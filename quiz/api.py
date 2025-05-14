
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, Http404, HttpResponseRedirect, JsonResponse, HttpRequest
from django.conf import settings
from django.db.models import Prefetch
import json
import typing

from .models import *

logger = logging.getLogger("quiz")

User : models.Model = settings.AUTH_USER_MODEL

@login_required
def update_quiz(request : HttpRequest):
  if request.method != "POST":
    return JsonResponse({ "error": "Invalid request type." }, status = 501)
  
  request_data : dict = json.loads(request.POST.get("data", "{ }"))
  
  quiz_id = request_data.get("quiz_id")
  
  try:
    qg_queryset = QuestionGroup.objects.prefetch_related(Prefetch("question_set", to_attr = "questions"))
    quiz = Quiz.objects.prefetch_related(Prefetch("questiongroup_set", queryset = qg_queryset, to_attr = "question_groups")).get(id = quiz_id)
  except Quiz.DoesNotExist:
    return JsonResponse({ "error": "Quiz does not exist." }, status = 404)
  
  if quiz.owner.id != request.user.id:
    return JsonResponse({ "error": "Permission denied." }, status = 401)
    
  quiz.title = request_data.get("title", quiz.title)
  
  request_qgs = request_data.get("question_groups", [])
  
  qg : typing.List[dict]
  for i, qg in enumerate(request_qgs):
    qg_obj, created = QuestionGroup.objects.get_or_create(quiz = quiz, ordering = i)
    
    questions = qg_obj.question_set.all()
    for j, q in enumerate(qg):
      if q.get("question", "") == "":
        return JsonResponse({ "error": "Question is missing a question." }, status = 400)
         
      if len(questions) > j:
        questions[j].question = q["question"]
        questions[j].a_text = q["a_text"]
        questions[j].a_correct = q["a_correct"]
        questions[j].b_text = q["b_text"]
        questions[j].b_correct = q["b_correct"]
        questions[j].c_text = q["c_text"]
        questions[j].c_correct = q["c_correct"]
        questions[j].d_text = q["d_text"]
        questions[j].d_correct = q["d_correct"]
        questions[j].randomize_order = q["randomize_order"]
        questions[j].save()
      else:
        question = Question.objects.create(question_group = qg_obj, **q)
        question.save()
        
    q : Question
    for q in questions[len(qg):]:
      q.delete()
        
    qg_obj.save()
    
  qg : QuestionGroup
  for qg in quiz.questiongroup_set.all()[len(request_qgs):]:
    qg.delete()
    
  quiz.save()
        
  return JsonResponse({ "error": "" }, status = 200)