const data = document.currentScript.dataset;

window.shiftheld = false;
window.ctrlheld = false;

const overlayId = data.overlayid;
const getOverlayItemsUrl  = data.getitemsurl;
const addOverlayItemsUrl  = data.additemsurl;
const editOverlayItemsUrl = data.edititemsurl;
const deleteOverlayItemUrl = data.deleteitemurl;
const overlayOwner = data.overlayowner;

var scaledOverlayWidth = -1;
var scaledOverlayHeight = -1;
const overlayWidth = parseInt(data.overlaywidth, 10);
const overlayHeight = parseInt(data.overlayheight, 10);

var itemDict = {};

var selectedItem = undefined;
var otherSelectedItems = [];

const GrabTypes = {
  Move: 0,
  TopLeft: 1,
  TopRight: 2,
  BottomLeft: 3,
  BottomRight: 4,
};
var grabType = GrabTypes.Move;

function editToViewScale(distance)
{
  return (overlayWidth * distance) / scaledOverlayWidth;
}

function viewToEditScale(distance)
{
  return (scaledOverlayWidth * distance) / overlayWidth;
}

function getItemDiv(itemId)
{
  return $("#{0}".format(itemId));
}

class Point 
{
  constructor(x, y)
  {
    this.x = x;
    this.y = y;
  }

  add(other)
  {
    this.x += other.x;
    this.y += other.y;

    return this;
  }

  addX(val)
  {
    this.x += val;
    return this;
  }

  addY(val)
  {
    this.y += val;
    return this;
  }

  sub(other)
  {
    this.x -= other.x;
    this.y -= other.y;

    return this;
  }

  subX(val)
  {
    this.x -= val;
    return this;
  }

  subY(val)
  {
    this.y -= val;
    return this;
  }

  div(divisor)
  {
    this.x /= divisor;
    this.y /= divisor;

    return this;
  }

  mult(multiplier)
  {
    this.x *= multiplier;
    this.y *= multiplier;

    return this;
  }

  angle()
  {
    var angle = 0;
    if (this.x == 0)
      angle = (this.y >= 0) ? (Math.PI / 2) : (3 * Math.PI / 2);
    else
      angle = Math.atan(this.y / this.x);

    if (this.x < 0)
      angle += Math.PI;

    return angle;
  }

  magnitude()
  {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
  }

  rotate(angle)
  {
    var r = this.magnitude();
    var currAngle = this.angle();

    var newAngle = currAngle + angle;

    this.x = r * Math.cos(newAngle);
    this.y = r * Math.sin(newAngle);

    return this;
  }

  static add2(p1, p2)
  {
    return new Point(p1.x + p2.x, p1.y + p2.y);
  }

  static sub2(p1, p2)
  {
    return new Point(p1.x - p2.x, p1.y - p2.y);
  }
}

function distance(x1, y1, x2, y2)
{
  return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
}

function addGrabbers(itemId)
{
  getItemDiv(itemId).append("<div class='grabber topleft'></div>");
  getItemDiv(itemId).append("<div class='grabber topright'></div>");
  getItemDiv(itemId).append("<div class='grabber bottomleft'></div>");
  getItemDiv(itemId).append("<div class='grabber bottomright'></div>");

  $('#{0} .topleft'.format(itemId)).on("mousedown", (event) => { grabType = GrabTypes.TopLeft; });
  $('#{0} .topright'.format(itemId)).on("mousedown", (event) => { grabType = GrabTypes.TopRight; });
  $('#{0} .bottomleft'.format(itemId)).on("mousedown", (event) => { grabType = GrabTypes.BottomLeft; });
  $('#{0} .bottomright'.format(itemId)).on("mousedown", (event) => { grabType = GrabTypes.BottomRight; });
}

