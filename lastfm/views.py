from typing import Any
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
import typing

from .forms import InfoForm
from .lastfm import *
from .tasks import *
from .models import *

# Create your views here.
class IndexView(generic.FormView):
  form_class = InfoForm
  template_name = 'lastfm/index.html'
  
  def form_valid(self, form : InfoForm, *args, **kwargs):
    username = form.cleaned_data.get('username')
    period = form.cleaned_data.get('period')
    size = form.cleaned_data.get('size')
    return HttpResponseRedirect(self.get_success_url(username, period, size))
  
  def get_success_url(self, username = None, period = '7day', size = 9) -> str:
    if not username:
      return reverse_lazy("lastfm:index")
    usernameurl = reverse_lazy("lastfm:user", kwargs={"username": username})
    return f"{usernameurl}?period={period}&size={size}"
  
  
class UserView(generic.FormView):
  form_class = InfoForm
  template_name = "lastfm/user.html"
  
  def get_period(self):
    return '7day' if 'period' not in self.request.GET else self.request.GET['period']
  
  def get_size(self):
    return '3' if 'size' not in self.request.GET else self.request.GET['size']
  
  def get_context_data(self, **kwargs: Any) -> typing.Dict[str, Any]:
    context = super().get_context_data(**kwargs)
    context['username'] = self.kwargs['username']
    context['period'] = self.get_period()
    
    size = int(self.get_size())
    
    context['size'] = size
    
    calc_lastfm_grid.delay(context['username'], context['period'], size)
    
    return context
  
  def get_initial(self):
    initial = super().get_initial()
    
    initial['username'] = self.kwargs['username']
    initial['period'] = self.get_period()
    initial['size'] = self.get_size()
    
    return initial
  
  def form_valid(self, form : InfoForm, *args, **kwargs):
    username = form.cleaned_data.get('username')
    period = form.cleaned_data.get('period')
    size = form.cleaned_data.get('size')
    return HttpResponseRedirect(self.get_success_url(username, period, size))
  
  def get_success_url(self, username = None, period = '7day', size = '3') -> str:
    if not username:
      return reverse_lazy("lastfm:index")
    usernameurl = reverse_lazy("lastfm:user", kwargs={"username": username})
    return f"{usernameurl}?period={period}&size={size}"
  
def redirect_home(request):
  return HttpResponseRedirect(reverse("lastfm:index"))