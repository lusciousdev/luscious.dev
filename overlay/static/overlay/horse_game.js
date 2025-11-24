const scriptData = document.currentScript.dataset;
const dataPath = scriptData.datapath;
const extrasPath = scriptData.extraspath;

const dataVersion = scriptData.version;
const versionAddendum = "?v=" + dataVersion;

const g_PixelsPerMeter = 10.0;
const g_MetersPerPixel = 1.0 / g_PixelsPerMeter;

const g_PhysicsSteps = 60;
const g_Timestep = 1000 / g_PhysicsSteps;
const g_DeltaTime = g_Timestep / 1000;

planck.Settings.maxPolygonVertices = 24;

PIXI.sound.disableAutoPause = true;

function p2mVec2(x, y) {
  return new planck.Vec2(x, y).mul(g_MetersPerPixel);
}

function constructPolygon(vertexArray) {
  var vectorArray = [];

  for (var i = 0; i < vertexArray.length; i++) {
    vectorArray[i] = p2mVec2(vertexArray[i][0], vertexArray[i][1]);
  }

  return new planck.Polygon(vectorArray);
}

function constructCircle(vals) {
  return new planck.Circle(
    p2mVec2(vals[0], vals[1]),
    vals[2] * g_MetersPerPixel,
  );
}

function createShapesFromJson(jsonData) {
  var shapeArray = [];

  for (var i = 0; i < jsonData.fixtures.length; i++) {
    if (jsonData.fixtures[i].type == "polygon") {
      shapeArray.push(
        constructPolygon(
          jsonData.fixtures[i].points.map((pair, idx) =>
            pair.map((v, vIdx) => v + jsonData.offset),
          ),
        ),
      );
    } else if (jsonData.fixtures[i].type == "circle") {
      var fix = jsonData.fixtures[i];
      shapeArray.push(
        constructCircle([
          fix.points[0] + jsonData.offset,
          fix.points[1] + jsonData.offset,
          fix.points[2],
        ]),
      );
    }
  }

  return shapeArray;
}

function angleBetween(vec1, vec2) {
  var dotProd = vec1.x * vec2.x + vec1.y * vec2.y;
  var determ = vec1.x * vec2.y - vec1.y * vec2.x;

  var angle = (2 * Math.PI - Math.atan2(determ, dotProd)) % (2 * Math.PI);

  return angle;
}

class RNG {
  static n = 624;
  static m = 397;
  static w = 32;
  static r = 31;
  static UMASK = 0xffffffff << RNG.r;
  static LMASK = 0xffffffff >>> (RNG.w - RNG.r);
  static a = 0x9908b0df;
  static u = 11;
  static s = 7;
  static t = 15;
  static l = 18;
  static b = 0x9d2c5680;
  static c = 0xefc60000;
  static f = 1812433253;

  constructor(i_seed) {
    this.seed = i_seed;
    this.stateArray = Array(RNG.n);

    this.stateArray[0] = this.seed;
    for (var i = 1; i < RNG.n; i++) {
      this.seed = RNG.f * (this.seed ^ (this.seed >>> (RNG.w - 2))) + i;
      this.stateArray[i] = this.seed;
    }

    this.stateIndex = 0;
    this.counter = 0;
  }

  randUInt() {
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

    var y = x ^ (x >>> RNG.u);
    y = y ^ ((y << RNG.s) & RNG.b);
    y = y ^ ((y << RNG.t) & RNG.c);

    var z = y ^ (y >>> RNG.l);

    this.counter++;

    return z >>> 0;
  }

  random() {
    return this.randUInt() / 2 ** RNG.w;
  }

  randFloat(min, max) {
    return (max - min) * this.random() + min;
  }

  randInt(min, max) {
    return Math.floor(this.randFloat(min, max + 1));
  }

  randBool() {
    return this.random() > 0.5;
  }

  choice(i_list) {
    return i_list[this.randInt(0, i_list.length - 1)];
  }

  sample(i_list, i_num = 1) {
    if (i_num < 1) return [];
    if (i_num == 1) return [this.choice(i_list)];

    i_num = Math.min(i_num, i_list.length);
    var listCopy = Array.from(i_list);
    var output = [];
    for (var i = 0; i < i_num; i++) {
      var idx = this.randInt(0, listCopy.length - 1);
      output.push(listCopy[idx]);
      listCopy.splice(idx, 1);
    }

    return output;
  }

