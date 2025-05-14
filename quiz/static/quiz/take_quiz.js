const quizData = JSON.parse(
  document.currentScript.nextElementSibling.textContent
);

let currentSlide = 0;
let currentQuestion = -1;

let correctResponses = 0;
let totalResponses = 0;
const questionCount = quizData["questions"].length;

function nextSlide()
{
  showSlide(++currentSlide);
}

function prevSlide()
{
  showSlide(--currentSlide);
}

function showSlide(index)
{
  currentSlide = index;

  let activeSlide = $($(".slide")[currentSlide]);

  $(".slide").css({ "display": "none" });
  activeSlide.css({ "display": "flex" });

  if (activeSlide.attr("question") !== undefined)
  {
    currentQuestion = parseInt(activeSlide.attr("question"), 10);
  }
  else
  {
    currentQuestion = -1;
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

  let correct = quizData["questions"][questionNumber]["options"][selectedAnswer][1];

  let correctAnswer = selectedAnswer;
  quizData["questions"][questionNumber]["options"].forEach((element, index) => {
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
    correctResponses++;
  }
  totalResponses++;

  $(questionOptionElems[correctAnswer]).attr("correct", "");

  questionElem.attr("submitted", "");
  $(ev.target.parentElement).find(".next-slide").removeAttr("blocked");
  $(ev.target).attr("blocked", "");

  $(".quiz-record").html("{0}/{1}".format(correctResponses, totalResponses));

  let resPerc = (correctResponses / totalResponses) * 100;

  $(".results-count").html("{0}/{1}".format(correctResponses, totalResponses));
  $(".results-percent").html("{0}%".format(resPerc.toFixed(1)));
}

window.addEventListener('load', function(e) {
  showSlide(0);

  $(".question-option").click(function (e) {
    let slideElem = $(e.target.parentElement.parentElement);
    let optContainerElem = $(e.target.parentElement);
    let targetElem = $(e.target);

    if (slideElem.attr("submitted") !== undefined)
    {
      return;
    }

    optContainerElem.find(".question-option").removeAttr("selected");
    targetElem.attr("selected", "");

    let slideControls = $($(e.target.parentElement.parentElement).find(".slide-controls")[0]);

    if (slideControls.find(".submit-question").length == 0)
      elem = slideControls.append(`<div class="slide-control submit-question">Submit</div>`);

    elem.click(submitQuestion);
  });

  $(".prev-slide").click(function (e) {
    if ($(e.target).attr("blocked") === undefined)
      prevSlide()
  });

  $(".next-slide").click(function (e) {
    if ($(e.target).attr("blocked") === undefined)
      nextSlide()
  });
}, false);