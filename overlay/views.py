from typing import Any
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import login_required
import typing

# Create your views here.
class IndexView(generic.TemplateView):
  template_name = "overlay/index.html"
  
class ProfileView(generic.TemplateView):
  template_name="overlay/profile.html"
  
  @method_decorator(login_required)
  def dispatch(self, *args, **kwargs):
    return super(ProfileView, self).dispatch(*args, **kwargs)