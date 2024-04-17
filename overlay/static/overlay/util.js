var WEBSOCKET = undefined;
var RECONNECT_INTERVAL = undefined;

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

function handleWebsocketMessage(e)
{
  var eventData = JSON.parse(e.data);

  var command = eventData.command;
  var data = eventData.data;
  var editor = data.editor;

  switch (command)
  {
    case "list_overlay_items":
      updateItems(data);
      break;
    case "overlay_item_added":
      break;
    case "overlay_item_edited":
      updateItems({ "items": [ { "item_type": data.item_type, "item_data": data.item_data, } ]}, false, (editor == twitchUser));
      break;
    case "overlay_item_deleted":
      deleteItem(data.item_id);
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
  WEBSOCKET = new WebSocket("ws://{0}/ws/overlay/{1}/".format(window.location.host, overlayId));

  WEBSOCKET.onopen = (e) => { getOverlayItems(); };
  WEBSOCKET.onmessage = (e) => { handleWebsocketMessage(e); };
  WEBSOCKET.onclose = (e) => { attemptReconnect(e, overlayId); };
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

function getItemDiv(itemId)
{
  return $("#{0}".format(itemId));
}

function deleteItem(itemId)
{
  delete itemDict[itemId];

  getItemDiv(itemId).remove();
  $("#{0}-list-entry".format(itemId)).remove();

  if (itemId == selectedItem)
  {
    clearSelectedItem();
  }
}

const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function setItemPosition(itemId, top, left, width, height, z, rotation)
{
  $("#{0}".format(itemId)).css({
    "top": "{0}px".format(top),
    "left": "{0}px".format(left),
    "width": "{0}px".format(width),
    "height": "{0}px".format(height),
    "z-index": "{0}".format(z), 
    "transform": "rotate({0}deg)".format(rotation),
  });
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
  var textElemId = "#{0}-text".format(itemId);
  var fontSize = (overlayElemWidth * itemData['font_size']) / overlayWidth;

  $(textElemId).text(itemText);
  $(textElemId).css({
    "font-size": "{0}pt".format(fontSize),
    "font-family": "{0}, sans-serif".format(itemData["font"]),
    "font-weight": itemData["font_weight"],
    "color": itemData['color'],
    "background-color": (itemData['background_enabled']) ? itemData['background'] : "#00000000",
    "visibility": (itemData['visible']) ? "inherit" : "hidden",
    "text-align": itemData["text_alignment"],
  });
}

function addOrUpdateItem(overlayElement, itemId, itemType, top, left, width, height, z, rotation, itemData, afterAdditionCallback, afterEditCallback)
{
  var itemElemId = '#{0}'.format(itemId);
  if ($(itemElemId).length == 0)
  {
    $(overlayElement).append("<div id='{0}' class='overlay-item unselected'></div>".format(itemId))

    switch (itemType)
    {
      case "ImageItem":
        imageUrl = itemData['url'];
        if (imageUrl == "")
        {
          imageUrl = itemData['image_url'];
        }

        $(itemElemId).append("<img id='{0}-img' class='noselect' src='{1}' width='{2}px' height='{3}px' draggable='false'>".format(itemId, imageUrl, width, height));
        $(itemElemId).data('id', itemData['id']);
        $(itemElemId).data('item_type', itemType);

        var imgElemId = "#{0}-img".format(itemId);
        
        $(imgElemId).on('dragstart', (event) => { event.preventDefault(); });

        $(imgElemId).css({
          "visibility": (itemData['visible']) ? "inherit" : "hidden",
        });
        break;
      case "EmbedItem":
        var iframeId = "#{0}-iframe".format(itemId)

        $(itemElemId).html(`<iframe id="{0}-iframe" src="{1}" height="100%" width="100%" class="noselect" frameBorder="0"></iframe>`.format(itemId, itemData['embed_url']));

        $(iframeId).css({
          "visibility": (itemData['visible']) ? "inherit" : "hidden",
        });
        break;
      case "TextItem":
        $(itemElemId).append("<pre id='{0}-text' class='text-item noselect' />".format(itemId));
        setTextItemContent(overlayElement, itemId, itemData['text'], itemData);
        break;
      case "StopwatchItem":
        $(itemElemId).append("<pre id='{0}-text' class='text-item noselect' />".format(itemId));

        var elapsedTime = Math.round(Date.now() / 1000) - itemData['timer_start'];
        if (itemData['paused'])
        {
          elapsedTime = itemData['pause_time'] - itemData['timer_start'];
        }
        var textContent = itemData["timer_format"].format(secondsToTimeFormat(elapsedTime));
        
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break;
      case "CounterItem":
        $(itemElemId).append("<pre id='{0}-text' class='text-item noselect' />".format(itemId));

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
    switch (itemType)
    {
      case "ImageItem":
        imageUrl = itemData['url'];
        if (imageUrl == "")
        {
          imageUrl = itemData['image_url'];
        }

        if ($("#{0}-img".format(itemId)).attr('src') != imageUrl)
        {
          $("#{0}-img".format(itemId)).attr('src', imageUrl);
        }

        $("#{0}-img".format(itemId)).attr('width', "{0}px".format(width));
        $("#{0}-img".format(itemId)).attr('height', "{0}px".format(height));

        $("#{0}-img".format(itemId)).css({
          "visibility": (itemData['visible']) ? "inherit" : "hidden",
        });
        break;
      case "EmbedItem":
        var iframeId = "#{0}-iframe".format(itemId)

        if ($(iframeId).attr('src') != itemData['embed_url'])
        {
          $(iframeId).attr('src', itemData['embed_url']);
        }

        $(iframeId).css({
          "visibility": (itemData['visible']) ? "inherit" : "hidden",
        });
        break;
      case "TextItem":
        setTextItemContent(overlayElement, itemId, itemData['text'], itemData);
        break;
      case "StopwatchItem":
        var elapsedTime = Math.round(Date.now() / 1000) - itemData['timer_start'];
        if (itemData['paused'])
        {
          elapsedTime = itemData['pause_time'] - itemData['timer_start']
        }
        var textContent = itemData["timer_format"].format(secondsToTimeFormat(elapsedTime));
        
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break
      case "CounterItem":
        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break;
      default:
        break;
    }

    afterEditCallback();
  }

  $(itemElemId).css({
    "visibility": (!itemData['minimized']) ? "visible" : "hidden",
  });

  setItemPosition(itemId, top, left, width, height, z, rotation);
}