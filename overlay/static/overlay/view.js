const c_EditView = false;
const c_OverlayUserID = undefined;

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
    var newItem = false;

    var prevItemData = null;
    if (itemId in g_ItemDict)
    {
      itemSeen[itemId] = true;
      prevItemData = g_ItemDict[itemData['id']]['item_data'];
      g_ItemDict[itemData['id']]['item_data'] = itemData;
    }
    else
    {
      newItem = true;

      g_ItemDict[itemData['id']] = {
        "item_type": itemType,
        "item_data": itemData,
      };
    }

    var top = itemData['y'];
    var left = itemData['x'];
    var width = itemData['width'];
    var height = itemData['height'];

    addOrUpdateItem(false, "body", itemId, itemType, isDisplayed, top, left, width, height, itemData);

    if (newItem)
    {
      addItemCallback(itemId, itemType);
    }
    else
    {
      updateItemCallback(itemId, itemType); 
    }
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
  g_ItemDict[itemId]['player_init'] = true;
  g_ItemDict[itemId]['player'] = new YT.Player('item-{0}-player'.format(itemId), {
    height: '100%',
    width: '100%',
    videoId: g_ItemDict[itemId]['item_data']['video_id'],
    playerVars: {
      'controls': 0,
      'disablekb': 1,
      'autoplay': 0,
      'playsinline': 1,
      'start': g_ItemDict[itemId].item_data.start_time,
    },
    events: {
      'onReady': onPlayerReady,
    }
  });
}

function handleUserSettings(data) {}
function userPresent(data) { }
function repositionMouse(data) { }
function repopulateChatHistory() { }
function addChatMessages(messageArray) { }

function handleWebsocketOpen(e)
{
  getOverlayItems();
}

$(window).on('load', function() {
  connectWebsocket();

  var intervalId = setInterval(function() { getOverlayItems(); }, 1000);
});
