var g_HorseGame = undefined;

var g_Shapes = [];
var g_MousePosition = undefined;

var g_PolygonInProgress = undefined;
var g_RectangleInProgress = undefined;

var g_BackgroundImage = undefined;
var g_BackgroundImageLoaded = false;

function printShapes(printout = false) {
  var shapeString = "";

  g_Shapes.forEach((v) => {
    shapeString += JSON.stringify(v) + ",\n";
  });

  if (printout) console.log(shapeString);

  return shapeString;
}

function renderCanvas(t = undefined) {
  requestAnimationFrame(renderCanvas);

  var ctx = $("#map-editor-canvas")[0].getContext("2d");

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (g_BackgroundImage && g_BackgroundImageLoaded) {
    ctx.drawImage(g_BackgroundImage, 0, 0);
  }

  var shapeType = $('input[name="shape_type"]:checked').val();
  switch (shapeType) {
    case "circle":
      if (g_MousePosition) {
        var radius = parseInt($("#circle-radius").val());
        ctx.beginPath();
        ctx.arc(g_MousePosition[0], g_MousePosition[1], radius, 0, 360, false);
        ctx.stroke();
      }
      break;
    case "rectangle":
      if (g_RectangleInProgress && g_MousePosition) {
        var w = g_MousePosition[0] - g_RectangleInProgress.points[0][0];
        var h = g_MousePosition[1] - g_RectangleInProgress.points[0][1];
        ctx.strokeRect(
          g_RectangleInProgress.points[0][0],
          g_RectangleInProgress.points[0][1],
          w,
          h,
        );
      }
      break;
    case "polygon":
      if (g_PolygonInProgress) {
        if (g_PolygonInProgress.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(
            g_PolygonInProgress.points[0][0],
            g_PolygonInProgress.points[0][1],
          );
          g_PolygonInProgress.points.forEach((p) => {
            ctx.lineTo(p[0], p[1]);
          });
          if (g_MousePosition)
            ctx.lineTo(g_MousePosition[0], g_MousePosition[1]);
          ctx.lineTo(
            g_PolygonInProgress.points[0][0],
            g_PolygonInProgress.points[0][1],
          );
          ctx.stroke();
        }
      }
      break;
  }

  g_Shapes.forEach((v, i) => {
    switch (v.type) {
      case "circle":
        ctx.beginPath();
        ctx.arc(v.points[0], v.points[1], v.points[2], 0, 360, false);
        ctx.fill();
        break;
      case "polygon":
      case "rectangle":
        ctx.beginPath();
        ctx.moveTo(v.points[0][0], v.points[0][1]);
        v.points.forEach((p) => {
          ctx.lineTo(p[0], p[1]);
        });
        ctx.fill();
        break;
      default:
        break;
    }
  });
}

window.addEventListener(
  "load",
  function (windowLoadEvent) {
    $("#canvas-container").mousemove((e) => {
      var canvas = $("#map-editor-canvas");
      var x = Math.min(
        canvas.width(),
        Math.max(0, Math.floor(e.originalEvent.pageX - canvas.offset().left)),
      );
      var y = Math.min(
        canvas.height(),
        Math.max(0, Math.floor(e.originalEvent.pageY - canvas.offset().top)),
      );
      g_MousePosition = [x, y];

      $("#position-value").html("{0}, {1}".format(x, y));
    });

    $("#canvas-container").mouseleave((e) => {
      g_MousePosition = undefined;
    });
    $("#canvas-container").mouseout((e) => {
      g_MousePosition = undefined;
    });

    $("#canvas-container").mousedown((e) => {
      var canvas = $("#map-editor-canvas");
      var x = Math.min(
        canvas.width(),
        Math.max(0, Math.floor(e.originalEvent.pageX - canvas.offset().left)),
      );
      var y = Math.min(
        canvas.height(),
        Math.max(0, Math.floor(e.originalEvent.pageY - canvas.offset().top)),
      );

      var shapeType = $('input[name="shape_type"]:checked').val();
      var ctx = $("#map-editor-canvas")[0].getContext("2d");

      switch (shapeType) {
        case "circle":
          var radius = parseInt($("#circle-radius").val());
          g_Shapes.push({ type: "circle", points: [x, y, radius] });
          break;
        case "rectangle":
          if (g_RectangleInProgress) {
            var p1 = g_RectangleInProgress.points[0];

            g_Shapes.push({
              type: "polygon",
              points: [p1, [p1[0], y], [x, y], [x, p1[1]]],
            });
            g_RectangleInProgress = undefined;
          } else {
            g_RectangleInProgress = { type: "polygon", points: [[x, y]] };
          }
          break;
        case "polygon":
          if (g_PolygonInProgress) {
            g_PolygonInProgress.points.push([x, y]);
          } else {
            g_PolygonInProgress = { type: "polygon", points: [[x, y]] };
          }
          break;
      }
    });

    $("#remove-last-shape").click((e) => {
      g_Shapes.pop();
    });

    $("#finish-polygon").click((e) => {
      if (g_PolygonInProgress) {
        g_Shapes.push(g_PolygonInProgress);
        g_PolygonInProgress = undefined;
      }
    });

    $("#update-background").click((e) => {
      var bgURL = $("#background-path-input").val();

      if (bgURL !== undefined && bgURL !== "") {
        g_BackgroundImageLoaded = false;
        g_BackgroundImage = new Image();
        g_BackgroundImage.src = bgURL;

        g_BackgroundImage.onload = function () {
          g_BackgroundImageLoaded = true;
        };
      } else {
        g_BackgroundImageLoaded = false;
        g_BackgroundImage = undefined;
      }
    });

    $("#to-image").click((e) => {
      const img = $("#map-editor-canvas")[0].toDataURL("image/png");

      $("#map-export").html(
        '<img src="{0}" />\n<pre>{1}</pre>'.format(img, printShapes()),
      );
    });

    renderCanvas();

    (async () => {
      g_HorseGame = new HorseGame(Math.floor(1000 * Math.random() + 1), 6);
      g_HorseGame.renderFrames = true;
      g_HorseGame.randomMap = false;
      g_HorseGame.selectedMap = 3;

      await g_HorseGame.setup();

      g_HorseGame.addCanvas($("#horse-game"));
      g_HorseGame.drawFixtures = false;

      g_HorseGame.setVolume(0);
      g_HorseGame.setGallopVolume(0);
      g_HorseGame.paused = false;
      g_HorseGame.countdown = 10;
    })();
  },
  false,
);
