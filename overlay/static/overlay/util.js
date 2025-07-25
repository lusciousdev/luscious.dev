const utilScriptData = document.currentScript.dataset;

const c_TwitchUID = utilScriptData.twitchuid;
const c_OverlayID = utilScriptData.overlayid;
const c_GetOverlayItemsURL  = utilScriptData.getitemsurl;

const c_OverlayWidth = parseInt(utilScriptData.overlaywidth, 10)
const c_OverlayHeight = parseInt(utilScriptData.overlayheight, 10)

var g_Websocket = undefined;
var g_ReconnectInterval = undefined;
var g_YouTubePlayerAPILoaded = false;

var g_ItemDict = {};

const c_Transparent = "#00000000"

const NOSCROLL  = 0;
const LEFTRIGHT = 1;
const RIGHTLEFT = 2;
const TOPBOTTOM = 3;
const BOTTOMTOP = 4;

var g_TwitchConnected = false;
var g_TwitchBroadcasterType = 0;

const c_TwitchChatHistoryLimit = 50;
var g_TwitchChatHistory = [];

var g_EmoteMap = {};

var g_ItemTimerUpdateInterval = undefined;
const c_ItemTimerUpdateIntervalTimeout = 100;
const c_EventTimerUpdateIntervalTimeout = 250;

var g_PollActive = false;
var g_PollTimeRemaining = 0;
var g_PollTimerUpdateInterval = undefined;
var g_PollLastTime = Date.now();

var g_PredictionActive = false;
var g_PredictionTimeRemaining = 0;
var g_PredictionTimerUpdateInterval = undefined;
var g_PredictionLastTime = Date.now();

function handleWebsocketMessage(e)
{
  var eventData = JSON.parse(e.data);

  if ("commands" in eventData)
  {
    eventData.commands.forEach( (commandData) => {
      var command = commandData["command"];
      var data = commandData["data"];

      handleWebsocketCommand(command, data);
    });
  }
  else if ("command" in eventData)
  {
    var command = eventData.command;
    var data = eventData.data;
  
    handleWebsocketCommand(command, data);
  }
}

function handleWebsocketCommand(command, data)
{
  var editor = "";
  if (typeof data === "object" && "uid" in data)
    editor = data.uid;

  switch (command)
  {
    case "user_settings":
      handleUserSettings(data);
      break;
    case "list_overlay_items":
      updateItems(data);
      break;
    case "overlay_item_added":
      break;
    case "overlay_item_moved":
      moveItem(data.item_id, data.x, data.y);
      break;
    case "overlay_item_resized":
      resizeItem(data.item_id, data.x, data.y, data.width, data.height);
      break;
    case "overlay_item_edited":
      updateItems({ "items": [ { "item_type": data.item_type, "is_displayed": data.is_displayed, "item_data": data.item_data, } ]}, false, (editor == c_OverlayUserID));
      break;
    case "overlay_item_deleted":
      deleteItem(data.item_id);
      break;
    case "item_event_triggered":
      handleItemEvent(data.item_id, data.event);
      break;
    case "canvas_action":
      handleCanvasAction(data.item_id, data.action, data.action_data, data.continue);
      break;
    case "canvas_undo":
      handleCanvasUpdate(data.item_id, data.history);
      break;
    case "user_present":
      userPresent(data);
      break;
    case "mouse_position":
      repositionMouse(data);
      break;
    case "chat_history":
      repopulateChatHistory(data["messages"]);
      break;
    case "chat_message_sent":
      addChatMessages(data);
      break;
    case "twitch_broadcaster_type":
      g_TwitchConnected = true;
      g_TwitchBroadcasterType = data.broadcaster_type;
      break;
    case "twitch_chat_message":
      handleTwitchChatMessage(data);
      break;
    case "twitch_poll_begin":
      handleTwitchPollBegin(data);
      break;
    case "twitch_poll_progress":
      handleTwitchPollProgress(data);
      break;
    case "twitch_poll_end":
      handleTwitchPollEnd(data);
      break;
    case "twitch_prediction_begin":
      handleTwitchPredictionBegin(data);
      break;
    case "twitch_prediction_progress":
      handleTwitchPredictionProgress(data);
      break;
    case "twitch_prediction_lock":
      handleTwitchPredictionLock(data);
      break;
    case "twitch_prediction_end":
      handleTwitchPredictionEnd(data);
      break;
    case "twitch_redemption_add":
      break;
    case "twitch_redemption_update":
      break
    case "pong":
      break;
    case "redirect":
      window.location.replace(data.url);
      break;
    case "refresh":
      window.location.reload(true);
      break;
    case "tts":
      if ("speechSynthesis" in window)
      {
        let msg = new SpeechSynthesisUtterance(data.text);
        window.speechSynthesis.speak(msg);
      }
      break;
    case "error":
      console.warn(data);
      break;
    default:
      console.log("Unknown command: {0}".format(command), data);
      break;
  }
}

function connectWebsocket()
{
  var protocol = "ws:"
  if (window.location.protocol == "https:")
    protocol = "wss:"
  g_Websocket = new WebSocket("{0}//{1}/ws/overlay/{2}/".format(protocol, window.location.host, c_OverlayID));

  g_Websocket.onopen = (e) => { handleWebsocketOpen(e); };
  g_Websocket.onmessage = (e) => { handleWebsocketMessage(e); };
  g_Websocket.onclose = (e) => { attemptWebSocketReconnect(e); };
}

function sendWebsocketMessage(cmd, objData)
{
  if (g_Websocket != undefined && g_Websocket.readyState == WebSocket.OPEN)
  {
    g_Websocket.send(JSON.stringify({
      "command": cmd,
      "data": objData,
    }));
  }
}

function sendWebsocketMessages(msgList)
{
  if (g_Websocket != undefined && g_Websocket.readyState == WebSocket.OPEN && msgList.length > 0)
  {
    g_Websocket.send(JSON.stringify({ "commands": msgList }));
  }
}

function requestRefresh()
{
  sendWebsocketMessage("request_refresh", {});
}

function getDefaultCSS(itype, idata)
{
  var visible = "hidden";

  if ((idata['visibility'] == 1 && c_EditView) || (idata["visibility"] == 2))
  {
    visible = "inherit";
  }
  else if (idata["visibility"] == 3)
  {
    switch (itype)
    {
      case "twitch_poll":
        visible = g_PollActive ? "inherit" : "hidden";
        break;
      case "twitch_prediction":
        visible = g_PredictionActive ? "inherit" : "hidden";
        break;
      default:
        break;
    }
  }

  var cssObj = {
    "opacity": (idata['opacity'] / 100.0),
    "visibility": visible,
    "clip-path": "inset({0}% {1}% {2}% {3}%)".format(idata["crop_top"], idata["crop_right"], idata["crop_bottom"], idata["crop_left"]),
  };

  if (idata['mirrored'])
  {
    cssObj["transform"] = "scale(-1, 1)";
    cssObj["-moz-transform"] = "scale(-1, 1)";
    cssObj["-webkit-transform"] = "scale(-1, 1)";
    cssObj["-o-transform"] = "scale(-1, 1)";
    cssObj["-ms-transform"] = "scale(-1, 1)";
  }
  else
  {
    cssObj["transform"] = "scale(1, 1)";
    cssObj["-moz-transform"] = "scale(1, 1)";
    cssObj["-webkit-transform"] = "scale(1, 1)";
    cssObj["-o-transform"] = "scale(1, 1)";
    cssObj["-ms-transform"] = "scale(1, 1)";
  }

  return cssObj;
}

