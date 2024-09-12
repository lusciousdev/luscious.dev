import datetime
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.http import int_to_base36
import logging

logger = logging.getLogger("overlay")

# Create your models here.

ID_LENGTH = 16
def id_gen() -> str:
  return int_to_base36(uuid.uuid4().int)[:ID_LENGTH]

def current_time_seconds() -> int:
  return int(datetime.datetime.now().timestamp())

class ChangeLogEntry(models.Model):
  date = models.DateTimeField(default = datetime.datetime.now())
  title = models.CharField(max_length = 255)
  description = models.TextField()
  
  def __repr__(self):
    return f"{self.pk} - {self.title}"
  
  def __str__(self):
    return f"{self.pk} - {self.title}"

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
  allow_audio = models.BooleanField(default = True)
  
  def __str__(self):
    return f"{self.name} ({self.description})"
  
class Editor(NonConsecutiveModel):
  owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
  
  username = models.CharField(max_length = 256)
  twitch_id = models.CharField(max_length = 256)
  
class AbstractItem(NonConsecutiveModel):
  overlay = models.ForeignKey(CollaborativeOverlay, on_delete = models.CASCADE)
  
  name = models.CharField(max_length = 256, default = "My Item")
  
  x = models.IntegerField(default = -300)
  y = models.IntegerField(default = -100)
  z = models.IntegerField(default = 50)
  width = models.IntegerField(default = 300)
  height = models.IntegerField(default = 100)
  rotation = models.FloatField(default = 0)
  opacity = models.FloatField(default = 100.0)
  visibility = models.IntegerField(default = 1)
  minimized = models.BooleanField(default = False)
  scroll_direction = models.IntegerField(default = 0)
  scroll_duration = models.FloatField(default = 5.0)
  
  crop_top = models.FloatField(verbose_name = "Crop % (top)", default = 0)
  crop_left = models.FloatField(verbose_name = "Crop % (left)", default = 0)
  crop_bottom = models.FloatField(verbose_name = "Crop % (bottom)", default = 0)
  crop_right = models.FloatField(verbose_name = "Crop % (right)", default = 0)
  
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
      "opacity": self.opacity,
      "visibility": self.visibility,
      "minimized": self.minimized,
      "crop_top": self.crop_top,
      "crop_bottom": self.crop_bottom,
      "crop_left": self.crop_left,
      "crop_right": self.crop_right,
      'scroll_direction': self.scroll_direction,
      'scroll_duration': self.scroll_duration,
    }
    
def image_directory_path(instance : "AbstractItem", filename : str):
  return f"overlays/{instance.overlay.id}/{filename}"
    
class ImageItem(AbstractItem):
  image = models.ImageField(upload_to = image_directory_path, blank = True, null = True)
  url = models.URLField(verbose_name = "URL", default = "", blank = True, null = True)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['image_url'] = "" if not self.image else self.image.url
    d['url'] = self.url
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Image"
  
  @staticmethod
  def get_simple_type():
    return "image"
  
class EmbedItem(AbstractItem):
  embed_url = models.URLField(verbose_name = "Embed URL", default = "", blank = True)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['embed_url'] = self.embed_url
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Embed"
  
  @staticmethod
  def get_simple_type():
    return "embed"
  
class YouTubeEmbedItem(AbstractItem):
  video_id = models.CharField(max_length = 256, verbose_name = "YouTube Video ID", default = "", blank = True)
  start_time = models.IntegerField(default = 0)
  
  paused = models.BooleanField()
  muted = models.BooleanField()
  volume = models.IntegerField(default = 50)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['video_id']   = self.video_id
    d['start_time'] = self.start_time
    d['paused']     = self.paused
    d['muted']      = self.muted
    d['volume']     = self.volume
    return d
  
  @staticmethod
  def get_pretty_type():
    return "YouTube video"
  
  @staticmethod
  def get_simple_type():
    return "youtube_video"
  
