const scriptData = document.currentScript.dataset;
const jsonPath = scriptData.jsonpath;

const g_PixelsPerMeter = 10.0;
const g_MetersPerPixel = 1.0 / g_PixelsPerMeter;

const g_PhysicsSteps = 60;
const g_Timestep = 1000 / g_PhysicsSteps;
const g_DeltaTime = g_Timestep / 1000;

planck.Settings.maxPolygonVertices = 24;

function p2mVec2(x, y)
{
  return new planck.Vec2(x, y).mul(g_MetersPerPixel);
}

function constructPolygon(vertexArray)
{
  var vectorArray = []

  for (var i = 0; i < vertexArray.length; i++)
  {
    vectorArray[i] = p2mVec2(vertexArray[i][0], vertexArray[i][1]);
  }

  return new planck.Polygon(vectorArray);
}

function constructCircle(vals)
{
  return new planck.Circle(p2mVec2(vals[0], vals[1]), vals[2] * g_MetersPerPixel)
}

function createShapesFromJson(jsonData)
{
  var shapeArray = [];

  for (var i = 0; i < jsonData.shapes.length; i++)
  {
    if (jsonData.shapes[i].type == "polygon")
    {
      shapeArray.push(constructPolygon(jsonData.shapes[i].points.map((pair, idx) => pair.map((v, vIdx) => v + jsonData.offset))));
    }
    else if (jsonData.shapes[i].type == "circle")
    {
      shapeArray.push(constructCircle(jsonData.shapes[i].points.map((v, idx) => v - jsonData.offset)));
    }
  }

  return shapeArray;
}

function angleBetween(vec1, vec2)
{
  var dotProd = (vec1.x * vec2.x) + (vec1.y * vec2.y);
  var determ = (vec1.x * vec2.y) - (vec1.y * vec2.x);

  var angle = ((2 * Math.PI) - Math.atan2(determ, dotProd)) % (2 * Math.PI);
  
  return angle;
}

class RNG 
{
  static n = 624;
  static m = 397;
  static w = 32;
  static r = 31;
  static UMASK = (0xffffffff << RNG.r);
  static LMASK = (0xffffffff >>> (RNG.w - RNG.r));
  static a = 0x9908b0df;
  static u = 11;
  static s = 7;
  static t = 15;
  static l = 18;
  static b = 0x9d2c5680;
  static c = 0xefc60000;
  static f = 1812433253;

  constructor (i_seed)
  {
    this.seed = i_seed;
    this.stateArray = Array(RNG.n);

    this.stateArray[0] = this.seed;
    for (var i = 1; i < RNG.n; i++)
    {
      this.seed = RNG.f * (this.seed ^ (this.seed >>> (RNG.w - 2))) + i;
      this.stateArray[i] = this.seed;
    }

    this.stateIndex = 0
    this.counter = 0;
  }

  randUInt()
  {
    var k = this.stateIndex;
    var j = k - (RNG.n - 1);
    if (j < 0) j += RNG.n;

    var x = (this.stateArray[k] & RNG.UMASK) | (this.stateArray[j] & RNG.LMASK);

    var xA = x >>> 1;
    if (x & 0x00000001) xA ^= RNG.a;

    j = k - (RNG.n - RNG.m);
    if (j < 0) j += RNG.n;

    x = this.stateArray[j] ^ xA;
    this.stateArray[k++] = x;

    if (k >= RNG.n) k = 0;
    this.stateIndex = k;

    var y = x ^ ( x >>> RNG.u);
        y = y ^ ((y << RNG.s) & RNG.b);
        y = y ^ ((y << RNG.t) & RNG.c);

    var z = y ^ (y >>> RNG.l);

    this.counter++;

    return (z >>> 0);
  }

  random()
  {
    return (this.randUInt() / (2 ** RNG.w));
  }

  randFloat(min, max)
  {
    return (max - min) * this.random() + min;
  }

  randInt(min, max)
  {
    return Math.floor(this.randFloat(min, max + 1));
  }

  randBool()
  {
    return (this.random() > 0.5);
  }

  choice(i_list)
  {
    return i_list[this.randInt(0, i_list.length - 1)];
  }

  sample(i_list, i_num = 1)
  {
    if (i_num < 1) return [];
    if (i_num == 1) return [ this.choice(i_list) ];

    i_num = Math.min(i_num, i_list.length);
    var listCopy = Array.from(i_list);
    var output = [];
    for (var i = 0; i < i_num; i++)
    {
      var idx = this.randInt(0, listCopy.length - 1)
      output.push(listCopy[idx]);
      listCopy.splice(idx, 1);
    }

    return output;
  }

