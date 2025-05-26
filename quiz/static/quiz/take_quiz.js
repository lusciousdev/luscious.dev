const c_ScriptData = document.currentScript.dataset;

const c_TwitchUserId = c_ScriptData.userid;

const c_QuizData = JSON.parse(
  document.currentScript.nextElementSibling.textContent
);

const c_QuestionCount = c_QuizData["questions"].length;

let g_CurrentSlide = 0;
let g_CurrentQuestion = -1;

let g_CorrectResponses = 0;
let g_TotalResponses = 0;

var g_Websocket = undefined;
var g_ReconnectInterval = undefined;

var g_TwitchConnected = false;
var g_TwitchBroadcasterType = 0;

var g_NumFiftyFifty = 1;
var g_NumAskTheAudience = 1;
var g_NumPhoneAFriend = 1;

if (c_QuestionCount >= 10)
{
  g_NumAskTheAudience = 2;
}
else if (c_QuestionCount >= 20)
{
  g_NumFiftyFifty = 2;
  g_NumAskTheAudience = 2;
}

var g_PollActive = false;
var g_PollTimeRemaining = 0;
var g_PollQuestion = undefined;
var g_PollTimerUpdateInterval = undefined;

var c_PollTimerUpdateIntervalTimeout = 250;
var g_LastTime = Date.now();

var g_PhoneAFriendQuestion = undefined;
var g_PhoneAFriendLogin = undefined;

var g_UIElem = {}

function connectWebsocket()
{
  var protocol = "ws:"
  if (window.location.protocol == "https:")
    protocol = "wss:"
  g_Websocket = new WebSocket("{0}//{1}/ws/quiz/{2}/".format(protocol, window.location.host, c_TwitchUserId));

  g_Websocket.onopen = (e) => { handleWebsocketOpen(e); };
  g_Websocket.onmessage = (e) => { handleWebsocketMessage(e); };
  g_Websocket.onclose = (e) => { attemptReconnect(e); };
}

function handleWebsocketOpen(e) 
{

}

function handleWebsocketMessage(e) 
{
  var eventData = JSON.parse(e.data);

  let command = eventData.command || "unknown";

  switch (command)
  {
    case "twitch_broadcaster_type":
      g_TwitchConnected = true;
      g_TwitchBroadcasterType = eventData.data.broadcaster_type;

      if ($($(".slide")[g_CurrentSlide]).attr("question") !== undefined)
      {
        $("#ui-container").css({ "display": "flex" });
      }
      break;
    case "twitch_poll_begin":
      handlePollBegin(eventData.data);
      break;
    case "twitch_poll_progress":
      handlePollProgress(eventData.data);
      break;
    case "twitch_poll_end":
      handlePollEnd(eventData.data);
      break;
    case "twitch_chat_message":
      handleChatMessage(eventData.data);
      break;
    case "twitch_error":
      console.log(eventData);
      break;
    default:
      console.error("Unknown event type: {0}".format(command));
      break;
  }
}

function sendWebsocketMessage(cmd, objData)
{
  if (g_Websocket != undefined && g_Websocket.readyState == WebSocket.OPEN)
  {
    g_Websocket.send(JSON.stringify({
      "command": cmd,
      "data": objData,
    }));
  }
}

function attemptReconnect(e)
{
  if (g_ReconnectInterval == undefined)
  {
    g_ReconnectInterval = setInterval(() => { 
      if (g_Websocket.readyState == WebSocket.OPEN)
      {
        console.log("Reconnected websocket.");
        clearInterval(g_ReconnectInterval);
        g_ReconnectInterval = undefined;
        return;
      }
  
      console.log("Attempting to reconnect websocket.");
      connectWebsocket();
    }, 5000);
  }
}