function getDefaultContainerCSS(itype, idata)
{
  var visible = false;

  if ((idata['visibility'] == 1 && c_EditView) || (idata["visibility"] == 2))
  {
    visible = true;
  }
  else if (idata["visibility"] == 3)
  {
    switch (itype)
    {
      case "twitch_poll":
        visible = g_PollActive;
        break;
      case "twitch_prediction":
        visible = g_PredictionActive;
        break;
      default:
        break;
    }
  }

  var cssObj = {
    "background-color": (visible && idata['background_enabled']) ? idata['background_color'] : c_Transparent,
  };
  
  return cssObj;
}

function getDefaultInnerContainerCSS(itype, idata)
{
  var cssObj = {};

  switch (idata["scroll_direction"])
  {
    case LEFTRIGHT:
      cssObj['-moz-transform'] = "translateX(-100%)";
      cssObj['-webkit-transform'] = "translateX(-100%)";
      cssObj['transform'] = "translateX(-100%)";
      cssObj['-moz-animation'] = "leftRightScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['-webkit-animation'] = "leftRightScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['animation'] = "leftRightScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      break;
    case RIGHTLEFT:
      cssObj['-moz-transform'] = "translateX(100%)";
      cssObj['-webkit-transform'] = "translateX(100%)";
      cssObj['transform'] = "translateX(100%)";
      cssObj['-moz-animation'] = "rightLeftScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['-webkit-animation'] = "rightLeftScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['animation'] = "rightLeftScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      break;
    case TOPBOTTOM:
      cssObj['-moz-transform'] = "translateY(100%)";
      cssObj['-webkit-transform'] = "translateY(100%)";
      cssObj['transform'] = "translateY(100%)";
      cssObj['-moz-animation'] = "topBottomScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['-webkit-animation'] = "topBottomScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['animation'] = "topBottomScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      break;
    case BOTTOMTOP:
      cssObj['-moz-transform'] = "translateY(-100%)";
      cssObj['-webkit-transform'] = "translateY(-100%)";
      cssObj['transform'] = "translateY(-100%)";
      cssObj['-moz-animation'] = "bottomTopScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['-webkit-animation'] = "bottomTopScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      cssObj['animation'] = "bottomTopScrollAnim {0}s linear infinite".format(idata["scroll_duration"]);
      break;
    case NOSCROLL:
    default:
      cssObj['-moz-transform'] = "";
      cssObj['-webkit-transform'] = "";
      cssObj['transform'] = "";
      cssObj['-moz-animation'] = "";
      cssObj['-webkit-animation'] = "";
      cssObj['animation'] = "";
      break;
  }

  return cssObj;
}

