const data = document.currentScript.dataset;

const quizId = data.quizid;
const postUrl = data.posturl;

function addQuestionGroup()
{
  var qgIndex = 0;
  while ($("#qg_{0}".format(qgIndex)).length > 0)
    qgIndex++;

  $(".qg-container").append(`
<div class="question-group" id="qg_{0}">
  <div class="qg-header">
    <h2>Question Group</h2>
    <button type="button" onclick="addQuestion({0});">Add question</button>
    <button type="button" onclick="deleteQuestionGroup({0});">Delete question group</button>
  </div>
  <ul class="question-list">
  </ul>
</div>`.format(qgIndex));
}

function addQuestion(index)
{
  var questionlist = $($(".question-group")[index]).find(".question-list")

  console.log(questionlist.length)

  var qIndex = 0;
  while ($("#question_{0}_{1}".format(index, qIndex)).length > 0)
    qIndex++;

  questionlist.append(`    
<li id="question_{0}_{1}">
  <table class="question">
    <tr>
      <td><label for="question">Question:</label></td>
      <td ><input type="text" id="id_question" name="question" placeholder="Question text?"></td>
    </tr>
    <tr>
      <td><label for="a_text">Option A:</label></td>
      <td><input type="text" id="id_a_text" name="a_text" value=""></td>
      <td><label for="a_correct">Correct?</label></td>
      <td><input type="checkbox" id="id_a_correct" name="a_correct"></td>
    </tr>
    <tr>
      <td><label for="b_text">Option B:</label></td>
      <td><input type="text" id="id_b_text" name="b_text" value=""></td>
      <td><label for="b_correct">Correct?</label></td>
      <td><input type="checkbox" id="id_b_correct" name="b_correct"></td>
    </tr>
    <tr>
      <td><label for="c_text">Option C:</label></td>
      <td><input type="text" id="id_c_text" name="c_text" value=""></td>
      <td><label for="c_correct">Correct?</label></td>
      <td><input type="checkbox" id="id_c_correct" name="c_correct"></td>
    </tr>
    <tr>
      <td><label for="d_text">Option D:</label></td>
      <td><input type="text" id="id_d_text" name="d_text" value=""></td>
      <td><label for="d_correct">Correct?</label></td>
      <td><input type="checkbox" id="id_d_correct" name="d_correct"></td>
    </tr>
    <tr>
      <td><label for="randomize_order">Random order?</label></td>
      <td><input type="checkbox" id="id_randomize_order" name="randomize_order"></td>
    </tr>
    <tr>
      <td><button type="button" onclick="deleteQuestion({0}, {1});">Delete question</button></td>
    </tr>
  </table>
  <hr>
</li>`.format(index, qIndex));
}

function deleteQuestion(qgIndex, qIndex)
{
  if (confirm("Delete this question?"))
    $("#question_{0}_{1}".format(qgIndex, qIndex)).remove();
}

function deleteQuestionGroup(qgIndex)
{
  if (confirm("Delete this question group?"))
    $("#qg_{0}".format(qgIndex)).remove();
}

function formToObj()
{
  var formObj = {
    "quiz_id": quizId,
    "title": $("#id_title").val(),
    "question_groups": []
  };

  $(".question-group").each((index, qgElem) => {
    var questionlist = [];

    $(qgElem).find(".question").each((index, qElem) => {
      var q = $(qElem);

      questionlist.push({
        "question": q.find("#id_question").val(),
        "a_text": q.find("#id_a_text").val(),
        "a_correct": q.find("#id_a_correct").is(":checked"),
        "b_text": q.find("#id_b_text").val(),
        "b_correct": q.find("#id_b_correct").is(":checked"),
        "c_text": q.find("#id_c_text").val(),
        "c_correct": q.find("#id_c_correct").is(":checked"),
        "d_text": q.find("#id_d_text").val(),
        "d_correct": q.find("#id_d_correct").is(":checked"),
        "randomize_order": q.find("#id_randomize_order").is(":checked"),
      });
    });

    formObj["question_groups"].push(questionlist);
  });

  AjaxPost(postUrl, formObj, (e) => { window.location.reload(true); }, (e) => { console.log(e); });
}

window.addEventListener('load', function(e) {
  
}, false);