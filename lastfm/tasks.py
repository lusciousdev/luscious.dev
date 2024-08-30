from django.conf import settings
from celery import Celery, shared_task
from celery.schedules import crontab
import requests
import json
import typing
import logging
from PIL import Image
from io import BytesIO
import math
import typing
import base64

from .lastfm import *
from .models import *

logger = logging.getLogger("lastfm")
  
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

@shared_task
def calc_lastfm_grid(username, period, size):
  print(f"Calculating grid for {username} {period} {size}")
  
  grid, newgrid = LastFMGrid.objects.get_or_create(username = username, period = period, size = size)
  
  if not newgrid and (timezone.now() - grid.created_at).total_seconds() < 120.0 and grid.results is not None:
    print("Grid has been recently edited.")
    return
  
  grid.results = None
  grid.save()
  
  topalbums = get_top_albums(username, period, size)
  
  img_urls = ["" for i in range(size * size)]
  for i, album in enumerate(topalbums):
    if 'art' in album:
      img_urls[i] = album['art']
      
  gridimg = create_grid(size, img_urls)
      
  buffered = BytesIO()
  gridimg.save(buffered, format = "JPEG")
  data_url = 'data:image/jpg;base64,' + base64.b64encode(buffered.getvalue()).decode()
  
  grid.results = {
    "topalbums": topalbums,
    "image": data_url,
  }
  
  grid.save()