function handleGetItemsResponse(data)
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
    var itemData = item["item_data"];
    var itemId = itemData['id'];
    
    if (itemId in itemDict)
    {
      itemSeen[itemId] = true;
      if (!itemDict[itemData['id']]['local_changes'])
      {
        itemDict[itemData['id']]['item_data'] = itemData;
      }
    }
    else
    {
      itemDict[itemData['id']] = {
        "item_type": itemType,
        "local_changes": false,
        "locked": false,
        "item_data": itemData,
      };
    }

    if (itemDict[itemId]['local_changes'])
    {
      continue;
    }

    var left   = viewToEditScale(itemData['x']);
    var top    = viewToEditScale(itemData['y']);
    var width  = viewToEditScale(itemData['width']);
    var height = viewToEditScale(itemData['height']);

    var z = itemData['z'];
    var rotation = itemData['rotation'];

    addOrUpdateItem("#overlay", itemId, itemType, top, left, width, height, z, rotation, itemData, 
      () => { addItemCallback(itemId, itemType); },
      () => { updateItemCallback(itemId, itemType); });
  }

  for (itemId in itemSeen)
  {
    if (!itemSeen[itemId])
    {
      getItemDiv(itemId).remove();
      $("#{0}-list-entry".format(itemId)).remove();

      if (itemId == selectedItem)
      {
        clearSelectedItem();
      }
    }
  }
}

function addItemCallback(itemId, itemType)
{
  getItemDiv(itemId).mousedown(onMousedownItem);
  addGrabbers(itemId);

  var item = itemDict[itemId]

  var itemIcon = 'text_snippet'
  switch (itemType)
  {
    case "ImageItem":
      itemIcon = 'image'
      break
    case "StopwatchItem":
      itemIcon = 'timer'
      break
    case "CounterItem":
      itemIcon = '123'
      break
    case "TextItem":
    default:
      break;
  }

  $("#item-select-list").append(`<div class="item-list-entry" id="{0}-list-entry" item_id="{0}">
    <span class="material-symbols-outlined">{1}</span> - {2}
  </div>`.format(itemId, itemIcon, item["item_data"]["name"]));

  $("#{0}-list-entry".format(itemId)).mousedown((e) => onMouseDownItemList(e, itemId));
}

function updateItemCallback(itemId, itemType)
{
  var item = itemDict[itemId]

  var itemIcon = 'text_snippet'
  switch (itemType)
  {
    case "ImageItem":
      itemIcon = 'image'
      break
    case "StopwatchItem":
      itemIcon = 'timer'
      break
    case "CounterItem":
      itemIcon = '123'
      break
    case "TextItem":
    default:
      break;
  }

  $("#{0}-list-entry".format(itemId)).html(`<span class="material-symbols-outlined">{0}</span><span> - {1}</span>`.format(itemIcon, item["item_data"]["name"]));
}

function handleEditItemsSuccess(data)
{
  getOverlayItems();
}

function handleAjaxError(data)
{
  console.log("~~~~~~~~~~~ERROR~~~~~~~~~~~~~~~~~~~")
  console.log(data);

  getOverlayItems();
}

function getOverlayItems()
{
  AjaxGet(getOverlayItemsUrl, { "overlay_id": overlayId }, handleGetItemsResponse, handleAjaxError);
}

function updateOverlayItems()
{
  items = []
  for (const prop in itemDict)
  {
    if (itemDict[prop]['local_changes'])
    {
      items.push({
        "item_id": prop,
        "item_type": itemDict[prop]['item_type'],
        "item_data": itemDict[prop]['item_data'],
      });

      if (!itemDict[prop]['locked']) itemDict[prop]['local_changes'] = false;
    }
  }

  if (items.length > 0)
  {
    AjaxPost(editOverlayItemsUrl, { "overlay_id": overlayId, "items": items }, handleEditItemsSuccess, handleAjaxError);
  }
  else
  {
    getOverlayItems();
  }
}

function onResize(event)
{
  var mcWidth = $("#main-container").width();
  var mcHeight = $("#main-container").height();

  scaledOverlayWidth = 0.8 * mcWidth;
  scaledOverlayHeight = 9.0 / 16.0 * scaledOverlayWidth;

  if (scaledOverlayHeight > (0.667 * mcHeight))
  {
    scaledOverlayHeight = 0.667 * mcHeight;
    scaledOverlayWidth = 16.0 / 9.0 * scaledOverlayHeight;
  }

  $("#overlay").width(scaledOverlayWidth);
  $("#overlay").height(scaledOverlayHeight);

  $("#twitch-embed").width(scaledOverlayWidth);
  $("#twitch-embed").height(scaledOverlayHeight);

  for (const prop in itemDict)
  {
    var itemData = itemDict[prop]['item_data'];
    var itemId = itemData['id'];

    var left   = viewToEditScale(itemData['x']);
    var top    = viewToEditScale(itemData['y']);
    var width  = viewToEditScale(itemData['width']);
    var height = viewToEditScale(itemData['height']);
    
    if (itemDict[prop]['item_type'] == "ImageItem")
    {
      $("#{0}-img".format(itemId)).attr('width', "{0}px".format(width));
      $("#{0}-img".format(itemId)).attr('height', "{0}px".format(height));
    }

    setItemPosition(itemId, top, left, width, height, itemData['rotation']);
  }
}

