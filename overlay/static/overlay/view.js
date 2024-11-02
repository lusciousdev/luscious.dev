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
    var isDisplayed = item["is_displayed"];
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
    
    addOrUpdateItem(false, "body", itemId, itemType, isDisplayed, top, left, width, height, z, rotation, itemData,
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

function handleCanvasUpdate(itemId, history)
{
  const context = $("#item-{0}-canvas".format(itemId)).get(0).getContext('2d');
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

  history.forEach((action, i) => {
    if (action["type"] == "draw")
    {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = action["strokeStyle"];
    }
    else if (action["type"] == "erase")
    {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0, 0, 0, 1)";
    }

    context.lineWidth = action["lineWidth"];
    context.lineCap = 'round';

    context.beginPath();
    context.moveTo(action["points"][0][0], action["points"][0][1]);
    context.lineTo(action["points"][0][0], action["points"][0][1]);

    for (var i = 1; i < action["points"].length; i++)
    {
      context.lineTo(action["points"][i][0], action["points"][i][1]);
    }
    
    context.stroke();
  });
}

function userPresent(data) { }
function repositionMouse(data) { }

function handleWebsocketOpen(e)
{
  getOverlayItems();
}

$(window).on('load', function() {
  connectWebsocket(overlayId);

  var intervalId = setInterval(function() { getOverlayItems(); }, 1000);
});