function attemptWebSocketReconnect(e)
{
  if (g_ReconnectInterval == undefined)
  {
    g_ReconnectInterval = setInterval(() => { 
      if (g_Websocket.readyState == WebSocket.OPEN)
      {
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

function getOverlayItems()
{
  sendWebsocketMessage("get_overlay_items", {});
}

function getDivById(id)
{
  return $("#{0}".format(id));
}

function getItemDiv(itemId)
{
  return $("#item-{0}".format(itemId));
}

function deleteItem(itemId)
{
  delete g_ItemDict[itemId];

  getItemDiv(itemId).remove();
  $("#item-{0}-list-entry".format(itemId)).remove();

  if (itemId == g_SelectedItem)
  {
    clearSelectedItem();
  }
}

function handleItemEvent(itemId, event)
{
  switch(event)
  {
    case "reset_item":
      resetItem(itemId);
      break;
    case "pause_item":
      pauseItem(itemId);
      break;
    case "play_item":
      playItem(itemId);
      break;
    default:
      console.log("Item ID {0} recieved unrecognized event: {1}".format(itemId, event));
      break;
  }
}

function resetItem(itemId)
{
  var itemType = g_ItemDict[itemId]['item_type'];
  
  switch (itemType)
  {
    case "audio":
      resetAudioItem(itemId);
      break;
    case "youtube_video":
      resetYouTubePlayer(itemId);
      break;
    case "twitch_stream":
      resetTwitchStreamEmbed(itemId);
      break;
    case "twitch_video":
      resetTwitchVideoEmbed(itemId);
      break;
    default:
      break;
  }
}

function playItem(itemId)
{
  var itemType = g_ItemDict[itemId]['item_type'];
  
  switch (itemType)
  {
    case "audio":
      playAudioItem(itemId);
      break;
    default:
      break;
  }
}

function pauseItem(itemId)
{
  var itemType = g_ItemDict[itemId]['item_type'];
  
  switch (itemType)
  {
    case "audio":
      pauseAudioItem(itemId);
      break;
    default:
      break;
  }
}

const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function setItemPosition(itemId, top, left, width, height, z, rotation)
{
  var borderWidth = parseFloat($("#item-{0}".format(itemId)).css("border-left-width"));
  $("#item-{0}".format(itemId)).css({
    "top": "{0}px".format(top - borderWidth),
    "left": "{0}px".format(left - borderWidth),
    "width": "{0}px".format(width),
    "height": "{0}px".format(height),
    "z-index": "{0}".format(z), 
    "transform": "rotate({0}deg)".format(rotation),
  });
}

function startTimeToTwitchVideoTime(start_time)
{
  hours = Math.floor(start_time / 3600);
  remainder = start_time % 3600;

  minutes = Math.floor(remainder / 60);
  remainder = remainder % 60;

  seconds = remainder;

  return "{0}h{1}m{2}s".format(hours, minutes, seconds);
}

Number.prototype.pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {s = "0" + s;}
  return s;
}

function secondsToTimeFormat(totalSeconds)
{
  var hours = Math.floor(totalSeconds / (60 * 60));
  var rem = totalSeconds % (60 * 60);

  var minutes = Math.floor(rem / 60);
  rem = rem % 60;

  var seconds = rem;

  return "{0}:{1}:{2}".format(hours.pad(), minutes.pad(), seconds.pad());
}

function setTextItemCSS(overlayElement, itemId, itemType, itemData)
{
  var textElemId = "#item-{0}-text".format(itemId);
  var fontSize = c_EditView ? viewToEditLength(itemData["font_size"]) : itemData["font_size"];

  var itemCSS = getDefaultCSS(itemType, itemData);
  itemCSS["font-size"] = "{0}pt".format(fontSize);
  itemCSS["font-family"] = "{0}, sans-serif".format(itemData["font"]);
  itemCSS["font-weight"] = itemData["font_weight"];
  itemCSS["color"] = itemData['color'];
  itemCSS["text-shadow"] = "{0}pt {1}pt {2}pt {3}".format(itemData["drop_shadow_offset_x"], itemData["drop_shadow_offset_y"], itemData["drop_shadow_blur_radius"], itemData["drop_shadow_enabled"] ? itemData["drop_shadow_color"] : c_Transparent);
  itemCSS["-webkit-text-stroke-width"] = "{0}pt".format(itemData["text_outline_width"])
  itemCSS["-webkit-text-stroke-color"] = itemData["text_outline_enabled"] ? itemData["text_outline_color"] : c_Transparent
  itemCSS["text-align"] = itemData["text_alignment"];

  $(textElemId).css(itemCSS);
}

function setTextItemContent(overlayElement, itemId, itemText, itemType, itemData)
{
  var textElemId = "#item-{0}-text".format(itemId);

  $(textElemId).text(itemText);

  setTextItemCSS(overlayElement, itemId, itemType, itemData);
}

function moveItem(itemId, x, y)
{
  if (!(itemId in g_ItemDict))
  {
    console.error("Tried to move item that doesn't exist yet.");
    return;
  }

  if (!c_EditView || !g_ItemDict[itemId]['moving'])
  {
    g_ItemDict[itemId]['item_data']['x'] = x;
    g_ItemDict[itemId]['item_data']['y'] = y;
  }

  var top = g_ItemDict[itemId]['item_data']['y'];
  var left = g_ItemDict[itemId]['item_data']['x'];
  var width = g_ItemDict[itemId]['item_data']['width'];
  var height = g_ItemDict[itemId]['item_data']['height'];
  if (c_EditView)
  {
    top    = viewToEditLength(top);
    left   = viewToEditLength(left);
    width  = viewToEditLength(width);
    height = viewToEditLength(height);
  }

  var z = g_ItemDict[itemId]['item_data']['z'];
  var rotation = g_ItemDict[itemId]['item_data']['rotation'];

  setItemPosition(itemId, top, left, width, height, z, rotation);
}

function resizeItem(itemId, x, y, width, height)
{
  if (!(itemId in g_ItemDict))
  {
    console.error("Tried to resize item that doesn't exist yet.");
    return;
  }

  if (!c_EditView || !g_ItemDict[itemId]['moving'])
  {
    g_ItemDict[itemId]['item_data']['x'] = x;
    g_ItemDict[itemId]['item_data']['y'] = y;
    g_ItemDict[itemId]['item_data']['width'] = width;
    g_ItemDict[itemId]['item_data']['height'] = height;
  }

  var top = g_ItemDict[itemId]['item_data']['y'];
  var left = g_ItemDict[itemId]['item_data']['x'];
  var width = g_ItemDict[itemId]['item_data']['width'];
  var height = g_ItemDict[itemId]['item_data']['height'];
  if (c_EditView)
  {
    top    = viewToEditLength(top);
    left   = viewToEditLength(left);
    width  = viewToEditLength(width);
    height = viewToEditLength(height);
  }

  var z = g_ItemDict[itemId]['item_data']['z'];
  var rotation = g_ItemDict[itemId]['item_data']['rotation'];

  setItemPosition(itemId, top, left, width, height, z, rotation);

  var itemType = g_ItemDict[itemId]['item_type'];

  switch (itemType)
  {
    case "image":
      var imgTag = $("#item-{0}-img".format(itemId));
      imgTag.attr('width', "{0}px".format(width));
      imgTag.attr('height', "{0}px".format(height));
      break;
    case "canvas":
      var canvasId = "#item-{0}-canvas".format(itemId);
      var canvasTag = $(canvasId);
      if (!g_ItemDict[itemId]["drawing"])
      {
        if (Math.abs(width - canvasTag.width()) > 1) canvasTag.attr('width', "{0}px".format(width));
        if (Math.abs(height - canvasTag.height()) > 1) canvasTag.attr('height', "{0}px".format(height));
      }
      break;
    case "twitch_chat":
      $("#item-{0}-text".format(itemId)).scrollTop($("#item-{0}-text".format(itemId))[0].scrollHeight);
      break;
    default:
      break;
  }
}

function addOrUpdateItem(selfEdit, overlayElement, itemId, itemType, isDisplayed, top, left, width, height, z, rotation, itemData, prevItemData, afterAdditionCallback, afterEditCallback)
{
  var itemElemId = '#item-{0}'.format(itemId);
  var itemOuterContainerId = '#item-{0}-outer-container'.format(itemId);
  var itemInnerContainerId = "#item-{0}-inner-container".format(itemId);

  if(!c_EditView && itemData["view_lock"])
  {
    return;
  }

  if ($(itemElemId).length == 0)
  {
    $(overlayElement).append("<div id='item-{0}' itemId='{0}' class='overlay-item {1}-item unselected'><div id='item-{0}-outer-container' itemId='{0}' class='overlay-item-container'><div id='item-{0}-inner-container' itemId='{0}' class='overlay-item-container'></div></div></div>".format(itemId, itemType))
  
    setItemPosition(itemId, top, left, width, height, z, rotation);
    $(itemOuterContainerId).css(getDefaultContainerCSS(itemType, itemData));
    $(itemInnerContainerId).css(getDefaultInnerContainerCSS(itemType, itemData));

    $(itemElemId).css({
      "visibility": (isDisplayed && !itemData['minimized']) ? "visible" : "hidden",
    });

    switch (itemType)
    {
      case "image":
        imageUrl = itemData['url'];
        if (imageUrl == "")
        {
          imageUrl = itemData['image_url'];
        }

        $(itemInnerContainerId).append("<img id='item-{0}-img' class='noselect nopointer' src='{1}' width='{2}px' height='{3}px' draggable='false'>".format(itemId, imageUrl, width, height));

        var imgElemId = "#item-{0}-img".format(itemId);
        
        $(imgElemId).on('dragstart', (event) => { event.preventDefault(); });

        $(imgElemId).css(getDefaultCSS(itemType, itemData));
        break;
      case "canvas":
        $(itemInnerContainerId).append("<canvas id='item-{0}-canvas' width='{1}px' height='{2}px' />".format(itemId, width, height));

        $("#item-{0}-canvas".format(itemId)).css(getDefaultCSS(itemType, itemData));
        handleCanvasUpdate(itemId, itemData["history"]);
        break;
      case "audio":
        audioUrl = itemData['audio_url'];

        g_ItemDict[itemId]['audio'] = new Audio(audioUrl);
        g_ItemDict[itemId]['audio'].load();
        g_ItemDict[itemId]['audio'].volume = (itemData['volume'] / 100.0);
        break;
      case "embed":
        var iframeId = "#item-{0}-iframe".format(itemId)

        $(itemInnerContainerId).html(`<iframe id="item-{0}-iframe" src="{1}" height="100%" width="100%" class="noselect nopointer" frameBorder="0"></iframe>`.format(itemId, itemData['embed_url']));

        $(iframeId).css({
          "opacity": itemData['opacity'],
          "visibility": (itemData['visibility']) ? "inherit" : "hidden",
          "clip-path": "inset({0}% {1}% {2}% {3}%)".format(itemData["crop_top"], itemData["crop_left"], itemData["crop_bottom"], itemData["crop_right"]),
        });
        break;
      case "youtube_video":
        var playerId = "#item-{0}-player".format(itemId);

        $(itemInnerContainerId).html(PlayerTemplate.format(itemId));

        g_ItemDict[itemId]['player_ready'] = false;
        g_ItemDict[itemId]['player'] = undefined;

        if (g_YouTubePlayerAPILoaded)
        {
          createYouTubePlayer(itemId);
        }

        $(playerId).css(getDefaultCSS(itemType, itemData));
        break;
      case "twitch_stream":
        var playerId = "#item-{0}-player".format(itemId)

        $(itemInnerContainerId).html(PlayerTemplate.format(itemId));

        if (g_ItemDict[itemId].item_data.channel != "")
        {
          g_ItemDict[itemId]['player'] = createTwitchStreamPlayer("item-{0}-player".format(itemId), g_ItemDict[itemId].item_data.channel);
  
          updateTwitchStreamPlayer(itemId);
        }
        else
        {
          g_ItemDict[itemId]['player'] = null;
        }

        $(playerId).css(getDefaultCSS(itemType, itemData));
        break;
      case "twitch_video":
        var playerId = "#item-{0}-player".format(itemId)

        $(itemInnerContainerId).html(PlayerTemplate.format(itemId));

        if (g_ItemDict[itemId].item_data.video_id != "")
        {
          g_ItemDict[itemId]["player"] = createTwitchVideoPlayer("item-{0}-player".format(itemId), 
                                                               g_ItemDict[itemId].item_data.video_id, 
                                                               startTimeToTwitchVideoTime(g_ItemDict[itemId].item_data.start_timeh));
  
          updateTwitchVideoPlayer(itemId);
        }
        else
        {
          g_ItemDict[itemId]['player'] = null;
        }

        $(playerId).css(getDefaultCSS(itemType, itemData));
        break;
      case "text":
        $(itemInnerContainerId).append(TextTemplate.format(itemId));
        setTextItemContent(overlayElement, itemId, itemData['text'], itemType, itemData);
        break;
      case "stopwatch":
        $(itemInnerContainerId).append(TextTemplate.format(itemId));
        
        var stopwatchText = getStopwatchText(itemData);
        setTextItemContent(overlayElement, itemId, stopwatchText, itemType, itemData);
        break;
      case "countdown":
        $(itemInnerContainerId).append(TextTemplate.format(itemId));
        
        var countdownText = getCountdownText(itemData);
        setTextItemContent(overlayElement, itemId, countdownText, itemType, itemData);
        break;
      case "counter":
        $(itemInnerContainerId).append(TextTemplate.format(itemId));

        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(overlayElement, itemId, textContent, itemType, itemData);
        break;
      case "twitch_chat":
        $(itemInnerContainerId).append("<div id='item-{0}-text' class='twitch-chat-history-container overlay-item-child noselect nopointer'><div class='twitch-chat-history'></div></div>".format(itemId));
        
        let historyElem = $("#item-{0}-text".format(itemId));
        g_TwitchChatHistory.forEach((msg, i) => {
          addMessageToChatHistory(historyElem, msg);
        });
        
        setTextItemCSS(overlayElement, itemId, itemType, itemData);
        break;
      case "twitch_poll":
        $(itemInnerContainerId).append(PollTemplate.format(itemId));

        $("#item-{0}-text".format(itemId)).find(".twitch-poll-title").css({ "color": itemData["title_color"]});
        $("#item-{0}-text".format(itemId)).find(".twitch-poll-choice-bar-fill").css({ "background-color": itemData["bar_color"]});
        setTextItemCSS(overlayElement, itemId, itemType, itemData);
        break;
      case "twitch_prediction":
        $(itemInnerContainerId).append(PredictionTemplate.format(itemId));

        $("#item-{0}-text".format(itemId)).find(".twitch-pred-title").css({ "color": itemData["title_color"]});
        $("#item-{0}-text".format(itemId)).find(".twitch-pred-outcome-bar-fill").css({ "background-color": itemData["bar_color"]});
        setTextItemCSS(overlayElement, itemId, itemType, itemData);
        break;
      default:
        break;
    }

    afterAdditionCallback();
  }
  else
  {
    setItemPosition(itemId, top, left, width, height, z, rotation);
    $(itemOuterContainerId).css(getDefaultContainerCSS(itemType, itemData));
    $(itemInnerContainerId).css(getDefaultInnerContainerCSS(itemType, itemData));

    $(itemElemId).css({
      "visibility": (isDisplayed && !itemData['minimized']) ? "visible" : "hidden",
    });
    
    switch (itemType)
    {
      case "image":
        imageUrl = itemData['url'];
        if (imageUrl == "")
        {
          imageUrl = itemData['image_url'];
        }

        var imgTag = $("#item-{0}-img".format(itemId));

        if (imgTag.attr('src') != imageUrl)
        {
          imgTag.attr('src', imageUrl);
        }

        imgTag.attr('width', "{0}px".format(width));
        imgTag.attr('height', "{0}px".format(height));

        imgTag.css(getDefaultCSS(itemType, itemData));
        break;
      case "canvas":
        var canvasId = "#item-{0}-canvas".format(itemId);
        var canvasTag = $(canvasId);

        canvasTag.css(getDefaultCSS(itemType, itemData));
        
        if (!g_ItemDict[itemId]["drawing"])
        {
          if (Math.abs(width - canvasTag.width()) > 1) canvasTag.attr('width', "{0}px".format(width));
          if (Math.abs(height - canvasTag.height()) > 1) canvasTag.attr('height', "{0}px".format(height));
        }

        handleCanvasUpdate(itemId, itemData["history"]);
        break;
      case "audio":
        audioUrl = itemData['audio_url'];

        if (g_ItemDict[itemId]['audio'].src != new URL(audioUrl, window.location.origin))
        {
          g_ItemDict[itemId]['audio'].src = audioUrl;
          g_ItemDict[itemId]['audio'].load();
        }

        g_ItemDict[itemId]['audio'].volume = (itemData['volume'] / 100.0);
        break;
      case "embed":
        var iframeId = "#item-{0}-iframe".format(itemId)

        if ($(iframeId).attr('src') != itemData['embed_url'])
        {
          $(iframeId).attr('src', itemData['embed_url']);
        }

        $(iframeId).css(getDefaultCSS(itemType, itemData));
        break;
      case "youtube_video":
        var playerId = "#item-{0}-player".format(itemId);

        if (g_YouTubePlayerAPILoaded)
        {
          if (g_ItemDict[itemId]['player'] == undefined)
          {
            createYouTubePlayer(itemId);
          }
          
          if (g_ItemDict[itemId]['player_ready'])
          {
            updateYouTubePlayer(itemId);
          }
        }

        $(playerId).css(getDefaultCSS(itemType, itemData));
        break;
      case "twitch_stream":
        var playerId = "#item-{0}-player".format(itemId);

        if (g_ItemDict[itemId].item_data.channel != "")
        {
          if (g_ItemDict[itemId]['player'] == null)
          {
            g_ItemDict[itemId]['player'] = createTwitchStreamPlayer("item-{0}-player".format(itemId), g_ItemDict[itemId].item_data.channel);
          }

          updateTwitchStreamPlayer(itemId);
        }

        $(playerId).css(getDefaultCSS(itemType, itemData));
        break;
      case "twitch_video":
        var playerId = "#item-{0}-player".format(itemId)

        if (g_ItemDict[itemId].item_data.video_id != "")
        {
          if (g_ItemDict[itemId]['player'] == null)
          {
            g_ItemDict[itemId]["player"] = createTwitchVideoPlayer("item-{0}-player".format(itemId), 
                                                                 g_ItemDict[itemId].item_data.video_id, 
                                                                 startTimeToTwitchVideoTime(g_ItemDict[itemId].item_data.start_timeh));
          }
  
          updateTwitchVideoPlayer(itemId);
        }

        $(playerId).css(getDefaultCSS(itemType, itemData));
        break;
      case "text":
        setTextItemContent(overlayElement, itemId, itemData['text'], itemType, itemData);
        break;
      case "stopwatch":
        var itemText = getStopwatchText(itemData);
        setTextItemContent(overlayElement, itemId, itemText, itemType, itemData);
        break
      case "countdown":
        var itemText = getCountdownText(itemData);
        setTextItemContent(overlayElement, itemId, itemText, itemType, itemData);
        break
      case "counter":
        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(overlayElement, itemId, textContent, itemType, itemData);
        break;
      case "twitch_chat":
        $("#item-{0}-text".format(itemId)).scrollTop($("#item-{0}-text".format(itemId))[0].scrollHeight);
        setTextItemCSS(overlayElement, itemId, itemType, itemData);
        break;
      case "twitch_poll":
        $("#item-{0}-text".format(itemId)).find(".twitch-poll-title").css({ "color": itemData["title_color"]});
        $("#item-{0}-text".format(itemId)).find(".twitch-poll-choice-bar-fill").css({ "background-color": itemData["bar_color"]});
        setTextItemCSS(overlayElement, itemId, itemType, itemData);
        break;
      case "twitch_prediction":
        $("#item-{0}-text".format(itemId)).find(".twitch-pred-title").css({ "color": itemData["title_color"]});
        $("#item-{0}-text".format(itemId)).find(".twitch-pred-outcome-bar-fill").css({ "background-color": itemData["bar_color"]});
        setTextItemCSS(overlayElement, itemId, itemType, itemData);
        break;
      default:
        break;
    }

    afterEditCallback();
  }
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///           CANVAS
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function handleCanvasUpdate(itemId, history)
{
  if (c_EditView && g_ItemDict[itemId]["drawing"])
  {
    return;
  }

  const canvas = $("#item-{0}-canvas".format(itemId)).get(0);
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

  history.forEach((action, i) => {
    var actionType = action["action"];
    var actionData = action["action_data"];

    handleCanvasActionWithContext(context, itemId, actionType, actionData);
  });
}

function handleCanvasClear(itemId)
{
  if (c_EditView && g_ItemDict[itemId]["drawing"])
  {
    return;
  }

  const canvas = $("#item-{0}-canvas".format(itemId)).get(0);
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
}

function handleCanvasAction(itemId, action, actionData, actionContinued = false)
{
  const canvas = $("#item-{0}-canvas".format(itemId)).get(0);
  const context = canvas.getContext('2d');

  handleCanvasActionWithContext(context, itemId, action, actionData, actionContinued)
}

function handleCanvasActionWithContext(context, itemId, action, actionData, actionContinued = false)
{
  if (action == 0)
  {
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = actionData["strokeStyle"];
  }
  else if (action == 1)
  {
    context.globalCompositeOperation = "destination-out";
    context.strokeStyle = "rgba(0, 0, 0, 1)";
  }
  else if (action == 2)
  {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    return 
  }

  context.lineWidth = c_EditView ? viewToEditLength(actionData["lineWidth"]) : actionData["lineWidth"];
  context.lineCap = 'round';


  context.beginPath()

  var p0 = new Point(actionData["points"][0][0], actionData["points"][0][1]);
  if (c_EditView)
    p0 = viewToEditPoint(p0)
  
  if (actionContinued)
  {
    p0 = g_ItemDict[itemId]["last_point"];
    if (c_EditView)
      p0 = viewToEditPoint(p0);
  }

  context.moveTo(p0.x, p0.y);

  for (var i = 0; i < actionData["points"].length; i++)
  {
    var p_i = new Point(actionData["points"][i][0], actionData["points"][i][1]);
    if (c_EditView)
      p_i = viewToEditPoint(p_i);
    context.lineTo(p_i.x, p_i.y);
  }
    
  context.stroke();

  g_ItemDict[itemId]['last_point'] = new Point(actionData.points[actionData.points.length - 1][0], actionData.points[actionData.points.length - 1][1]);
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///       TWITCH CONNECTION
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function handleTwitchChatMessage(msgData)
{
  g_TwitchChatHistory.push(msgData);

  while (g_TwitchChatHistory.length > c_TwitchChatHistoryLimit)
  {
    g_TwitchChatHistory.shift();
  }

  addMessageToChatHistory($(".twitch-chat-history"), msgData);

  $(".twitch-chat-history").each((i, elem) => {
    while ($(elem).find(".twitch-chat-message").length > c_TwitchChatHistoryLimit)
    {
      $(elem).find(".twitch-chat-message:first").remove();
    }
  });

  $(".twitch-chat-history-container").each((i, elem) => {
    $(elem).scrollTop(elem.scrollHeight);
  });
}

function addMessageToChatHistory(elem, msg)
{
  let msgParts = msg["message"].split(" ");
  let msgRes = [];

  msgParts.forEach((part) => {
    if (part in msg["emotes"])
    {
      let emoteData = msg["emotes"][part];
      let emoteUrl = "https://static-cdn.jtvnw.net/emoticons/v2/{0}/default/dark/1.0".format(emoteData["id"]);
      msgRes.push(EmoteTemplate.format(emoteUrl, part));
    }
    else if (part in g_EmoteMap)
    {
      msgRes.push(EmoteTemplate.format(g_EmoteMap[part], part));
    }
    else
    {
      msgRes.push(part);
    }
  });

  let message = msgRes.join(" ");

  elem.append(TwitchChatMessageTemplate.format(msg["chatter"]["color"], msg["chatter"]["display_name"], message));
}

function getChatEmotes()
{
  let ffz = [
    "https://api.betterttv.net/3/cached/frankerfacez/emotes/global",
    "https://api.betterttv.net/3/cached/frankerfacez/users/twitch/{0}".format(c_TwitchUID),
  ];

  ffz.forEach((url, i) => {
    $.get(url, handleFFZResp);
  });

  $.get("https://api.betterttv.net/3/cached/emotes/global", handleBTTVGlobalResp);
  $.get("https://api.betterttv.net/3/cached/users/twitch/{0}".format(c_TwitchUID), handleBTTVUserResp);

  $.get("https://7tv.io/v3/emote-sets/global", handle7TVGlobalResp);
  $.get("https://7tv.io/v3/users/twitch/{0}".format(c_TwitchUID), handle7TVUserResp);
}

function handleFFZResp(resp)
{
  resp.forEach((emote, i) => {
    let emoteKey = Object.keys(emote["images"]).sort().shift();
    let emoteUrl = emote["images"][emoteKey];
    g_EmoteMap[emote["code"]] = emoteUrl;
  });
}

function handleBTTVEmoteList(emoteList)
{
  emoteList.forEach((emote, i) => {
    g_EmoteMap[emote["code"]] = "https://cdn.betterttv.net/emote/{0}/1x.{1}".format(emote["id"], emote["imageType"]);
  });
}

function handleBTTVGlobalResp(resp)
{
  handleBTTVEmoteList(resp);
}

function handleBTTVUserResp(resp)
{
  handleBTTVEmoteList(resp["channelEmotes"]);
  handleBTTVEmoteList(resp["sharedEmotes"]);
}

function handle7TVEmoteList(emoteList)
{
  emoteList.forEach((emote, i) => {
    let emoteBase = emote["data"]["host"]["url"];
    let emoteUrl = "{0}/{1}".format(emoteBase, emote["data"]["host"]["files"][0]["name"]);

    g_EmoteMap[emote["name"]] = emoteUrl;
  });
}

function handle7TVGlobalResp(resp)
{
  handle7TVEmoteList(resp["emotes"]);
}

function handle7TVUserResp(resp)
{
  handle7TVEmoteList(resp["emote_set"]["emotes"]);
}

function handleTwitchPollBegin(pollData)
{
  g_PollActive = true;
  changePollVisibility();

  $(".twitch-poll-title").html("Poll: {0}".format(pollData.title));

  $(".twitch-poll-choice-container").empty();

  pollData.choices.forEach((val, idx) => { $(".twitch-poll-choice-container").append(PollChoiceTemplate.format((idx + 1), val.title)); });

  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj.item_type == "twitch_poll")
    {
      $("#item-{0}-text".format(itemId)).find(".twitch-poll-choice-bar-fill").css({ "background-color": itemObj.item_data.bar_color });
    }
  }

  $(".twitch-poll-vote-count").html("Total votes: 0")

  g_PollTimeRemaining = pollData.time_remaining;

  updatePollTimer(false);
  clearInterval(g_PollTimerUpdateInterval);
  g_PollTimerUpdateInterval = setInterval(updatePollTimer, c_EventTimerUpdateIntervalTimeout);
}

function handleTwitchPollProgress(pollData)
{
  g_PollActive = true;
  changePollVisibility();

  $(".twitch-poll-title").html("Poll: {0}".format(pollData.title));

  $(".twitch-poll-choice-container").empty();

  let totalVotes = 0;
  pollData.choices.forEach((val, idx) => { 
    totalVotes += val.votes; 
    $(".twitch-poll-choice-container").append(PollChoiceTemplate.format((idx + 1), val.title)); 
  });

  if (totalVotes > 0)
  {
    pollData.choices.forEach((val, idx) => {
      let barElem = $(".twitch-poll-choice-bar[choice='{0}']".format((idx + 1)));

      let percent = val.votes / totalVotes;

      let label = $(barElem).find(".twitch-poll-choice-bar-label");
      let fill = $(barElem).find(".twitch-poll-choice-bar-fill");

      label.html("{0}%".format((percent * 100).toFixed(1)));
      fill.css({ "width": "{0}%".format(percent * 100) });
    });
  }

  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj.item_type == "twitch_poll")
    {
      $("#item-{0}-text".format(itemId)).find(".twitch-poll-choice-bar-fill").css({ "background-color": itemObj.item_data.bar_color });
    }
  }

  $(".twitch-poll-vote-count").html("Total votes: {0}".format(totalVotes));

  g_PollTimeRemaining = pollData.time_remaining;

  updatePollTimer(false);
  clearInterval(g_PollTimerUpdateInterval);
  g_PollTimerUpdateInterval = setInterval(updatePollTimer, c_EventTimerUpdateIntervalTimeout);
}

function handleTwitchPollEnd(pollData)
{
  setTimeout(() => { 
    g_PollActive = false;
    changePollVisibility()
  }, 15000);

  g_PollTimeRemaining = 0;
  clearInterval(g_PollTimerUpdateInterval);

  $(".twitch-poll-timer").html("Poll ended.");
}

function changePollVisibility()
{
  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj["item_type"] == "twitch_poll")
    {
      if (itemObj["item_data"]["visibility"] == 3)
      {
        if (g_PollActive)
        {
          $("#item-{0}-text".format(itemId)).css({ "visibility": "inherit" });
        }
        else
        {
          $("#item-{0}-text".format(itemId)).css({ "visibility": "hidden" });
        }
      }
    }
  }
}

