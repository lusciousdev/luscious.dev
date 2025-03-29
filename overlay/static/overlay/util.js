var g_Websocket = undefined;
var g_ReconnectInterval = undefined;
var g_YouTubePlayerAPILoaded = false;

var g_ItemDict = {};

const TRANSPARENT = "#00000000"

const NOSCROLL  = 0;
const LEFTRIGHT = 1;
const RIGHTLEFT = 2;
const TOPBOTTOM = 3;
const BOTTOMTOP = 4;

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
  if ("uid" in data)
    editor = data.uid;

  switch (command)
  {
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
      updateItems({ "items": [ { "item_type": data.item_type, "is_displayed": data.is_displayed, "item_data": data.item_data, } ]}, false, (editor == overlayUserId));
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
    case "pong":
      break;
    case "redirect":
      window.location.replace(data.url);
      break;
    case "error":
      console.warn(data);
      break;
    default:
      console.log("Unknown command: {0}".format(command));
      break;
  }
}

function connectWebsocket(overlayId)
{
  var protocol = "ws:"
  if (window.location.protocol == "https:")
    protocol = "wss:"
  g_Websocket = new WebSocket("{0}//{1}/ws/overlay/{2}/".format(protocol, window.location.host, overlayId));

  g_Websocket.onopen = (e) => { handleWebsocketOpen(e); };
  g_Websocket.onmessage = (e) => { handleWebsocketMessage(e); };
  g_Websocket.onclose = (e) => { attemptReconnect(e, overlayId); };
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

function getDefaultCSS(idata)
{
  var visible = "hidden";

  if ((idata['visibility'] == 1 && EDIT_VIEW) || (idata["visibility"] == 2))
  {
    visible = "inherit";
  }

  var cssObj = {
    "opacity": (idata['opacity'] / 100.0),
    "visibility": visible,
    "clip-path": "inset({0}% {1}% {2}% {3}%)".format(idata["crop_top"], idata["crop_right"], idata["crop_bottom"], idata["crop_left"]),
  };

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

function getDefaultContainerCSS(idata)
{
  var visible = false;

  if ((idata['visibility'] == 1 && EDIT_VIEW) || (idata["visibility"] == 2))
  {
    visible = true;
  }

  var containerCss = {
    "background-color": (visible && idata['background_enabled']) ? idata['background_color'] : TRANSPARENT,
  };
  
  return containerCss;
}

function attemptReconnect(e, overlayId)
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
      connectWebsocket(overlayId);
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

function setTextItemContent(overlayElement, itemId, itemText, itemData)
{
  var overlayElemWidth = $(overlayElement).width();
  var textElemId = "#item-{0}-text".format(itemId);
  var fontSize = (overlayElemWidth * itemData['font_size']) / OVERLAY_WIDTH;

  $(textElemId).text(itemText);

  var itemCSS = getDefaultCSS(itemData);
  itemCSS["font-size"] = "{0}pt".format(fontSize);
  itemCSS["font-family"] = "{0}, sans-serif".format(itemData["font"]);
  itemCSS["font-weight"] = itemData["font_weight"];
  itemCSS["color"] = itemData['color'];
  itemCSS["text-shadow"] = "{0}pt {1}pt {2}pt {3}".format(itemData["drop_shadow_offset_x"], itemData["drop_shadow_offset_y"], itemData["drop_shadow_blur_radius"], itemData["drop_shadow_enabled"] ? itemData["drop_shadow_color"] : TRANSPARENT);
  itemCSS["-webkit-text-stroke-width"] = "{0}pt".format(itemData["text_outline_width"])
  itemCSS["-webkit-text-stroke-color"] = itemData["text_outline_enabled"] ? itemData["text_outline_color"] : TRANSPARENT
  itemCSS["text-align"] = itemData["text_alignment"];

  $(textElemId).css(itemCSS);
}

function moveItem(itemId, x, y)
{
  if (!(itemId in g_ItemDict))
  {
    console.error("Tried to move item that doesn't exist yet.");
    return;
  }

  if (!EDIT_VIEW || !g_ItemDict[itemId]['moving'])
  {
    g_ItemDict[itemId]['item_data']['x'] = x;
    g_ItemDict[itemId]['item_data']['y'] = y;
  }

  var top = g_ItemDict[itemId]['item_data']['y'];
  var left = g_ItemDict[itemId]['item_data']['x'];
  var width = g_ItemDict[itemId]['item_data']['width'];
  var height = g_ItemDict[itemId]['item_data']['height'];
  if (EDIT_VIEW)
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

  if (!EDIT_VIEW || !g_ItemDict[itemId]['moving'])
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
  if (EDIT_VIEW)
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
    default:
      break;
  }
}

function addOrUpdateItem(selfEdit, overlayElement, itemId, itemType, isDisplayed, top, left, width, height, z, rotation, itemData, prevItemData, afterAdditionCallback, afterEditCallback)
{
  var itemElemId = '#item-{0}'.format(itemId);
  var itemContainerId = '#item-{0}-container'.format(itemId);

  if(!EDIT_VIEW && itemData["view_lock"])
  {
    return;
  }

  if ($(itemElemId).length == 0)
  {
    $(overlayElement).append("<div id='item-{0}' itemId='{0}' class='overlay-item {1}-item unselected'><div id='item-{0}-container' itemId='{0}' class='overlay-item-container'></div></div>".format(itemId, itemType))
  
    setItemPosition(itemId, top, left, width, height, z, rotation);
    $(itemContainerId).css(getDefaultContainerCSS(itemData));

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

        $(itemContainerId).append("<img id='item-{0}-img' class='noselect' src='{1}' width='{2}px' height='{3}px' draggable='false'>".format(itemId, imageUrl, width, height));
        // $(itemElemId).data('id', itemData['id']);
        // $(itemElemId).data('item_type', itemType);

        var imgElemId = "#item-{0}-img".format(itemId);
        
        $(imgElemId).on('dragstart', (event) => { event.preventDefault(); });

        $(imgElemId).css(getDefaultCSS(itemData));
        break;
      case "canvas":
        $(itemContainerId).append("<canvas id='item-{0}-canvas' width='{1}px' height='{2}px' />".format(itemId, width, height));

        $("#item-{0}-canvas".format(itemId)).css(getDefaultCSS(itemData));
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

        $(itemContainerId).html(`<iframe id="item-{0}-iframe" src="{1}" height="100%" width="100%" class="noselect" frameBorder="0"></iframe>`.format(itemId, itemData['embed_url']));

        $(iframeId).css({
          "opacity": itemData['opacity'],
          "visibility": (itemData['visibility']) ? "inherit" : "hidden",
          "clip-path": "inset({0}% {1}% {2}% {3}%)".format(itemData["crop_top"], itemData["crop_left"], itemData["crop_bottom"], itemData["crop_right"]),
        });
        break;
      case "youtube_video":
        var playerId = "#item-{0}-player".format(itemId);

        $(itemContainerId).html(`<div id="item-{0}-player" class="overlay-item-child noselect" />`.format(itemId));

        g_ItemDict[itemId]['player_ready'] = false;
        g_ItemDict[itemId]['player'] = undefined;

        if (g_YouTubePlayerAPILoaded)
        {
          createYouTubePlayer(itemId);
        }

        $(playerId).css(getDefaultCSS(itemData));
        break;
      case "twitch_stream":
        var playerId = "#item-{0}-player".format(itemId)

        $(itemContainerId).html(`<div id="item-{0}-player" class="overlay-item-child noselect" />`.format(itemId));

        if (g_ItemDict[itemId].item_data.channel != "")
        {
          g_ItemDict[itemId]['player'] = createTwitchStreamPlayer("item-{0}-player".format(itemId), g_ItemDict[itemId].item_data.channel);
  
          updateTwitchStreamPlayer(itemId);
        }
        else
        {
          g_ItemDict[itemId]['player'] = null;
        }

        $(playerId).css(getDefaultCSS(itemData));
        break;
      case "twitch_video":
        var playerId = "#item-{0}-player".format(itemId)

        $(itemContainerId).html(`<div id="item-{0}-player" class="overlay-item-child noselect" />`.format(itemId));

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

        $(playerId).css(getDefaultCSS(itemData));
        break;
      case "text":
        $(itemContainerId).append("<pre id='item-{0}-text' class='overlay-item-child noselect' />".format(itemId));
        setTextItemContent(overlayElement, itemId, itemData['text'], itemData);
        break;
      case "stopwatch":
        $(itemContainerId).append("<pre id='item-{0}-text' class='overlay-item-child noselect' />".format(itemId));

        var elapsedTime = Math.round(Date.now() / 1000) - itemData['timer_start'];
        if (itemData['paused'])
        {
          elapsedTime = itemData['pause_time'] - itemData['timer_start'];
        }
        var textContent = itemData["timer_format"].format(secondsToTimeFormat(elapsedTime));
        
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break;
      case "counter":
        $(itemContainerId).append("<pre id='item-{0}-text' class='overlay-item-child noselect' />".format(itemId));

        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break;
      default:
        break;
    }

    afterAdditionCallback();
  }
  else
  {
    setItemPosition(itemId, top, left, width, height, z, rotation);
    $(itemContainerId).css(getDefaultContainerCSS(itemData));

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

        imgTag.css(getDefaultCSS(itemData));
        break;
      case "canvas":
        var canvasId = "#item-{0}-canvas".format(itemId);
        var canvasTag = $(canvasId);

        canvasTag.css(getDefaultCSS(itemData));
        
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

        $(iframeId).css(getDefaultCSS(itemData));
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

        $(playerId).css(getDefaultCSS(itemData));
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

        $(playerId).css(getDefaultCSS(itemData));
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

        $(playerId).css(getDefaultCSS(itemData));
        break;
      case "text":
        setTextItemContent(overlayElement, itemId, itemData['text'], itemData);
        break;
      case "stopwatch":
        var elapsedTime = Math.round(Date.now() / 1000) - itemData['timer_start'];
        if (itemData['paused'])
        {
          elapsedTime = itemData['pause_time'] - itemData['timer_start']
        }
        var textContent = itemData["timer_format"].format(secondsToTimeFormat(elapsedTime));
        
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break
      case "counter":
        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(overlayElement, itemId, textContent, itemData);
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

function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

function handleCanvasUpdate(itemId, history)
{
  if (EDIT_VIEW && g_ItemDict[itemId]["drawing"])
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
  if (EDIT_VIEW && g_ItemDict[itemId]["drawing"])
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

  context.lineWidth = EDIT_VIEW ? viewToEditLength(actionData["lineWidth"]) : actionData["lineWidth"];
  context.lineCap = 'round';


  context.beginPath()

  var p0 = new Point(actionData["points"][0][0], actionData["points"][0][1]);
  if (EDIT_VIEW)
    p0 = viewToEditPoint(p0)
  
  if (actionContinued)
  {
    p0 = g_ItemDict[itemId]["last_point"];
    if (EDIT_VIEW)
      p0 = viewToEditPoint(p0);
  }

  context.moveTo(p0.x, p0.y);

  for (var i = 0; i < actionData["points"].length; i++)
  {
    var p_i = new Point(actionData["points"][i][0], actionData["points"][i][1]);
    if (EDIT_VIEW)
      p_i = viewToEditPoint(p_i);
    context.lineTo(p_i.x, p_i.y);
  }
    
  context.stroke();

  g_ItemDict[itemId]['last_point'] = new Point(actionData.points[actionData.points.length - 1][0], actionData.points[actionData.points.length - 1][1]);
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
}, false);