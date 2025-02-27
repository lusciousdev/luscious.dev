from typing import Any
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
import typing
import markdown

from .models import *

# Create your views here.
class BlogView(generic.DetailView):
  model = Blog
  context_object_name = "blog"
  template_name = "blog/blog.html"
  slug_url_kwarg = "slug"