function updatePollTimer(decrementTime = true)
{
  timeSince = Date.now() - g_PollLastTime;

  if (decrementTime) 
  {
    g_PollTimeRemaining -= (timeSince / 1000.0);
  }

  if (g_PollTimeRemaining < 0) g_PollTimeRemaining = 0;
  $(".twitch-poll-timer").html("Vote now - {0}s left".format(Math.ceil(g_PollTimeRemaining).toFixed(0)));

  g_PollLastTime = Date.now();
}

function handleTwitchPredictionBegin(predData)
{
  g_PredictionActive = true;
  changePredictionVisibility();

  $(".twitch-pred-title").html("Prediction: {0}".format(predData.title));

  $(".twitch-pred-outcome-container").empty();

  predData.outcomes.forEach((val, idx) => { $(".twitch-pred-outcome-container").append(PredictionOutcomeTemplate.format(val.id, val.title)); });

  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj.item_type == "twitch_prediction")
    {
      $("#item-{0}-text".format(itemId)).find(".twitch-pred-outcome-bar-fill").css({ "background-color": itemObj.item_data.bar_color });
    }
  }

  g_PredictionTimeRemaining = predData.time_remaining;

  updatePredictionTimer(false);
  clearInterval(g_PredictionTimerUpdateInterval);
  g_PredictionTimerUpdateInterval = setInterval(updatePredictionTimer, c_EventTimerUpdateIntervalTimeout);
}

