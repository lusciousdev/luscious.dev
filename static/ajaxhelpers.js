function AjaxGet(theUrl, theData, success_callback, error_callback)
{
  $.ajax({
    url: theUrl,
    type: "GET",
    dataType: "json",
    data: theData,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRFToken": getCookie("csrftoken"),
    },
    success: success_callback,
    error: error_callback,
  });
}

function AjaxPost(theUrl, theData, success_callback, error_callback)
{
  $.ajax({
    url: theUrl,
    type: "POST",
    data: JSON.stringify(theData),
    contentType: "application/json; charset=utf-8",
    traditional: true,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRFToken": getCookie("csrftoken"),
    },
    success: success_callback,
    error: error_callback,
  });
}