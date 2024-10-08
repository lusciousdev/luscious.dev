const data = document.currentScript.dataset;

window.shiftheld = false;
window.ctrlheld = false;

const overlayId = data.overlayid;
const getOverlayItemsUrl  = data.getitemsurl;
const addOverlayItemsUrl  = data.additemsurl;
const editOverlayItemUrl = data.edititemurl;
const editOverlayItemsUrl = data.edititemsurl;
const deleteOverlayItemUrl = data.deleteitemurl;
const overlayOwner = data.overlayowner;
const twitchUser = data.twitchuser;

var scaledOverlayWidth = -1;
var scaledOverlayHeight = -1;
const overlayWidth = parseInt(data.overlaywidth, 10);
const overlayHeight = parseInt(data.overlayheight, 10);

const defaultSizePercent = 0.667;

var currentScale = 1.0;
var overlayOffset = new Point(0, 0);

const scaleChange = 0.05;
const minimumScale = 0.05;
const maximumScale = 5.0;
const scrollAmount = 50.0;

var selectedItem = undefined;
var otherSelectedItems = [];

var sendEditTimeout = undefined;
var sendEditChanges = {};

const WEBSOCKET_SEND_COOLDOWN = 125; // ms

var streamEmbed;

const GrabTypes = {
  Move: 0,
  TopLeft: 1,
  TopRight: 2,
  BottomLeft: 3,
  BottomRight: 4,
};
var grabType = GrabTypes.Move;

var mousePosition = { "x": 0, "y": 0 };
var lastMousePosition = Object.assign({}, mousePosition);

var editorList = {};
var cursorDict = {};

function editToViewX(xCoord)
{
  return (xCoord - overlayOffset.x) / currentScale;
}

function editToViewY(yCoord)
{
  return (yCoord - overlayOffset.y) / currentScale;
}

function viewToEditX(xCoord)
{
  return (xCoord * currentScale) + overlayOffset.x;
}

function viewToEditY(yCoord)
{
  return (yCoord * currentScale) + overlayOffset.y;
}

function editToViewPoint(p)
{
  return new Point(editToViewX(p.x), editToViewY(p.y));
}

function viewToEditPoint(p)
{
  return new Point(viewToEditX(p.x), viewToEditY(p.y));
}

function editToViewLength(distance)
{
  return distance / currentScale;
}

function viewToEditLength(distance)
{
  return currentScale * distance;
}

function addGrabbers(itemId)
{
  getItemDiv(itemId).append("<div class='grabber topleft'></div>");
  getItemDiv(itemId).append("<div class='grabber topright'></div>");
  getItemDiv(itemId).append("<div class='grabber bottomleft'></div>");
  getItemDiv(itemId).append("<div class='grabber bottomright'></div>");

  $('#item-{0} .topleft'.format(itemId)).on("mousedown touchstart", (event) => { grabType = GrabTypes.TopLeft; });
  $('#item-{0} .topright'.format(itemId)).on("mousedown touchstart", (event) => { grabType = GrabTypes.TopRight; });
  $('#item-{0} .bottomleft'.format(itemId)).on("mousedown touchstart", (event) => { grabType = GrabTypes.BottomLeft; });
  $('#item-{0} .bottomright'.format(itemId)).on("mousedown touchstart", (event) => { grabType = GrabTypes.BottomRight; });
}