  shuffle(i_list)
  {
    return this.sample(i_list, i_list.length);
  }
}

class GameObject
{
  constructor(i_name, i_game, i_texture, i_world, i_shapes, i_weight, i_bodyType = 'dynamic')
  {
    this.name = i_name;
    this.game = i_game;
    this.world = i_world;
    this.texture = i_texture;
    this.shapes = i_shapes;
    this.bodyType = i_bodyType;

    this.speed = 1;
    this.angle = 0;
    this.weight = i_weight;

    this.x = 0;
    this.y = 0;
  }
  
  spawn(i_x, i_y)
  {
    this.x = i_x;
    this.y = i_y;

    this.debug = new PIXI.Graphics();
    this.container = new PIXI.Container();

    this.body = this.world.createBody({
      type: this.bodyType,
      fixedRotation: true,
      position: { x: this.x * g_MetersPerPixel, y: this.y * g_MetersPerPixel},
      userData: this.getUserData(),
    });

    this.sprite  = new PIXI.Sprite({ texture: this.texture });
    this.sprite.anchor.set(0.5);

    for (var i = 0; i < this.shapes.length; i++)
    {
      this.body.createFixture(
        {
          shape: this.shapes[i],
          density: this.weight,
          friction: 0,
          restitution: 0.99,
        }
      );
    }

    this.container.pivot.set(this.container.width / 2, this.container.height / 2);
    this.container.x = this.x;
    this.container.y = this.y;
    this.container.addChild(this.sprite);
    this.game.spriteLayer.addChild(this.container);

    this.debug.x = this.container.x = this.x;
    this.debug.y = this.container.y = this.y;
    this.game.debugLayer.addChildAt(this.debug);
  }

  update(i_deltaTime)
  {

  }

  integrate(i_alpha)
  {
    this.debug.x = this.container.x = this.body.getPosition().x * g_PixelsPerMeter;
    this.debug.y = this.container.y = this.body.getPosition().y * g_PixelsPerMeter;
    this.container.rotation = this.body.getAngle();

    this.debug.clear();
    if (this.game.drawFixtures)
    {
      this.debug.lineStyle(1,0x00ff2a,1);
      for (var fixture = this.body.getFixtureList(); fixture; fixture = fixture.getNext())
      {
        if (fixture.getShape().getType() == "circle")
        {
          var r = fixture.getShape().m_radius;
          this.debug.drawCircle(fixture.getShape().m_p.x * g_PixelsPerMeter, fixture.getShape().m_p.y * g_PixelsPerMeter, r * g_PixelsPerMeter);
        }
        else if (fixture.getShape().getType() == "polygon")
        {
          var shape = fixture.getShape(); // we do make an assumption that there's just one fixture; keep this in mind if you add more.
          this.debug.moveTo(shape.m_vertices[0].x * g_PixelsPerMeter, shape.m_vertices[0].y * g_PixelsPerMeter);
          for(var v = 1; v < shape.m_vertices.length; v++) {
            this.debug.lineTo(shape.m_vertices[v].x * g_PixelsPerMeter, shape.m_vertices[v].y * g_PixelsPerMeter);
          }
          this.debug.lineTo(shape.m_vertices[0].x * g_PixelsPerMeter, shape.m_vertices[0].y * g_PixelsPerMeter);
        }

        this.debug.endFill();
      }
    }
  }

  destroy()
  {
    this.world.destroyBody(this.body);

    this.game.debugLayer.removeChild(this.debug);
    this.game.spriteLayer.removeChild(this.container);
  }

  objectType() { return "gameObject"; }
  getUserData() { return { name: this.name, objectType: this.objectType() }}
}

class Racer extends GameObject
{
  constructor(i_name, i_game, i_texture, i_world, i_shape, i_weight, i_baseSpeed, i_accel, i_maxSpeed, i_bodyType = 'dynamic')
  {
    super(i_name, i_game, i_texture, i_world, i_shape, i_weight, i_bodyType);

    this.baseSpeed = i_baseSpeed;
    this.accel = i_accel;
    this.maxSpeed = i_maxSpeed;
  }

