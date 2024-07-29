from typing import Any
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
import typing
from PIL import Image
from io import BytesIO
import requests
import math
import typing
import base64

from .forms import InfoForm
from .api import *

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
  
def create_grid(size, image_urls) -> Image.Image:
  assert len(image_urls) == (size * size)
  
  img_list : typing.List[Image.Image]= []
  for url in image_urls:
    if url != "":
      resp = requests.get(url)
      img_list.append(Image.open(BytesIO(resp.content)))
    else:
      img_list.append(Image.new('RGB', size = (300, 300), color = "black"))
  
  ah, aw = img_list[0].size
  
  imgh = size * ah
  imgw = size * aw
  
  grid = Image.new('RGB', size = (imgw, imgh))
  
  for i, img in enumerate(img_list):
    grid.paste(img, box=((i % size) * aw, (i // size) * ah))
    
  return grid
  
  
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
    if size > 9:
      size = 9
    
    context['size'] = size
    context['topalbums'] = get_top_albums(context['username'], context['period'], size)
    
    img_urls = ["" for i in range(size * size)]
    for i, album in enumerate(context['topalbums']):
      if 'art' in album:
        img_urls[i] = album['art']
        
    gridimg = create_grid(size, img_urls)
    buffered = BytesIO()
    gridimg.save(buffered, format = "JPEG")
    data_url = 'data:image/jpg;base64,' + base64.b64encode(buffered.getvalue()).decode()
    context['grid'] = data_url
    
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