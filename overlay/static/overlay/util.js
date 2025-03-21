var WEBSOCKET = undefined;
var RECONNECT_INTERVAL = undefined;
var YOUTUBE_PLAYER_API_LOADED = false;

var itemDict = {};

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
  if ("editor" in data)
    editor = data.editor;

  switch (command)
  {
    case "list_overlay_items":
      updateItems(data);
      break;
    case "overlay_item_added":
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
    case "canvas_updated":
      handleCanvasUpdate(data.item_id, data.history, (editor == overlayUserId));
      break;
    case "user_present":
      userPresent(data);
      break;
    case "mouse_position":
      repositionMouse(data);
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
  WEBSOCKET = new WebSocket("{0}//{1}/ws/overlay/{2}/".format(protocol, window.location.host, overlayId));

  WEBSOCKET.onopen = (e) => { handleWebsocketOpen(e); };
  WEBSOCKET.onmessage = (e) => { handleWebsocketMessage(e); };
  WEBSOCKET.onclose = (e) => { attemptReconnect(e, overlayId); };
}

function sendWebsocketMessage(cmd, objData)
{
  if (WEBSOCKET != undefined && WEBSOCKET.readyState == WebSocket.OPEN)
  {
    WEBSOCKET.send(JSON.stringify({
      "command": cmd,
      "data": objData,
    }));
  }
}

function sendWebsocketMessages(msgList)
{
  if (WEBSOCKET != undefined && WEBSOCKET.readyState == WebSocket.OPEN)
  {
    WEBSOCKET.send(JSON.stringify({ "commands": msgList }));
  }
}