function handleTwitchPredictionProgress(predData)
{
  g_PredictionActive = true;
  changePredictionVisibility();

  $(".twitch-pred-title").html("Prediction: {0}".format(predData.title));

  $(".twitch-pred-outcome-container").empty();

  let totalPoints = 0;
  predData.outcomes.forEach((val, idx) => { 
    totalPoints += val.channel_points; 
    $(".twitch-pred-outcome-container").append(PredictionOutcomeTemplate.format(val.id, val.title)); 
  });

  if (totalPoints > 0)
  {
    predData.outcomes.forEach((val, idx) => {
      let barElem = $(".twitch-pred-outcome-bar[outcome='{0}']".format(val.id));

      let percent = val.channel_points / totalPoints;

      let label = $(barElem).find(".twitch-pred-outcome-bar-label");
      let fill = $(barElem).find(".twitch-pred-outcome-bar-fill");

      label.html("{0} points".format(pointFormatter(val.channel_points)));
      fill.css({ "width": "{0}%".format(percent * 100) });
    });
  }

  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj.item_type == "twitch_prediction")
    {
      $("#item-{0}-text".format(itemId)).find(".twitch-pred-outcome-bar-fill").css({ "background-color": itemObj.item_data.bar_color });
    }
  }

  $(".twitch-pred-point-count").html("Total points: {0}".format(pointFormatter(totalPoints)));

  g_PredictionTimeRemaining = predData.time_remaining;

  updatePredictionTimer(false);
  clearInterval(g_PredictionTimerUpdateInterval);
  g_PredictionTimerUpdateInterval = setInterval(updatePredictionTimer, c_EventTimerUpdateIntervalTimeout);
}