  shuffle(i_list) {
    return this.sample(i_list, i_list.length);
  }
}

class GameObject {
  constructor(
    i_name,
    i_game,
    i_texture,
    i_world,
    i_shapes,
    i_weight,
    i_bodyType = "dynamic",
  ) {
    this.name = i_name;
    this.game = i_game;
    this.world = i_world;
    this.texture = i_texture;
    this.shapes = i_shapes;
    this.bodyType = i_bodyType;

    this.speed = 1;
    this.angle = 0;
    this.weight = i_weight;
    this.anchor = 0.5;

    this.body = undefined;
    this.debug = undefined;
    this.container = undefined;

    this.x = 0;
    this.y = 0;
  }

  spawn(i_x, i_y) {
    this.x = i_x;
    this.y = i_y;

    this.debug = new PIXI.Graphics();
    this.container = new PIXI.Container();

    this.body = this.world.createBody({
      type: this.bodyType,
      fixedRotation: true,
      position: { x: this.x * g_MetersPerPixel, y: this.y * g_MetersPerPixel },
      userData: this.getUserData(),
    });

    this.sprite = new PIXI.Sprite({ texture: this.texture });
    this.sprite.anchor.set(this.anchor);

    for (var i = 0; i < this.shapes.length; i++) {
      this.body.createFixture({
        shape: this.shapes[i],
        density: this.weight,
        friction: 0,
        restitution: 0.99,
      });
    }

    this.container.pivot.set(
      this.container.width / 2,
      this.container.height / 2,
    );
    this.container.x = this.x;
    this.container.y = this.y;
    this.container.addChild(this.sprite);
    this.game.spriteLayer.addChild(this.container);

    this.debug.x = this.container.x = this.x;
    this.debug.y = this.container.y = this.y;
    this.game.debugLayer.addChildAt(this.debug);
  }

  update(i_deltaTime) {}

  integrate(i_alpha) {
    this.debug.x = this.container.x =
      this.body.getPosition().x * g_PixelsPerMeter;
    this.debug.y = this.container.y =
      this.body.getPosition().y * g_PixelsPerMeter;
    this.container.rotation = this.body.getAngle();

    this.debug.clear();
    if (this.game.drawFixtures) {
      this.debug.lineStyle(1, 0x00ff2a, 1);
      for (
        var fixture = this.body.getFixtureList();
        fixture;
        fixture = fixture.getNext()
      ) {
        if (fixture.getShape().getType() == "circle") {
          var r = fixture.getShape().m_radius;
          this.debug.drawCircle(
            fixture.getShape().m_p.x * g_PixelsPerMeter,
            fixture.getShape().m_p.y * g_PixelsPerMeter,
            r * g_PixelsPerMeter,
          );
        } else if (fixture.getShape().getType() == "polygon") {
          var shape = fixture.getShape(); // we do make an assumption that there's just one fixture; keep this in mind if you add more.
          this.debug.moveTo(
            shape.m_vertices[0].x * g_PixelsPerMeter,
            shape.m_vertices[0].y * g_PixelsPerMeter,
          );
          for (var v = 1; v < shape.m_vertices.length; v++) {
            this.debug.lineTo(
              shape.m_vertices[v].x * g_PixelsPerMeter,
              shape.m_vertices[v].y * g_PixelsPerMeter,
            );
          }
          this.debug.lineTo(
            shape.m_vertices[0].x * g_PixelsPerMeter,
            shape.m_vertices[0].y * g_PixelsPerMeter,
          );
        }

        this.debug.endFill();
      }
    }
  }

  destroy() {
    if (this.body !== undefined)
    {
      this.world.destroyBody(this.body);
      this.body = undefined;
    }

    if (this.debug !== undefined)
    {
      this.game.debugLayer.removeChild(this.debug);
      this.debug = undefined;
    }

    if (this.container !== undefined)
    {
      this.game.spriteLayer.removeChild(this.container);
      this.container = undefined;
    }
  }

  objectType() {
    return "gameObject";
  }
  getUserData() {
    return { name: this.name, objectType: this.objectType() };
  }
}

