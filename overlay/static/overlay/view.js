const data = document.currentScript.dataset;

const overlayId = data.overlayid;
const getOverlayItemsUrl = data.getitemsurl;
const overlayWidth = parseInt(data.overlaywidth, 10)
const overlayHeight = parseInt(data.overlayheight, 10)

const twitchUser = undefined;

var itemDict = {};

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

  if (fullItemList)
  {
    for (itemId in itemSeen)
    {
      if (!itemSeen[itemId])
      {
        $("#{0}".format(itemId)).remove();
      }
    }
  }
}

function handleGetItemsError(data)
{
  console.log("~~~~~~~~~~~ERROR~~~~~~~~~~~~~~~~~~~")
  console.log(data);
}

$(window).on('load', function() {
  connectWebsocket(overlayId);

  var intervalId = setInterval(function() { getOverlayItems(); }, 1000);
});