function onMouseDownItemList(e, itemId)
{
  selectItem(itemId);
}

function onMousedownItem(e) 
{
  e.stopImmediatePropagation();

  window.dragData = {};
  dragData.pageP0 = new Point(e.pageX, e.pageY);
  dragData.pagePn = new Point(e.pageX, e.pageY);
  dragData.pagePn_m1 = new Point(e.pageX, e.pageY);
  dragData.elem = this;

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

  selectItem(dragData.elem.id);

  dragData.elemP0 = new Point(parseFloat($(dragData.elem).css('left')), parseFloat($(dragData.elem).css('top')));
  dragData.distP0 = Point.sub2(dragData.furthestCorner.point, new Point(e.pageX, e.pageY));

  dragData.selectedElem = {
    point0: getItemPos(selectedItem)
  }
  itemDict[selectedItem]['locked'] = true;

  dragData.otherElems = {}
  otherSelectedItems.forEach((itemId) => {
    dragData.otherElems[itemId] = {};
    dragData.otherElems[itemId]["point0"] = getItemPos(itemId)
    itemDict[itemId]['locked'] = true;
  });

  function handleDragging(e)
  {
    dragData.pagePn = new Point(e.pageX, e.pageY);

    if (grabType == GrabTypes.Move)
    {
      var offsetPosition = Point.sub2(dragData.pagePn, dragData.pageP0);

      var movedItemNewPos = Point.add2(dragData.elemP0, offsetPosition);
      var movedItemDim = getItemDim(dragData.elem.id);
      if (itemDict[dragData.elem.id].item_data.rotation == 0)
      {
        if (Math.abs(scaledOverlayHeight - (movedItemNewPos.y + movedItemDim.y)) < (0.01 * scaledOverlayHeight))
          offsetPosition.addY(scaledOverlayHeight - (movedItemNewPos.y + movedItemDim.y));
    
        if (Math.abs(scaledOverlayWidth - (movedItemNewPos.x + movedItemDim.x)) < (0.01 * scaledOverlayWidth))
          offsetPosition.addX(scaledOverlayWidth - (movedItemNewPos.x + movedItemDim.x));
    
        if (Math.abs(movedItemNewPos.y) < (0.01 * scaledOverlayHeight))
          offsetPosition.subY(movedItemNewPos.y);
    
        if (Math.abs(movedItemNewPos.x) < (0.01 * scaledOverlayWidth))
          offsetPosition.subX(movedItemNewPos.x);
      }
  
      var newPos = Point.add2(dragData.selectedElem.point0, offsetPosition);
      getItemDiv(selectedItem).css({
        top: "{0}px".format(newPos.y), 
        left: "{0}px".format(newPos.x),
      });

      var itemTop  = editToViewScale(newPos.y);
      var itemLeft = editToViewScale(newPos.x);
      itemDict[selectedItem]['item_data']['x'] = Math.round(itemLeft);
      itemDict[selectedItem]['item_data']['y'] = Math.round(itemTop);
      itemDict[selectedItem]['local_changes'] = true;

      otherSelectedItems.forEach((itemId) => {
        newPos = Point.add2(dragData.otherElems[itemId].point0, offsetPosition);
        getItemDiv(itemId).css({
          top: "{0}px".format(newPos.y), 
          left: "{0}px".format(newPos.x),
        });

        var itemTop  = editToViewScale(newPos.y);
        var itemLeft = editToViewScale(newPos.x);
        itemDict[itemId]['item_data']['x'] = Math.round(itemLeft);
        itemDict[itemId]['item_data']['y'] = Math.round(itemTop);
        itemDict[itemId]['local_changes'] = true;
      });
    }
    else
    {
      var relativePos = Point.sub2(dragData.furthestCorner.point, dragData.pagePn);

      var itemRotRad = itemDict[dragData.elem.id].item_data.rotation * Math.PI / 180.0;
      
      relativePos.rotate(-1 * itemRotRad);

      var newWidth = Math.abs(relativePos.x);
      var newHeight = Math.abs(relativePos.y);

      newWidth = Math.max(25, newWidth);
      newHeight = Math.max(25, newHeight);

      if (itemDict[dragData.elem.id].item_type == "ImageItem")
      {
        if (!window.shiftheld)
        {
          var imgNaturalWidth = $("#{0}-img".format(selectedItem)).get(0).naturalWidth;
          var imgNaturalHeight = $("#{0}-img".format(selectedItem)).get(0).naturalHeight;

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
        }
      }

      newWidth = Math.max(5, newWidth);
      newHeight = Math.max(5, newHeight);
    
      $(dragData.elem).css({
        width: "{0}px".format(newWidth),
        height: "{0}px".format(newHeight),
      });

      var newFurthestCornerPoint = getGrabberPos(dragData.furthestCorner.elem);
      var offsetPosition = Point.sub2(dragData.furthestCorner.point, newFurthestCornerPoint);

      var newPos = Point.add2(getItemPos(dragData.elem.id), offsetPosition);
      $(dragData.elem).css({
        top: "{0}px".format(newPos.y), 
        left: "{0}px".format(newPos.x),
      });

      if (itemDict[dragData.elem.id].item_type == "ImageItem")
      {
        $("#{0}-img".format(selectedItem)).attr("width", "{0}px".format(newWidth));
        $("#{0}-img".format(selectedItem)).attr("height", "{0}px".format(newHeight));
      }
  
      var itemTop    = editToViewScale(newPos.y);
      var itemLeft   = editToViewScale(newPos.x);
      var itemWidth  = editToViewScale(newWidth);
      var itemHeight = editToViewScale(newHeight);
  
      itemDict[dragData.elem.id]['item_data']['x']      = Math.round(itemLeft);
      itemDict[dragData.elem.id]['item_data']['y']      = Math.round(itemTop);
      itemDict[dragData.elem.id]['item_data']['width']  = Math.round(itemWidth);
      itemDict[dragData.elem.id]['item_data']['height'] = Math.round(itemHeight);

      itemDict[dragData.elem.id]['local_changes'] = true;
    }
  
    setEditFormInputs(selectedItem);

    dragData.pagePn_m1 = new Point(e.pageX, e.pageY);
  }

  function handleMouseUp(e){
    itemDict[selectedItem]['locked'] = false;
    otherSelectedItems.forEach((itemId) => itemDict[itemId]['locked'] = false);
    grabType = GrabTypes.Move;
    $('#main-container').off('mousemove', handleDragging).off('mouseup', handleMouseUp);
  }

  $('#main-container').on('mouseup', handleMouseUp).on('mousemove', handleDragging);
}

