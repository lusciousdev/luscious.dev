const data = document.currentScript.dataset;

const username = data.username;
const period = data.period;
const width = data.width;
const height = data.height;

const getGridURL = data.getgridurl;

var getDataInterval;

var count = 0;

function handleGridSuccess(data)
{
  if (data.ready)
  {
    $("#loading-text").css("display", "none");

    clearInterval(getDataInterval);

    $("#album-grid").html('<img id="grid-image" src="{0}">'.format(data.image));

    $("#album-list").html('');

    data.topalbums.forEach(function(album, i) {
      $("#album-list").append(
        `<tr>
          <td class="album-rank">{0}.</td>
          <td class="album-name">{1}</td>
          <td class="album-artist">{2}<td>
        </tr>`.format(i+1, album.name, album.artist));
    });
  }
  else
  {
    $("#loading-text").html("Creating grid" + ".".repeat((count % 4) + 1));
    count++;
  }
}

function handleAjaxError(data)
{
  console.log("~~~~~~~~~~~ERROR~~~~~~~~~~~~~~~~~~~")
  console.log(data);
}

function getLastFMGrid()
{
  QueueAjaxRequest(new AjaxRequest(AjaxRequestTypes.GET, getGridURL, { "username": username, "period": period, "width": parseInt(width), "height": parseInt(height) }, handleGridSuccess, handleAjaxError))
}

$(window).on("load", function() {
  getDataInterval = setInterval(getLastFMGrid, 1000);
});
