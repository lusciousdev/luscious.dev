const editScriptData = document.currentScript.dataset;

window.shiftheld = false;
window.ctrlheld = false;

const c_AddOverlayItemsURL  = editScriptData.additemsurl;
const c_EditOverlayItemURL = editScriptData.edititemurl;
const c_EditOverlayItemsURL = editScriptData.edititemsurl;
const c_DeleteOverlayItemURL = editScriptData.deleteitemurl;
const c_OverlayOwner = editScriptData.overlayowner;
const c_OverlayUserID = editScriptData.overlayuid;
const c_NotificationURL = editScriptData.notificationurl;

const c_EditView = true;

var g_ScaledOverlayWidth = -1;
var g_ScaledOverlayHeight = -1;

const c_DefaultSizePercent = 0.667;

var g_CurrentScale = 1.0;
var g_OverlayOffset = new Point(0, 0);

const c_ScaleChange = 0.05;
const c_MinScale = 0.05;
const c_MaxScale = 5.0;
const c_ScrollAmount = 50.0;

var g_SelectedItem = undefined;
var g_OtherSelectedItems = [];

var g_SendEditChanges = {};
var g_SendCanvasPoints = {};

const c_MouseMoveCooldown = 2;

const c_WebsocketSendCooldown = 50; // ms
var g_WebsocketEventQueue = []

var g_StreamEmbed;

const c_NotificationAudio = new Audio(c_NotificationURL);
c_NotificationAudio.load();

// USER SETTINGS
var g_EmbedStream = false;
var g_NotificationVolume = 0.5;

const GrabTypes = {
  Move: 0,
  TopLeft: 1,
  TopRight: 2,
  BottomLeft: 3,
  BottomRight: 4,
};
var g_GrabType = GrabTypes.Move;

var g_SendMousePosition = false;
var g_MousePosition = { "x": 0, "y": 0 };
var g_LastMousePosition = Object.assign({}, g_MousePosition);

var g_EditorList = {};
var g_CursorDict = {};

var g_ChatOpen = false;
var g_FirstHistory = true;

function editToViewX(xCoord)
{
  return (xCoord - g_OverlayOffset.x) / g_CurrentScale;
}

function editToViewY(yCoord)
{
  return (yCoord - g_OverlayOffset.y) / g_CurrentScale;
}

function viewToEditX(xCoord)
{
  return (xCoord * g_CurrentScale) + g_OverlayOffset.x;
}

function viewToEditY(yCoord)
{
  return (yCoord * g_CurrentScale) + g_OverlayOffset.y;
}

function editToViewCoords(p)
{
  return new Point(editToViewX(p.x), editToViewY(p.y));
}

function viewToEditCoords(p)
{
  return new Point(viewToEditX(p.x), viewToEditY(p.y));
}

function editToViewPoint(p)
{
  return p.div(g_CurrentScale);
}

function viewToEditPoint(p)
{
  return p.mult(g_CurrentScale);
}

function editToViewLength(distance)
{
  return distance / g_CurrentScale;
}

function viewToEditLength(distance)
{
  return g_CurrentScale * distance;
}

function addGrabbers(itemId)
{
  getItemDiv(itemId).append("<div class='grabber topleft'></div>");
  getItemDiv(itemId).append("<div class='grabber topright'></div>");
  getItemDiv(itemId).append("<div class='grabber bottomleft'></div>");
  getItemDiv(itemId).append("<div class='grabber bottomright'></div>");

  $('#item-{0} .topleft'.format(itemId)).on("mousedown touchstart", (event) => { g_GrabType = GrabTypes.TopLeft; });
  $('#item-{0} .topright'.format(itemId)).on("mousedown touchstart", (event) => { g_GrabType = GrabTypes.TopRight; });
  $('#item-{0} .bottomleft'.format(itemId)).on("mousedown touchstart", (event) => { g_GrabType = GrabTypes.BottomLeft; });
  $('#item-{0} .bottomright'.format(itemId)).on("mousedown touchstart", (event) => { g_GrabType = GrabTypes.BottomRight; });
}

function updateItems(data, fullItemList = true, selfEdit = false)
{
  var itemSeen = {};
  for (itemId in g_ItemDict)
  {
    itemSeen[itemId] = false;
  }

  for (var index = 0; index < data['items'].length; index++)
  {
    var item = data['items'][index]
    var itemType = item["item_type"];
    var isDisplayed = item["is_displayed"];
    var itemData = item["item_data"];
    var itemId = itemData['id'];

    var prevItemData = null;
    if (itemId in g_ItemDict)
    {
      itemSeen[itemId] = true;
  
      if (!g_ItemDict[itemId]['moving'])
      {
        prevItemData = g_ItemDict[itemId]['item_data'];
        g_ItemDict[itemId]['item_data'] = itemData;
      }
    }
    else
    {
      g_ItemDict[itemId] = {
        "item_type": itemType,
        "item_data": itemData,
        "moving": false,
      };
    }

    var left   = viewToEditLength(g_ItemDict[itemId]['item_data']['x']);
    var top    = viewToEditLength(g_ItemDict[itemId]['item_data']['y']);
    var width  = viewToEditLength(g_ItemDict[itemId]['item_data']['width']);
    var height = viewToEditLength(g_ItemDict[itemId]['item_data']['height']);

    var z = itemData['z'];
    var rotation = itemData['rotation'];

    addOrUpdateItem(selfEdit, "#overlay", itemId, itemType, isDisplayed, top, left, width, height, z, rotation, itemData, prevItemData,
      () => { addItemCallback(itemId, itemType); },
      () => { updateItemCallback(itemId, itemType); });
  }

  if (fullItemList)
  {
    for (itemId in itemSeen)
    {
      if (!itemSeen[itemId])
      {
        deleteItem(itemId);
      }
    }
  }

  var result = $(".item-list-entry").sort(function(a, b) {
    if ($(a).attr("itemName").toLowerCase() == $(b).attr("itemName").toLowerCase())
    {
      if ($(a).attr("itemId") < $(b).attr("itemId"))
      {
        return -1;
      }
      else
      {
        return 1;
      }
    }
    else if ($(a).attr("itemName").toLowerCase() < $(b).attr("itemName").toLowerCase())
    {
      return -1;
    }
    else
    {
      return 1;
    }
  });

  $("#item-select-list").html(result);

  $(".item-list-entry").each(function(i, entry) {
    $(this).mousedown((e) => onMouseDownItemList(e, $(this).attr("itemid")));
  });

  onFilterChange();
}

function addItemCallback(itemId, itemType)
{
  getItemDiv(itemId).on("mousedown touchstart", onMousedownItem);
  addGrabbers(itemId);

  var item = g_ItemDict[itemId]

  $("#item-select-list").append(`<div class="item-list-entry" id="item-{0}-list-entry" itemId="{0}" itemName="{2}" itemType="{3}">
    <span class="material-symbols-outlined">{1}</span>&nbsp;{2}
  </div>`.format(itemId, getItemIconName(itemType), item["item_data"]["name"], item["item_type"]));

  $("#item-{0}-list-entry".format(itemId)).mousedown((e) => onMouseDownItemList(e, itemId));

  if (item["item_data"]["position_lock"])
  {
    getItemDiv(itemId).addClass("position-locked");
  }
  else
  {
    getItemDiv(itemId).removeClass("position-locked");
  }

  setCanvasCursor();
}