class TwitchStreamEmbedItem(AbstractItem):
  channel = models.CharField(max_length = 256, verbose_name = "Twitch Channel Name", default = "", blank = True)
  
  paused = models.BooleanField()
  muted = models.BooleanField()
  volume = models.IntegerField(default = 50)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['channel'] = self.channel
    d['paused']   = self.paused
    d['muted']    = self.muted
    d['volume']   = self.volume
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Twitch stream"
  
  @staticmethod
  def get_simple_type():
    return "twitch_stream"
  
class TwitchVideoEmbedItem(AbstractItem):
  video_id = models.CharField(max_length = 256, verbose_name = "Twitch Video ID", default = "", blank = True)
  start_time = models.IntegerField(default = 0)
  
  paused = models.BooleanField()
  muted = models.BooleanField()
  volume = models.IntegerField(default = 50)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['video_id']   = self.video_id
    d['start_time'] = self.start_time
    d['paused']     = self.paused
    d['muted']      = self.muted
    d['volume']     = self.volume
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Twitch video"
  
  @staticmethod
  def get_simple_type():
    return "twitch_video"
  
class AbstractTextItem(AbstractItem):
  font = models.CharField(max_length=255, default="Roboto Mono")
  font_size = models.IntegerField(default = 32)
  font_weight = models.CharField(max_length=128, default = "normal")
  color = models.CharField(max_length = 255, default = "#FFFFFF")
  drop_shadow_enabled = models.BooleanField(default = False)
  drop_shadow_offset_x = models.FloatField(default = 0.0)
  drop_shadow_offset_y = models.FloatField(default = 0.0)
  drop_shadow_blur_radius = models.FloatField(default = 0.0)
  drop_shadow_color = models.CharField(max_length = 255, default = "#000000")
  text_outline_enabled = models.BooleanField(default = False)
  text_outline_width = models.FloatField(default = 0.0)
  text_outline_color = models.CharField(max_length = 255, default = "#000000")
  background_enabled = models.BooleanField(default = False)
  background_color = models.CharField(max_length = 255, default = "#000000")
  text_alignment = models.CharField(max_length = 128, default = "left")
  
  class Meta:
    abstract = True
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["font"] = self.font
    d["font_size"] = self.font_size
    d["font_weight"] = self.font_weight
    d["color"] = self.color
    d["drop_shadow_enabled"] = self.drop_shadow_enabled
    d["drop_shadow_offset_x"] = self.drop_shadow_offset_x
    d["drop_shadow_offset_y"] = self.drop_shadow_offset_y
    d["drop_shadow_blur_radius"] = self.drop_shadow_blur_radius
    d["drop_shadow_color"] = self.drop_shadow_color
    d["text_outline_enabled"] = self.text_outline_enabled
    d["text_outline_width"] = self.text_outline_width
    d["text_outline_color"] = self.text_outline_color
    d["background_enabled"] = self.background_enabled
    d["background_color"] = self.background_color
    d["text_alignment"] = self.text_alignment
    return d
  
class TextItem(AbstractTextItem):
  text = models.TextField(default = "Example text.")
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["text"] = self.text
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Text"
  
  @staticmethod
  def get_simple_type():
    return "text"
  
class StopwatchItem(AbstractTextItem):
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
  
  @staticmethod
  def get_pretty_type():
    return "Stopwatch"
  
  @staticmethod
  def get_simple_type():
    return "stopwatch"
  
class CounterItem(AbstractTextItem):
  counter_format = models.TextField(default = "Count: {0}")
  count = models.IntegerField(default = 0)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["counter_format"] = self.counter_format
    d["count"] = self.count
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Counter"
  
  @staticmethod
  def get_simple_type():
    return "counter"

ITEM_TYPES = [
  ImageItem,
  EmbedItem,
  YouTubeEmbedItem,
  TwitchStreamEmbedItem,
  TwitchVideoEmbedItem,
  TextItem,
  StopwatchItem,
  CounterItem,
]