class Racer extends GameObject {
  constructor(
    i_name,
    i_game,
    i_texture,
    i_world,
    i_shape,
    i_weight,
    i_baseSpeed,
    i_accel,
    i_maxSpeed,
    i_bodyType = "dynamic",
  ) {
    super(i_name, i_game, i_texture, i_world, i_shape, i_weight, i_bodyType);

    this.baseSpeed = i_baseSpeed;
    this.accel = i_accel;
    this.maxSpeed = i_maxSpeed;
  }

  update(i_deltaTime) {
    super.update(i_deltaTime);

    var linVel = this.body.getLinearVelocity();

    if (linVel.length() < this.maxSpeed) {
      var angle = angleBetween(linVel, new planck.Vec2(1, 0));

      var speedIncrease = this.accel * i_deltaTime;
      var rot = new planck.Rot(angle);
      var accelVec = planck.Rot.mulVec2(rot, new planck.Vec2(speedIncrease, 0));

      var newVel = planck.Vec2.add(linVel, accelVec);

      if (newVel.length() > this.maxSpeed) {
        newVel = planck.Vec2.mul(planck.Vec2.normalize(newVel), this.maxSpeed);
      }

      this.body.setLinearVelocity(newVel);
    }

    this.body.m_userData.collided = false;
  }

  objectType() {
    return "racer";
  }

  getUserData() {
    return {
      name: this.name,
      objectType: this.objectType(),
      baseSpeed: this.baseSpeed,
      acceleration: this.accel,
      collided: false,
    };
  }
}

class Goal extends GameObject {
  objectType() {
    return "goal";
  }
}

class Course {
  constructor(
    i_game,
    i_startingPoints,
    i_goalPoints,
    i_shapes,
    i_texture,
    i_playDuringCountdown = false,
    i_barrierDuringCountdown = false,
    i_barrierLocation = [0, 0],
  ) {
    this.game = i_game;

    this.startingPoints = i_startingPoints;
    this.goalPoints = i_goalPoints;
    this.shapes = i_shapes;

    this.playDuringCountdown = i_playDuringCountdown;
    this.barrierDuringCountdown = i_barrierDuringCountdown;
    this.barrierLocation = i_barrierLocation;

    this.sprite = new PIXI.Sprite({
      texture: i_texture,
      anchor: 0,
    });
  }

  stage() {
    this.debug = new PIXI.Graphics();
    this.game.debugLayer.addChildAt(this.debug);

    this.sprite.x = 0;
    this.sprite.y = 0;
    this.sprite.scale.set(1);

    this.game.mapLayer.addChild(this.sprite);

    this.body = this.game.world.createBody({
      type: "static",
      fixedRotation: true,
      position: { x: 0, y: 0 },
      userData: { name: "course", objectType: "course" },
    });

    for (var i = 0; i < this.shapes.length; i++) {
      this.body.createFixture({
        shape: this.shapes[i],
        friction: 0,
        restitution: 0.99,
      });
    }
  }

  integrate(i_alpha) {
    this.debug.clear();
    if (this.game.drawFixtures) {
      this.debug.x = 0;
      this.debug.y = 0;
      this.debug.lineStyle(1, 0x00ff2a, 1);
      for (
        var fixture = this.body.getFixtureList();
        fixture;
        fixture = fixture.getNext()
      ) {
        if (fixture.getShape().getType() == "circle") {
          var r = fixture.getShape().m_radius;
          this.debug.drawCircle(
            fixture.getShape().m_p.x * g_PixelsPerMeter,
            fixture.getShape().m_p.y * g_PixelsPerMeter,
            r * g_PixelsPerMeter,
          );
        } else if (fixture.getShape().getType() == "polygon") {
          var shape = fixture.getShape(); // we do make an assumption that there's just one fixture; keep this in mind if you add more.
          this.debug.moveTo(
            shape.m_vertices[0].x * g_PixelsPerMeter,
            shape.m_vertices[0].y * g_PixelsPerMeter,
          );
          for (var v = 1; v < shape.m_vertices.length; v++) {
            this.debug.lineTo(
              shape.m_vertices[v].x * g_PixelsPerMeter,
              shape.m_vertices[v].y * g_PixelsPerMeter,
            );
          }
          this.debug.lineTo(
            shape.m_vertices[0].x * g_PixelsPerMeter,
            shape.m_vertices[0].y * g_PixelsPerMeter,
          );
        }

        this.debug.endFill();
      }
    }
  }

