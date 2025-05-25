from django.contrib import messages
from django.db.models.query import QuerySet
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
from django.utils.decorators import method_decorator, classonlymethod
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.views.generic.detail import SingleObjectMixin
import logging
import typing
import random
import markdown

from .forms import *

logger = logging.getLogger("quiz")


class HomeView(generic.TemplateView):
  @method_decorator(login_required)
  def post(self, request, **kwargs):
    action = request.POST.get("action", "")
    
    if action == "delete_quiz":
      form = DeleteQuizForm(request.user, request.POST)
      
      try:
        quiz = request.user.quiz_set.get(pk = request.POST["quiz_id"])
        quiz.delete()
      except:
        form.add_error("quiz_id", "That quiz does not exist.")
        return render(request, reverse("quiz:home"), { "delete_quiz_form": form })
        
      return HttpResponseRedirect(reverse("quiz:home"))
    
  def get_template_names(self):
    if (self.request.user.is_authenticated):
      return [ "quiz/user_home.html" ]
    else:
      return [ "quiz/home.html" ]
  
  def get_context_data(self, **kwargs) -> dict[str, typing.Any]:
    context = super(HomeView, self).get_context_data(**kwargs)
    return context
    
class ProfileView(generic.TemplateView):
  template_name="quiz/profile.html"
  
class EditQuizView(generic.DetailView):
  model = Quiz
  template_name = "quiz/edit_quiz.html"
  
  def dispatch(self, *args, **kwargs):
    quiz : Quiz = self.get_object()
    if (quiz.owner.id != self.request.user.id):
      return HttpResponseRedirect(reverse("quiz:home"))
    
    return super(EditQuizView, self).dispatch(*args, **kwargs)
  
  def get_context_data(self, **kwargs):
    context = super(EditQuizView, self).get_context_data(**kwargs)
    
    quiz : Quiz = self.get_object()
    
    context['quiz_data'] = {
      "title": quiz.title,
      "question_groups": [ qg.to_data_dict() for qg in quiz.questiongroup_set.order_by("ordering").all() ]
    }
    
    return context
    
class TakeQuizView(generic.DetailView):
  model = Quiz
  template_name = "quiz/take_quiz.html"
  
  def get_context_data(self, **kwargs):
    context = super(TakeQuizView, self).get_context_data(**kwargs)
    
    try:
      twitchuser = self.request.user.socialaccount_set.get(provider = "twitch")
      context["twitch_user_id"] = twitchuser.uid
    except:
      context["twitch_user_id"] = None
    
    quiz : Quiz = self.get_object()
    
    questions : typing.List[Question] = [ random.choice(list(qg.question_set.all())) for qg in quiz.questiongroup_set.order_by("ordering").all() ]
    
    context["quiz_data"] = {
      "title": quiz.title,
      "questions": [{
        "question": q.question,
        "options": q.get_options()
      } for q in questions ]
    }
    
    return context
  
@login_required
def create_quiz(request):
  try:
    quiz = Quiz.objects.create(owner = request.user)
    quiz.save()
  except:
    return HttpResponseRedirect(reverse("quiz:home"))
  
  return HttpResponseRedirect(reverse("quiz:edit_quiz", kwargs = { "slug": quiz.slug }))