  update(i_deltaTime)
  {
    super.update(i_deltaTime);

    var linVel = this.body.getLinearVelocity();

    if (linVel.length() < this.maxSpeed)
    {
      var angle = angleBetween(linVel, new planck.Vec2(1, 0));

      var speedIncrease = this.accel * i_deltaTime;
      var rot = new planck.Rot(angle);
      var accelVec = planck.Rot.mulVec2(rot, new planck.Vec2(speedIncrease, 0));

      var newVel = planck.Vec2.add(linVel, accelVec);

      if (newVel.length() > this.maxSpeed)
      {
        newVel = planck.Vec2.mul(planck.Vec2.normalize(newVel), this.maxSpeed);
      }

      this.body.setLinearVelocity(newVel);
    }

    this.body.m_userData.collided = false;
  }

  objectType() { return "racer"; }

  getUserData()
  {
    return {
      name: this.name,
      objectType: this.objectType(),
      baseSpeed: this.baseSpeed,
      acceleration: this.accel,
      collided: false,
    }
  }
}

class Goal extends GameObject
{
  objectType() { return "goal"; }
}

class Course {
  constructor(i_game, i_startingPoints, i_goalPoints, i_shapes, i_texture)
  {
    this.game = i_game;

    this.startingPoints = i_startingPoints;
    this.goalPoints = i_goalPoints;
    this.shapes = i_shapes;

    this.sprite = new PIXI.Sprite({
      texture: i_texture,
      anchor: 0,
    });
  }

  stage()
  {
    this.debug = new PIXI.Graphics();
    this.game.debugLayer.addChildAt(this.debug);

    this.sprite.x = 0;
    this.sprite.y = 0;
    this.sprite.scale.set(1);

    this.game.mapLayer.addChild(this.sprite);

    this.body = this.game.world.createBody({
      type: 'static',
      fixedRotation: true,
      position: { x: 0, y: 0},
      userData: { name: 'course', objectType: 'course' }
    });

    for (var i = 0; i < this.shapes.length; i++)
    {
      this.body.createFixture(
        {
          shape: this.shapes[i], 
          friction: 0,
          restitution: 0.99,
        }
      );
    }
  }

  integrate(i_alpha)
  {
    this.debug.clear();
    if (this.game.drawFixtures)
    {
      this.debug.x = 0;
      this.debug.y = 0;
      this.debug.lineStyle(1,0x00ff2a,1);
      for (var fixture = this.body.getFixtureList(); fixture; fixture = fixture.getNext())
      {
        if (fixture.getShape().getType() == "circle")
        {
          var r = fixture.getShape().m_radius;
          this.debug.drawCircle(fixture.getShape().m_p.x * g_PixelsPerMeter, fixture.getShape().m_p.y * g_PixelsPerMeter, r * g_PixelsPerMeter);
        }
        else if (fixture.getShape().getType() == "polygon")
        {
          var shape = fixture.getShape(); // we do make an assumption that there's just one fixture; keep this in mind if you add more.
          this.debug.moveTo(shape.m_vertices[0].x * g_PixelsPerMeter, shape.m_vertices[0].y * g_PixelsPerMeter);
          for(var v = 1; v < shape.m_vertices.length; v++) {
            this.debug.lineTo(shape.m_vertices[v].x * g_PixelsPerMeter, shape.m_vertices[v].y * g_PixelsPerMeter);
          }
          this.debug.lineTo(shape.m_vertices[0].x * g_PixelsPerMeter, shape.m_vertices[0].y * g_PixelsPerMeter);
        }

        this.debug.endFill();
      }
    }
  }

  destroy()
  {
    this.game.world.destroyBody(this.body);

    this.game.debugLayer.removeChild(this.debug);
    this.game.spriteLayer.removeChild(this.sprite);
  }
}