  destroy() {
    this.game.world.destroyBody(this.body);

    this.game.debugLayer.removeChild(this.debug);
    this.game.spriteLayer.removeChild(this.sprite);
  }
}

class HorseGame {
  constructor(i_seed, i_numRacers = 4, i_editWarning = false) {
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

    this.celebrationLayer = new PIXI.Container();
    this.uiLayer.addChild(this.celebrationLayer);

    this.countdownText = new PIXI.HTMLText({
      text: "Race begins in: \n10 seconds",
      style: {
        fill: "#FFFFFF",
        stroke: { color: "#000000", width: 9 },
        fontFamily: "Arial",
        fontSize: 96,
        align: "center",
      },
    });
    this.countdownText.anchor.x = 0.5;
    this.countdownText.anchor.y = 0.5;
    this.uiLayer.addChild(this.countdownText);

    this.winText = new PIXI.HTMLText({
      text: "",
      style: {
        fill: "#FFFFFF",
        stroke: { color: "#000000", width: 12 },
        fontFamily: "Arial",
        fontSize: 108,
        align: "center",
      },
    });
    this.winText.anchor.x = 0.5;
    this.winText.anchor.y = 0.5;
    this.uiLayer.addChild(this.winText);

    this.world = planck.World({ gravity: planck.Vec2(0, 0) });
    this.world.on("pre-solve", this.handleContact.bind(this));

    this.gameTime = 0;
    this.frameCounter = 0;
    this.countdown = 10;
    this.lastTime = undefined;
    this.accumulator = 0;
    this.renderFrames = true;

    this.paused = true;
    this.completed = false;
    this.winner = undefined;
    this.drawFixtures = false;
    this.numRacers = i_numRacers;

    this.randomizeBounces = true;
    this.contactList = [];

    this.editWarning = i_editWarning;

    this.collisionList = [];

    this.randomMap = true;
    this.selectedMap = 0;

    this.volume = 1.0;
    this.gallopVolume = 1.0;
  }