function handleTwitchPredictionLock(predData)
{
  g_PredictionActive = true;
  changePredictionVisibility();

  setTimeout(() => { 
    g_PredictionActive = false;
    changePredictionVisibility();
  }, 15000);

  $(".twitch-pred-title").html("Prediction: {0}".format(predData.title));

  $(".twitch-pred-outcome-container").empty();

  let totalPoints = 0;
  predData.outcomes.forEach((val, idx) => { 
    totalPoints += val.channel_points; 
    $(".twitch-pred-outcome-container").append(PredictionOutcomeTemplate.format(val.id, val.title)); 
  });

  if (totalPoints > 0)
  {
    predData.outcomes.forEach((val, idx) => {
      let barElem = $(".twitch-pred-outcome-bar[outcome='{0}']".format(val.id));

      let percent = val.channel_points / totalPoints;

      let label = $(barElem).find(".twitch-pred-outcome-bar-label");
      let fill = $(barElem).find(".twitch-pred-outcome-bar-fill");

      label.html("{0} points".format(pointFormatter(val.channel_points)));
      fill.css({ "width": "{0}%".format(percent * 100) });
    });
  }

  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj.item_type == "twitch_prediction")
    {
      $("#item-{0}-text".format(itemId)).find(".twitch-pred-outcome-bar-fill").css({ "background-color": itemObj.item_data.bar_color });
    }
  }

  $(".twitch-pred-point-count").html("Total points: {0}".format(pointFormatter(totalPoints)));

  g_PredictionTimeRemaining = 0;
  clearInterval(g_PredictionTimerUpdateInterval);

  $(".twitch-pred-timer").html("Prediction closed. Awaiting payout.");
}