class HorseGame
{
  constructor(i_seed, i_numRacers = 4)
  {
    this.seed = i_seed;
    this.rng = new RNG(this.seed);

    this.app = new PIXI.Application();

    this.mapLayer = new PIXI.Container();
    this.app.stage.addChild(this.mapLayer);

    this.spriteLayer = new PIXI.Container();
    this.app.stage.addChild(this.spriteLayer);

    this.debugLayer = new PIXI.Container();
    this.app.stage.addChild(this.debugLayer);

    this.uiLayer = new PIXI.Container();
    this.app.stage.addChild(this.uiLayer);

    this.boundaryGraphics = new PIXI.Graphics();
    this.debugLayer.addChild(this.boundaryGraphics);

    this.countdownText = new PIXI.HTMLText({ text: 'Race begins in: \n10 seconds', style: { fill: '#FFFFFF', stroke: { color: '#000000', width: 6 }, fontFamily: 'Arial', fontSize: 72, align: 'center' } });
    this.countdownText.anchor.x = 0.5;
    this.countdownText.anchor.y = 0.5;
    this.uiLayer.addChild(this.countdownText);

    this.winText = new PIXI.HTMLText({ text: '', style: { fill: '#FFFFFF', stroke: { color: '#000000', width: 6 }, fontFamily: 'Arial', fontSize: 72, align: 'center' } });
    this.winText.anchor.x = 0.5;
    this.winText.anchor.y = 0.5;
    this.uiLayer.addChild(this.winText);

    this.world = planck.World({ gravity: planck.Vec2(0, 0) });
    this.world.on('post-solve', this.handleContact.bind(this));

    this.gameTime = 0;
    this.frameCounter = 0;
    this.countdown = 10;
    this.lastTime = undefined;
    this.accumulator = 0;

    this.paused = true;
    this.completed = false;
    this.winner = undefined;
    this.drawFixtures = false;
    this.numRacers = i_numRacers;

    this.randomizeBounces = true;
    this.contactList = [];

    this.collisionList = [];
  }