  async preload() {
    await fetch(dataPath + versionAddendum)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        this.itemData = data;
      });

    await fetch(extrasPath + versionAddendum)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        this.extrasData = data;
      });

    var assets = [];
    var shapes = {};
    for (const [itemType, typeData] of Object.entries(this.itemData)) {
      shapes[itemType] = {};

      for (const [itemKey, itemValue] of Object.entries(typeData["items"])) {
        assets.push({
          alias: itemType + "/" + itemKey,
          src: "/static/overlay/horse/" + itemValue["sprite"] + versionAddendum,
        });
      }

      for (const [itemKey, shapeData] of Object.entries(typeData["shapes"])) {
        shapes[itemType][itemKey] = createShapesFromJson(shapeData);
      }
    }

    for (const [imageKey, imageFile] of Object.entries(
      this.extrasData.images,
    )) {
      assets.push({
        alias: "images/" + imageKey,
        src: "/static/overlay/horse/" + imageFile + versionAddendum,
      });
    }

    this.assets = await PIXI.Assets.load(assets);

    this.racers = [];
    this.specialRacers = {};
    for (const [racerKey, racerData] of Object.entries(
      this.itemData["racers"]["items"],
    )) {
      var shapeKey = racerData["shape"];
      var racer = new Racer(
        racerKey,
        this,
        this.assets["racers/" + racerKey],
        this.world,
        shapes["racers"][shapeKey],
        racerData["weight"],
        racerData["baseSpeed"],
        racerData["acceleration"],
        racerData["maxSpeed"],
      );

      if (!racerData["special"]) {
        this.racers.push(racer);
      } else {
        this.specialRacers[racerKey] = racer;
      }
    }

    this.goals = [];
    this.specialGoals = {};
    for (const [goalKey, goalData] of Object.entries(
      this.itemData["goals"]["items"],
    )) {
      var shapeKey = goalData["shape"];
      var goal = new Goal(
        goalKey,
        this,
        this.assets["goals/" + goalKey],
        this.world,
        shapes["goals"][shapeKey],
        0,
        "static",
      );

      if (!goalData["special"]) {
        this.goals.push(goal);
      } else {
        this.specialGoals[goalKey] = goal;
      }
    }

    this.misc = {};
    for (const [miscKey, miscData] of Object.entries(
      this.itemData["misc"]["items"],
    )) {
      var shapeKey = miscData["shape"];

      var miscItem = new GameObject(
        miscKey,
        this,
        this.assets["misc/" + miscKey],
        this.world,
        shapes["misc"][shapeKey],
        0,
        "static",
      );
      miscItem.anchor = 0;

      this.misc[miscKey] = miscItem;
    }

    this.maps = [];
    this.specialMaps = {};
    for (const [mapKey, mapData] of Object.entries(
      this.itemData["maps"]["items"],
    )) {
      var shapeKey = mapData["shape"];
      var course = new Course(
        this,
        mapData["spawnPoints"],
        mapData["goalPoints"],
        shapes["maps"][shapeKey],
        this.assets["maps/" + mapKey],
        mapData["playDuringCountdown"],
        mapData["barrierDuringCountdown"],
        mapData["barrierLocation"],
      );

      if (!mapData["special"]) {
        this.maps.push(course);
      } else {
        this.specialMaps[mapKey] = course;
      }
    }

    var w = this.app.screen.width;
    var h = this.app.screen.height;
    this.fireworks1 = new PIXI.GifSprite({
      source: this.assets["images/fireworks1"],
      anchor: 0.5,
      x: 0.25 * w,
      y: 0.25 * h,
      scale: 1.0,
    });
    this.fireworks2 = new PIXI.GifSprite({
      source: this.assets["images/fireworks2"],
      anchor: 0.5,
      x: 0.75 * w,
      y: 0.25 * h,
      scale: 2.0,
    });
    this.fireworks3 = new PIXI.GifSprite({
      source: this.assets["images/fireworks3"],
      anchor: 0.5,
      x: 0.75 * w,
      y: 0.75 * h,
      scale: 1.0,
    });
    this.fireworks4 = new PIXI.GifSprite({
      source: this.assets["images/fireworks4"],
      anchor: 0.5,
      x: 0.25 * w,
      y: 0.75 * h,
      scale: 2.0,
    });
    this.horseGif = new PIXI.GifSprite({
      source: this.assets["images/horse"],
      anchor: 0.5,
      x: 0.5 * w,
      y: 0.3 * h,
      scale: 3.0,
    });
    this.soundEffects = {};
    for (const [soundKey, soundFile] of Object.entries(
      this.extrasData.sounds,
    )) {
      if (typeof soundFile === "string") {
        this.soundEffects[soundKey] = PIXI.sound.Sound.from({
          url: "/static/overlay/horse/" + soundFile + versionAddendum,
          preload: true,
        });
      } else if (Array.isArray(soundFile)) {
        this.soundEffects[soundKey] = [];
        soundFile.forEach((v, i) =>
          this.soundEffects[soundKey].push(
            PIXI.sound.Sound.from({
              url: "/static/overlay/horse/" + v + versionAddendum,
              preload: true,
            }),
          ),
        );
      }
    }
  }

  async setup() {
    await this.app.init({
      background: "#FFF",
      width: 1280,
      height: 720,
      autoStart: false,
    });

    this.countdownText.x = this.winText.x = this.app.screen.width / 2;
    this.countdownText.y = this.winText.y = this.app.screen.height / 2;

    await this.preload();

    let w = this.app.screen.width * g_MetersPerPixel;
    let h = this.app.screen.height * g_MetersPerPixel;

    this.ground = this.world.createBody({
      userData: { name: "boundary", objectType: "boundary" },
    });

    this.ground.createFixture(
      planck.Edge(planck.Vec2(0, 0), planck.Vec2(w, 0)),
    );
    this.ground.createFixture(
      planck.Edge(planck.Vec2(w, 0), planck.Vec2(w, h)),
    );
    this.ground.createFixture(
      planck.Edge(planck.Vec2(w, h), planck.Vec2(0, h)),
    );
    this.ground.createFixture(
      planck.Edge(planck.Vec2(0, h), planck.Vec2(0, 0)),
    );

    this.populate();

    requestAnimationFrame(this.step.bind(this));
  }

  populate() {
    if (this.randomMap) {
      this.map = this.rng.choice(this.maps);
    } else {
      this.map = this.maps[this.selectedMap];
    }

    this.map.stage();
    this.goal = this.rng.choice(this.goals);

    if (this.map.barrierDuringCountdown) {
      this.misc.barrier.spawn(
        this.map.barrierLocation[0],
        this.map.barrierLocation[1],
      );
    }

    var goalLoc = this.rng.choice(this.map.goalPoints);
    this.goal.spawn(goalLoc[0], goalLoc[1]);

    this.activeRacers = [];

    this.spawnRacers(this.numRacers);
  }

  reset() {
    this.celebrationLayer.removeChildren();

    this.map.destroy();
    this.map = undefined;

    this.activeRacers.forEach((racer, idx) => racer.destroy());
    this.activeRacers = [];

    this.goal.destroy();

    for (const [miscKey, miscItem] of Object.entries(this.misc))
    {
      this.misc[miscKey].destroy();
    }

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

  togglePause() {
    if (this.paused) this.play();
    else this.pause();
  }

  play() {
    if (this.paused) {
      this.paused = false;
      PIXI.sound.resumeAll();
    }
  }

  pause() {
    if (!this.paused) {
      this.paused = true;
      PIXI.sound.pauseAll();
    }
  }

  setVolume(i_volume) {
    this.volume = i_volume;

    for (const [soundKey, sounds] of Object.entries(this.soundEffects)) {
      var newVolume = this.volume;
      if (soundKey == "gallops") newVolume *= this.gallopVolume;

      if (Array.isArray(sounds))
        this.soundEffects[soundKey].forEach((v, i) => (v.volume = newVolume));
      else this.soundEffects[soundKey].volume = newVolume;
    }
  }

  setGallopVolume(i_volume) {
    this.gallopVolume = i_volume;

    this.soundEffects["gallops"].forEach(
      (v, i) => (v.volume = this.volume * this.gallopVolume),
    );
  }

  setSeed(i_seed) {
    this.seed = i_seed;
  }

  setRacerCount(i_count) {
    this.numRacers = i_count;
  }

  spawnRacers(i_numRacers) {
    this.activeRacers = this.rng.sample(this.racers, i_numRacers);
    var startingPoints = this.rng.sample(this.map.startingPoints, i_numRacers);

    for (var i = 0; i < i_numRacers; i++) {
      if (this.activeRacers[i].name == "green" && this.rng.random() < 0.0833) {
        this.activeRacers[i] = this.specialRacers["glorp"];
      }
      if (this.activeRacers[i].name == "orange" && this.rng.random() < 0.1667) {
        this.activeRacers[i] = this.specialRacers["garf"];
      }
      if (this.activeRacers[i].name == "red" && this.rng.random() < 0.125) {
        this.activeRacers[i] = this.specialRacers["shoop"];
      }
      if (this.activeRacers[i].name == "pink" && this.rng.random() < 0.125) {
        this.activeRacers[i] = this.specialRacers["kirbeter"];
      }

      this.activeRacers[i].spawn(startingPoints[i][0], startingPoints[i][1]);

      var linVel = new planck.Vec2(this.activeRacers[i].baseSpeed, 0);
      var angle = new planck.Rot((startingPoints[i][2] * Math.PI) / 180.0);

      linVel = planck.Rot.mulVec2(angle, linVel);
      this.activeRacers[i].body.setLinearVelocity(linVel);
      this.activeRacers[i].body.m_userData["number"] = i;
    }
  }

  simulate()
  {
    if (this.iterCount === undefined) this.iterCount = 0;
    if (this.timingStats === undefined) this.timingStats = { 15: 0, 30: 0, 60: 0, 120: 0, 240: 0, 480: 0 };

    if (this.racerStats === undefined)
    {
      this.racerStats = {};

      for (var i = 0; i < this.racers.length; i++)
      {
        this.racerStats[this.racers[i].name] = { "wins": 0, "races": 0 };
      }

      for (const [racerKey, racerObj] of Object.entries(this.specialRacers))
      {
        this.racerStats[racerKey] = { "wins": 0, "races": 0 };
      }
    }

    this.misc.barrier.destroy();
    while (!this.completed) {
      for (let i = 0; i < this.activeRacers.length; i++) {
        this.activeRacers[i].update(g_DeltaTime);
      }

      this.goal.update(g_DeltaTime);

      this.world.step(g_DeltaTime, 16, 6);
      this.gameTime += g_Timestep;
      this.frameCounter += 1;

      this.handleContacts();
    }

    for (var i = 0; i < this.activeRacers.length; i++)
    {
      this.racerStats[this.activeRacers[i].name]["races"]++;
    }

    this.racerStats[this.winner.getUserData().name]["wins"]++;

    this.iterCount += 1;
    if (this.longestLap === undefined) this.longestLap = 0;
    this.longestLap = Math.max(this.longestLap, this.frameCounter);
    if (this.shortestLap === undefined) this.shortestLap = 1000000;
    this.shortestLap = Math.min(this.shortestLap, this.frameCounter);

    if (this.totalFrames === undefined) this.totalFrames = 0;
    this.totalFrames += this.frameCounter;

    for (const [timeId, count] of Object.entries(this.timingStats))
    {
      if (this.frameCounter > timeId / g_DeltaTime) this.timingStats[timeId]++;
    }

    if (this.iterCount < 500) {
      this.setSeed(Math.floor(1_000_000 * Math.random() + 1));
      this.reset();
      setTimeout(() => this.step(0), 100);
    } else {
      console.log(
        "Longest: " +
          this.longestLap * g_DeltaTime +
          "s, Shortest: " +
          this.shortestLap * g_DeltaTime +
          "s, Average: " +
          (this.totalFrames / this.iterCount) * g_DeltaTime +
          "s, Over 15s: " +
          this.timingStats[15] +
          ", Over 30s: " +
          this.timingStats[30] +
          ", Over 1m: " +
          this.timingStats[60] +
          ", Over 2m: " +
          this.timingStats[120] +
          ", Over 4m: " +
          this.timingStats[240] +
          ", Over 8m: " +
          this.timingStats[480],
      );

      for (const [racerName, racerStats] of Object.entries(this.racerStats))
      {
        console.log("\tRacer " + racerName + ": " + racerStats["wins"] + "/" + racerStats["races"]);
      }
    }
  }

  step(t) {
    if (!this.renderFrames) {
      this.simulate();
    } else {
      requestAnimationFrame(this.step.bind(this));

      if (this.lastTime !== undefined) {
        var frameTime = t - this.lastTime;
        this.lastTime = t;

        if (this.paused || this.completed) {
          this.render(0);
          return;
        }

        if (this.countdown == 10.0) {
          this.soundEffects["start"].play();
        }

        if (this.countdown > 0) {
          this.countdown -= frameTime / 1000;

          if (!this.map.playDuringCountdown)
          {
            this.render(0);
            return;
          }

          if (this.countdown <= 0)
          {
            this.misc.barrier.destroy();
          }
        }

        if (this.editWarning)
        {
          this.render(0);
          return;
        }

        this.accumulator += frameTime;

        while (this.accumulator >= g_Timestep) {
          for (let i = 0; i < this.activeRacers.length; i++) {
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
    }
    this.lastTime = t;
  }

  render(i_alpha) {
    this.map.integrate(i_alpha);

    for (let i = 0; i < this.activeRacers.length; i++) {
      this.activeRacers[i].integrate(i_alpha);
    }

    this.goal.integrate(i_alpha);

    if (this.countdown >= 10.0) {
      this.countdownText.text = "Race starting soon...";
    } else if (this.countdown > 0) {
      this.countdownText.text =
        "Race begins in: \n" + this.countdown.toFixed(0) + " seconds";
    } else if (this.editWarning) {
      this.countdownText.text = "Check stream for results.";
    } else {
      this.countdownText.text = "";
    }

    if (this.completed) {
      this.winText.text = this.winner.getUserData().name + " wins!";
    } else {
      this.winText.text = "";
    }

    this.app.renderer.render(this.app.stage);
  }

  addCanvas(element) {
    element.html(this.app.canvas);
  }

  deflectRacer(i_racerBody) {
    var linVel = i_racerBody.getLinearVelocity();

    if (this.randomizeBounces && this.rng.random() < 0.5) {
      var minDeflection = (5.0 * Math.PI) / 180.0;
      var maxDeflection = (75.0 * Math.PI) / 180.0;
      var def1 = this.rng.randFloat(minDeflection, maxDeflection);
      var def2 = this.rng.randFloat(minDeflection, maxDeflection);

      var deflection = Math.min(def1, def2);
      deflection = this.rng.randBool() ? deflection : -deflection;

      var rot = new planck.Rot(deflection);
      var newLinearVel = planck.Rot.mulVec2(rot, linVel);
    } else {
      var deflection = 0;
      var newLinearVel = linVel;
    }

    i_racerBody.setLinearVelocity(newLinearVel);

    return deflection;
  }

  handleContacts() {
    this.contactList.sort((a, b) =>
      a.getUserData().name.localeCompare(b.getUserData().name),
    );

    var racerList = [];
    for (var i = this.contactList.length - 1; i >= 0; i--) {
      var racerBody = this.contactList[i];

      var defl = this.deflectRacer(racerBody);

      racerList.push(racerBody.getUserData().name);
      racerList.push(this.gameTime);

      this.contactList.pop();
    }

    if (racerList.length > 0) this.collisionList.push(racerList);
  }

  handleVictory(i_victor) {
    this.celebrationLayer.addChild(this.fireworks1);
    this.celebrationLayer.addChild(this.fireworks2);
    this.celebrationLayer.addChild(this.fireworks3);
    this.celebrationLayer.addChild(this.fireworks4);
    this.celebrationLayer.addChild(this.horseGif);
  }

  handleContact(i_contact, i_impulse) {
    var fA = i_contact.getFixtureA(),
      bA = fA.getBody();
    var fB = i_contact.getFixtureB(),
      bB = fB.getBody();

    var objectTypeA = bA.getUserData().objectType;
    var objectTypeB = bB.getUserData().objectType;

    var racerBody1 = undefined;
    var racerBody2 = undefined;
    if (objectTypeA == "racer" && objectTypeB == "racer") {
      racerBody1 = bA;
      racerBody2 = bB;
    } else if (objectTypeA == "racer") {
      racerBody1 = bA;
    } else if (objectTypeB == "racer") {
      racerBody1 = bB;
    }

    if (racerBody1 !== undefined) {
      this.soundEffects["gallops"][racerBody1.getUserData().number].play({
        loop: false,
        singleInstance: true,
      });
    }

    var goalBody =
      objectTypeA == "goal" ? bA : objectTypeB == "goal" ? bB : undefined;
    var courseBody =
      objectTypeA == "course" ? bA : objectTypeB == "course" ? bB : undefined;

    if (racerBody1 !== undefined && goalBody !== undefined) {
      this.winner = racerBody1;
      this.completed = true;

      this.handleVictory(racerBody1);

      console.log(
        "RNG Counter: " +
          this.rng.counter +
          ", Winner: " +
          racerBody1.getUserData().name +
          " @ " +
          racerBody1.getLinearVelocity().x +
          ", " +
          racerBody1.getLinearVelocity().y +
          " in " +
          this.frameCounter +
          " frames (" +
          this.frameCounter * g_DeltaTime +
          " seconds)",
      );
    }

    if (racerBody1 !== undefined && courseBody !== undefined) {
      var vel = racerBody1.getLinearVelocity();
      var baseSpeed = racerBody1.getUserData().baseSpeed;

      var velMag = planck.Vec2.lengthOf(vel);
      var newRest = Math.max(0.05, Math.min(1, baseSpeed / velMag));

      i_contact.setRestitution(newRest);

      this.contactList.push(racerBody1);
    }

    if (racerBody1 !== undefined && racerBody2 !== undefined) {
      var vel1 = racerBody1.getLinearVelocity();
      var vel2 = racerBody2.getLinearVelocity();

      var baseSpeed1 = racerBody1.getUserData().baseSpeed;
      var baseSpeed2 = racerBody2.getUserData().baseSpeed;

      var velMag1 = planck.Vec2.lengthOf(vel1);
      var velMag2 = planck.Vec2.lengthOf(vel2);

      var ratio1 = baseSpeed1 / velMag1;
      var ratio2 = baseSpeed2 / velMag2;

      var newRest = Math.max(0.05, Math.min(1, (ratio1 + ratio2) / 2));

      i_contact.setRestitution(newRest);

      this.contactList.push(racerBody1);
      this.contactList.push(racerBody2);
    }
  }
}