function handlePollBegin(data)
{
  if (g_PollQuestion === undefined)
  {
    c_QuizData["questions"].forEach((q, i) => {
      if (q.question == data.title)
        g_PollQuestion = i;
    });
  }

  if (g_PollQuestion == g_CurrentQuestion)
  {  
    if (g_UIElem.ata)
    {
      $("#ata-container").css({ "display": "block" });
    }
    else
    {
      $("#ata-minimized").css({ "display": "flex" });
    }
  }

  $("#poll-title").html(data.title);

  $("#poll-choice-container").empty();

  data.choices.forEach((val, idx) => {
    $("#poll-choice-container").append(`<tr class="poll-choice">
      <td class="poll-choice-name">{0}. {1}</td>
      <td class="poll-choice-bar-container">
        <div class="poll-choice-bar">
          <div class="poll-choice-bar-fill" style="width: 0%"></div>
          <div class="poll-choice-bar-label">0%</div>
        </div>
      </td>
    </tr>`.format((idx + 1), val.title));
  });

  $("#poll-vote-count").html("Total votes: 0")

  g_PollTimeRemaining = data.time_remaining;

  updatePollTimer(false);
  clearInterval(g_PollTimerUpdateInterval);
  g_PollTimerUpdateInterval = setInterval(updatePollTimer, c_PollTimerUpdateIntervalTimeout);
}

function handlePollProgress(data)
{
  if (g_PollQuestion === undefined)
  {
    c_QuizData["questions"].forEach((q, i) => {
      if (q.question == data.title)
        g_PollQuestion = i;
    });
  }

  if (g_PollQuestion == g_CurrentQuestion)
  {  
    if (g_UIElem.ata)
    {
      $("#ata-container").css({ "display": "block" });
    }
    else
    {
      $("#ata-minimized").css({ "display": "flex" });
    }
  }

  $("#poll-title").html(data.title);

  $("#poll-choice-container").empty();

  let totalVotes = 0;

  data.choices.forEach((val, idx) => {
    totalVotes += val.votes;

    $("#poll-choice-container").append(`<tr class="poll-choice">
      <td class="poll-choice-name">{0}. {1}</td>
      <td class="poll-choice-bar-container">
        <div class="poll-choice-bar">
          <div class="poll-choice-bar-fill" style="width: 0%"></div>
          <div class="poll-choice-bar-label">0%</div>
        </div>
      </td>
    </tr>`.format((idx + 1), val.title));
  });

  if (totalVotes > 0)
  {
    $(".poll-choice-bar").each((i, elem) => {
      let percent = data.choices[i].votes / totalVotes;

      let label = $(elem).find(".poll-choice-bar-label");
      let fill = $(elem).find(".poll-choice-bar-fill");

      label.html("{0}%".format((percent * 100).toFixed(1)));
      fill.css({ "width": "{0}%".format(percent * 100) });
    });
  }

  $("#poll-vote-count").html("Total votes: {0}".format(totalVotes))

  g_PollTimeRemaining = data.time_remaining;

  updatePollTimer(false);
  clearInterval(g_PollTimerUpdateInterval);
  g_PollTimerUpdateInterval = setInterval(updatePollTimer, c_PollTimerUpdateIntervalTimeout);
}

function handlePollEnd(data)
{
  g_PollTimeRemaining = 0;

  clearInterval(g_PollTimerUpdateInterval);

  $("#poll-timer").html("Poll ended.");
}

function handleChatMessage(data)
{
  if (g_PhoneAFriendLogin !== undefined && data.chatter.login.toLowerCase() == g_PhoneAFriendLogin.toLowerCase())
  {
    $("#paf-chat-history").append(`<div class='chat-message'><b>{0}:</b> {1}</div>`.format(data.chatter.display_name, data.message));

    $(".chat-history-container").scrollTop($(".chat-history-container")[0].scrollHeight);
  }
}

function updatePollTimer(decrementTime = true)
{
  timeSince = Date.now() - g_LastTime;

  if (decrementTime) 
  {
    g_PollTimeRemaining -= (timeSince / 1000.0);
  }

  if (g_PollTimeRemaining < 0) g_PollTimeRemaining = 0;
  $("#poll-timer").html("Vote now - {0}s left".format(Math.round(g_PollTimeRemaining).toFixed(0)));

  g_LastTime = Date.now();
}

function nextSlide()
{
  showSlide(++g_CurrentSlide);
}

function prevSlide()
{
  showSlide(--g_CurrentSlide);
}

