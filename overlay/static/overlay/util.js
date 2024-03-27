function setItemPosition(itemId, top, left, width, height, z, rotation)
{
  $("#{0}".format(itemId)).css({
    "top": "{0}px".format(top),
    "left": "{0}px".format(left),
    "width": "{0}px".format(width),
    "height": "{0}px".format(height),
    "z-index": "{0}".format(z), 
    "transform": "rotate({0}deg)".format(rotation),
  });
}

const escapeHtml = (unsafe) => {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function setTextItemContent(overlayElement, itemId, itemText, itemData)
{
  var overlayElemWidth = $(overlayElement).width();
  var textElemId = "#{0}-text".format(itemId);
  var fontSize = (overlayElemWidth * itemData['font_size']) / overlayWidth;

  $(textElemId).text(itemText);
  $(textElemId).css({
    "font-size": "{0}pt".format(fontSize),
    "color": itemData['color'],
    "background-color": (itemData['outline_enabled']) ? itemData['outline'] : "#00000000",
    "visibility": (itemData['visible']) ? "visible" : "hidden",
  });
}

function addOrUpdateItem(overlayElement, itemId, itemType, top, left, width, height, z, rotation, itemData, afterAdditionCallback, afterEditCallback)
{
  var itemElemId = '#{0}'.format(itemId);
  if ($(itemElemId).length == 0)
  {
    $(overlayElement).append("<div id='{0}' class='overlay-item unselected'></div>".format(itemId))

    switch (itemType)
    {
      case "ImageItem":
        $(itemElemId).append("<img id='{0}-img' class='noselect' src='{1}' width='{2}px' height='{3}px' draggable='false'>".format(itemId, itemData['url'], width, height));
        $(itemElemId).data('id', itemData['id']);
        $(itemElemId).data('item_type', itemType);

        var imgElemId = "#{0}-img".format(itemId);
        
        $(imgElemId).on('dragstart', (event) => { event.preventDefault(); });

        $(imgElemId).css({
          "visibility": (itemData['visible']) ? "visible" : "hidden",
        });
        break;
      case "TextItem":
        $(itemElemId).append("<pre id='{0}-text' class='text-item noselect' />".format(itemId));
        setTextItemContent(overlayElement, itemId, itemData['text'], itemData);
        break;
      case "CounterItem":
        $(itemElemId).append("<pre id='{0}-text' class='text-item noselect' />".format(itemId));

        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break;
      default:
        break;
    }

    afterAdditionCallback();
  }
  else
  {
    switch (itemType)
    {
      case "ImageItem":
        if ($("#{0}-img".format(itemId)).attr('src') != itemData['url'])
        {
          $("#{0}-img".format(itemId)).attr('src', itemData['url']);
        }

        $("#{0}-img".format(itemId)).attr('width', "{0}px".format(width));
        $("#{0}-img".format(itemId)).attr('height', "{0}px".format(height));

        $("#{0}-img".format(itemId)).css({
          "visibility": (itemData['visible']) ? "visible" : "hidden",
        });
        break;
      case "TextItem":
        setTextItemContent(overlayElement, itemId, itemData['text'], itemData);
        break;
      case "CounterItem":
        var textContent = itemData['counter_format'].format(itemData['count'])
        setTextItemContent(overlayElement, itemId, textContent, itemData);
        break;
      default:
        break;
    }

    afterEditCallback();
  }

  setItemPosition(itemId, top, left, width, height, z, rotation);
}