function onMousedownBody(e)
{
  if (selectedItem !== undefined)
  {
    clearSelectedItem();
  }
}

function clearSelectedItem()
{
  if (selectedItem !== undefined)
  {
    getItemDiv(selectedItem).removeClass("selected").addClass("unselected");
    $("#{0}-list-entry".format(selectedItem)).removeClass("selected-list-entry");

    selectedItem = undefined;
  }

  otherSelectedItems.forEach((itemId) => {
    getItemDiv(itemId).removeClass("selected").addClass("unselected");
    $("#{0}-list-entry".format(itemId)).removeClass("selected-list-entry");
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

function selectItem(itemId)
{
  if (otherSelectedItems.includes(itemId))
    return;
  if (itemId == selectedItem)
    return;

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
  $("#{0}-list-entry".format(itemId)).addClass("selected-list-entry");

  if (!addingItem)
  {
    var itemType = itemDict[selectedItem]['item_type'];
    var containerId = "#edit-{0}-container".format(itemType);
  
    $(containerId).removeClass("hidden");
  
    if ("paused" in itemDict[selectedItem]["item_data"])
    {
      $("{0} .pause-item".format(containerId)).text(itemDict[selectedItem]["item_data"]["paused"] ? "Unpause" : "Pause");
    }
  
    setEditFormInputs(selectedItem);
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

    switch(input.prop("type"))
    {
      case "checkbox":
        input.prop('checked', itemData[key]);
        break;
      default:
        input.prop('value', itemData[key]);
        break;
    }
  }
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
      case "text":
      default:
        return inputVal;
    }
  }
}

function updateItemDataFromInput(itemId, inputObj) 
{
  var name = inputObj.attr('name');

  if (!(name in itemDict[itemId]['item_data']))
  {
    return;
  }

  var inputVal = inputToValue(inputObj);

  if (inputVal !== undefined)
  {
    itemDict[itemId]['item_data'][name] = inputVal;
  }
}

function submitEditForm(form)
{
  var itemId = $(form).find("#id_item_id").val();

  for(var i = 0; i < $(form).find("input,textarea,select").length; i++)
  {
    var inp = $(form).find("input,textarea,select").eq(i);

    updateItemDataFromInput(itemId, inp);
  }

  itemDict[itemId]['local_changes'] = true;
}

function addFormToDict(form)
{
  var itemDict = {}

  for(var i = 0; i < $(form).find("input,textarea,select").length; i++)
  {
    var inputObj = $(form).find("input,textarea,select").eq(i);

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

  AjaxPost(addOverlayItemsUrl, { 'overlay_id': overlayId, "item_type": itemType, "item_data": itemData }, (e) => {}, handleAjaxError);

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
  
    AjaxPost(deleteOverlayItemUrl, { "overlay_id": overlayId, "item_type": itemType, "item_id": selectedItem }, (e) => {}, (e) => {});
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
    case "StopwatchItem":
      itemDict[selectedItem]["item_data"]["timer_start"] = Math.round(Date.now() / 1000);
      itemDict[selectedItem]["item_data"]["pause_time"] = itemDict[selectedItem]["item_data"]["timer_start"];
      break;
    default:
      break;
  }

  itemDict[selectedItem]["local_changes"] = true;
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
    case "StopwatchItem":
      var wasPaused = itemDict[selectedItem]["item_data"]["paused"];
      var timeNow = Math.round(Date.now() / 1000);

      if (wasPaused)
      {
        var timeSincePause = timeNow - itemDict[selectedItem]["item_data"]["pause_time"];
        itemDict[selectedItem]["item_data"]["timer_start"] += timeSincePause;
        $(e.currentTarget).text("Pause");
      }
      else 
      {
        $(e.currentTarget).text("Unpause");
      }

      itemDict[selectedItem]["item_data"]["pause_time"] = timeNow;
      itemDict[selectedItem]["item_data"]["paused"] = !wasPaused;
      break;
    default:
      break;
  }

  itemDict[selectedItem]["local_changes"] = true;
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

  getItemDiv(tabId).css({ "visibility": "visible" });
  $(event.currentTarget).addClass("active");
}

