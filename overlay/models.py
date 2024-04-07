import datetime
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.http import int_to_base36

# Create your models here.

ID_LENGTH = 16
def id_gen() -> str:
  return int_to_base36(uuid.uuid4().int)[:ID_LENGTH]

def current_time_seconds() -> int:
  return int(datetime.datetime.now().timestamp())

class NonConsecutiveModel(models.Model):
  id = models.CharField(max_length = ID_LENGTH, primary_key = True, default = id_gen, editable = False)
  
  class Meta:
    abstract = True

class CollaborativeOverlay(NonConsecutiveModel):
  owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
  
  name = models.CharField(max_length = 256, default = "My Overlay")
  description = models.CharField(max_length = 256)
  
  width = models.IntegerField(default = 1920)
  height = models.IntegerField(default = 1080)
  
  def __str__(self):
    return f"{self.name} ({self.description})"
  
class Editor(NonConsecutiveModel):
  owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
  
  username = models.CharField(max_length = 256)
  twitch_id = models.CharField(max_length = 256)
  
class AbstractItem(NonConsecutiveModel):
  overlay = models.ForeignKey(CollaborativeOverlay, on_delete = models.CASCADE)
  
  item_type = models.CharField(max_length = 32, default = "AbstractItem", editable = False)
  name = models.CharField(max_length = 256, default = "My Item")
  
  x = models.IntegerField(default = -300)
  y = models.IntegerField(default = -100)
  z = models.IntegerField(default = 50)
  width = models.IntegerField(default = 300)
  height = models.IntegerField(default = 100)
  rotation = models.FloatField(default = 0)
  visible = models.BooleanField(default = True)
  minimized = models.BooleanField(default = False)
  
  class Meta:
    abstract = True
    
  def to_data_dict(self):
    return {
      "id": self.id,
      "name": self.name,
      "x": self.x,
      "y": self.y,
      "z": self.z,
      "width": self.width,
      "height": self.height,
      "rotation": self.rotation,
      "visible": self.visible,
      "minimized": self.minimized,
    }
    
def image_directory_path(instance : "AbstractItem", filename : str):
  return f"overlays/{instance.overlay.id}/{filename}"
    
class ImageItem(AbstractItem):
  item_type = models.CharField(max_length = 32, default = "ImageItem", editable = False)
  
  image = models.ImageField(upload_to = image_directory_path, blank = True, null = True)
  url = models.URLField(verbose_name = "URL", default = "", blank = True, null = True)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['image_url'] = self.image.url
    d['url'] = self.url
    return d
  
class AbstractTextItem(AbstractItem):
  font = models.CharField(max_length=128, default="Roboto Mono")
  font_size = models.IntegerField(default = 32)
  color = models.CharField(max_length = 64, default = "#FFFFFF")
  background = models.CharField(max_length = 64, default = "#000000")
  background_enabled = models.BooleanField(default = False)
  
  class Meta:
    abstract = True
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["font"] = self.font
    d["font_size"] = self.font_size
    d["color"] = self.color
    d["background"] = self.background
    d["background_enabled"] = self.background_enabled
    return d
  
class TextItem(AbstractTextItem):
  item_type = models.CharField(max_length = 32, default = "TextItem", editable = False)
  
  text = models.TextField(default = "Example text.")
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["text"] = self.text
    return d
  
class StopwatchItem(AbstractTextItem):
  item_type = models.CharField(max_length = 32, default = "StopwatchItem", editable = False)
  
  timer_format = models.TextField(default = "{0}")
  timer_start = models.BigIntegerField(default = current_time_seconds)
  
  paused = models.BooleanField(default = False)
  pause_time = models.BigIntegerField(default = current_time_seconds)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["timer_format"] = self.timer_format
    d["timer_start"] = self.timer_start
    d["paused"] = self.paused
    d["pause_time"] = self.pause_time
    return d
  
class CounterItem(AbstractTextItem):
  item_type = models.CharField(max_length = 32, default = "CounterItem", editable = False)
  
  counter_format = models.TextField(default = "Count: {0}")
  count = models.IntegerField(default = 0)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["counter_format"] = self.counter_format
    d["count"] = self.count
    return d

ITEM_TYPES = [
  ImageItem,
  TextItem,
  StopwatchItem,
  CounterItem,
]