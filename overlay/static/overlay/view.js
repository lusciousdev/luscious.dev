const data = document.currentScript.dataset;

const overlayId = data.overlayid;
const getOverlayItemsUrl = data.getitemsurl;
const overlayWidth = parseInt(data.overlaywidth, 10)
const overlayHeight = parseInt(data.overlayheight, 10)

var itemDict = {};

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
      itemDict[itemData['id']]['item_data'] = itemData;
    }
    else
    {
      itemDict[itemData['id']] = {
        "item_type": itemType,
        "item_data": itemData,
      };
    }

    var top = itemData['y'];
    var left = itemData['x'];
    var width = itemData['width'];
    var height = itemData['height'];
    var z = itemData['z'];
    var rotation = itemData['rotation'];
    
    addOrUpdateItem("body", itemId, itemType, top, left, width, height, z, rotation, itemData,
      () => {},
      () => {});
  }

  for (itemId in itemSeen)
  {
    if (!itemSeen[itemId])
    {
      $("#{0}".format(itemId)).remove();
    }
  }
}

function handleGetItemsError(data)
{
  console.log("~~~~~~~~~~~ERROR~~~~~~~~~~~~~~~~~~~")
  console.log(data);
}

function getOverlayItems()
{
  AjaxGet(getOverlayItemsUrl, { "overlay_id": overlayId }, handleGetItemsResponse, handleGetItemsError);
}

$(window).on('load', function() {
  getOverlayItems();

  var intervalId = setInterval(function() { getOverlayItems(); }, 250);
});