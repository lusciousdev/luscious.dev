const demoScriptData = document.currentScript.dataset;

var g_TwitchUID =
  "twitchuid" in demoScriptData ? demoScriptData.twitchuid : undefined;

var g_Websocket = undefined;
var g_ReconnectInterval = undefined;

var g_TwitchConnected = false;
var g_TwitchBroadcasterType = 0;

var g_HorseGame = undefined;

function handleWebsocketMessage(e) {
  var eventData = JSON.parse(e.data);

  if ("commands" in eventData) {
    eventData.commands.forEach((commandData) => {
      var command = commandData["command"];
      var data = commandData["data"];

      handleWebsocketCommand(command, data);
    });
  } else if ("command" in eventData) {
    var command = eventData.command;
    var data = eventData.data;

    handleWebsocketCommand(command, data);
  }
}

function handleWebsocketCommand(command, data) {
  var editor = "";
  if (typeof data === "object" && "uid" in data) editor = data.uid;

  switch (command) {
    case "twitch_broadcaster_type":
      g_TwitchConnected = true;
      g_TwitchBroadcasterType = data.broadcaster_type;
      if (g_TwitchBroadcasterType > 0)
        $("#predict-game").style({ display: "inline-block" });
      break;
    case "error":
      console.warn(data);
      break;
    default:
      console.log("Unknown command: {0}".format(command), data);
      break;
  }
}

function connectWebsocket() {
  var protocol = "ws:";
  if (window.location.protocol == "https:") protocol = "wss:";
  g_Websocket = new WebSocket(
    "{0}//{1}/ws/twitch/".format(protocol, window.location.host),
  );

  g_Websocket.onopen = (e) => {
    handleWebsocketOpen(e);
  };
  g_Websocket.onmessage = (e) => {
    handleWebsocketMessage(e);
  };
  g_Websocket.onclose = (e) => {
    attemptWebSocketReconnect(e);
  };
}

function sendWebsocketMessage(cmd, objData) {
  if (g_Websocket != undefined && g_Websocket.readyState == WebSocket.OPEN) {
    g_Websocket.send(
      JSON.stringify({
        command: cmd,
        data: objData,
      }),
    );
  }
}

function sendWebsocketMessages(msgList) {
  if (
    g_Websocket != undefined &&
    g_Websocket.readyState == WebSocket.OPEN &&
    msgList.length > 0
  ) {
    g_Websocket.send(JSON.stringify({ commands: msgList }));

    connectWebsocket();
  }
}

function attemptWebSocketReconnect(e) {
  if (g_ReconnectInterval == undefined) {
    g_ReconnectInterval = setInterval(() => {
      if (g_Websocket.readyState == WebSocket.OPEN) {
        console.log("Reconnected websocket.");
        clearInterval(g_ReconnectInterval);
        g_ReconnectInterval = undefined;
        return;
      }

      console.log("Attempting to reconnect websocket.");
      connectWebsocket();
    }, 5000);
  }
}

function handleWebsocketOpen(e) {}

window.addEventListener(
  "load",
  function (windowLoadEvent) {
    if (g_TwitchUID !== undefined) {
      connectWebsocket();
    }

    $("#play-pause-game").click((e) => {
      g_HorseGame.togglePause();

      if (g_HorseGame.paused) {
        $("#play-pause-game").html("Play");
      } else {
        $("#play-pause-game").html("Pause");
      }
    });

    $("#reset-game").click((e) => {
      g_HorseGame.setSeed(g_HorseGame.seed + 1);
      g_HorseGame.reset();
    });

    $("#racer-count").change((e) => {
      var numRacers = parseInt($("#racer-count").val());

      g_HorseGame.setRacerCount(numRacers);
    });

    $("#volume-input").change((e) => {
      var val = parseFloat($("#volume-input").val());

      g_HorseGame.setVolume(val);
    });

    $("#gallop-volume-input").change((e) => {
      var val = parseFloat($("#gallop-volume-input").val());

      g_HorseGame.setGallopVolume(val);
    });

    $("#predict-game").click((e) => {
      sendWebsocketMessage("start_prediction", {
        duration: 60,
        title: "Who will win?",
        outcomes: g_HorseGame.activeRacers.map((v, i) => v.name),
      });
    });

    (async () => {
      g_HorseGame = new HorseGame(Math.floor(1_000_000 * Math.random() + 1), 6);
      await g_HorseGame.setup();

      var vol = parseFloat($("#volume-input").val());
      g_HorseGame.setVolume(vol);

      var gallopVol = parseFloat($("#gallop-volume-input").val());
      g_HorseGame.setGallopVolume(gallopVol);

      g_HorseGame.addCanvas($("#horse-game"));
    })();
  },
  false,
);