function showSlide(index)
{
  g_CurrentSlide = index;

  let activeSlide = $($(".slide")[g_CurrentSlide]);

  $(".slide").css({ "display": "none" });
  activeSlide.css({ "display": "flex" });

  if (activeSlide.attr("question") !== undefined)
  {
    g_CurrentQuestion = parseInt(activeSlide.attr("question"), 10);

    if (g_TwitchConnected && activeSlide.attr("submitted") === undefined)
    {
      $("#ui-container").css({ "display": "flex" });
    }
    else
    {
      $("#ui-container").css({ "display": "none" });
    }

    if (g_PollQuestion == g_CurrentQuestion)
    {  
      if (g_UIElem.ata)
      {
        $("#ata-container").css({ "display": "block" });
      }
      else
      {
        $("#ata-minimized").css({ "display": "flex" });
      }
    }
    else
    {  
      $("#ata-container").css({ "display": "none" });
      $("#ata-minimized").css({ "display": "none" });
    }

    if (g_PhoneAFriendQuestion == g_CurrentQuestion)
    {
      if (g_UIElem.ata)
      {
        $("#paf-container").css({ "display": "block" });
      }
      else
      {
        $("#paf-minimized").css({ "display": "flex" });
      }
    }
    else
    {  
      $("#paf-container").css({ "display": "none" });
      $("#paf-minimized").css({ "display": "none" });
    }
  }
  else
  {
    g_CurrentQuestion = -1;

    $("#ui-container").css({ "display": "none" });
  }
}

function submitQuestion(ev)
{
  if ($(ev.target).attr("blocked") !== undefined)
    return;

  let questionElem = $(ev.target.parentElement.parentElement);
  let questionOptionElems = $(ev.target.parentElement.parentElement).find(".question-option");

  let questionNumber = questionElem.attr("question");
  let selectedAnswer = questionElem.find(".question-option[selected]").attr("option");

  let correct = c_QuizData["questions"][questionNumber]["options"][selectedAnswer][1];

  let correctAnswer = selectedAnswer;
  c_QuizData["questions"][questionNumber]["options"].forEach((element, index) => {
    if (element[1])
    {
      correctAnswer = index;
    }
  });

  questionOptionElems.removeAttr("selected");

  if (!correct)
  {
    $(questionOptionElems[selectedAnswer]).attr("wrong", "");
  }
  else
  {
    g_CorrectResponses++;
  }
  g_TotalResponses++;

  $(questionOptionElems[correctAnswer]).attr("correct", "");

  questionOptionElems.each(function (i, e) {
    if (i != correctAnswer && !(!correct && i == selectedAnswer))
    {
      $(e).attr("blocked", "");
    }
  })

  questionElem.attr("submitted", "");
  $(ev.target.parentElement).find(".next-slide").removeAttr("blocked");
  $(ev.target).attr("blocked", "");

  $(".quiz-record").html("{0}/{1}".format(g_CorrectResponses, g_TotalResponses));

  let resPerc = (g_CorrectResponses / g_TotalResponses) * 100;

  $(".results-count").html("{0}/{1}".format(g_CorrectResponses, g_TotalResponses));
  $(".results-percent").html("{0}%".format(resPerc.toFixed(1)));

  $("#ui-container").css({ "display": "none" });
}

function activateFiftyFifty(event)
{
  if (g_NumFiftyFifty <= 0)
  {
    return;
  }

  let questionElem = $($(".slide")[g_CurrentSlide]);
  let questionOptionElems = questionElem.find(".question-option");

  if (questionOptionElems.length > 2)
  {
    continueWith5050 = confirm("Activate 50/50? This will remove all but 2 possible answers.");

    if (!continueWith5050) return;
  }
  else
  {
    alert("The 50/50 wouldn't do anything. You have {0} possible answers already.".format(questionOptionElems.length));
    return;
  }

  questionOptionElems.removeAttr("selected");

  let correctAnswer = 0;
  let wrongAnswers = [];
  c_QuizData["questions"][g_CurrentQuestion]["options"].forEach((element, index) => {
    if (element[1])
    {
      correctAnswer = index;
    }
    else 
    {
      wrongAnswers.push(index);
    }
  });

  let remainingAnswers = [correctAnswer, wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)]]

  questionOptionElems.each(function (i, e) {
    if (!remainingAnswers.includes(i))
    {
      $(questionOptionElems[i]).attr("blocked", "");
    }
  });

  g_NumFiftyFifty--;
  $("#ff-count").html("x{0}".format(g_NumFiftyFifty));

  if (g_NumFiftyFifty <= 0)
  {
    $(event.currentTarget).attr("disabled", '');
  }
}

