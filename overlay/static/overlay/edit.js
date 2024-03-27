const data = document.currentScript.dataset;

const overlayId = data.overlayid;
const getOverlayItemsUrl  = data.getitemsurl;
const addOverlayItemsUrl  = data.additemsurl;
const editOverlayItemsUrl = data.edititemsurl;
const deleteOverlayItemUrl = data.deleteitemurl;
const overlayWidth = parseInt(data.overlaywidth, 10)
const overlayHeight = parseInt(data.overlayheight, 10)

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
  var overlayElemWidth = $("#overlay").width();
  var overlayElemHeight = $("#overlay").height();

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

    var left   = (overlayElemWidth  * itemData['x']) / overlayWidth;
    var top    = (overlayElemHeight * itemData['y']) / overlayHeight;
    var width  = (overlayElemWidth  * itemData['width']) / overlayWidth;
    var height = (overlayElemHeight * itemData['height']) / overlayHeight;
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

  var overlayElemWidth = 0.8 * mcWidth;
  var overlayElemHeight = 9.0 / 16.0 * overlayElemWidth;

  if (overlayElemHeight > (0.667 * mcHeight))
  {
    overlayElemHeight = 0.667 * mcHeight;
    overlayElemWidth = 16.0 / 9.0 * overlayElemHeight;
  }

  $("#overlay").width(overlayElemWidth);
  $("#overlay").height(overlayElemHeight);

  for (const prop in itemDict)
  {
    var itemData = itemDict[prop]['item_data'];
    var itemId = itemData['id'];

    var left   = (overlayElemWidth  * itemData['x']) / overlayWidth;
    var top    = (overlayElemHeight * itemData['y']) / overlayHeight;
    var width  = (overlayElemWidth  * itemData['width']) / overlayWidth;
    var height = (overlayElemHeight * itemData['height']) / overlayHeight;
    
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


  if (selectedItem !== undefined)
  {
    $("#{0}".format(selectedItem)).removeClass("selected").addClass("unselected");
  }

  selectItem(dragData.elem.id);
  itemDict[selectedItem]['locked'] = true;

  function handleDragging(e){
    var diffX = (e.pageX - dragData.pageXn);
    var diffY = (e.pageY - dragData.pageYn);

    var elemTop = parseFloat($(dragData.elem).css('top'));
    var absTop = $(dragData.elem).offset().top;
    var elemLeft = parseFloat($(dragData.elem).css('left'));
    var absLeft = $(dragData.elem).offset().left;
    var elemWidth = parseFloat($(dragData.elem).css('width'));
    var elemHeight = parseFloat($(dragData.elem).css('height'));

    var points = {
      topleft: {
        x: absLeft,
        y: absTop,
      },
      topright: {
        x: absLeft + elemWidth,
        y: absTop
      },
      bottomleft: {
        x: absLeft,
        y: absTop + elemHeight
      },
      bottomright: {
        x: absLeft + elemWidth,
        y: absTop + elemHeight
      }
    };

    var newTop = elemTop;
    var newLeft = elemLeft;
    var newWidth = elemWidth;
    var newHeight = elemHeight;

    switch (grabType)
    {
      case GrabTypes.TopLeft:
        newTop += diffY;
        newLeft += diffX;
        newWidth -= diffX;
        newHeight -= diffY;
        break;
      case GrabTypes.TopRight:
        newTop += diffY;
        newWidth += diffX;
        newHeight -= diffY;
        break;
      case GrabTypes.BottomLeft:
        newLeft += diffX;
        newWidth -= diffX;
        newHeight += diffY;
        break;
      case GrabTypes.BottomRight:
        newWidth += diffX;
        newHeight += diffY;
        break;
      case GrabTypes.Move:
      default:
        newTop += diffY;
        newLeft += diffX;
        break;
    }

    if (itemDict[selectedItem]['item_type'] == "ImageItem")
    {
      if (!window.shiftheld && grabType != GrabTypes.Move)
      {
        var attemptedWidth = 0;
        var attemptedHeight = 0;

        switch (grabType)
        {
          case GrabTypes.TopLeft:
            attemptedWidth = points.bottomright.x - e.pageX;
            attemptedHeight = points.bottomright.y - e.pageY;
            break;
          case GrabTypes.TopRight:
            attemptedWidth = e.pageX - points.bottomleft.x;
            attemptedHeight = points.bottomleft.y - e.pageY;
            break;
          case GrabTypes.BottomLeft:
            attemptedWidth = points.topright.x - e.pageX;
            attemptedHeight = e.pageY - points.topright.y;
            break;
          case GrabTypes.BottomRight:
            attemptedWidth = e.pageX - points.topleft.x;
            attemptedHeight = e.pageY - points.topleft.y;
            break;
          case GrabTypes.Move:
          default:
            break;
        }

        var imgNaturalWidth = $("#{0}-img".format(selectedItem)).get(0).naturalWidth;
        var imgNaturalHeight = $("#{0}-img".format(selectedItem)).get(0).naturalHeight;
        
        var widthScale = attemptedWidth / imgNaturalWidth;
        var heightScale = attemptedHeight / imgNaturalHeight;

        var correctedWidth = attemptedWidth;
        var correctedHeight = attemptedHeight;
        if (heightScale >= widthScale)
        {
          correctedWidth = imgNaturalWidth * heightScale;
        }
        else
        {
          correctedHeight = imgNaturalHeight * widthScale;
        }

        var correctionX = correctedWidth - newWidth;
        var correctionY = correctedHeight - newHeight;

        switch (grabType)
        {
          case GrabTypes.TopLeft:
            newTop -= correctionY;
            newLeft -= correctionX;
            break;
          case GrabTypes.TopRight:
            newTop -= correctionY;
            break;
          case GrabTypes.BottomLeft:
            newLeft -= correctionX;
            break;
          case GrabTypes.BottomRight:
          case GrabTypes.Move:
          default:
            break;
        }

        newWidth = Math.max(5, correctedWidth);
        newHeight = Math.max(5, correctedHeight);
      }

      $("#{0}-img".format(selectedItem)).attr("width", "{0}px".format(newWidth));
      $("#{0}-img".format(selectedItem)).attr("height", "{0}px".format(newHeight));
    }

    newWidth = Math.max(5, newWidth);
    newHeight = Math.max(5, newHeight);
  
    $(dragData.elem).css({
      top: "{0}px".format(newTop), 
      left: "{0}px".format(newLeft),
      width: "{0}px".format(newWidth),
      height: "{0}px".format(newHeight),
    });
    
    var overlayElemWidth = $("#overlay").width();
    var overlayElemHeight = $("#overlay").height();

    var itemTop    = (overlayHeight * newTop) / overlayElemHeight;
    var itemLeft   = (overlayWidth * newLeft) / overlayElemWidth;
    var itemWidth  = (overlayWidth * newWidth) / overlayElemWidth;
    var itemHeight = (overlayHeight * newHeight) / overlayElemHeight;

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

  if (nodeName.toUpperCase() == "TEXTAREA")
  {
    return inputObj.val();
  }
  else if (nodeName.toUpperCase() == "INPUT")
  {
    var inputType = inputObj.attr('type');

    switch (inputType)
    {
      case "submit":
        return undefined;
      case "number":
        var numberVal = parseInt(inputObj.val(), 10);

        if (!isNaN(numberVal))
        {
          return numberVal;
        }
        else
        {
          return 0;
        }
      case "checkbox":
        return inputObj.is(":checked");
      case "text":
      default:
        return inputObj.val();
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

  var nodeName = inputObj.prop('nodeName');

  if (nodeName.toUpperCase() == "TEXTAREA")
  {
    itemDict[itemId]['item_data'][name] = inputObj.val();
  }
  else if (nodeName.toUpperCase() == "INPUT")
  {
    var inputVal = inputToValue(inputObj);

    if (inputVal !== undefined)
    {
      itemDict[itemId]['item_data'][name] = inputVal;
    }
  }
}

function submitEditForm(form)
{
  var itemId = $(form).find("#id_item_id").val();

  for(var i = 0; i < $(form).find("input,textarea").length; i++)
  {
    var inp = $(form).find("input,textarea").eq(i);

    updateItemDataFromInput(itemId, inp);
  }

  itemDict[itemId]['local_changes'] = true;
}

function addFormToDict(form)
{
  var itemDict = {}

  for(var i = 0; i < $(form).find("input,textarea").length; i++)
  {
    var inputObj = $(form).find("input,textarea").eq(i);

    var name = inputObj.attr('name');
    var nodeName = inputObj.prop('nodeName');
  
    if (nodeName.toUpperCase() == "TEXTAREA")
    {
      itemDict[name] = inputObj.val();
    }
    else if (nodeName.toUpperCase() == "INPUT")
    {
      var inputVal = inputToValue(inputObj);
  
      if (inputVal !== undefined)
      {
        itemDict[name] = inputVal;
      }
    }
  }

  console.log(itemDict);

  return itemDict;
}

function submitAddForm(form)
{
  var itemType = $(form).find("#id_item_type").val();
  var itemData = addFormToDict(form);

  // itemData['name'] = $(form).find("#id_name").val();
  // itemData['x'] = parseInt($(form).find("#id_x").val(), 10);
  // itemData['y'] = parseInt($(form).find("#id_y").val(), 10);
  // itemData['z'] = parseInt($(form).find("#id_z").val(), 10);
  // itemData['width'] = parseInt($(form).find("#id_width").val(), 10);
  // itemData['height'] = parseInt($(form).find("#id_height").val(), 10);
  // itemData['rotation'] = parseInt($(form).find("#id_rotation").val(), 10);
  // itemData['visible'] = $(form).find("#id_visible").is(":checked");
// 
  // switch (itemType)
  // {
  //   case "ImageItem":
  //     itemData['url'] = $(form).find("#id_url").val();
  //     break;
  //   case "TextItem":
  //     itemData['text'] = $(form).find("#id_text").val();
  //     itemData['font_size'] = parseInt($(form).find("#id_font_size").val(), 10);
  //     itemData['color'] = $(form).find("#id_color").val();
  //     itemData['outline'] = $(form).find("#id_outline").val();
  //     itemData['outline_enabled'] = $(form).find("#id_outline_enabled").is(":checked");
  //     break;
  //   case "CounterItem":
  //     itemData['counter_format'] = $(form).find("#id_text").val();
  //     itemData['count'] = parseInt($(form).find("#id_count").val(), 10);
  //     itemData['font_size'] = parseInt($(form).find("#id_font_size").val(), 10);
  //     itemData['color'] = $(form).find("#id_color").val();
  //     itemData['outline'] = $(form).find("#id_outline").val();
  //     itemData['outline_enabled'] = $(form).find("#id_outline_enabled").is(":checked");
  //     break;
  //   default:
  //     break;
  // };

  console.log({ 'overlay_id': overlayId, "item_type": itemType, "item_data": itemData });

  AjaxPost(addOverlayItemsUrl, { 'overlay_id': overlayId, "item_type": itemType, "item_data": itemData }, (e) => {}, handleAjaxError);

  $("#close-add-item").click();
}

function deleteSelectedItem()
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

  $(".delete-item").click((e) => {
    deleteSelectedItem();
  });
});