function getDefaultCSS(editView, idata)
{
  var visible = "hidden";

  if ((idata['visibility'] == 1 && editView) || (idata["visibility"] == 2))
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

function getDefaultContainerCSS(editView, idata)
{
  var visible = false;

  if ((idata['visibility'] == 1 && editView) || (idata["visibility"] == 2))
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
  if (RECONNECT_INTERVAL == undefined)
  {
    RECONNECT_INTERVAL = setInterval(() => { 
      if (WEBSOCKET.readyState == WebSocket.OPEN)
      {
        console.log("Reconnected websocket.");
        clearInterval(RECONNECT_INTERVAL);
        RECONNECT_INTERVAL = undefined;
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
  delete itemDict[itemId];

  getItemDiv(itemId).remove();
  $("#item-{0}-list-entry".format(itemId)).remove();

  if (itemId == selectedItem)
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
  var itemType = itemDict[itemId]['item_type'];
  
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
  var itemType = itemDict[itemId]['item_type'];
  
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
  var itemType = itemDict[itemId]['item_type'];
  
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

function setTextItemContent(editView, overlayElement, itemId, itemText, itemData)
{
  var overlayElemWidth = $(overlayElement).width();
  var textElemId = "#item-{0}-text".format(itemId);
  var fontSize = (overlayElemWidth * itemData['font_size']) / overlayWidth;

  $(textElemId).text(itemText);

  var itemCSS = getDefaultCSS(editView, itemData);
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

function addOrUpdateItem(editView, selfEdit, overlayElement, itemId, itemType, isDisplayed, top, left, width, height, z, rotation, itemData, afterAdditionCallback, afterEditCallback)
{
  var itemElemId = '#item-{0}'.format(itemId);
  var itemContainerId = '#item-{0}-container'.format(itemId);

  if(!editView && itemData["view_lock"])
  {
    return;
  }

  if ($(itemElemId).length == 0)
  {
    $(overlayElement).append("<div id='item-{0}' itemId='{0}' class='overlay-item {1}-item unselected'><div id='item-{0}-container' itemId='{0}' class='overlay-item-container'></div></div>".format(itemId, itemType))
  
    setItemPosition(itemId, top, left, width, height, z, rotation);
    $(itemContainerId).css(getDefaultContainerCSS(editView, itemData));

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

        $(imgElemId).css(getDefaultCSS(editView, itemData));
        break;
      case "canvas":
        $(itemContainerId).append("<canvas id='item-{0}-canvas' width='{1}px' height='{2}px' />".format(itemId, width, height));

        $("#item-{0}-canvas".format(itemId)).css(getDefaultCSS(editView, itemData));
        handleCanvasUpdate(itemId, itemData["history"], (selfEdit && editView));
        break;
      case "audio":
        audioUrl = itemData['audio_url'];

        itemDict[itemId]['audio'] = new Audio(audioUrl);
        itemDict[itemId]['audio'].load();
        itemDict[itemId]['audio'].volume = (itemData['volume'] / 100.0);
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

        itemDict[itemId]['player_ready'] = false;
        itemDict[itemId]['player'] = undefined;

        if (YOUTUBE_PLAYER_API_LOADED)
        {
          createYouTubePlayer(itemId);
        }

        $(playerId).css(getDefaultCSS(editView, itemData));
        break;
      case "twitch_stream":
        var playerId = "#item-{0}-player".format(itemId)

        $(itemContainerId).html(`<div id="item-{0}-player" class="overlay-item-child noselect" />`.format(itemId));

        if (itemDict[itemId].item_data.channel != "")
        {
          itemDict[itemId]['player'] = createTwitchStreamPlayer("item-{0}-player".format(itemId), itemDict[itemId].item_data.channel);
  
          updateTwitchStreamPlayer(itemId);
        }
        else
        {
          itemDict[itemId]['player'] = null;
        }

        $(playerId).css(getDefaultCSS(editView, itemData));
        break;
      case "twitch_video":
        var playerId = "#item-{0}-player".format(itemId)

        $(itemContainerId).html(`<div id="item-{0}-player" class="overlay-item-child noselect" />`.format(itemId));

        if (itemDict[itemId].item_data.video_id != "")
        {
          itemDict[itemId]["player"] = createTwitchVideoPlayer("item-{0}-player".format(itemId), 
                                                               itemDict[itemId].item_data.video_id, 
                                                               startTimeToTwitchVideoTime(itemDict[itemId].item_data.start_timeh));
  
          updateTwitchVideoPlayer(itemId);
        }
        else
        {
          itemDict[itemId]['player'] = null;
        }

        $(playerId).css(getDefaultCSS(editView, itemData));
        break;
      case "text":
        $(itemContainerId).append("<pre id='item-{0}-text' class='overlay-item-child noselect' />".format(itemId));
        setTextItemContent(editView, overlayElement, itemId, itemData['text'], itemData);
        break;
      case "stopwatch":
        $(itemContainerId).append("<pre id='item-{0}-text' class='overlay-item-child noselect' />".format(itemId));

        var elapsedTime = Math.round(Date.now() / 1000) - itemData['timer_start'];
        if (itemData['paused'])
        {
          elapsedTime = itemData['pause_time'] - itemData['timer_start'];
        }
        var textContent = itemData["timer_format"].format(secondsToTimeFormat(elapsedTime));
        
        setTextItemContent(editView, overlayElement, itemId, textContent, itemData);
        break;
      case "counter":
        $(itemContainerId).append("<pre id='item-{0}-text' class='overlay-item-child noselect' />".format(itemId));

        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(editView, overlayElement, itemId, textContent, itemData);
        break;
      default:
        break;
    }

    afterAdditionCallback();
  }
  else
  {
    setItemPosition(itemId, top, left, width, height, z, rotation);
    $(itemContainerId).css(getDefaultContainerCSS(editView, itemData));

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

        imgTag.css(getDefaultCSS(editView, itemData));
        break;
      case "canvas":
        var canvasId = "#item-{0}-canvas".format(itemId);
        var canvasTag = $(canvasId);

        canvasTag.css(getDefaultCSS(editView, itemData));
        
        if (!itemDict[itemId]["drawing"])
        {
          if (Math.abs(width - canvasTag.width()) > 1) canvasTag.attr('width', "{0}px".format(width));
          if (Math.abs(height - canvasTag.height()) > 1) canvasTag.attr('height', "{0}px".format(height));
        }
        handleCanvasUpdate(itemId, itemData["history"], (selfEdit && editView));
        break;
      case "audio":
        audioUrl = itemData['audio_url'];

        if (itemDict[itemId]['audio'].src != new URL(audioUrl, window.location.origin))
        {
          itemDict[itemId]['audio'].src = audioUrl;
          itemDict[itemId]['audio'].load();
        }

        itemDict[itemId]['audio'].volume = (itemData['volume'] / 100.0);
        break;
      case "embed":
        var iframeId = "#item-{0}-iframe".format(itemId)

        if ($(iframeId).attr('src') != itemData['embed_url'])
        {
          $(iframeId).attr('src', itemData['embed_url']);
        }

        $(iframeId).css(getDefaultCSS(editView, itemData));
        break;
      case "youtube_video":
        var playerId = "#item-{0}-player".format(itemId);

        if (YOUTUBE_PLAYER_API_LOADED)
        {
          if (itemDict[itemId]['player'] == undefined)
          {
            createYouTubePlayer(itemId);
          }
          
          if (itemDict[itemId]['player_ready'])
          {
            updateYouTubePlayer(itemId);
          }
        }

        $(playerId).css(getDefaultCSS(editView, itemData));
        break;
      case "twitch_stream":
        var playerId = "#item-{0}-player".format(itemId);

        if (itemDict[itemId].item_data.channel != "")
        {
          if (itemDict[itemId]['player'] == null)
          {
            itemDict[itemId]['player'] = createTwitchStreamPlayer("item-{0}-player".format(itemId), itemDict[itemId].item_data.channel);
          }

          updateTwitchStreamPlayer(itemId);
        }

        $(playerId).css(getDefaultCSS(editView, itemData));
        break;
      case "twitch_video":
        var playerId = "#item-{0}-player".format(itemId)

        if (itemDict[itemId].item_data.video_id != "")
        {
          if (itemDict[itemId]['player'] == null)
          {
            itemDict[itemId]["player"] = createTwitchVideoPlayer("item-{0}-player".format(itemId), 
                                                                 itemDict[itemId].item_data.video_id, 
                                                                 startTimeToTwitchVideoTime(itemDict[itemId].item_data.start_timeh));
          }
  
          updateTwitchVideoPlayer(itemId);
        }

        $(playerId).css(getDefaultCSS(editView, itemData));
        break;
      case "text":
        setTextItemContent(editView, overlayElement, itemId, itemData['text'], itemData);
        break;
      case "stopwatch":
        var elapsedTime = Math.round(Date.now() / 1000) - itemData['timer_start'];
        if (itemData['paused'])
        {
          elapsedTime = itemData['pause_time'] - itemData['timer_start']
        }
        var textContent = itemData["timer_format"].format(secondsToTimeFormat(elapsedTime));
        
        setTextItemContent(editView, overlayElement, itemId, textContent, itemData);
        break
      case "counter":
        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(editView, overlayElement, itemId, textContent, itemData);
        break;
      default:
        break;
    }

    afterEditCallback();
  }
}

function onYouTubeIframeAPIReady()
{
  YOUTUBE_PLAYER_API_LOADED = true;
}

function onPlayerReady(event) {
  event.target.setVolume(0);
  event.target.pauseVideo();

  var itemElem = $(event.target.g).closest(".overlay-item");
  itemDict[itemElem.attr("itemid")]["player_ready"] = true;
}

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
  if (itemDict[itemId].player == null)
  {
    return
  }

  if (itemDict[itemId].player.getChannel() != itemDict[itemId].item_data.channel)
  {
    itemDict[itemId].player.setChannel(itemDict[itemId].item_data.channel);
  }

  updateTwitchEmbed(itemId);
}

function resetTwitchStreamEmbed(itemId)
{
  itemDict[itemId].player.setChannel(itemDict[itemId].item_data.channel);
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
  if (itemDict[itemId].player == null)
  {
    return
  }

  if (itemDict[itemId].player.getVideo() != itemDict[itemId].item_data.video_id)
  {
    itemDict[itemId].player.setVideo(itemDict[itemId].item_data.video_id, itemDict[itemId].item_data.start_time);
  }

  updateTwitchEmbed(itemId);
}

function resetTwitchVideoEmbed(itemId)
{
  itemDict[itemId].player.seek(itemDict[itemId].item_data.start_time);
}

function updateTwitchEmbed(itemId)
{
  if (itemDict[itemId].item_data.paused)
  {
    itemDict[itemId].player.pause();
  }
  else
  {
    itemDict[itemId].player.play();
  }

  itemDict[itemId].player.setMuted(itemDict[itemId].item_data.muted);
  itemDict[itemId].player.setVolume(itemDict[itemId].item_data.volume / 100.0);
}

function updateYouTubePlayer(itemId)
{
  if (itemDict[itemId]["player"] == undefined)
    return;

  var videoData = itemDict[itemId]["player"].getVideoData();

  itemDict[itemId].player.setVolume(itemDict[itemId].item_data.volume);

  if (videoData.video_id != itemDict[itemId].item_data.video_id)
  {
    itemDict[itemId].player.loadVideoById(itemDict[itemId].item_data.video_id);
  }

  if (itemDict[itemId]['item_data']['muted'])
  {
    itemDict[itemId].player.mute();
  }
  else
  {
    itemDict[itemId].player.unMute();
  }

  if (itemDict[itemId]['item_data']['paused'])
  {
    itemDict[itemId].player.pauseVideo();
  }
  else
  {
    itemDict[itemId].player.playVideo();
  }
}

function resetYouTubePlayer(itemId)
{
  if (YOUTUBE_PLAYER_API_LOADED) 
  {
    itemDict[itemId].player.cueVideoById(itemDict[itemId].item_data.video_id, itemDict[itemId].item_data.start_time);
  }
}

function resetAudioItem(itemId)
{
  itemDict[itemId]['audio'].currentTime = 0;
}

function playAudioItem(itemId)
{
  itemDict[itemId]['audio'].play();
}

function pauseAudioItem(itemId)
{
  itemDict[itemId]['audio'].pause();
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