function updateItems(data, fullItemList = true, selfEdit = false)
{
  var itemSeen = {};
  for (itemId in itemDict)
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

    if (itemId in itemDict)
    {
      itemSeen[itemId] = true;
  
      if (!itemDict[itemId]['moving'])
      {
        itemDict[itemId]['item_data'] = itemData;
      }
    }
    else
    {
      itemDict[itemId] = {
        "item_type": itemType,
        "item_data": itemData,
        "moving": false,
      };
    }

    var left   = viewToEditLength(itemDict[itemId]['item_data']['x']);
    var top    = viewToEditLength(itemDict[itemId]['item_data']['y']);
    var width  = viewToEditLength(itemDict[itemId]['item_data']['width']);
    var height = viewToEditLength(itemDict[itemId]['item_data']['height']);

    var z = itemData['z'];
    var rotation = itemData['rotation'];

    addOrUpdateItem(true, "#overlay", itemId, itemType, isDisplayed, top, left, width, height, z, rotation, itemData, 
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

  var item = itemDict[itemId]

  $("#item-select-list").append(`<div class="item-list-entry" id="item-{0}-list-entry" itemId="{0}" itemName="{2}" itemType="{3}">
    <span class="material-symbols-outlined">{1}</span> - {2}
  </div>`.format(itemId, getItemIconName(itemType), item["item_data"]["name"], item["item_type"]));

  $("#item-{0}-list-entry".format(itemId)).mousedown((e) => onMouseDownItemList(e, itemId));
}

function updateItemCallback(itemId, itemType)
{
  var item = itemDict[itemId]

  $("#item-{0}-list-entry".format(itemId)).attr("itemName", item["item_data"]["name"]);

  $("#item-{0}-list-entry".format(itemId)).html(`<span class="material-symbols-outlined">{0}</span><span> - {1}</span>`.format(getItemIconName(itemType), item["item_data"]["name"]));

  if (selectedItem != undefined) 
  {
    setEditFormInputs(selectedItem);
  }
}

function handleEditItemsSuccess(data) {}

function sendPing()
{
  sendWebsocketMessage("ping", {});
}

function sendMousePosition()
{
  if ((mousePosition["x"] != lastMousePosition["x"]) || (mousePosition["y"] != lastMousePosition["y"]))
  {
    sendWebsocketMessage("mouse_position", mousePosition);
    lastMousePosition = Object.assign({}, mousePosition);
  }
}

function userPresent(data) 
{
  if (data["uid"] == twitchUser)
    return;

  if (!editorList.hasOwnProperty(data["uid"]))
  {
    editorList[data["uid"]] = {
      "login": data["username"],
      "last_seen": Date.now(),
      "last_mouse": Date.now(),
    }
  }
  else
  {
    editorList[data["uid"]]["login"] = data["username"];
    editorList[data["uid"]]["last_seen"] = Date.now();
  }
}

function repositionMouse(data)
{
  if (data["uid"] == twitchUser)
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

  editorList[data["uid"]]["last_mouse"] = Date.now();
}

function removeInactiveUsers()
{
  var timeNow = Date.now();

  Object.keys(editorList).forEach(function(key) {
    if ((timeNow - editorList[key]["last_seen"]) > 15000.0)
    {
      $("#{0}".format(key)).remove();
      delete editorList[key];
    }
  });
}

function removeInactiveCursors()
{
  var timeNow = Date.now();

  Object.keys(editorList).forEach(function(key) {
    if ((timeNow - editorList[key]["last_mouse"]) > 5000.0)
    {
      $("#{0}".format(key)).remove();
    }
  });
}

function handleWebsocketOpen(e)
{
  getOverlayItems();

  setInterval(sendPing, 5000);
  setInterval(sendMousePosition, 50);
  setInterval(removeInactiveUsers, 500);
  setInterval(removeInactiveCursors, 500);
}

function handleAjaxError(data)
{
  console.log("~~~~~~~~~~~ERROR~~~~~~~~~~~~~~~~~~~")
  console.log(data);
}

function sendOverlayItemUpdates()
{
  items = []
  for (const itemId in itemDict)
  {
    if (itemDict[itemId]['local_changes'])
    {
      itemFormData = new FormData();
      itemFormData.set("overlay_id", overlayId);
      itemFormData.set("item_id", itemId);
      itemFormData.set("item_type", itemDict[itemId]['item_type']);
      
      for (const itemProp in itemDict[itemId]['item_data'])
      {
        itemFormData.set(itemProp, itemDict[itemId]['item_data'][itemProp]);
      }

      items.push(itemFormData);

      if (!itemDict[itemId]['locked']) itemDict[itemId]['local_changes'] = false;
    }
  }

  if (items.length > 0)
  {
    for (const i in items)
    {
      QueueAjaxRequest(new AjaxRequest(AjaxRequestTypes.POST_FORM, editOverlayItemUrl, items[i], handleEditItemsSuccess, handleAjaxError));
    }
  }
}

function initialResize(event)
{
  var mcWidth = $("#main-container").width();
  var mcHeight = $("#main-container").height();

  scaledOverlayWidth = defaultSizePercent * mcWidth;
  scaledOverlayHeight = 9.0 / 16.0 * scaledOverlayWidth;

  if (scaledOverlayHeight > (defaultSizePercent * mcHeight))
  {
    scaledOverlayHeight = 0.667 * mcHeight;
    scaledOverlayWidth = 16.0 / 9.0 * scaledOverlayHeight;
  }

  currentScale = scaledOverlayWidth / overlayWidth;

  $("#overlay").width(scaledOverlayWidth);
  $("#overlay").height(scaledOverlayHeight);

  $("#twitch-embed").width(scaledOverlayWidth);
  $("#twitch-embed").height(scaledOverlayHeight);

  for (const prop in itemDict)
  {
    var itemData = itemDict[prop]['item_data'];
    var itemId = itemData['id'];

    var left   = viewToEditLength(itemData['x']);
    var top    = viewToEditLength(itemData['y']);
    var width  = viewToEditLength(itemData['width']);
    var height = viewToEditLength(itemData['height']);
    
    if (itemDict[prop]['item_type'] == "image")
    {
      $("#item-{0}-img".format(itemId)).attr('width', "{0}px".format(width));
      $("#item-{0}-img".format(itemId)).attr('height', "{0}px".format(height));
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
      changeScale(currentScale + scaleChange);
    }
    else if (event.shiftKey)
    {
      overlayOffset.addX(scrollAmount);
      repositionOverlay();
    }
    else
    {
      overlayOffset.addY(scrollAmount);
      repositionOverlay();
    }
  }
  else if (delta < 0)
  {
    if (event.ctrlKey)
    {
      changeScale(currentScale - scaleChange);
    }
    else if (event.shiftKey)
    {
      overlayOffset.addX(-scrollAmount);
      repositionOverlay();
    }
    else
    {
      overlayOffset.addY(-scrollAmount);
      repositionOverlay();
    }
  }
}

function changeScale(newScale)
{
  var oldScale = currentScale;
  currentScale = newScale;
  if (currentScale < minimumScale)
  {
    currentScale = minimumScale;
  }
  else if (currentScale > maximumScale)
  {
    currentScale = maximumScale;
  }

  if (oldScale == currentScale)
    return;

  scaledOverlayWidth = currentScale * overlayWidth;
  scaledOverlayHeight = currentScale * overlayHeight;

  $("#overlay").width(scaledOverlayWidth);
  $("#overlay").height(scaledOverlayHeight);

  $("#twitch-embed").width(scaledOverlayWidth);
  $("#twitch-embed").height(scaledOverlayHeight);

  setAllItemPositions();
}

function setAllItemPositions()
{
  for (const prop in itemDict)
  {
    var itemData = itemDict[prop]['item_data'];
    var itemId = itemData['id'];

    var left   = viewToEditLength(itemData['x']);
    var top    = viewToEditLength(itemData['y']);
    var width  = viewToEditLength(itemData['width']);
    var height = viewToEditLength(itemData['height']);
    
    if (itemDict[prop]['item_type'] == "image")
    {
      $("#item-{0}-img".format(itemId)).attr('width', "{0}px".format(width));
      $("#item-{0}-img".format(itemId)).attr('height', "{0}px".format(height));
    }

    if (itemDict[prop]['item_type'] == "text" ||
        itemDict[prop]['item_type'] == "counter" ||
        itemDict[prop]['item_type'] == "stopwatch")
    {
      setTextItemContent(true, $("#overlay"), prop, itemDict[prop]["item_data"]["text"], itemDict[prop]["item_data"])
    }

    setItemPosition(itemId, top, left, width, height, itemData["z"], itemData['rotation']);
  }
}

function repositionOverlay()
{
  $("#overlay").css({
    "left": viewToEditLength(overlayOffset.x),
    "top": viewToEditLength(overlayOffset.y),
  });
}

function onMouseDownItemList(e, itemId)
{
  selectItem(itemId);
}

function sendMovingItemEdits()
{
  items = []
  for (const itemId in itemDict)
  {
    if (itemDict[itemId]['moving'])
    {
      var itemData = {};
      itemData['x']      = itemDict[itemId].item_data.x;
      itemData['y']      = itemDict[itemId].item_data.y;
      itemData['width']  = itemDict[itemId].item_data.width;
      itemData['height'] = itemDict[itemId].item_data.height;

      var itemType = itemDict[itemId]["item_type"];

      sendWebsocketMessage("edit_overlay_item", { "item_type": itemType, "item_id": itemId, "item_data": itemData });
    }
  }
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

  selectItem($(dragData.elem).attr("itemId"));

  if (selectedItem == undefined)
  {
    return;
  }

  dragData.elemP0 = new Point(parseFloat($(dragData.elem).css('left')), parseFloat($(dragData.elem).css('top')));
  dragData.distP0 = Point.sub2(dragData.furthestCorner.point, new Point(pageX, pageY));

  dragData.selectedElem = {
    point0: getItemPos(selectedItem)
  }
  itemDict[selectedItem]['moving'] = true;

  dragData.otherElems = {}
  otherSelectedItems.forEach((itemId) => {
    dragData.otherElems[itemId] = {};
    dragData.otherElems[itemId]["point0"] = getItemPos(itemId);
    itemDict[itemId]['moving'] = true;
  });

  var SEND_MOVE_INTERVAL = setInterval(sendMovingItemEdits, WEBSOCKET_SEND_COOLDOWN);

  function handleDragging(e)
  {
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

    if (grabType == GrabTypes.Move)
    {
      var offsetPosition = Point.sub2(dragData.pagePn, dragData.pageP0);

      if (!window.shiftheld)
      {
        var lowestXOffset = scaledOverlayWidth;
        var lowestYOffset = scaledOverlayHeight;

        dragData.initialGrabberCoords.forEach((grabberObj) => {
          var movedGrabberPos = Point.add2(grabberObj.point, offsetPosition);

          var grabberX = (movedGrabberPos.x - overlayLoc.x);
          var grabberY = (movedGrabberPos.y - overlayLoc.y);

          var distXLeft = grabberX;
          var distXRight = grabberX - scaledOverlayWidth;

          var distYTop = grabberY;
          var distYBottom = grabberY - scaledOverlayHeight;

          if (Math.abs(lowestXOffset) > Math.abs(distXLeft))
            lowestXOffset = distXLeft;
          if (Math.abs(lowestXOffset) > Math.abs(distXRight))
            lowestXOffset = distXRight;

          if (Math.abs(lowestYOffset) > Math.abs(distYTop))
            lowestYOffset = distYTop;
          if (Math.abs(lowestYOffset) > Math.abs(distYBottom))
            lowestYOffset = distYBottom;
        });

        var itemRotRad = itemDict[$(dragData.elem).attr("itemId")].item_data.rotation * Math.PI / 180.0;

        if (Math.abs(lowestXOffset) < (0.01 * scaledOverlayWidth))
        {
          offsetPosition.subX(lowestXOffset);
        }

        if (Math.abs(lowestYOffset) < (0.01 * scaledOverlayHeight))
        {
          offsetPosition.subY(lowestYOffset);
        }
      }
  
      var newPos = Point.add2(dragData.selectedElem.point0, offsetPosition);
      
      getItemDiv(selectedItem).css({
        top: "{0}px".format(newPos.y), 
        left: "{0}px".format(newPos.x),
      });

      var itemTop  = editToViewLength(newPos.y + borderWidth);
      var itemLeft = editToViewLength(newPos.x + borderWidth);
      
      itemDict[selectedItem]['item_data']['x'] = Math.round(itemLeft);
      itemDict[selectedItem]['item_data']['y'] = Math.round(itemTop);

      otherSelectedItems.forEach((itemId) => {
        newPos = Point.add2(dragData.otherElems[itemId].point0, offsetPosition);
        getItemDiv(itemId).css({
          top: "{0}px".format(newPos.y), 
          left: "{0}px".format(newPos.x),
        });

        var itemTop  = editToViewLength(newPos.y);
        var itemLeft = editToViewLength(newPos.x);
        itemDict[itemId]['item_data']['x'] = Math.round(itemLeft);
        itemDict[itemId]['item_data']['y'] = Math.round(itemTop);
      });
    }
    else
    {
      var mouseLoc = Point.sub2(dragData.pagePn, overlayLoc);
      var mouseOffset = new Point(0, 0);

      if (!window.shiftheld)
      {
        var distXLeft = mouseLoc.x;
        var distXRight = mouseLoc.x - scaledOverlayWidth;

        var distYTop = mouseLoc.y;
        var distYBottom = mouseLoc.y - scaledOverlayHeight;

        if (Math.abs(distXLeft) <= Math.abs(distXRight))
        {
          if (Math.abs(distXLeft) < (0.01 * scaledOverlayWidth))
            mouseOffset.subX(distXLeft);
        }
        else
        {
          if (Math.abs(distXRight) < (0.01 * scaledOverlayWidth))
            mouseOffset.subX(distXRight);
        }

        if (Math.abs(distYTop) <= Math.abs(distYBottom))
        {
          if (Math.abs(distYTop) < (0.01 * scaledOverlayHeight))
            mouseOffset.subY(distYTop);
        }
        else
        {
          if (Math.abs(distYBottom) < (0.01 * scaledOverlayHeight))
            mouseOffset.subY(distYBottom);
        }
      }

      var relativePos = Point.sub2(dragData.furthestCorner.point, Point.add2(dragData.pagePn, mouseOffset));

      var itemRotRad = itemDict[$(dragData.elem).attr("itemId")].item_data.rotation * Math.PI / 180.0;
      
      relativePos.rotate(-1 * itemRotRad);

      var newWidth = Math.abs(relativePos.x);
      var newHeight = Math.abs(relativePos.y);

      newWidth = Math.max(viewToEditLength(25), newWidth);
      newHeight = Math.max(viewToEditLength(25), newHeight);

      if (itemDict[$(dragData.elem).attr("itemId")].item_type == "image")
      {
        if (window.shiftheld)
        {
          var imgNaturalWidth = $("#item-{0}-img".format(selectedItem)).get(0).naturalWidth;
          var imgNaturalHeight = $("#item-{0}-img".format(selectedItem)).get(0).naturalHeight;

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

      var newPos = Point.add2(getItemPos($(dragData.elem).attr("itemId")), offsetPosition);
      $(dragData.elem).css({
        top: "{0}px".format(newPos.y), 
        left: "{0}px".format(newPos.x),
      });

      if (itemDict[$(dragData.elem).attr("itemId")].item_type == "image")
      {
        $("#item-{0}-img".format(selectedItem)).attr("width", "{0}px".format(newWidth));
        $("#item-{0}-img".format(selectedItem)).attr("height", "{0}px".format(newHeight));
      }
  
      var itemTop    = editToViewLength(newPos.y + borderWidth);
      var itemLeft   = editToViewLength(newPos.x + borderWidth);
      var itemWidth  = editToViewLength(newWidth);
      var itemHeight = editToViewLength(newHeight);
  
      itemDict[$(dragData.elem).attr("itemId")]['item_data']['x']      = Math.round(itemLeft);
      itemDict[$(dragData.elem).attr("itemId")]['item_data']['y']      = Math.round(itemTop);
      itemDict[$(dragData.elem).attr("itemId")]['item_data']['width']  = Math.round(itemWidth);
      itemDict[$(dragData.elem).attr("itemId")]['item_data']['height'] = Math.round(itemHeight);
    }
  
    setEditFormInputs(selectedItem);

    dragData.pagePn_m1 = new Point(pageX, pageY);
  }

  function handleMouseUp(e){
    clearInterval(SEND_MOVE_INTERVAL);
    sendMovingItemEdits();

    itemDict[selectedItem]['moving'] = false;
  
    otherSelectedItems.forEach((itemId) => {
      itemDict[itemId]['moving'] = false;
    });

    grabType = GrabTypes.Move;
    $('#main-container').off('mousemove touchmove', handleDragging).off('mouseup touchend mouseleave touchcancel', handleMouseUp);
  }

  $('#main-container').on('mouseup touchend mouseleave touchcancel', handleMouseUp).on('mousemove touchmove', handleDragging);
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

  mousePosition['x'] = ox;
  mousePosition['y'] = oy;
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

    overlayOffset.addX(editToViewLength(offsetPosition.x));
    overlayOffset.addY(editToViewLength(offsetPosition.y));

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
      if (selectedItem !== undefined)
      {
        clearSelectedItem();
      }
      break;
  }
}

function clearSelectedItem()
{
  if (selectedItem !== undefined)
  {
    getItemDiv(selectedItem).removeClass("selected").addClass("unselected");
    $("#item-{0}-list-entry".format(selectedItem)).removeClass("selected-list-entry");

    selectedItem = undefined;
  }

  otherSelectedItems.forEach((itemId) => {
    getItemDiv(itemId).removeClass("selected").addClass("unselected");
    $("#item-{0}-list-entry".format(itemId)).removeClass("selected-list-entry");
  });

  otherSelectedItems = [];
  
  for (var i = 0; i < $(".edit-container").length; i++)
  {
    $(".edit-container").eq(i).addClass("hidden");
  }

  $("#delete-item").addClass("hidden");

  for (var i = 0; i < $(".edit-form").length; i++)
  {
    $(".edit-form").get(i).reset();
  }
}

function unselectItem(itemId)
{
  if (itemId != selectedItem && !otherSelectedItems.includes(itemId))
  {
    return
  }

  if (itemId == selectedItem)
  {
    if (otherSelectedItems.length > 0)
    {
      selectedItem = otherSelectedItems.splice(0, 1)[0];
      
      openEditForm(selectedItem);
      setEditFormInputs(selectedItem);
    }
    else
    {
      clearSelectedItem();
      return;
    }
  }
  else if (otherSelectedItems.includes(itemId))
  {
    otherSelectedItems.splice(otherSelectedItems.indexOf(itemId), 1);
  }

  getItemDiv(itemId).removeClass("selected").addClass("unselected");
  $("#item-{0}-list-entry".format(itemId)).removeClass("selected-list-entry");
}

function selectItem(itemId)
{
  if (otherSelectedItems.includes(itemId) || itemId == selectedItem)
  {
    if (window.ctrlheld)
    {
      unselectItem(itemId);
    }
    return;
  }

  if (selectedItem !== undefined && !window.ctrlheld)
  {
    clearSelectedItem();
  }
  
  var addingItem = false;
  
  if (selectedItem == undefined)
  {
    selectedItem = itemId;
  }
  else
  {
    otherSelectedItems.push(itemId);
    addingItem = true;
  }

  getItemDiv(itemId).removeClass("unselected").addClass("selected");
  $("#item-{0}-list-entry".format(itemId)).addClass("selected-list-entry");

  if (!addingItem)
  {
    openEditForm(selectedItem);
    setEditFormInputs(selectedItem);
  }
}

function openEditForm(itemId)
{
  var itemType = itemDict[selectedItem]['item_type'];
  var editContainerId = "#edit-{0}-container".format(itemType);

  if ($(editContainerId).hasClass('hidden'))
  {
    for (var i = 0; i < $(".edit-container").length; i++)
    {
      $(".edit-container").eq(i).addClass("hidden");
    }
  
    $(editContainerId).removeClass("hidden");
  
    if ("paused" in itemDict[selectedItem]["item_data"])
    {
      $("{0} .pause-item".format(editContainerId)).text(itemDict[selectedItem]["item_data"]["paused"] ? "Unpause" : "Pause");
    }
  }
}

function setEditFormInputs(itemId)
{
  var itemType = itemDict[selectedItem]['item_type'];
  var formId = "#edit-{0}-form".format(itemType);

  var itemData = itemDict[selectedItem]['item_data'];

  $(formId).find("#id_overlay_id").prop('value', overlayId);
  $(formId).find("#id_item_id").prop('value', itemId);

  for (var key in itemData)
  {
    if (key == "id") continue;
    var input = $(formId).find("#id_{0}".format(key))

    if (input.is(":focus"))
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
  itemFormData.set("overlay_id", overlayId);
  itemFormData.set("item_id", itemId);
  itemFormData.set("item_type", itemType);

  itemFormData.set(inputField, file);

  QueueAjaxRequest(new AjaxRequest(AjaxRequestTypes.POST_FORM, editOverlayItemUrl, itemFormData, handleEditItemsSuccess, handleAjaxError));
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

function sendEdits()
{
  for (const itemId in sendEditChanges)
  {
    var itemType = itemDict[itemId]["item_type"];
    sendWebsocketMessage("edit_overlay_item", { "item_type": itemType, "item_id": itemId, "item_data": sendEditChanges[itemId] });

    delete sendEditChanges[itemId];
  }
  
  sendEditTimeout = undefined;
}

function onInputChange(inputEvent)
{
  var targetedInput = $(inputEvent.currentTarget);
  var targetedForm = targetedInput.closest("form");
  var inputType = targetedInput.attr('type');

  var itemId = targetedForm.find("#id_item_id").val();
  var itemType = itemDict[itemId]["item_type"];

  var inputField = targetedInput.attr('name');

  switch (inputType)
  {
    case "file":
      sendFileEdit(itemId, itemType, targetedInput);
      break;
    default:
      var inputVal = inputToValue(targetedInput);

      if (!(itemId in sendEditChanges))
        sendEditChanges[itemId] = {};
      sendEditChanges[itemId][inputField] = inputVal;

      switch (inputField)
      {
        case "visibility":
        case "minimized":
        case "scroll_direction":
        case "font":
        case "opacity":
        case "view_lock":
          otherSelectedItems.forEach((otherSelectedItemId, i) => {
            if (!(otherSelectedItemId in sendEditChanges))
              sendEditChanges[otherSelectedItemId] = {};
            sendEditChanges[otherSelectedItemId][inputField] = inputVal;
          });
          break;
        default:
          break;
      }

      if (sendEditTimeout == undefined)
        sendEditTimeout = setTimeout(sendEdits, WEBSOCKET_SEND_COOLDOWN);
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

  itemFormData.set("overlay_id", overlayId);
  itemFormData.set("item_type", itemType);
  
  for (const itemProp in itemData)
  {
    itemFormData.set(itemProp, itemData[itemProp]);
  }

  AjaxFormPost(addOverlayItemsUrl, itemFormData, (e) => {}, handleAjaxError);

  $("#close-add-item").click();
}

function deleteSelectedItem(e)
{
  if (selectedItem === undefined)
  {
    return;
  }

  if (confirm("Delete {0}?".format(itemDict[selectedItem]['item_data']['name'])))
  {
    var itemType = itemDict[selectedItem]['item_type'];
  
    sendWebsocketMessage("delete_overlay_item", { "item_type": itemType, "item_id": selectedItem });
  }
}

function resetSelectedItem(e)
{
  if (selectedItem === undefined)
  {
    return;
  }

  var itemType = itemDict[selectedItem]['item_type'];
  
  switch (itemType)
  {
    case "stopwatch":
      var timeNow = Math.round(Date.now() / 1000);
      var editData = {};

      editData["timer_start"] = timeNow;
      editData["pause_time"]  = timeNow;

      sendWebsocketMessage("edit_overlay_item", { "item_id": selectedItem, "item_type": itemType, "item_data": editData });
      break;
    case "youtube_video":
    case "twitch_stream":
    case "twitch_video":
    case "audio":
      sendWebsocketMessage("trigger_item_event", { "item_id": selectedItem, "item_type": itemType, "event": "reset_item" })
      break;
    default:
      break;
  }

  itemDict[selectedItem]["local_changes"] = true;
}

function playSelectedItem(e)
{
  if (selectedItem === undefined)
  {
    return;
  }

  var itemType = itemDict[selectedItem]['item_type'];
  
  switch (itemType)
  {
    case "audio":
      sendWebsocketMessage("trigger_item_event", { "item_id": selectedItem, "item_type": itemType, "event": "play_item" });
      break;
    default:
      break;
  }
}

function pauseSelectedItem(e)
{
  if (selectedItem === undefined)
  {
    return;
  }

  var itemType = itemDict[selectedItem]['item_type'];
  
  switch (itemType)
  {
    case "stopwatch":
      var wasPaused = itemDict[selectedItem]["item_data"]["paused"];
      var timeNow = Math.round(Date.now() / 1000);

      var prevTimerStart = itemDict[selectedItem]["item_data"]["timer_start"];

      var editData = {};

      if (wasPaused)
      {
        var timeSincePause = timeNow - itemDict[selectedItem]["item_data"]["pause_time"];
        editData["timer_start"] = prevTimerStart + timeSincePause;

        $(e.currentTarget).text("Pause");
      }
      else 
      {
        editData["pause_time"] = timeNow;
        $(e.currentTarget).text("Unpause");
      }

      editData["paused"] = !wasPaused;

      sendWebsocketMessage("edit_overlay_item", { "item_id": selectedItem, "item_type": itemType, "item_data": editData });
      break;
    case "audio":
      sendWebsocketMessage("trigger_item_event", { "item_id": selectedItem, "item_type": itemType, "event": "pause_item" });
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

function toggleEmbeddedTwitchStream(e)
{
  var checked = $("#embed-checkbox").is(":checked");
  var interactable = $("#embed-interact").is(":checked");

  if (checked)
  {
    streamEmbed = new Twitch.Player("twitch-embed", {
      width: "100%",
      height: "100%",
      muted: true,
      channel: overlayOwner,
    });
    if (!interactable)
    {
      $("#twitch-embed iframe").addClass("noselect");
    }
  }
  else
  {
    $("#twitch-embed").html("");
    streamEmbed = null;
  }
}

function toggleEmbeddedStreamInteraction(e)
{
  var checked = $("#embed-interact").is(":checked");

  if (checked)
  {
    $("#twitch-embed").removeClass("noselect");
    $("#twitch-embed iframe").removeClass("noselect");
  }
  else
  {
    $("#twitch-embed").addClass("noselect");
    $("#twitch-embed iframe").addClass("noselect");
  }
}

function selectedVisibilityChange(e)
{
  otherSelectedItems.forEach((itemId) => {
    itemDict[itemId]["item_data"]["visibility"] = $(e.target).is(":checked");
    itemDict[itemId]["local_changes"] = true;
  });
}

function selectedMinimizedChange(e)
{
  otherSelectedItems.forEach((itemId) => {
    itemDict[itemId]["item_data"]["minimized"] = $(e.target).is(":checked");
    itemDict[itemId]["local_changes"] = true;
  });
}

function createYouTubePlayer(itemId)
{
  itemDict[itemId]['player_init'] = true;
  itemDict[itemId]["player"] = new YT.Player('item-{0}-player'.format(itemId), {
    height: '100%',
    width: '100%',
    videoId: itemDict[itemId]['item_data']['video_id'],
    playerVars: {
      'controls': 1,
      'disablekb': 0,
      'autoplay': 0,
      'playsinline': 1,
      'start': itemDict[itemId].item_data.start_time,
    },
    events: {
      'onReady': onPlayerReady,
    }
  });
}

$(window).on('load', function() {
  initialResize();

  connectWebsocket(overlayId);

  var getInterval = setInterval(function() { getOverlayItems(); }, 1000);

  $("#main-container").on("mousewheel DOMMouseScroll", onScroll);
  
  $("#main-container").on("mousemove touchmove", onMouseMove);
  $('#main-container').on("mousedown touchstart", onMouseDownBody);
  
  $(document).on('keyup keydown', function(e){window.shiftheld = e.shiftKey; window.ctrlheld = e.ctrlKey;} );
  
  $(".edit-form").submit((e) => {
    e.preventDefault();
  });

  $(".edit-form input, .edit-form textarea, .edit-form select, .edit-form file").on("input", (e) => {
    onInputChange(e);
  });

  $("input[checkbox]").change((e) => {
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

  $(".tablink").first().click();

  for (var i = 0; i < $(".tabcontent").length; i++)
  {
    $(".tabcontent").eq(i).css({ "z-index": i });
  }

  toggleEmbeddedTwitchStream();
  $("#embed-checkbox").change((e) => {
    toggleEmbeddedTwitchStream(e);
  });

  toggleEmbeddedStreamInteraction();
  $("#embed-interact").change((e) => {
    toggleEmbeddedStreamInteraction(e);
  });

  $(".delete-item").click((e) => {
    deleteSelectedItem(e);
  });

  $(".reset-item").click((e) => {
    resetSelectedItem(e);
  });

  $(".pause-item").click((e) => {
    pauseSelectedItem(e);
  });

  $(".play-item").click((e) => {
    playSelectedItem(e);
  })

  $(".edit-container input[id=id_visibility]").each((i, visibleCheckbox) => {
    $(visibleCheckbox).change((e) => selectedVisibilityChange(e));
  });

  $(".edit-container input[id=id_minimized]").each((i, minimizedCheckbox) => {
    $(minimizedCheckbox).change((e) => selectedMinimizedChange(e));
  });
});