function activateAskTheAudience(event)
{
  if (g_NumAskTheAudience <= 0)
  {
    return;
  }

  let continueWithATA = confirm("Activate Ask the Audience? This will poll your chat.");

  if (!continueWithATA) return;

  let questionElem = $($(".slide")[g_CurrentSlide]);
  let questionOptionElems = questionElem.find(".question-option");

  g_PollQuestion = g_CurrentQuestion;

  let questionData = c_QuizData["questions"][g_CurrentQuestion];
  let choices = [];
  questionData.options.forEach((v, i) => { choices.push(v[0]); });

  sendWebsocketMessage("start_poll", {
    "title": questionData["question"],
    "choices": choices,
    "duration": 120
  });

  g_NumAskTheAudience--;
  $("#ata-count").html("x{0}".format(g_NumAskTheAudience));

  if (g_NumAskTheAudience <= 0)
  {
    $(event.currentTarget).attr("disabled", '');
  }
}

function activatePhoneAFriend(event)
{
  if (g_NumPhoneAFriend <= 0)
  {
    return;
  }

  let continueWithPAF = confirm("Activate Phone-a-Friend? This will let you bring up one chatter's messages.");

  if (!continueWithPAF) return;

  g_PhoneAFriendQuestion = g_CurrentQuestion;

  if (g_UIElem.paf)
  {
    $("#paf-container").css({ "display": "block" });
  }
  else
  {
    $("#paf-minimized").css({ "display": "flex" });
  }

  g_NumPhoneAFriend--;
  $("#paf-count").html("x{0}".format(g_NumPhoneAFriend));

  if (g_NumPhoneAFriend <= 0)
  {
    $(event.currentTarget).attr("disabled", '');
  }
}

function submitPAFLogin(e)
{
  e.preventDefault();

  $("#paf-chat-history").empty();

  g_PhoneAFriendLogin = $("#paf-login-input").val();
  
  $(".user-select-container").css({ "display": "none" });
  $(".chat-history-container").css({ "display": "block" });
}

window.addEventListener('load', function(e) {
  showSlide(0);

  connectWebsocket();

  $(".question-option").click(function (e) {
    let slideElem = $(e.currentTarget.parentElement.parentElement);
    let optContainerElem = $(e.currentTarget.parentElement);
    let targetElem = $(e.currentTarget);

    if (slideElem.attr("submitted") !== undefined || targetElem.attr("blocked") !== undefined)
    {
      return;
    }

    optContainerElem.find(".question-option").removeAttr("selected");
    targetElem.attr("selected", "");

    let slideControls = $($(e.currentTarget.parentElement.parentElement).find(".slide-controls")[0]);

    if (slideControls.find(".submit-question").length == 0)
    {
      slideControls.append(`<div class="slide-control submit-question">Submit</div>`);
      slideControls.find(".submit-question").click(submitQuestion);
    }
  });

  $(".prev-slide").click(function (e) {
    if ($(e.target).attr("blocked") === undefined)
      prevSlide()
  });

  $(".next-slide").click(function (e) {
    if ($(e.target).attr("blocked") === undefined)
      nextSlide()
  });
 
  $("#ff-count").html("x{0}".format(g_NumFiftyFifty));
  $("#ata-count").html("x{0}".format(g_NumAskTheAudience));
  $("#paf-count").html("x{0}".format(g_NumPhoneAFriend));

  $("*[ui-tag]").each(function (i, elem) {
    let uiTag = $(elem).attr("ui-tag");

    g_UIElem[uiTag] = true;
  });

  $(".ui-minimize").click(function (e) {
    let uiTag = $(e.target).attr("ui-tag");

    g_UIElem[uiTag] = false;

    $("#{0}-container".format(uiTag)).css({ "display": "none" });
    $("#{0}-minimized".format(uiTag)).css({ "display": "flex" });
  });

  $(".ui-maximize").click(function (e) {
    let uiTag = $(e.target).attr("ui-tag");

    g_UIElem[uiTag] = true;

    $("#{0}-container".format(uiTag)).css({ "display": "block" });
    $("#{0}-minimized".format(uiTag)).css({ "display": "none" });
  });

  $("#fifty-fifty").click(activateFiftyFifty);

  $("#ask-the-audience").click(activateAskTheAudience);

  $("#phone-a-friend").click(activatePhoneAFriend);

  $("#paf-login-form").submit(submitPAFLogin);
}, false);