  async preload()
  {
    await fetch(jsonPath).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    }).then(data => {
      this.shapeData = data;
    });

    const assets = [
      { alias: "red",     src: "/static/overlay/sprites/red.png", },
      { alias: "orange",  src: "/static/overlay/sprites/orange.png", },
      { alias: "yellow",  src: "/static/overlay/sprites/yellow.png", },
      { alias: "green",   src: "/static/overlay/sprites/green.png", },
      { alias: "cyan",    src: "/static/overlay/sprites/cyan.png", },
      { alias: "blue",    src: "/static/overlay/sprites/blue.png", },
      { alias: "purple",  src: "/static/overlay/sprites/purple.png", },
      { alias: "pink",    src: "/static/overlay/sprites/pink.png", },
      { alias: "rainbow", src: "/static/overlay/sprites/rainbow.png", },
      
      { alias: "glorp",  src: "/static/overlay/sprites/glorp.png", },
      { alias: "garf",   src: "/static/overlay/sprites/garf.png", },

      { alias: "goal",   src: "/static/overlay/sprites/goal.png", },

      { alias: "map1",   src: "/static/overlay/sprites/map1.png", },
      { alias: "map2",   src: "/static/overlay/sprites/map2.png", },
      { alias: "map3",   src: "/static/overlay/sprites/map3.png", },
    ]
    this.assets = await PIXI.Assets.load(assets);

    var horseShapes = createShapesFromJson(this.shapeData["horse"]);
    this.racers = [
      new Racer("red",     this, this.assets["red"],     this.world, horseShapes, 10, 15.0, 17.50, 50.0),
      new Racer("orange",  this, this.assets["orange"],  this.world, horseShapes, 10, 15.0, 20.00, 45.0),
      new Racer("yellow",  this, this.assets["yellow"],  this.world, horseShapes, 10, 15.0, 15.00, 60.0),
      new Racer("green",   this, this.assets["green"],   this.world, horseShapes, 10, 15.0, 12.50, 65.0),
      new Racer("cyan",    this, this.assets["cyan"],    this.world, horseShapes, 10, 15.0, 25.00, 40.0),
      new Racer("blue",    this, this.assets["blue"],    this.world, horseShapes, 10, 15.0, 12.50, 65.0),
      new Racer("purple",  this, this.assets["purple"],  this.world, horseShapes, 10, 15.0, 10.00, 75.0),
      new Racer("pink",    this, this.assets["pink"],    this.world, horseShapes, 10, 10.0, 25.00, 60.0),
      new Racer("rainbow", this, this.assets["rainbow"], this.world, horseShapes, 10, 25.0,  5.00, 35.0),
    ];

    this.glorp = new Racer("glorp",  this, this.assets["glorp"],  this.world, createShapesFromJson(this.shapeData["glorp"]), 10, 15.0, 12.50, 65.0);
    this.garf  = new Racer("garf",   this, this.assets["garf"],   this.world, createShapesFromJson(this.shapeData["garf"]),  10, 15.0, 22.50, 45.0);

    this.goal = new Goal("goal", this, this.assets["goal"], this.world, createShapesFromJson(this.shapeData["goal"]), 0, 'static');

    this.maps = [ 
      new Course(this, this.shapeData["map1"]["spawn_points"], this.shapeData["map1"]["goal_points"], createShapesFromJson(this.shapeData["map1"]), this.assets["map1"]),
      new Course(this, this.shapeData["map2"]["spawn_points"], this.shapeData["map2"]["goal_points"], createShapesFromJson(this.shapeData["map2"]), this.assets['map2']),
      new Course(this, this.shapeData["map3"]["spawn_points"], this.shapeData["map3"]["goal_points"], createShapesFromJson(this.shapeData["map3"]), this.assets['map3']),
    ];
  }

  async setup()
  {
    await this.app.init({ background: "#FFF", width: 1280, height: 720, autoStart: false });

    this.countdownText.x = this.winText.x = this.app.screen.width / 2;
    this.countdownText.y = this.winText.y = this.app.screen.height / 2;

    await this.preload();

    let w = this.app.screen.width * g_MetersPerPixel;
    let h = this.app.screen.height * g_MetersPerPixel;

    this.ground = this.world.createBody({ userData: { name: 'boundary', objectType: 'boundary' }});

    this.ground.createFixture(planck.Edge(planck.Vec2(0, 0), planck.Vec2(w, 0)));
    this.ground.createFixture(planck.Edge(planck.Vec2(w, 0), planck.Vec2(w, h)));
    this.ground.createFixture(planck.Edge(planck.Vec2(w, h), planck.Vec2(0, h)));
    this.ground.createFixture(planck.Edge(planck.Vec2(0, h), planck.Vec2(0, 0)));

    this.populate()

    requestAnimationFrame(this.step.bind(this));
  }

  populate()
  {
    this.map = this.rng.choice(this.maps);
    this.map.stage();

    var goalLoc = this.rng.choice(this.map.goalPoints);
    this.goal.spawn(goalLoc[0], goalLoc[1]);

    this.activeRacers = []

    this.spawnRacers(this.numRacers);
  }

  reset()
  {
    this.map.destroy();
    this.map = undefined;

    this.activeRacers.forEach((racer, idx) => racer.destroy());
    this.activeRacers = [];

    this.goal.destroy();

    this.gameTime = 0;
    this.frameCounter = 0;
    this.lastTime = undefined;
    this.accumulator = 0;

    this.countdown = 10;
    this.paused = true;
    this.completed = false;
    this.winner = undefined;

    this.collisionList = [];

    this.setSeed(this.seed);

    this.rng = new RNG(this.seed);
    this.populate();
  }

  start()
  {
    this.paused = false;
  }

  setSeed(i_seed)
  {
    this.seed = i_seed;
  }

  setRacerCount(i_count)
  {
    this.numRacers = i_count;
  }

  spawnRacers(i_numRacers)
  {
    this.activeRacers = this.rng.sample(this.racers, i_numRacers);
    var startingPoints = this.rng.sample(this.map.startingPoints, i_numRacers);

    for (var i = 0; i < i_numRacers; i++)
    {
      if (this.activeRacers[i].name == "green" && this.rng.random() < 0.05)
      {
        this.activeRacers[i] = this.glorp;
      }
      if (this.activeRacers[i].name == "orange" && this.rng.random() < 0.25)
      {
        this.activeRacers[i] = this.garf;
      }
      this.activeRacers[i].spawn(startingPoints[i][0], startingPoints[i][1]);

      var linVel = new planck.Vec2(this.activeRacers[i].baseSpeed, 0);
      var angle = new planck.Rot(startingPoints[i][2] * Math.PI / 180.0);

      linVel = planck.Rot.mulVec2(angle, linVel);
      this.activeRacers[i].body.setLinearVelocity(linVel);
    }
  }

  step(t)
  {
    // while(!this.completed)
    // {
    //   for (let i = 0; i < this.activeRacers.length; i++)
    //   {
    //     this.activeRacers[i].update(g_DeltaTime);
    //   }

    //   this.goal.update(g_DeltaTime);

    //   this.world.step(g_DeltaTime, 32, 12);
    //   this.gameTime += g_Timestep;
    //   this.frameCounter += 1;

    //   this.handleContacts();
    // }

    // this.reset();
    // setTimeout(() => this.step(0), 100);

    requestAnimationFrame(this.step.bind(this));
    
    if (this.lastTime !== undefined)
    {
      var frameTime = t - this.lastTime;
      this.lastTime = t;

      if (this.paused || this.completed)
      {
        this.render(0);
        return;
      }

      if (this.countdown > 0)
      {
        this.countdown -= (frameTime / 1000);
        this.render(0);
        return;
      }

      this.accumulator += frameTime;

      while (this.accumulator >= g_Timestep)
      {
        for (let i = 0; i < this.activeRacers.length; i++)
        {
          this.activeRacers[i].update(g_DeltaTime);
        }

        this.goal.update(g_DeltaTime);

        this.world.step(g_DeltaTime, 16, 6);

        this.handleContacts();

        this.gameTime += g_Timestep;
        this.accumulator -= g_Timestep;
        this.frameCounter += 1;
      }

      this.render(this.accumulator / g_Timestep);
    }

    this.lastTime = t;
  }

  render(i_alpha)
  {
    this.map.integrate(i_alpha);

    for (let i = 0; i < this.activeRacers.length; i++)
    {
      this.activeRacers[i].integrate(i_alpha);
    }

    this.goal.integrate(i_alpha);

    if (this.countdown >= 10.0)
    {
      this.countdownText.text = "Race starting soon..."
    }
    else if (this.countdown > 0)
    {
      this.countdownText.text = "Race begins in: \n" + this.countdown.toFixed(0) + " seconds";
    }
    else
    {
      this.countdownText.text = '';
    }

    if (this.completed)
    {
      this.winText.text = this.winner.getUserData().name + " wins!";
    }
    else
    {
      this.winText.text = '';
    }

    this.app.renderer.render(this.app.stage);
  }

  addCanvas(element)
  {
    element.html(this.app.canvas);
  }

  deflectRacer(i_racerBody)
  {
    var linVel = i_racerBody.getLinearVelocity();
    
    if (this.randomizeBounces)
    {
      var maxDeflection = 60.0 * Math.PI / 180.0;
      var def1 = this.rng.randFloat(0, maxDeflection);
      var def2 = this.rng.randFloat(0, maxDeflection);
      var def3 = this.rng.randFloat(0, maxDeflection);
      var def4 = this.rng.randFloat(0, maxDeflection);
      var def5 = this.rng.randFloat(0, maxDeflection);

      var deflection = Math.min(def1, def2, def3, def4, def5);
      deflection = (this.rng.randBool()) ? deflection : -deflection;

      var rot = new planck.Rot(deflection);
      var newLinearVel = planck.Rot.mulVec2(rot, linVel);
    }
    else
    {
      var deflection = 0;
      var newLinearVel = linVel;
    }
    
    newLinearVel = planck.Vec2.normalize(newLinearVel);
    newLinearVel = planck.Vec2.mul(newLinearVel, i_racerBody.getUserData().baseSpeed);

    i_racerBody.setLinearVelocity(newLinearVel);

    return deflection;
  }

  handleContacts()
  {
    this.contactList.sort((a, b) => a.getUserData().name.localeCompare(b.getUserData().name));

    var racerList = [];
    for (var i = this.contactList.length - 1; i >= 0; i--)
    {
      var racerBody = this.contactList[i];
      
      var defl = this.deflectRacer(racerBody);

      racerList.push(racerBody.getUserData().name);
      racerList.push(this.gameTime);
    
      this.contactList.pop();
    }

    if (racerList.length > 0) this.collisionList.push(racerList);
  }

  handleContact(i_contact, i_impulse)
  {
    var fA = i_contact.getFixtureA(), bA = fA.getBody();
    var fB = i_contact.getFixtureB(), bB = fB.getBody();

    var objectTypeA = bA.getUserData().objectType;
    var objectTypeB = bB.getUserData().objectType;

    if ((objectTypeA == 'goal' || objectTypeB == 'goal') && (objectTypeA == 'racer' || objectTypeB == 'racer'))
    {
      var racerBody = (objectTypeA == 'racer') ? bA : bB;

      this.winner = racerBody;
      this.completed = true;

      console.log("RNG Counter: " + this.rng.counter + ", Winner: " + racerBody.getUserData().name + " @ " + racerBody.getLinearVelocity().x + ", " + racerBody.getLinearVelocity().y + " in " + this.frameCounter + " frames (" + (this.frameCounter * g_DeltaTime) + " seconds)");
    }

    if (objectTypeA == 'racer' && !this.contactList.includes(bA))
    {
      this.contactList.push(bA);
    }
    if (objectTypeB == 'racer' && !this.contactList.includes(bB))
    {
      this.contactList.push(bB);
    }
  }
}