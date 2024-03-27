const data = document.currentScript.dataset;

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
  }

  sub(other)
  {
    this.x -= other.x;
    this.y -= other.y;
  }

  div(divisor)
  {
    this.x /= divisor;
    this.y /= divisor;
  }

  mult(multiplier)
  {
    this.x *= multiplier;
    this.y *= multiplier;
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
  }
}

function distance(x1, y1, x2, y2)
{
  return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
}

function addGrabbers(itemId)
{
  $("#{0}".format(itemId)).append("<div class='grabber topleft'></div>");
  $("#{0}".format(itemId)).append("<div class='grabber topright'></div>");
  $("#{0}".format(itemId)).append("<div class='grabber bottomleft'></div>");
  $("#{0}".format(itemId)).append("<div class='grabber bottomright'></div>");

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
      () => { $("#{0}".format(itemId)).mousedown(onMousedownItem); addGrabbers(itemId);},
      () => {});
  }

  for (itemId in itemSeen)
  {
    if (!itemSeen[itemId])
    {
      $("#{0}".format(itemId)).remove();

      if (itemId == selectedItem)
      {
        clearSelectedItem();
      }
    }
  }
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

function onMousedownItem(e) {
  e.stopImmediatePropagation();

  window.dragData = {};
  dragData.pageX0 = e.pageX;
  dragData.pageY0 = e.pageY;
  dragData.pageXn = e.pageX;
  dragData.pageYn = e.pageY;
  dragData.elem = this;

  function getGrabberPos(grabber)
  {
    return new Point(
      grabber.offset().left + (grabber.outerWidth() / 2),
      grabber.offset().top  + (grabber.outerHeight() / 2)
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
  
  var maxDist = distance(dragData.initialGrabberCoords[0].point.x, dragData.initialGrabberCoords[0].point.y, dragData.pageX0, dragData.pageY0);
  dragData.furthestCorner = dragData.initialGrabberCoords[0];

  for (var i = 1; i < dragData.initialGrabberCoords.length; i++)
  {
    var dist = distance(dragData.initialGrabberCoords[i].point.x, dragData.initialGrabberCoords[i].point.y, dragData.pageX0, dragData.pageY0);

    if (dist > maxDist)
    {
      maxDist = dist;
      dragData.furthestCorner = dragData.initialGrabberCoords[i];
    }
  }

  dragData.elemX0 = parseFloat($(dragData.elem).css('left'));
  dragData.elemY0 = parseFloat($(dragData.elem).css('top'));

  dragData.distX0 = dragData.furthestCorner.point.x - e.pageX;
  dragData.distY0 = dragData.furthestCorner.point.x - e.pageY;

  selectItem(dragData.elem.id);
  itemDict[selectedItem]['locked'] = true;

  function handleDragging(e)
  {
    var elemTop = parseFloat($(dragData.elem).css('top'));
    var absTop = $(dragData.elem).offset().top;
    var elemLeft = parseFloat($(dragData.elem).css('left'));
    var absLeft = $(dragData.elem).offset().left;
    var elemWidth = parseFloat($(dragData.elem).css('width'));
    var elemHeight = parseFloat($(dragData.elem).css('height'));

    var newTop = elemTop;
    var newLeft = elemLeft;
    var newWidth = elemWidth;
    var newHeight = elemHeight;

    if (grabType == GrabTypes.Move)
    {
      var diffX = (e.pageX - dragData.pageX0);
      var diffY = (e.pageY - dragData.pageY0);

      newTop = dragData.elemY0 + diffY;
      newLeft = dragData.elemX0 + diffX;

      if (itemDict[selectedItem].item_data.rotation == 0)
      {
        if (Math.abs(scaledOverlayHeight - (newTop + newHeight)) < (0.01 * scaledOverlayHeight))
          newTop = scaledOverlayHeight - newHeight;
    
        if (Math.abs(scaledOverlayWidth - (newLeft + newWidth)) < (0.01 * scaledOverlayWidth))
          newLeft = scaledOverlayWidth - newWidth;
    
        if (Math.abs(newTop) < (0.01 * scaledOverlayHeight))
          newTop = 0;
    
        if (Math.abs(newLeft) < (0.01 * scaledOverlayWidth))
          newLeft = 0;
      }
    }
    else
    {
      var clickPoint = new Point(e.pageX, e.pageY);

      var relativePos = new Point(dragData.furthestCorner.point.x, dragData.furthestCorner.point.y);
      relativePos.sub(clickPoint);

      var itemRotRad = itemDict[selectedItem].item_data.rotation * Math.PI / 180.0;
      
      relativePos.rotate(-1 * itemRotRad);

      newWidth = Math.abs(relativePos.x);
      newHeight = Math.abs(relativePos.y);

      newWidth = Math.max(25, newWidth);
      newHeight = Math.max(25, newHeight);

      if (itemDict[selectedItem].item_type == "ImageItem")
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
    
      $(dragData.elem).css({
        width: "{0}px".format(newWidth),
        height: "{0}px".format(newHeight),
      });

      var newFurthestCornerPoint = getGrabberPos(dragData.furthestCorner.elem);

      var diffX = newFurthestCornerPoint.x - dragData.furthestCorner.point.x;
      var diffY = newFurthestCornerPoint.y - dragData.furthestCorner.point.y;

      newTop -= diffY;
      newLeft -= diffX;
    }

    newWidth = Math.max(5, newWidth);
    newHeight = Math.max(5, newHeight);
  
    $(dragData.elem).css({
      top: "{0}px".format(newTop), 
      left: "{0}px".format(newLeft),
      width: "{0}px".format(newWidth),
      height: "{0}px".format(newHeight),
    });

    if (itemDict[selectedItem].item_type == "ImageItem")
    {
      $("#{0}-img".format(selectedItem)).attr("width", "{0}px".format(newWidth));
      $("#{0}-img".format(selectedItem)).attr("height", "{0}px".format(newHeight));
    }

    var itemTop    = editToViewScale(newTop);
    var itemLeft   = editToViewScale(newLeft);
    var itemWidth  = editToViewScale(newWidth);
    var itemHeight = editToViewScale(newHeight);

    itemDict[selectedItem]['item_data']['x']      = Math.round(itemLeft);
    itemDict[selectedItem]['item_data']['y']      = Math.round(itemTop);
    itemDict[selectedItem]['item_data']['width']  = Math.round(itemWidth);
    itemDict[selectedItem]['item_data']['height'] = Math.round(itemHeight);

    itemDict[selectedItem]['local_changes'] = true;

    setEditFormInputs(selectedItem);

    dragData.pageXn = e.pageX;
    dragData.pageYn = e.pageY;
  }

  function handleMouseUp(e){
    itemDict[selectedItem]['locked'] = false;
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
    $("#{0}".format(selectedItem)).removeClass("selected").addClass("unselected");
  }
  
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
  if (selectedItem !== undefined)
  {
    clearSelectedItem();
  }

  selectedItem = itemId;
  $("#{0}".format(selectedItem)).removeClass("unselected").addClass("selected");

  var itemType = itemDict[selectedItem]['item_type'];
  var containerId = "#edit-{0}-container".format(itemType);

  $(containerId).removeClass("hidden");

  if ("paused" in itemDict[selectedItem]["item_data"])
  {
    $("{0} .pause-item".format(containerId)).text(itemDict[selectedItem]["item_data"]["paused"] ? "Unpause" : "Pause");
  }

  setEditFormInputs(selectedItem);
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

  $("#{0}".format(tabId)).css({ "visibility": "visible" });
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

$(window).on('load', function() {
  onResize();
  getOverlayItems();

  var getInterval  = setInterval(function() { updateOverlayItems(); }, 500);

  $(window).on("resize", onResize);
  
  $('#main-container').on("mousedown", onMousedownBody);
  
  $(document).on('keyup keydown', function(e){window.shiftheld = e.shiftKey} );
  
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
});