function updateItemCallback(itemId, itemType)
{
  var item = g_ItemDict[itemId]

  var itemListEntry = $("#item-{0}-list-entry".format(itemId));

  itemListEntry.attr("itemName", item["item_data"]["name"]);

  itemListEntry.html(`<span class="material-symbols-outlined">{0}</span><span>&nbsp;{1}</span>`.format(getItemIconName(itemType), item["item_data"]["name"]));

  if (g_SelectedItem != undefined) 
  {
    setEditFormInputs(g_SelectedItem);
  }

  if (item["item_data"]["position_lock"])
  {
    getItemDiv(itemId).addClass("position-locked");
  }
  else
  {
    getItemDiv(itemId).removeClass("position-locked");
  }

  setCanvasCursor();
}

function handleEditItemsSuccess(data) {}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///           USER PRESENCE
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function sendPing()
{
  g_WebsocketEventQueue.push({ "command": "ping", "data": {} });
}

function checkMousePosition()
{
  if ((g_MousePosition["x"] != g_LastMousePosition["x"]) || (g_MousePosition["y"] != g_LastMousePosition["y"]))
  {
    g_SendMousePosition = true;
    g_LastMousePosition = Object.assign({}, g_MousePosition);
  }
}

function userPresent(data) 
{
  if (data["uid"] == c_OverlayUserID)
    return;

  if (!(data["uid"] in g_EditorList))
    g_EditorList[data["uid"]] = {};

  if (!g_EditorList.hasOwnProperty(data["uid"]))
  {
    g_EditorList[data["uid"]] = {
      "login": data["username"],
      "last_seen": Date.now(),
      "last_mouse": Date.now(),
    }
  }
  else
  {
    g_EditorList[data["uid"]]["login"] = data["username"];
    g_EditorList[data["uid"]]["last_seen"] = Date.now();
  }
}

function repositionMouse(data)
{
  if (data["uid"] == c_OverlayUserID)
    return;

  if ($("#{0}".format(data["uid"])).length == 0)
  {
    $("#cursor-container").append(`<div id='{0}' class='cursor'>
      <span class="material-symbols-outlined">arrow_selector_tool</span> {1}
      </div>`.format(data["uid"], data["username"]));
  }

  var top = viewToEditLength(parseFloat(data["y"])) + $("#overlay").offset().top;
  var left = viewToEditLength(parseFloat(data["x"])) + $("#overlay").offset().left;

  $("#{0}".format(data["uid"])).css({
    "top": "{0}px".format(top),
    "left": "{0}px".format(left),
  });

  if (!(data["uid"] in g_EditorList))
    g_EditorList[data["uid"]] = {};

  g_EditorList[data["uid"]]["last_mouse"] = Date.now();
}

function removeInactiveUsers()
{
  var timeNow = Date.now();

  Object.keys(g_EditorList).forEach(function(key) {
    if ((timeNow - g_EditorList[key]["last_seen"]) > 60000.0) // 60s
    {
      $("#{0}".format(key)).remove();
      delete g_EditorList[key];
    }
  });
}

