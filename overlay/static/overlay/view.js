const data = document.currentScript.dataset;

const overlayId = data.overlayid;
const getOverlayItemsUrl = data.getitemsurl;
const overlayWidth = parseInt(data.overlaywidth, 10)
const overlayHeight = parseInt(data.overlayheight, 10)

const twitchUser = undefined;

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
    
    addOrUpdateItem(false, "body", itemId, itemType, top, left, width, height, z, rotation, itemData,
      () => { addItemCallback(itemId, itemType); },
      () => { updateItemCallback(itemId, itemType); });
  }

  if (fullItemList)
  {
    for (itemId in itemSeen)
    {
      if (!itemSeen[itemId])
      {
        $("#item-{0}".format(itemId)).remove();
      }
    }
  }
}

function addItemCallback(itemId, itemType)
{
  switch (itemType)
  {
    case "YouTubeEmbedItem":
    case "ImageItem":
    case "StopwatchItem":
    case "CounterItem":
    case "EmbedItem":
    case "TwitchStreamEmbedItem":
    case "TextItem":
    default:
      break;
  }
}

function updateItemCallback(itemId, itemType)
{
  switch (itemType)
  {
    case "YouTubeEmbedItem":
    case "ImageItem":
    case "StopwatchItem":
    case "CounterItem":
    case "EmbedItem":
    case "TwitchStreamEmbedItem":
    case "TextItem":
    default:
      break;
  }
}

function handleGetItemsError(data)
{
  console.log("~~~~~~~~~~~ERROR~~~~~~~~~~~~~~~~~~~")
  console.log(data);
}

function createYouTubePlayer(itemId)
{
  itemDict[itemId]['player_init'] = true;
  itemDict[itemId]['player'] = new YT.Player('item-{0}-player'.format(itemId), {
    height: '100%',
    width: '100%',
    videoId: itemDict[itemId]['item_data']['video_id'],
    playerVars: {
      'controls': 0,
      'disablekb': 1,
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
  connectWebsocket(overlayId);

  var intervalId = setInterval(function() { getOverlayItems(); }, 1000);
});