function handleTwitchPredictionEnd(predData)
{
  g_PredictionActive = true;
  changePredictionVisibility();
  setTimeout(() => { 
    g_PredictionActive = false;
    changePredictionVisibility();
  }, 25000);

  $(".twitch-pred-title").html("Prediction: {0}".format(predData.title));

  $(".twitch-pred-outcome-container").empty();

  let totalPoints = 0;
  predData.outcomes.forEach((val, idx) => { 
    totalPoints += val.channel_points; 
    $(".twitch-pred-outcome-container").append(PredictionOutcomeTemplate.format(val.id, val.title)); 
  });

  if (totalPoints > 0)
  {
    predData.outcomes.forEach((val, idx) => {
      let barElem = $(".twitch-pred-outcome-bar[outcome='{0}']".format(val.id));

      let percent = val.channel_points / totalPoints;

      let label = $(barElem).find(".twitch-pred-outcome-bar-label");
      let fill = $(barElem).find(".twitch-pred-outcome-bar-fill");

      label.html("{0} points".format(pointFormatter(val.channel_points)));
      fill.css({ "width": "{0}%".format(percent * 100) });
    });
  }

  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj.item_type == "twitch_prediction")
    {
      $("#item-{0}-text".format(itemId)).find(".twitch-pred-outcome-bar-fill").css({ "background-color": itemObj.item_data.bar_color });
    }
  }

  $(".twitch-pred-point-count").html("Total points: {0}".format(pointFormatter(totalPoints)));

  if (predData.status == "resolved" && predData.winning_outcome !== null)
  {
    if (predData.outcomes.length == 2)
    {
      if (predData.outcomes[0].id == predData.winning_outcome.id)
      {
        $(".twitch-pred-timer").html("Believers win!");
      }
      else
      {
        $(".twitch-pred-timer").html("Doubters win!");
      }
    }
    else
    {
      for (var i = 0; i < predData.outcomes.length; i++)
      {
        if (predData.outcomes[i].id == predData.winning_outcome.id)
        {
          $(".twitch-pred-timer").html("Outcome {0} wins!".format(i));
        }
      }
    }

    $(".twitch-pred-outcome-name[outcome='{0}']".format(predData.winning_outcome.id)).html("{0} &check;".format(predData.winning_outcome.title));
  }
  else
  {
    $(".twitch-pred-timer").html("Prediction canceled. Points returned.");
  }
}

function changePredictionVisibility()
{
  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    if (itemObj["item_type"] == "twitch_prediction")
    {
      if (itemObj["item_data"]["visibility"] == 3)
      {
        if (g_PredictionActive)
        {
          $("#item-{0}-text".format(itemId)).css({ "visibility": "inherit" });
        }
        else
        {
          $("#item-{0}-text".format(itemId)).css({ "visibility": "hidden" });
        }
      }
    }
  }
}