function removeInactiveCursors()
{
  var timeNow = Date.now();

  Object.keys(g_EditorList).forEach(function(key) {
    if ((timeNow - g_EditorList[key]["last_mouse"]) > 20000.0) // 20s
    {
      $("#{0}".format(key)).remove();
    }
  });
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///      WEBSOCKETS & HTTP
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function handleWebsocketOpen(e)
{
  getUserSettings();

  getOverlayItems();
  var getInterval = setInterval(function() { getOverlayItems(); }, 2500);

  getChatHistory();
  var historyInterval = setInterval(function() { getChatHistory(); }, (1000 * 60 * 60));

  setInterval(sendPing, c_WebsocketSendCooldown * 100);
  setInterval(checkMousePosition, c_WebsocketSendCooldown);
  setInterval(removeInactiveUsers, c_WebsocketSendCooldown * 10);
  setInterval(removeInactiveCursors, c_WebsocketSendCooldown * 10);
  setInterval(sendAllMessages, c_WebsocketSendCooldown);
}

function handleAjaxError(data)
{
  console.log("~~~~~~~~~~~ERROR~~~~~~~~~~~~~~~~~~~")
  console.log(data);
}

function sendAllMessages()
{
  msgList = Array.from(g_WebsocketEventQueue);
  g_WebsocketEventQueue = [];
  
  for (const itemId in g_ItemDict)
  {
    if (g_ItemDict[itemId]['moving'])
    {
      var itemData = {};
      itemData['x']      = g_ItemDict[itemId].item_data.x;
      itemData['y']      = g_ItemDict[itemId].item_data.y;

      var itemType = g_ItemDict[itemId]["item_type"];

      msgList.push({ "command": "move_overlay_item", "data": { "item_type": itemType, "item_id": itemId, "item_data": itemData } });
    }
    
    if (g_ItemDict[itemId]["resizing"])
    {
      var itemData = {};
      itemData['x']      = g_ItemDict[itemId].item_data.x;
      itemData['y']      = g_ItemDict[itemId].item_data.y;
      itemData['width']  = g_ItemDict[itemId].item_data.width;
      itemData['height'] = g_ItemDict[itemId].item_data.height;

      var itemType = g_ItemDict[itemId]["item_type"];

      msgList.push({ "command": "resize_overlay_item", "data": { "item_type": itemType, "item_id": itemId, "item_data": itemData } });
    }
  }

  for (const itemId in g_SendEditChanges)
  {
    var itemType = g_ItemDict[itemId]["item_type"];
    msgList.push({ "command": "edit_overlay_item", "data": { "item_type": itemType, "item_id": itemId, "item_data": g_SendEditChanges[itemId] } });

    delete g_SendEditChanges[itemId];
  }

  for (const itemId in g_SendCanvasPoints)
  {
    var itemType = g_ItemDict[itemId]["item_type"];
    msgList.push({ "command": "record_canvas_event", "data": { "item_type": itemType, "item_id": itemId, "event": "add_points", "points": g_SendCanvasPoints[itemId] } });

    delete g_SendCanvasPoints[itemId];
  }
  
  if (g_SendMousePosition)
  {
    msgList.push({ "command": "mouse_position", "data": g_MousePosition });
    g_SendMousePosition = false;
  }

  sendWebsocketMessages(msgList);
}

function getUserSettings()
{
  sendWebsocketMessage("get_user_settings", {});
}

function handleUserSettings(data)
{
  g_EmbedStream = data.embed_stream;
  g_NotificationVolume = data.notification_volume;

  c_NotificationAudio.volume = g_NotificationVolume;
  $("#notification-volume").val(g_NotificationVolume * 100);

  $("#embed-checkbox").prop('checked', g_EmbedStream);
  toggleEmbeddedTwitchStream({});
}

function getChatHistory()
{
  sendWebsocketMessage("get_chat_history", {});
}

function sendChatMessage()
{
  var messageContent = $("#chat-input").val();

  sendWebsocketMessage("send_chat_message", { "message": messageContent });

  $("#chat-input").val("");
}

function repopulateChatHistory(messageArray)
{
  var historyElem = $("#chat-history");
  var atBottom = (historyElem[0].scrollHeight - historyElem.scrollTop() - historyElem.outerHeight()) < 1;

  historyElem.html("");

  messageArray.forEach((msg, i) => {
    var msgDT = new Date(msg['epoch'] * 1000);
    var nowDT = new Date();

    let msgY = msgDT.getFullYear();
    let msgM = msgDT.getMonth();
    let msgD = msgDT.getDate();
    
    let nowY = nowDT.getFullYear();
    let nowM = nowDT.getMonth();
    let nowD = nowDT.getDate();
    

    var timeStr = "{0}:{1}:{2}".format(String(msgDT.getHours()).padStart(2, "0"), String(msgDT.getMinutes()).padStart(2, "0"), String(msgDT.getSeconds()).padStart(2, "0"));
    if ((msgY < nowY) || (msgY == nowY && msgM < nowM) || (msgY == nowY && msgM == nowM && msgD < nowD))
    {
      var timeStr = "{0}.{1}.{2}".format(String(msgDT.getFullYear()), String(msgDT.getMonth()).padStart(2, "0"), String(msgDT.getDate()).padStart(2, "0"));
    }

    historyElem.append("<div class=\"chat-message old-chat-message\">[{0}] <b>{1}</b>: {2}</div>".format(timeStr, msg["username"], msg["message"]));
  });

  historyElem.scrollTop(historyElem[0].scrollHeight);
}

function addChatMessages(msg)
{
  var historyElem = $("#chat-history");
  var atBottom = (historyElem[0].scrollHeight - historyElem.scrollTop() - historyElem.outerHeight()) < 1;

  var msgDT = new Date(msg['epoch'] * 1000);
  var timeStr = "{0}:{1}:{2}".format(String(msgDT.getHours()).padStart(2, "0"), String(msgDT.getMinutes()).padStart(2, "0"), String(msgDT.getSeconds()).padStart(2, "0"));

  historyElem.append("<div class=\"chat-message\">[{0}] <b>{1}</b>: {2}</div>".format(timeStr, msg["username"], msg["message"]));
  
  if (atBottom)
  {
    historyElem.scrollTop(historyElem[0].scrollHeight);
  }

  if (!g_ChatOpen)
  {
    $("#chat-message-indicator").css({ "display": "flex" });
  }
  
  if (msg.uid != c_OverlayUserID)
  {
    c_NotificationAudio.play();
  }
}

function initialResize(event)
{
  var mcWidth = $("#main-container").width();
  var mcHeight = $("#main-container").height();

  g_ScaledOverlayWidth = c_DefaultSizePercent * mcWidth;
  g_ScaledOverlayHeight = 9.0 / 16.0 * g_ScaledOverlayWidth;

  if (g_ScaledOverlayHeight > (c_DefaultSizePercent * mcHeight))
  {
    g_ScaledOverlayHeight = 0.667 * mcHeight;
    g_ScaledOverlayWidth = 16.0 / 9.0 * g_ScaledOverlayHeight;
  }

  g_CurrentScale = g_ScaledOverlayWidth / c_OverlayWidth;

  $("#overlay").width(g_ScaledOverlayWidth);
  $("#overlay").height(g_ScaledOverlayHeight);

  $("#twitch-embed").width(g_ScaledOverlayWidth);
  $("#twitch-embed").height(g_ScaledOverlayHeight);

  for (const prop in g_ItemDict)
  {
    var itemData = g_ItemDict[prop]['item_data'];
    var itemId = itemData['id'];

    var left   = viewToEditLength(itemData['x']);
    var top    = viewToEditLength(itemData['y']);
    var width  = viewToEditLength(itemData['width']);
    var height = viewToEditLength(itemData['height']);
    
    if (g_ItemDict[prop]['item_type'] == "image")
    {
      var imgTag = $("#item-{0}-img".format(itemId));
      imgTag.attr('width', "{0}px".format(width));
      imgTag.attr('height', "{0}px".format(height));
    }

    setItemPosition(itemId, top, left, width, height, itemData['rotation']);
  }
}

function documentScroll(event)
{
  if (event.ctrlKey)
  {
    event.preventDefault();
  }
}

function onScroll(event)
{
  if (event.ctrlKey)
  {
    event.preventDefault();
  }

  var delta = (event.type === 'DOMMouseScroll' ?
               event.originalEvent.detail * -40 :
               event.originalEvent.wheelDelta);

  if (delta > 0)
  {
    if (event.ctrlKey)
    {
      changeScale(g_CurrentScale + c_ScaleChange);
    }
    else if (event.shiftKey)
    {
      g_OverlayOffset.addX(c_ScrollAmount);
      repositionOverlay();
    }
    else
    {
      g_OverlayOffset.addY(c_ScrollAmount);
      repositionOverlay();
    }
  }
  else if (delta < 0)
  {
    if (event.ctrlKey)
    {
      changeScale(g_CurrentScale - c_ScaleChange);
    }
    else if (event.shiftKey)
    {
      g_OverlayOffset.addX(-c_ScrollAmount);
      repositionOverlay();
    }
    else
    {
      g_OverlayOffset.addY(-c_ScrollAmount);
      repositionOverlay();
    }
  }
}

function changeScale(newScale)
{
  var oldScale = g_CurrentScale;
  g_CurrentScale = newScale;
  if (g_CurrentScale < c_MinScale)
  {
    g_CurrentScale = c_MinScale;
  }
  else if (g_CurrentScale > c_MaxScale)
  {
    g_CurrentScale = c_MaxScale;
  }

  if (oldScale == g_CurrentScale)
    return;

  g_ScaledOverlayWidth = g_CurrentScale * c_OverlayWidth;
  g_ScaledOverlayHeight = g_CurrentScale * c_OverlayHeight;

  $("#overlay").width(g_ScaledOverlayWidth);
  $("#overlay").height(g_ScaledOverlayHeight);

  $("#twitch-embed").width(g_ScaledOverlayWidth);
  $("#twitch-embed").height(g_ScaledOverlayHeight);

  setAllItemPositions();
}

function setAllItemPositions()
{
  for (const prop in g_ItemDict)
  {
    var itemData = g_ItemDict[prop]['item_data'];
    var itemId = itemData['id'];

    var left   = viewToEditLength(itemData['x']);
    var top    = viewToEditLength(itemData['y']);
    var width  = viewToEditLength(itemData['width']);
    var height = viewToEditLength(itemData['height']);
    
    if (g_ItemDict[prop]['item_type'] == "image")
    {
      var imgTag = $("#item-{0}-img".format(itemId));
      imgTag.attr('width', "{0}px".format(width));
      imgTag.attr('height', "{0}px".format(height));
    }

    if (g_ItemDict[prop]['item_type'] == "canvas")
    {
      handleCanvasUpdate(prop, g_ItemDict[prop]["item_data"]["history"]);
    }

    if (g_ItemDict[prop]['item_type'] == "text" ||
        g_ItemDict[prop]['item_type'] == "counter" ||
        g_ItemDict[prop]['item_type'] == "stopwatch")
    {
      setTextItemContent($("#overlay"), prop, g_ItemDict[prop]["item_data"]["text"], g_ItemDict[prop]['item_type'], g_ItemDict[prop]["item_data"])
    }
    
    if (g_ItemDict[prop]['item_type'] == "twitch_chat" ||
        g_ItemDict[prop]['item_type'] == "twitch_poll" ||
        g_ItemDict[prop]['item_type'] == "twitch_prediction")
    {
      setTextItemCSS($("#overlay"), prop, g_ItemDict[prop]['item_type'], g_ItemDict[prop]["item_data"]);

      $("#item-{0}-text".format(itemId)).scrollTop($("#item-{0}-text".format(itemId))[0].scrollHeight);
    }

    setItemPosition(itemId, top, left, width, height, itemData["z"], itemData['rotation']);
  }
}

function repositionOverlay()
{
  $("#overlay").css({
    "left": viewToEditLength(g_OverlayOffset.x),
    "top": viewToEditLength(g_OverlayOffset.y),
  });

  for (const prop in g_ItemDict)
  {
    if (g_ItemDict[prop]['item_type'] == "canvas")
    {
      handleCanvasUpdate(prop, g_ItemDict[prop]["item_data"]["history"]);
    }
  }
}

function onMouseDownItemList(e, itemId)
{
  selectItem(itemId);
}

function onMousedownItem(e) 
{
  e.stopImmediatePropagation();

  switch (e.which)
  {
    case 2:
      // middle click
      e.preventDefault();
      handleBodyMiddleClick(e);
      break;
    case 3:
      // right click
      break;
    case 1:
    default:
      handleItemLeftClick(e, this)
      break;
  }
}

function handleItemLeftClick(e, elem)
{
  e.preventDefault();

  var pageX, pageY;
  if (e.type == "touchstart")
  {
    pageX = e.changedTouches[0].pageX;
    pageY = e.changedTouches[0].pageY;
  }
  else
  {
    pageX = e.pageX;
    pageY = e.pageY;
  }

  window.dragData = {};
  dragData.pageP0 = new Point(pageX, pageY);
  dragData.pagePn = new Point(pageX, pageY);
  dragData.pagePn_m1 = new Point(pageX, pageY);
  dragData.elem = elem;

  var elemId = $(dragData.elem).attr("itemId");

  function getGrabberPos(grabber)
  {
    return new Point(
      grabber.offset().left + (grabber.outerWidth() / 2),
      grabber.offset().top  + (grabber.outerHeight() / 2)
    );
  }

  function getItemPos(itemId)
  {
    return new Point(
      parseFloat(getItemDiv(itemId).css('left')),
      parseFloat(getItemDiv(itemId).css('top')),
    );
  }

  function getItemOffset(itemId)
  {
    return new Point(
      getItemDiv(itemId).offset().left,
      getItemDiv(itemId).offset().top
    );
  }

  function getItemDim(itemId)
  {
    return new Point(
      parseFloat(getItemDiv(itemId).css('width')),
      parseFloat(getItemDiv(itemId).css('height')),
    );
  }

  dragData.initialGrabberCoords = [
    {
      elem: $(dragData.elem).find(".topleft"),
      point: getGrabberPos($(dragData.elem).find(".topleft")),
    },
    {
      elem: $(dragData.elem).find(".topright"),
      point: getGrabberPos($(dragData.elem).find(".topright")),
    },
    {
      elem: $(dragData.elem).find(".bottomleft"),
      point: getGrabberPos($(dragData.elem).find(".bottomleft")),
    },
    {
      elem: $(dragData.elem).find(".bottomright"),
      point: getGrabberPos($(dragData.elem).find(".bottomright")),
    },
  ]
  
  var maxDist = distance(dragData.initialGrabberCoords[0].point.x, dragData.initialGrabberCoords[0].point.y, dragData.pageP0.x, dragData.pageP0.y);
  dragData.furthestCorner = dragData.initialGrabberCoords[0];

  for (var i = 1; i < dragData.initialGrabberCoords.length; i++)
  {
    var dist = distance(dragData.initialGrabberCoords[i].point.x, dragData.initialGrabberCoords[i].point.y, dragData.pageP0.x, dragData.pageP0.y);

    if (dist > maxDist)
    {
      maxDist = dist;
      dragData.furthestCorner = dragData.initialGrabberCoords[i];
    }
  }

  var oldSelectedItem = g_SelectedItem;
  selectItem(elemId);

  if (g_SelectedItem == undefined)
  {
    return;
  }

  var isCanvas = (g_ItemDict[g_SelectedItem]["item_type"] == "canvas");
  var canvasDraw = isCanvas && !($("#edit-canvas-form #id_drawing_mode").val() == "move");

  if (g_SelectedItem != oldSelectedItem && isCanvas)
  {
    canvasDraw = false;
  }

  dragData.elemP0 = new Point(parseFloat($(dragData.elem).css('left')), parseFloat($(dragData.elem).css('top')));
  dragData.distP0 = Point.sub2(dragData.furthestCorner.point, new Point(pageX, pageY));

  dragData.selectedElem = {
    point0: getItemPos(g_SelectedItem)
  }

  dragData.otherElems = {}
  g_OtherSelectedItems.forEach((itemId) => {
    dragData.otherElems[itemId] = {};
    dragData.otherElems[itemId]["point0"] = getItemPos(itemId);
  });

  if (isCanvas && canvasDraw)
  {
    var drawMode = getCanvasDrawingMode();
    var strokeStyle = getCanvasColor();
    var lineWidth = getCanvasLineWidth();

    var relMousePos = editToViewPoint(Point.sub2(dragData.pageP0, getItemOffset(elemId)));

    g_WebsocketEventQueue.push({ "command": "record_canvas_event", "data": { "item_id": g_SelectedItem, "item_type": g_ItemDict[g_SelectedItem]["item_type"], "event": "start_action", "action": drawMode, "action_data": { "strokeStyle": strokeStyle, "lineWidth": lineWidth, "points": [[relMousePos.x, relMousePos.y]] } } });

    g_ItemDict[elemId]["drawing"] = true;

    $('#main-container').on('mouseup touchend mouseleave touchcancel', handleMouseUp).on('mousemove touchmove', handleDrawing);
  }
  else if (!g_ItemDict[g_SelectedItem]["item_data"]["position_lock"])
  {
    $('#main-container').on('mouseup touchend mouseleave touchcancel', handleMouseUp).on('mousemove touchmove', handleDragging);

    if (g_GrabType == GrabTypes.Move)
      g_ItemDict[g_SelectedItem]['moving'] = true;
    else
      g_ItemDict[g_SelectedItem]['resizing'] = true;

    g_OtherSelectedItems.forEach((itemId) => {
      if (g_GrabType == GrabTypes.Move)
        g_ItemDict[itemId]['moving'] = true;
      else
        g_ItemDict[itemId]['resizing'] = true;
    });
  }

  var enableMoveHandler = false;
  var mouseMoveTimeout = setInterval(() => {
    enableMoveHandler = true;
  }, c_MouseMoveCooldown);

  function handleDragging(e)
  {
    if (enableMoveHandler)
    {
      enableMoveHandler = false;
    }
    else
    {
      return;
    }

    var pageX, pageY;
    if (e.type == "touchmove")
    {
      pageX = e.changedTouches[0].pageX;
      pageY = e.changedTouches[0].pageY;
    }
    else
    {
      pageX = e.pageX;
      pageY = e.pageY;
    }

    dragData.pagePn = new Point(pageX, pageY);

    var overlayLoc = new Point($("#overlay").offset().left, $("#overlay").offset().top);
    var borderWidth = parseFloat($(dragData.elem).css("border-left-width"));

    if (g_GrabType == GrabTypes.Move)
    {
      var offsetPosition = Point.sub2(dragData.pagePn, dragData.pageP0);

      if (!window.shiftheld)
      {
        var lowestXOffset = g_ScaledOverlayWidth;
        var lowestYOffset = g_ScaledOverlayHeight;

        dragData.initialGrabberCoords.forEach((grabberObj) => {
          var movedGrabberPos = Point.add2(grabberObj.point, offsetPosition);

          var grabberX = (movedGrabberPos.x - overlayLoc.x);
          var grabberY = (movedGrabberPos.y - overlayLoc.y);

          var distXLeft = grabberX;
          var distXRight = grabberX - g_ScaledOverlayWidth;

          var distYTop = grabberY;
          var distYBottom = grabberY - g_ScaledOverlayHeight;

          if (Math.abs(lowestXOffset) > Math.abs(distXLeft))
            lowestXOffset = distXLeft;
          if (Math.abs(lowestXOffset) > Math.abs(distXRight))
            lowestXOffset = distXRight;

          if (Math.abs(lowestYOffset) > Math.abs(distYTop))
            lowestYOffset = distYTop;
          if (Math.abs(lowestYOffset) > Math.abs(distYBottom))
            lowestYOffset = distYBottom;
        });

        var itemRotRad = g_ItemDict[elemId].item_data.rotation * Math.PI / 180.0;

        if (Math.abs(lowestXOffset) < (0.01 * g_ScaledOverlayWidth))
        {
          offsetPosition.subX(lowestXOffset);
        }

        if (Math.abs(lowestYOffset) < (0.01 * g_ScaledOverlayHeight))
        {
          offsetPosition.subY(lowestYOffset);
        }
      }
  
      var newPos = Point.add2(dragData.selectedElem.point0, offsetPosition);
      
      getItemDiv(g_SelectedItem).css({
        top: "{0}px".format(newPos.y), 
        left: "{0}px".format(newPos.x),
      });

      var itemTop  = editToViewLength(newPos.y + borderWidth);
      var itemLeft = editToViewLength(newPos.x + borderWidth);
      
      g_ItemDict[g_SelectedItem]['item_data']['x'] = Math.round(itemLeft);
      g_ItemDict[g_SelectedItem]['item_data']['y'] = Math.round(itemTop);

      g_OtherSelectedItems.forEach((itemId) => {
        newPos = Point.add2(dragData.otherElems[itemId].point0, offsetPosition);
        getItemDiv(itemId).css({
          top: "{0}px".format(newPos.y), 
          left: "{0}px".format(newPos.x),
        });

        var itemTop  = editToViewLength(newPos.y);
        var itemLeft = editToViewLength(newPos.x);
        g_ItemDict[itemId]['item_data']['x'] = Math.round(itemLeft);
        g_ItemDict[itemId]['item_data']['y'] = Math.round(itemTop);
      });
    }
    else
    {
      var mouseLoc = Point.sub2(dragData.pagePn, overlayLoc);
      var mouseOffset = new Point(0, 0);

      if (!window.shiftheld)
      {
        var distXLeft = mouseLoc.x;
        var distXRight = mouseLoc.x - g_ScaledOverlayWidth;

        var distYTop = mouseLoc.y;
        var distYBottom = mouseLoc.y - g_ScaledOverlayHeight;

        if (Math.abs(distXLeft) <= Math.abs(distXRight))
        {
          if (Math.abs(distXLeft) < (0.01 * g_ScaledOverlayWidth))
            mouseOffset.subX(distXLeft);
        }
        else
        {
          if (Math.abs(distXRight) < (0.01 * g_ScaledOverlayWidth))
            mouseOffset.subX(distXRight);
        }

        if (Math.abs(distYTop) <= Math.abs(distYBottom))
        {
          if (Math.abs(distYTop) < (0.01 * g_ScaledOverlayHeight))
            mouseOffset.subY(distYTop);
        }
        else
        {
          if (Math.abs(distYBottom) < (0.01 * g_ScaledOverlayHeight))
            mouseOffset.subY(distYBottom);
        }
      }

      var relativePos = Point.sub2(dragData.furthestCorner.point, Point.add2(dragData.pagePn, mouseOffset));

      var itemRotRad = g_ItemDict[elemId].item_data.rotation * Math.PI / 180.0;
      
      relativePos.rotate(-1 * itemRotRad);

      var newWidth = Math.abs(relativePos.x);
      var newHeight = Math.abs(relativePos.y);

      newWidth = Math.max(viewToEditLength(25), newWidth);
      newHeight = Math.max(viewToEditLength(25), newHeight);

      if (g_ItemDict[elemId].item_type == "image")
      {
        if (window.shiftheld)
        {
          var imgTag = $("#item-{0}-img".format(g_SelectedItem));
          var imgNaturalWidth = imgTag.get(0).naturalWidth;
          var imgNaturalHeight = imgTag.get(0).naturalHeight;

          var widthScale = newWidth / imgNaturalWidth;
          var heightScale = newHeight / imgNaturalHeight;

          var correctedWidth = newWidth;
          var correctedHeight = newHeight;
          if (heightScale >= widthScale)
          {
            correctedWidth = imgNaturalWidth * heightScale;
          }
          else
          {
            correctedHeight = imgNaturalHeight * widthScale;
          }

          newWidth = correctedWidth;
          newHeight = correctedHeight;

          newWidth = Math.max(viewToEditLength(25), newWidth);
          newHeight = Math.max(viewToEditLength(25), newHeight);
        }
      }
    
      $(dragData.elem).css({
        width: "{0}px".format(newWidth),
        height: "{0}px".format(newHeight),
      });

      var newFurthestCornerPoint = getGrabberPos(dragData.furthestCorner.elem);
      var offsetPosition = Point.sub2(dragData.furthestCorner.point, newFurthestCornerPoint);

      var newPos = Point.add2(getItemPos(elemId), offsetPosition);
      $(dragData.elem).css({
        top: "{0}px".format(newPos.y), 
        left: "{0}px".format(newPos.x),
      });

      if (g_ItemDict[elemId].item_type == "image")
      {
        var imgTag = $("#item-{0}-img".format(g_SelectedItem));
        imgTag.attr("width", "{0}px".format(newWidth));
        imgTag.attr("height", "{0}px".format(newHeight));
      }
      else if (g_ItemDict[elemId].item_type == "twitch_chat")
      {
        $("#item-{0}-text".format(elemId)).scrollTop($("#item-{0}-text".format(elemId))[0].scrollHeight);
      }
      
      var itemTop    = editToViewLength(newPos.y + borderWidth);
      var itemLeft   = editToViewLength(newPos.x + borderWidth);
      var itemWidth  = editToViewLength(newWidth);
      var itemHeight = editToViewLength(newHeight);
  
      g_ItemDict[elemId]['item_data']['x']      = Math.round(itemLeft);
      g_ItemDict[elemId]['item_data']['y']      = Math.round(itemTop);
      g_ItemDict[elemId]['item_data']['width']  = Math.round(itemWidth);
      g_ItemDict[elemId]['item_data']['height'] = Math.round(itemHeight);
    }
  
    setEditFormInputs(g_SelectedItem);

    dragData.pagePn_m1 = new Point(pageX, pageY);
  }

  function handleDrawing(e)
  {
    if (enableMoveHandler)
    {
      enableMoveHandler = false;
    }
    else
    {
      return;
    }

    var pageX, pageY;
    if (e.type == "touchmove")
    {
      pageX = e.changedTouches[0].pageX;
      pageY = e.changedTouches[0].pageY;
    }
    else
    {
      pageX = e.pageX;
      pageY = e.pageY;
    }

    dragData.pagePn = new Point(pageX, pageY);

    var lastMousePos = editToViewPoint(Point.sub2(dragData.pagePn_m1, getItemOffset(elemId)));
    var relMousePos = editToViewPoint(Point.sub2(dragData.pagePn, getItemOffset(elemId)));

    if (!(elemId in g_SendCanvasPoints))
      g_SendCanvasPoints[elemId] = [];

    g_SendCanvasPoints[elemId].push([relMousePos.x, relMousePos.y])

    drawLine(elemId, lastMousePos, relMousePos);

    dragData.pagePn_m1 = new Point(pageX, pageY);
  }

  function handleMouseUp(e){
    clearInterval(mouseMoveTimeout);

    if (isCanvas && canvasDraw)
    {
      handleDrawing(e);
    }
    else
    {
      handleDragging(e);
    }

    g_ItemDict[g_SelectedItem]['moving'] = false;
    g_ItemDict[g_SelectedItem]['resizing'] = false;
    g_ItemDict[g_SelectedItem]["drawing"] = false;
  
    g_OtherSelectedItems.forEach((itemId) => {
      g_ItemDict[itemId]['moving'] = false;
      g_ItemDict[itemId]['resizing'] = false;
    });

    g_GrabType = GrabTypes.Move;
    $('#main-container').off('mousemove touchmove', handleDragging).off('mousemove touchmove', handleDrawing).off('mouseup touchend mouseleave touchcancel', handleMouseUp);
  }
}

function onMouseMove(e)
{
  var x = e.pageX;
  var y = e.pageY;
  var leftOverlay = $("#overlay").offset().left;
  var topOverlay = $("#overlay").offset().top;

  var relx = x - leftOverlay;
  var rely = y - topOverlay;

  var ox = editToViewLength(relx);
  var oy = editToViewLength(rely);

  g_MousePosition['x'] = ox;
  g_MousePosition['y'] = oy;
}

function handleBodyMiddleClick(e)
{
  window.dragData = {};
  dragData.pageP0 = new Point(e.pageX, e.pageY);
  dragData.pagePn = new Point(e.pageX, e.pageY);
  dragData.pagePn_m1 = new Point(e.pageX, e.pageY);

  function handleDragging(e)
  {
    dragData.pagePn = new Point(e.pageX, e.pageY);

    var offsetPosition = Point.sub2(dragData.pagePn, dragData.pagePn_m1);

    g_OverlayOffset.addX(editToViewLength(offsetPosition.x));
    g_OverlayOffset.addY(editToViewLength(offsetPosition.y));

    dragData.pagePn_m1 = dragData.pagePn;

    setAllItemPositions();
    repositionOverlay();
  }

  function handleMouseUp(e){
    $('#main-container').off('mousemove touchmove', handleDragging).off('mouseup touchend mouseleave touchcancel', handleMouseUp);
  }

  $('#main-container').on('mouseup touchend mouseleave touchcancel', handleMouseUp).on('mousemove touchmove', handleDragging);
}

function onMouseDownBody(e)
{
  switch (e.which)
  {
    case 2:
      // Middle click
      e.preventDefault();
      handleBodyMiddleClick(e);
      break;
    case 3:
      // Right click
      break;
    case 1:
      // Left click
    default:
      if (g_SelectedItem !== undefined)
      {
        clearSelectedItem();
      }
      break;
  }
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///    ITEM SELECTION
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function selectItem(itemId)
{
  if (g_OtherSelectedItems.includes(itemId) || itemId == g_SelectedItem)
  {
    if (window.ctrlheld)
    {
      unselectItem(itemId);
    }
    return;
  }

  if (g_SelectedItem !== undefined && !window.ctrlheld)
  {
    clearSelectedItem(true);
  }
  
  var addingItem = false;
  
  if (g_SelectedItem == undefined)
  {
    g_SelectedItem = itemId;
  }
  else
  {
    g_OtherSelectedItems.push(itemId);
    addingItem = true;
  }

  getItemDiv(itemId).removeClass("unselected").addClass("selected");
  $("#item-{0}-list-entry".format(itemId)).addClass("selected-list-entry");

  $("#item-select-list").animate({
    scrollTop: $("#item-select-list").scrollTop() - $("#item-select-list").offset().top + $("#item-{0}-list-entry".format(itemId)).offset().top - 25
  }, 333);

  if (!addingItem)
  {
    openEditForm(g_SelectedItem);
    setEditFormInputs(g_SelectedItem, true);
  }
}

function unselectItem(itemId)
{
  if (itemId != g_SelectedItem && !g_OtherSelectedItems.includes(itemId))
  {
    return
  }

  if (itemId == g_SelectedItem)
  {
    if (g_OtherSelectedItems.length > 0)
    {
      g_SelectedItem = g_OtherSelectedItems.splice(0, 1)[0];
      
      openEditForm(g_SelectedItem);
      setEditFormInputs(g_SelectedItem, true);
    }
    else
    {
      clearSelectedItem();
      return;
    }
  }
  else if (g_OtherSelectedItems.includes(itemId))
  {
    g_OtherSelectedItems.splice(g_OtherSelectedItems.indexOf(itemId), 1);
  }

  getItemDiv(itemId).removeClass("selected").addClass("unselected");
  $("#item-{0}-list-entry".format(itemId)).removeClass("selected-list-entry");
}

function clearSelectedItem(swapping = false)
{
  if (g_SelectedItem !== undefined)
  {
    getItemDiv(g_SelectedItem).removeClass("selected").addClass("unselected");
    $("#item-{0}-list-entry".format(g_SelectedItem)).removeClass("selected-list-entry");

    g_SelectedItem = undefined;
  }

  g_OtherSelectedItems.forEach((itemId) => {
    getItemDiv(itemId).removeClass("selected").addClass("unselected");
    $("#item-{0}-list-entry".format(itemId)).removeClass("selected-list-entry");
  });

  g_OtherSelectedItems = [];
  
  for (var i = 0; i < $(".edit-container").length; i++)
  {
    $(".edit-container").eq(i).addClass("hidden");
  }

  $("#delete-item").addClass("hidden");

  var canvasDrawMode = $("#edit-canvas-form #id_drawing_mode").val();
  var canvasColor = $("#edit-canvas-form #id_color").val();
  var canvasLineWidth = $("#edit-canvas-form #id_line_width").val();

  for (var i = 0; i < $(".edit-form").length; i++)
  {
    $(".edit-form").get(i).reset();
  }

  $("#edit-canvas-form #id_drawing_mode").val(canvasDrawMode);
  $("#edit-canvas-form #id_color").val(canvasColor);
  $("#edit-canvas-form #id_line_width").val(canvasLineWidth);

  if (!swapping)
  {
    $("#item-select-list").css({ "max-height": "" });

    $("#item-select-list").animate({
      scrollTop: $("#item-select-list").scrollTop() - $("#item-select-list").offset().top
    }, 333);
  }
}

///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///         FORMS
///
///~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function openEditForm(itemId)
{
  var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  var editContainerId = "#edit-{0}-container".format(itemType);

  $("#item-select-list").css({ "max-height": "15em" });

  if ($(editContainerId).hasClass('hidden'))
  {
    for (var i = 0; i < $(".edit-container").length; i++)
    {
      $(".edit-container").eq(i).addClass("hidden");
    }
  
    $(editContainerId).removeClass("hidden");
  
    if ("paused" in g_ItemDict[g_SelectedItem]["item_data"])
    {
      $("{0} .pause-item".format(editContainerId)).text(g_ItemDict[g_SelectedItem]["item_data"]["paused"] ? "Unpause" : "Pause");
    }
  }
}

function setEditFormInputs(itemId, ignoreFocus = false)
{
  var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  var formId = "#edit-{0}-form".format(itemType);

  var itemData = g_ItemDict[g_SelectedItem]['item_data'];

  $(formId).find("#id_overlay_id").prop('value', c_OverlayID);
  $(formId).find("#id_item_id").prop('value', itemId);

  for (var key in itemData)
  {
    if (key == "id") continue;
    var input = $(formId).find("#id_{0}".format(key))

    if (input.is(":focus") && !ignoreFocus)
    {
      continue;
    }

    switch(input.prop("type"))
    {
      case "checkbox":
        input.prop('checked', itemData[key]);
        break;
      case "file":
        break;
      default:
        input.prop('value', itemData[key]);
        break;
    }
  }
}

function sendFileEdit(itemId, itemType, inputObj)
{
  let file = inputObj.prop('files')[0];
  var inputField = inputObj.attr('name');

  if (!file)
  {
    console.log("Bad file.");
    return;
  }
  
  var itemFormData = new FormData();
  itemFormData.set("overlay_id", c_OverlayID);
  itemFormData.set("item_id", itemId);
  itemFormData.set("item_type", itemType);

  itemFormData.set(inputField, file);

  QueueAjaxRequest(new AjaxRequest(AjaxRequestTypes.POST_FORM, c_EditOverlayItemURL, itemFormData, handleEditItemsSuccess, handleAjaxError));
}

function inputToValue(inputObj)
{
  var nodeName = inputObj.prop('nodeName');

  if (nodeName.toUpperCase() == "TEXTAREA" || nodeName.toUpperCase() == "SELECT")
  {
    return inputObj.val();
  }
  else if (nodeName.toUpperCase() == "INPUT")
  {
    var inputType = inputObj.attr('type');
    var fieldType = inputObj.attr('field-type');
    var inputVal = inputObj.val();

    if (inputType == "submit")
      return undefined;

    switch (fieldType)
    {
      case "integer":
        var numberVal = parseInt(inputVal, 10);

        return !isNaN(numberVal) ? numberVal : 0;
      case "float":
        var floatVal = parseFloat(inputVal);

        return !isNaN(floatVal) ? floatVal : 0.0;
      case "boolean":
        if (inputType == "checkbox")
          return inputObj.is(":checked");
        else
          return (inputVal == "true") ? true : false;
      case "file":
        if (inputObj.prop('files').length > 0)
        {
          f = inputObj.prop('files')[0];
          inputObj.val('');
          return f;
        }
        else
        {
          return undefined;
        }
      case "text":
      default:
        return inputVal;
    }
  }
}

function onInputChange(inputEvent)
{
  var targetedInput = $(inputEvent.currentTarget);
  var targetedForm = targetedInput.closest("form");
  var inputType = targetedInput.attr('type');

  var itemId = targetedForm.find("#id_item_id").val();
  var itemType = g_ItemDict[itemId]["item_type"];

  var inputField = targetedInput.attr('name');

  if (targetedInput.attr("prevent_send") == 1)
  {
    return;
  }

  switch (inputType)
  {
    case "file":
      sendFileEdit(itemId, itemType, targetedInput);
      break;
    default:
      var inputVal = inputToValue(targetedInput);

      if (!(itemId in g_SendEditChanges))
        g_SendEditChanges[itemId] = {};
      g_SendEditChanges[itemId][inputField] = inputVal;

      switch (inputField)
      {
        case "visibility":
        case "minimized":
        case "scroll_direction":
        case "font":
        case "opacity":
        case "view_lock":
        case "position_lock":
          g_OtherSelectedItems.forEach((otherSelectedItemId, i) => {
            if (!(otherSelectedItemId in g_SendEditChanges))
              g_SendEditChanges[otherSelectedItemId] = {};
            g_SendEditChanges[otherSelectedItemId][inputField] = inputVal;
          });
          break;
        default:
          break;
      }

      break;
  }
}

function onFilterChange()
{
  var typeFilterInput = $("#item-type-filter");
  var nameFilterInput = $("#item-filter");

  var typeFilterText = typeFilterInput.val().toLowerCase();
  var filterText = nameFilterInput.val().toLowerCase();

  $(".item-list-entry").each(function(i, obj) {
    var itemHidden = true;

    var typeMatch = (typeFilterText == "") || ($(this).attr("itemType").toLowerCase() == typeFilterText);
    var nameMatch = $(this).attr("itemName").toLowerCase().includes(filterText)

    if (typeMatch && nameMatch)
    {
      itemHidden = false;
    }

    if (itemHidden)
    {
      $(this).css("display", "none");
    }
    else
    {
      $(this).css("display", "flex");
    }
  });
}

function addFormToDict(form)
{
  var itemDict = {}

  for(var i = 0; i < $(form).find("input,textarea,file,select").length; i++)
  {
    var inputObj = $(form).find("input,textarea,file,select").eq(i);

    var name = inputObj.attr('name');
    var inputVal = inputToValue(inputObj);

    if (inputVal !== undefined)
    {
      itemDict[name] = inputVal;
    }
  }

  return itemDict;
}

function submitAddForm(form)
{
  var itemType = $(form).find("#id_item_type").val();
  var itemData = addFormToDict(form);

  var itemFormData = new FormData();

  itemFormData.set("overlay_id", c_OverlayID);
  itemFormData.set("item_type", itemType);
  
  for (const itemProp in itemData)
  {
    itemFormData.set(itemProp, itemData[itemProp]);
  }

  AjaxFormPost(c_AddOverlayItemsURL, itemFormData, (e) => {}, handleAjaxError);

  $("#close-add-item").click();
}

function onDeleteItem(e)
{
  if (g_SelectedItem === undefined)
  {
    return;
  }

  if (confirm("Delete {0}?".format(g_ItemDict[g_SelectedItem]['item_data']['name'])))
  {
    var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  
    g_WebsocketEventQueue.push({ "command": "delete_overlay_item", "data": { "item_type": itemType, "item_id": g_SelectedItem } });
  }
}

function onResetItem(e)
{
  if (g_SelectedItem === undefined)
  {
    return;
  }

  var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  
  switch (itemType)
  {
    case "stopwatch":
      var timeNow = Math.round(Date.now() / 1000);
      var editData = {};

      editData["timer_start"] = timeNow;
      editData["pause_time"]  = timeNow;

      g_WebsocketEventQueue.push({"command": "edit_overlay_item", "data": { "item_id": g_SelectedItem, "item_type": itemType, "item_data": editData }});
      break;
    case "youtube_video":
    case "twitch_stream":
    case "twitch_video":
    case "audio":
      g_WebsocketEventQueue.push({"command": "trigger_item_event", "data": { "item_id": g_SelectedItem, "item_type": itemType, "event": "reset_item" }});
      break;
    default:
      break;
  }

  g_ItemDict[g_SelectedItem]["local_changes"] = true;
}

function onPlayItem(e)
{
  if (g_SelectedItem === undefined)
  {
    return;
  }

  var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  
  switch (itemType)
  {
    case "audio":
      g_WebsocketEventQueue.push({ "command": "trigger_item_event", "data": { "item_id": g_SelectedItem, "item_type": itemType, "event": "play_item" }});
      break;
    default:
      break;
  }
}

function onPauseItem(e)
{
  if (g_SelectedItem === undefined)
  {
    return;
  }

  var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  
  switch (itemType)
  {
    case "stopwatch":
      var wasPaused = g_ItemDict[g_SelectedItem]["item_data"]["paused"];
      var timeNow = Math.round(Date.now() / 1000);

      var prevTimerStart = g_ItemDict[g_SelectedItem]["item_data"]["timer_start"];

      var editData = {};

      if (wasPaused)
      {
        var timeSincePause = timeNow - g_ItemDict[g_SelectedItem]["item_data"]["pause_time"];
        editData["timer_start"] = prevTimerStart + timeSincePause;

        $(e.currentTarget).text("Pause");
      }
      else 
      {
        editData["pause_time"] = timeNow;
        $(e.currentTarget).text("Unpause");
      }

      editData["paused"] = !wasPaused;

      g_WebsocketEventQueue.push({ "command": "edit_overlay_item", "data": { "item_id": g_SelectedItem, "item_type": itemType, "item_data": editData } });
      break;
    case "audio":
      g_WebsocketEventQueue.push({ "command": "trigger_item_event", "data": { "item_id": g_SelectedItem, "item_type": itemType, "event": "pause_item" } });
      break;
    default:
      break;
  }
}

function onUndoItem(e)
{
  if (g_SelectedItem === undefined)
  {
    return;
  }

  var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  
  switch (itemType)
  {
    case "canvas":
      sendWebsocketMessage("record_canvas_event", {
        "item_id": g_SelectedItem,
        "item_type": itemType,
        "event": "undo"
      });
      break;
    default:
      break;
  }
}

function onClearItem(e)
{
  if (g_SelectedItem === undefined)
  {
    return;
  }

  var itemType = g_ItemDict[g_SelectedItem]['item_type'];
  
  switch (itemType)
  {
    case "canvas":
      handleCanvasClear(g_SelectedItem);
      sendWebsocketMessage("record_canvas_event", {
        "item_id": g_SelectedItem,
        "item_type": itemType,
        "event": "clear"
      });
      break;
    default:
      break;
  }
}

function openAddItemTab(event, tabId)
{
  for (var i = 0; i < $(".tabcontent").length; i++)
  {
    $(".tabcontent").eq(i).css({ "visibility": "hidden" });
  }

  for (var i = 0; i < $(".tablink").length; i++)
  {
    $(".tablink").eq(i).removeClass("active");
  }

  getDivById(tabId).css({ "visibility": "visible" });
  $(event.currentTarget).addClass("active");
}

function toggleEmbeddedTwitchStream()
{
  var checked = g_EmbedStream;
  var interactable = $("#embed-interact").is(":checked");

  if (checked)
  {
    $("#twitch-embed").empty();
    g_StreamEmbed = createTwitchStreamPlayer("twitch-embed", c_OverlayOwner);
    
    if (!interactable)
    {
      $("#twitch-embed iframe").addClass("noselect nopointer");
    }
  }
  else
  {
    $("#twitch-embed").html("");
    g_StreamEmbed = null;
  }
}

function drawLine(itemId, p0, p1)
{
  const context = $("#item-{0}-canvas".format(itemId)).get(0).getContext('2d');

  var drawingMode = getCanvasDrawingMode();
  var color = getCanvasColor();
  var lineWidth = getCanvasLineWidth();

  if (drawingMode == "draw")
  {
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = color;
  }
  else if (drawingMode == "erase")
  {
    context.globalCompositeOperation = "destination-out";
    context.strokeStyle = "rgba(0, 0, 0, 1)";
  }

  context.lineWidth = viewToEditLength(lineWidth);
  context.lineCap = 'round';

  var ep0 = viewToEditPoint(p0);
  var ep1 = viewToEditPoint(p1);

  context.beginPath();
  context.moveTo(ep0.x, ep0.y);
  context.lineTo(ep1.x, ep1.y);
  context.stroke();
}

function getCanvasDrawingMode()
{
  return $("#edit-canvas-form #id_drawing_mode").val();
}

function getCanvasColor()
{
  return $("#edit-canvas-form #id_color").val();
}

function getCanvasLineWidth()
{
  return $("#edit-canvas-form #id_line_width").val();
}

function toggleEmbeddedStreamInteraction(e)
{
  var checked = $("#embed-interact").is(":checked");

  if (checked)
  {
    $("#twitch-embed").removeClass("noselect nopointer");
    $("#twitch-embed iframe").removeClass("noselect nopointer");
  }
  else
  {
    $("#twitch-embed").addClass("noselect nopointer");
    $("#twitch-embed iframe").addClass("noselect nopointer");
  }
}

function selectedVisibilityChange(e)
{
  g_OtherSelectedItems.forEach((itemId) => {
    g_ItemDict[itemId]["item_data"]["visibility"] = $(e.target).is(":checked");
    g_ItemDict[itemId]["local_changes"] = true;
  });
}

function selectedMinimizedChange(e)
{
  g_OtherSelectedItems.forEach((itemId) => {
    g_ItemDict[itemId]["item_data"]["minimized"] = $(e.target).is(":checked");
    g_ItemDict[itemId]["local_changes"] = true;
  });
}

function createYouTubePlayer(itemId)
{
  g_ItemDict[itemId]['player_init'] = true;
  g_ItemDict[itemId]["player"] = new YT.Player('item-{0}-player'.format(itemId), {
    height: '100%',
    width: '100%',
    videoId: g_ItemDict[itemId]['item_data']['video_id'],
    playerVars: {
      'controls': 1,
      'disablekb': 0,
      'autoplay': 0,
      'playsinline': 1,
      'start': g_ItemDict[itemId].item_data.start_time,
    },
    events: {
      'onReady': onPlayerReady,
    }
  });
}

function setCanvasCursor() 
{
  var inputVal = $("#id_drawing_mode").val();

  var cursorCss = "move";
  switch (inputVal)
  {
    case "draw":
      cursorCss = "url('/static/overlay/pen.cur'), auto";
      break;
    case "erase":
      cursorCss = "url('/static/overlay/eraser.cur'), auto"
      break;
    default:
      break;
  }
  
  $(".selected.canvas-item").css({
    "cursor": cursorCss,
  });
}

$(window).on('load', function() {
  initialResize();

  connectWebsocket();

  $("#main-container").on("mousewheel DOMMouseScroll", onScroll);
  
  $("#main-container").on("mousemove touchmove", onMouseMove);
  $('#main-container').on("mousedown touchstart", onMouseDownBody);
  
  $(document).on('keyup keydown', function(e){window.shiftheld = e.shiftKey; window.ctrlheld = e.ctrlKey;} );
  
  $(".edit-form").submit((e) => {
    e.preventDefault();
  });

  $("#chat-form").submit((e) => {
    e.preventDefault();

    sendChatMessage();
  });

  $(".edit-form input, .edit-form textarea, .edit-form select, .edit-form file").on("input", (e) => {
    onInputChange(e);
  });

  $("input[checkbox]").change((e) => {
    onInputChange(e);
  });

  $("#id_drawing_mode").change((e) => {
    setCanvasCursor();
    onInputChange(e);
  });

  $("#item-filter").on("keyup keydown", (e) => {
    onFilterChange();
  });

  $("#item-type-filter").change((e) => {
    onFilterChange();
  });

  $(".add-form").submit((e) => {
    e.preventDefault();
    submitAddForm(e.target);
  });
  
  $("#open-add-item").click((e) => { $("#add-item-modal").css({ "display": "flex" }); });
  $("#close-add-item").click((e) => { $("#add-item-modal").css({ "display": "none" }); });

  $("#open-chat-button").click((e) => { 
    g_ChatOpen = true; 
    $("#chat-box").css({ "display": "flex" }); 
    $("#chat-message-indicator").css({ "display": "none" }); 
  });

  $("#close-chat-button").click((e) => { 
    g_ChatOpen = false;
    $("#chat-box").css({ "display": "none" });
  });

  $(".tablink").first().click();

  for (var i = 0; i < $(".tabcontent").length; i++)
  {
    $(".tabcontent").eq(i).css({ "z-index": i });
  }

  $("#embed-checkbox").change((e) => {
    g_EmbedStream = $(e.currentTarget).is(":checked");

    toggleEmbeddedTwitchStream();

    sendWebsocketMessage("update_user_settings", { "embed_stream": g_EmbedStream });
  });

  $("#notification-volume").change((e) => {
    let floatVal = parseFloat($(e.currentTarget).val());

    g_NotificationVolume = floatVal / 100.0;
    c_NotificationAudio.volume = g_NotificationVolume;
    c_NotificationAudio.play();

    sendWebsocketMessage("update_user_settings", { "notification_volume": g_NotificationVolume });
  });

  toggleEmbeddedStreamInteraction();
  $("#embed-interact").change((e) => {
    toggleEmbeddedStreamInteraction();
  });

  $(".delete-item").click((e) => {
    onDeleteItem(e);
  });

  $(".reset-item").click((e) => {
    onResetItem(e);
  });

  $(".pause-item").click((e) => {
    onPauseItem(e);
  });

  $(".play-item").click((e) => {
    onPlayItem(e);
  });

  $(".undo-item").click((e) => { onUndoItem(e); });
  $(".clear-item").click((e) => { onClearItem(e); });

  $(".edit-container input[id=id_visibility]").each((i, visibleCheckbox) => {
    $(visibleCheckbox).change((e) => selectedVisibilityChange(e));
  });

  $(".edit-container input[id=id_minimized]").each((i, minimizedCheckbox) => {
    $(minimizedCheckbox).change((e) => selectedMinimizedChange(e));
  });
});