function toggleEmbeddedTwitchStream(e)
{
  var checked = $("#embed-checkbox").is(":checked");

  if (checked)
  {
    $("#twitch-embed").html(`<iframe
    src="https://player.twitch.tv/?channel={0}&parent={1}&muted=true"
    height="100%"
    width="100%"
    class="noselect"
    frameBorder="0">
</iframe>`.format(overlayOwner, location.hostname));
  }
  else
  {
    $("#twitch-embed").html("");
  }
}

function selectedVisibilityChange(e)
{
  otherSelectedItems.forEach((itemId) => {
    itemDict[itemId]["item_data"]["visible"] = $(e.target).is(":checked");
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

$(window).on('load', function() {
  onResize();
  getOverlayItems();

  var getInterval  = setInterval(function() { updateOverlayItems(); }, 500);

  $(window).on("resize", onResize);
  
  $('#main-container').on("mousedown", onMousedownBody);
  
  $(document).on('keyup keydown', function(e){window.shiftheld = e.shiftKey; window.ctrlheld = e.ctrlKey;} );
  
  $(".edit-form").submit((e) => {
    e.preventDefault();
  });

  $(".edit-form").on('input', (e) => {
    submitEditForm(e.currentTarget);
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

  $(".delete-item").click((e) => {
    deleteSelectedItem(e);
  });

  $(".reset-item").click((e) => {
    resetSelectedItem(e);
  });

  $(".pause-item").click((e) => {
    pauseSelectedItem(e);
  });

  $(".edit-container input[id=id_visible]").each((i, visibleCheckbox) => {
    $(visibleCheckbox).change((e) => selectedVisibilityChange(e));
  });

  $(".edit-container input[id=id_minimized]").each((i, minimizedCheckbox) => {
    $(minimizedCheckbox).change((e) => selectedMinimizedChange(e));
  });
});