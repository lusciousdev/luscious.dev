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
    data: { 'data': JSON.stringify(theData), },
    dataType: "json",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRFToken": getCookie("csrftoken"),
    },
    success: success_callback,
    error: error_callback,
  });
}

function AjaxFormPost(theUrl, formData, success_callback, error_callback)
{
  $.ajax({
    url: theUrl,
    type: "POST",
    dataType: "json",
    cache: false,
    contentType: false,
    processData: false,
    data: formData,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRFToken": getCookie("csrftoken"),
    },
    success: success_callback,
    error: error_callback,
  });
}

const AjaxRequestTypes = {
  GET: "get",
  POST: "post",
  POST_FORM: "post_form",
};

class AjaxRequest
{
  constructor(type, url, data, success_callback, error_callback)
  {
    this.type = type;
    this.url  = url;
    this.data = data;
    this.scb = success_callback;
    this.ecb = error_callback;
  }

  execute()
  {
    switch (this.type)
    {
      case AjaxRequestTypes.GET:
        AjaxGet(this.url, this.data, this.scb, this.ecb);
        break;
      case AjaxRequestTypes.POST:
        AjaxPost(this.url, this.data, this.scb, this.ecb);
        break;
      case AjaxRequestTypes.POST_FORM:
        AjaxFormPost(this.url, this.data, this.scb, this.ecb);
        break;
      default:
        console.warn("Unknown Ajax request type.");
        break;
    }
  }
}

var AjaxQueueProcessing = false;
var AjaxQueue = [];

function QueueAjaxRequest(ajaxRequest)
{
  AjaxQueue.push(ajaxRequest);

  if (!AjaxQueueProcessing)
  {
    startAjaxQueueProcessing();
  }
}

function processNextAjaxRequest()
{
  if (AjaxQueue.length <= 0)
  {
    AjaxQueueProcessing = false;
    return;
  }

  var nextRequest = AjaxQueue.shift();
  
  switch (nextRequest.type)
  {
    case AjaxRequestTypes.GET:
      AjaxGet(nextRequest.url, nextRequest.data, (e) => { nextRequest.scb(e); processNextAjaxRequest(); }, (e) => { nextRequest.ecb(e); processNextAjaxRequest(); });
      break;
    case AjaxRequestTypes.POST:
      AjaxPost(nextRequest.url, nextRequest.data, (e) => { nextRequest.scb(e); processNextAjaxRequest(); }, (e) => { nextRequest.ecb(e); processNextAjaxRequest(); });
      break;
    case AjaxRequestTypes.POST_FORM:
      AjaxFormPost(nextRequest.url, nextRequest.data, (e) => { nextRequest.scb(e); processNextAjaxRequest(); }, (e) => { nextRequest.ecb(e); processNextAjaxRequest(); });
      break;
    default:
      console.warn("Unknown Ajax request type.");
      break;
  }
}

function startAjaxQueueProcessing()
{
  AjaxQueueProcessing = true;

  processNextAjaxRequest();
}