function pointFormatter(num)
{
  let absv = Math.abs(num);
  if (absv < 100_000)
  {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  else if (absv >= 100_000 && absv < 100_000_000)
  {
    let thousands = num / 1_000;
    return "{0}K".format(thousands.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  }
  else if (absv >= 100_000_000 && absv < 100_000_000_000)
  {
    let millions = num / 1_000_000;
    return "{0}M".format(millions.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  }
  else
  {
    let billions = num / 1_000_000_000;
    return "{0}B".format(billions.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  }
}

function updatePredictionTimer(decrementTime = true)
{
  timeSince = Date.now() - g_PredictionLastTime;

  if (decrementTime) 
  {
    g_PredictionTimeRemaining -= (timeSince / 1000.0);
  }

  if (g_PredictionTimeRemaining < 0) g_PredictionTimeRemaining = 0;
  $(".twitch-pred-timer").html("Gamble now - {0}s left".format(Math.ceil(g_PredictionTimeRemaining).toFixed(0)));

  g_PredictionLastTime = Date.now();
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///           YOUTUBE
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function onYouTubeIframeAPIReady()
{
  g_YouTubePlayerAPILoaded = true;
}

function updateYouTubePlayer(itemId)
{
  if (g_ItemDict[itemId]["player"] == undefined)
    return;

  var videoData = g_ItemDict[itemId]["player"].getVideoData();

  g_ItemDict[itemId].player.setVolume(g_ItemDict[itemId].item_data.volume);

  if (videoData.video_id != g_ItemDict[itemId].item_data.video_id)
  {
    g_ItemDict[itemId].player.loadVideoById(g_ItemDict[itemId].item_data.video_id);
  }

  if (g_ItemDict[itemId]['item_data']['muted'])
  {
    g_ItemDict[itemId].player.mute();
  }
  else
  {
    g_ItemDict[itemId].player.unMute();
  }

  if (g_ItemDict[itemId]['item_data']['paused'])
  {
    g_ItemDict[itemId].player.pauseVideo();
  }
  else
  {
    g_ItemDict[itemId].player.playVideo();
  }
}

function resetYouTubePlayer(itemId)
{
  if (g_YouTubePlayerAPILoaded) 
  {
    g_ItemDict[itemId].player.cueVideoById(g_ItemDict[itemId].item_data.video_id, g_ItemDict[itemId].item_data.start_time);
  }
}

function onPlayerReady(event) {
  event.target.setVolume(0);
  event.target.pauseVideo();

  var itemElem = $(event.target.g).closest(".overlay-item");
  g_ItemDict[itemElem.attr("itemid")]["player_ready"] = true;
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///           TWITCH
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function createTwitchStreamPlayer(divId, channel)
{
  return new Twitch.Player(divId, {
    width: '100%',
    height: '100%',
    muted: true,
    channel:  channel,
  });
}

function updateTwitchStreamPlayer(itemId)
{
  if (g_ItemDict[itemId].player == null)
  {
    return
  }

  if (g_ItemDict[itemId].player.getChannel() != g_ItemDict[itemId].item_data.channel)
  {
    g_ItemDict[itemId].player.setChannel(g_ItemDict[itemId].item_data.channel);
  }

  updateTwitchEmbed(itemId);
}

function resetTwitchStreamEmbed(itemId)
{
  g_ItemDict[itemId].player.setChannel(g_ItemDict[itemId].item_data.channel);
}

function createTwitchVideoPlayer(divId, video, time)
{
  return new Twitch.Player(divId, {
    width: '100%',
    height: '100%',
    muted: true,
    video: video,
    time: time,
  });
}

function updateTwitchVideoPlayer(itemId)
{
  if (g_ItemDict[itemId].player == null)
  {
    return
  }

  if (g_ItemDict[itemId].player.getVideo() != g_ItemDict[itemId].item_data.video_id)
  {
    g_ItemDict[itemId].player.setVideo(g_ItemDict[itemId].item_data.video_id, g_ItemDict[itemId].item_data.start_time);
  }

  updateTwitchEmbed(itemId);
}

function resetTwitchVideoEmbed(itemId)
{
  g_ItemDict[itemId].player.seek(g_ItemDict[itemId].item_data.start_time);
}

function updateTwitchEmbed(itemId)
{
  if (g_ItemDict[itemId].item_data.paused)
  {
    g_ItemDict[itemId].player.pause();
  }
  else
  {
    g_ItemDict[itemId].player.play();
  }

  g_ItemDict[itemId].player.setMuted(g_ItemDict[itemId].item_data.muted);
  g_ItemDict[itemId].player.setVolume(g_ItemDict[itemId].item_data.volume / 100.0);
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///           AUDIO
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function resetAudioItem(itemId)
{
  g_ItemDict[itemId]['audio'].currentTime = 0;
}

function playAudioItem(itemId)
{
  g_ItemDict[itemId]['audio'].play();
}

function pauseAudioItem(itemId)
{
  g_ItemDict[itemId]['audio'].pause();
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///           TIMERS
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function getStopwatchText(idata)
{
  var elapsedTime = Math.round(Date.now() / 1000) - idata['timer_start'];
  if (idata['paused'])
  {
    elapsedTime = idata['pause_time'] - idata['timer_start']
  }
  return idata["timer_format"].format(secondsToTimeFormat(elapsedTime));
}

function getCountdownText(idata)
{
  var endDt = new Date(idata["timer_end"]);
  var nowDt = new Date();

  var secondsLeft = 0;
  if (nowDt < endDt)
  {
    secondsLeft = Math.round((endDt.getTime() - nowDt.getTime()) / 1000);
  }

  return idata["timer_format"].format(secondsToTimeFormat(secondsLeft));
}

function LocalToUTC(localStr)
{
  let iDT = new Date(localStr);
  let year = iDT.getUTCFullYear();
  let month = iDT.getUTCMonth() + 1;
  let date = iDT.getUTCDate();
  let hours = iDT.getUTCHours();
  let minutes = iDT.getUTCMinutes();
  let seconds = iDT.getUTCSeconds();
  return "{0}-{1}-{2}T{3}:{4}:{5}Z".format(String(year), 
                                           String(month).padStart(2, "0"), 
                                           String(date).padStart(2, "0"), 
                                           String(hours).padStart(2, "0"), 
                                           String(minutes).padStart(2, "0"), 
                                           String(seconds).padStart(2, "0"));
}

function UTC_ToLocal(utcStr)
{
  let idt = new Date(utcStr);
  let year = idt.getFullYear();
  let month = idt.getMonth() + 1;
  let date = idt.getDate();
  let hours = idt.getHours();
  let minutes = idt.getMinutes();
  let seconds = idt.getSeconds();
  return "{0}-{1}-{2}T{3}:{4}:{5}".format(String(year), 
                                          String(month).padStart(2, "0"), 
                                          String(date).padStart(2, "0"), 
                                          String(hours).padStart(2, "0"), 
                                          String(minutes).padStart(2, "0"), 
                                          String(seconds).padStart(2, "0"));
}

function updateTimerItems()
{
  let overlayElem = $("#overlay");
  for (const [itemId, itemObj] of Object.entries(g_ItemDict))
  {
    switch (itemObj["item_type"])
    {
      case "stopwatch":
        let stopwatchText = getStopwatchText(itemObj["item_data"]);
        setTextItemContent(overlayElem, itemId, stopwatchText, itemObj["item_type"], itemObj["item_data"]);
        break;
      case "countdown":
        let countdownText = getCountdownText(itemObj["item_data"]);
        setTextItemContent(overlayElem, itemId, countdownText, itemObj["item_type"], itemObj["item_data"]);
        break;
      default:
        break;
    }
  }
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///           MISC
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function getItemIconName(itemType)
{
  var itemIcon = 'text_snippet'
  switch (itemType)
  {
    case "image":
      itemIcon = 'image';
      break;
    case "canvas":
      itemIcon = "palette";
      break;
    case "audio":
      itemIcon = 'music_note';
      break;
    case "stopwatch":
      itemIcon = 'timer';
      break;
    case "countdown":
      itemIcon = "alarm"
      break;
    case "counter":
      itemIcon = '123';
      break;
    case "embed":
      itemIcon = "picture_in_picture";
      break;
    case "youtube_video":
      itemIcon = "smart_display";
      break;
    case "twitch_stream":
    case "twitch_video":
      itemIcon = "live_tv";
      break;
    case "twitch_chat":
      itemIcon = "forum";
      break
    case "twitch_poll":
      itemIcon = "ballot";
      break;
    case "twitch_prediction":
      itemIcon = "casino";
      break;
    case "text":
    default:
      break;
  }

  return itemIcon;
}

window.addEventListener('load', function(e) {
  var tag = document.createElement('script');

  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  getChatEmotes();

  g_ItemTimerUpdateInterval = setInterval(updateTimerItems, c_ItemTimerUpdateIntervalTimeout);
}, false);