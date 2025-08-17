import datetime
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.utils.timezone import now
from django.contrib.auth.models import User

import logging
import random

from bot.enums import TwitchUserLevels
from lusciousdev.util.modelutil import *

logger = logging.getLogger("overlay")

# Create your models here.
class ChangeLogEntry(models.Model):
  date = models.DateTimeField(default = datetime.datetime.now)
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
  description = models.CharField(max_length = 256, blank = True)
  
  width = models.IntegerField(default = 1920)
  height = models.IntegerField(default = 1080)
  allow_audio = models.BooleanField(default = True)
  
  def __str__(self):
    return f"{self.name} ({self.description})"
  
class OverlayUserInfo(models.Model):
  user = models.OneToOneField(User, on_delete = models.CASCADE, related_name = "ovl", unique = True)
  
  identifier = models.CharField(max_length = ID_LENGTH, default = id_gen, editable = False)
  
  embed_stream = models.BooleanField(default = False)
  notification_volume = models.FloatField(default = 0.5)
  
  class Meta:
    indexes = [
      models.Index(fields = ["user_id", ]),
    ]

class OverlayUser(User):
  @property
  def overlay(self):
    try:
      return self.ovl
    except OverlayUserInfo.DoesNotExist:
      return OverlayUserInfo.objects.create(user = self)
  
  class Meta:
    proxy = True
  
class Editor(NonConsecutiveModel):
  owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
  
  id_type = models.IntegerField(verbose_name = "Identification method", default = 0)
  
  username = models.CharField(max_length = 256)
  identifier = models.CharField(max_length = 256)
  
  class Meta:
    unique_together = ('owner', 'id_type', 'identifier')
  
class AbstractItem(NonConsecutiveModel):
  overlay = models.ForeignKey(CollaborativeOverlay, on_delete = models.CASCADE)
  
  name = models.CharField(max_length = 256, default = "My Item")
  
  x = models.IntegerField(default = -300)
  y = models.IntegerField(default = -100)
  z = models.IntegerField(default = 50)
  width = models.IntegerField(default = 300)
  height = models.IntegerField(default = 100)
  rotation = models.FloatField(default = 0)
  mirrored = models.BooleanField(default = False)
  background_enabled = models.BooleanField(default = False)
  background_color = models.CharField(max_length = 255, default = "#000000FF")
  opacity = models.FloatField(default = 100.0)
  visibility = models.IntegerField(default = 1)
  minimized = models.BooleanField(default = False)
  view_lock = models.BooleanField(default = False)
  position_lock = models.BooleanField(default = False)
  scroll_direction = models.IntegerField(default = 0)
  scroll_duration = models.FloatField(default = 5.0)
  
  crop_top = models.FloatField(verbose_name = "Crop % (top)", default = 0)
  crop_left = models.FloatField(verbose_name = "Crop % (left)", default = 0)
  crop_bottom = models.FloatField(verbose_name = "Crop % (bottom)", default = 0)
  crop_right = models.FloatField(verbose_name = "Crop % (right)", default = 0)
  
  class Meta:
    abstract = True
  
  @staticmethod
  def get_pretty_type():
    return "Item"
  
  @staticmethod
  def get_simple_type():
    return "item"
  
  @staticmethod
  def is_displayed():
    return True
    
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
      "mirrored": self.mirrored,
      "background_enabled": self.background_enabled,
      "background_color": self.background_color,
      "opacity": self.opacity,
      "visibility": self.visibility,
      "minimized": self.minimized,
      "view_lock": self.view_lock,
      "position_lock": self.position_lock,
      "crop_top": self.crop_top,
      "crop_bottom": self.crop_bottom,
      "crop_left": self.crop_left,
      "crop_right": self.crop_right,
      'scroll_direction': self.scroll_direction,
      'scroll_duration': self.scroll_duration,
    }
    
def media_directory_path(instance : "AbstractItem", filename : str):
  return f"overlays/{instance.overlay.id}/{filename}"

def validate_file_size(fieldfile_obj):
  filesize = fieldfile_obj.file.size
  megabyte_limit = 25.0
  if filesize > megabyte_limit * 1024 * 1024:
    raise ValidationError(f"Max file size is {megabyte_limit}MB.")
    
class ImageItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My Image")
  
  image = models.ImageField(upload_to = media_directory_path, validators=[validate_file_size], blank = True, null = True, help_text="Max file size: 25MB")
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
  
  @staticmethod
  def is_displayed():
    return True
  
class CanvasItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My Canvas")
  
  def to_data_dict(self, since : datetime.datetime = None):
    d = super().to_data_dict()
    d['history'] = []
    canvasaction : CanvasAction
    
    canvasaction_set = self.canvasaction_set.order_by("timestamp")
    if since is not None:
      canvasaction_set = canvasaction_set.filter(timestamp__gte = since)
      
    last_clear = canvasaction_set.filter(action = CanvasActionEnum.CLEAR).last()
    if last_clear:
      canvasaction_set = canvasaction_set.filter(timestamp__gt = last_clear.timestamp)
    
    for canvasaction in canvasaction_set.all():
      d['history'].append({ "action": canvasaction.action, "action_data": canvasaction.action_data })
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Canvas"
  
  @staticmethod
  def get_simple_type():
    return "canvas"
  
  @staticmethod
  def is_displayed():
    return True
  
class CanvasActionEnum:
  NONE = -1
  DRAW = 0
  ERASE = 1
  CLEAR = 2
  
  @staticmethod
  def FromString(actionName : str) -> int:
    if actionName.lower() == "draw":
      return CanvasActionEnum.DRAW
    elif actionName.lower() == "erase":
      return CanvasActionEnum.ERASE
    elif actionName.lower() == "clear":
      return CanvasActionEnum.CLEAR
    else:
      return CanvasActionEnum.NONE
  
class CanvasAction(models.Model):
  canvas = models.ForeignKey(CanvasItem, on_delete = models.CASCADE)
  user = models.ForeignKey(settings.AUTH_USER_MODEL, null = True, on_delete = models.SET_NULL)
  
  timestamp = models.DateTimeField(auto_now_add = True)
  action = models.IntegerField(default = CanvasActionEnum.NONE)
  action_data = models.JSONField(default = dict)
  
  class Meta:
    ordering = ('-timestamp', )
  
class AudioItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My Audio")
  
  audio = models.FileField(upload_to = media_directory_path, validators=[validate_file_size], blank = False, null = False, help_text = "Max file size: 25MB")
  volume = models.FloatField(default = 50.0)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['audio_url'] = self.audio.url
    d['volume'] = self.volume
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Audio"
  
  @staticmethod
  def get_simple_type():
    return "audio"
  
  @staticmethod
  def is_displayed():
    return False

class EmbedItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My Embed")
  
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
  
  @staticmethod
  def is_displayed():
    return True
  
class YouTubeEmbedItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My YouTube Video")
  
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
  
  @staticmethod
  def is_displayed():
    return True
  
class TwitchStreamEmbedItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My Twitch Stream")
  
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
  
  @staticmethod
  def is_displayed():
    return True
  
class TwitchVideoEmbedItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My Twitch Video")
  
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
  
  @staticmethod
  def is_displayed():
    return True
  
def generate_seed():
  return random.randint(0, 2**31)

class HorseGameItem(AbstractItem):
  name = models.CharField(max_length = 256, default = "My Horse Game")
  
  seed = models.IntegerField(default = generate_seed)
  racers = models.IntegerField(default = 4)
  prediction_duration = models.IntegerField(default = 30)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d['seed']   = self.seed
    d['racers'] = self.racers
    d['prediction_duration'] = self.prediction_duration
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Horse game"
  
  @staticmethod
  def get_simple_type():
    return "horse_game"
  
  @staticmethod
  def is_displayed():
    return True
  
class AbstractTextItem(AbstractItem):
  font = models.CharField(max_length=255, default="Roboto Mono")
  font_size = models.IntegerField(default = 32)
  font_weight = models.CharField(max_length=128, default = "normal")
  color = models.CharField(max_length = 255, default = "#FFFFFFFF")
  drop_shadow_enabled = models.BooleanField(default = False)
  drop_shadow_offset_x = models.FloatField(default = 0.0)
  drop_shadow_offset_y = models.FloatField(default = 0.0)
  drop_shadow_blur_radius = models.FloatField(default = 0.0)
  drop_shadow_color = models.CharField(max_length = 255, default = "#000000FF")
  text_outline_enabled = models.BooleanField(default = False)
  text_outline_width = models.FloatField(default = 0.0)
  text_outline_color = models.CharField(max_length = 255, default = "#000000FF")
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
    d["text_alignment"] = self.text_alignment
    return d
  
class TextItem(AbstractTextItem):
  name = models.CharField(max_length = 256, default = "My Text")
  
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
  
  @staticmethod
  def is_displayed():
    return True
  
class StopwatchItem(AbstractTextItem):
  name = models.CharField(max_length = 256, default = "My Stopwatch")
  
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
  
  @staticmethod
  def is_displayed():
    return True
  
class CountdownItem(AbstractTextItem):
  name = models.CharField(max_length = 256, default = "My Countdown")
  
  timer_format = models.TextField(default = "{0}")
  timer_end = models.DateTimeField(default = timezone.now, blank = True, null = True)
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["timer_format"] = self.timer_format
    d["timer_end"] = self.timer_end.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Countdown"
  
  @staticmethod
  def get_simple_type():
    return "countdown"
  
  @staticmethod
  def is_displayed():
    return True
  
class CounterItem(AbstractTextItem):
  name = models.CharField(max_length = 256, default = "My Counter")
  
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
  
  @staticmethod
  def is_displayed():
    return True
  
class TwitchChatItem(AbstractTextItem):
  name = models.CharField(max_length = 256, default = "My Twitch Chat")
  
  @staticmethod
  def get_pretty_type():
    return "Twitch Chat"
  
  @staticmethod
  def get_simple_type():
    return "twitch_chat"
  
  @staticmethod
  def is_displayed():
    return True
  
class TwitchPollItem(AbstractTextItem):
  name = models.CharField(max_length = 256, default = "My Twitch Poll")
  
  title_color = models.CharField(max_length = 255, default = "#FFFFFFFF")
  bar_color = models.CharField(max_length = 255, default = "#EB5E28FF")
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["title_color"] = self.title_color
    d["bar_color"] = self.bar_color
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Twitch Poll"
  
  @staticmethod
  def get_simple_type():
    return "twitch_poll"
  
  @staticmethod
  def is_displayed():
    return True
  
class TwitchPredictionItem(AbstractTextItem):
  name = models.CharField(max_length = 256, default = "My Twitch Prediction")
  
  title_color = models.CharField(max_length = 255, default = "#FFFFFFFF")
  bar_color = models.CharField(max_length = 255, default = "#EB5E28FF")
  
  def to_data_dict(self):
    d = super().to_data_dict()
    d["title_color"] = self.title_color
    d["bar_color"] = self.bar_color
    return d
  
  @staticmethod
  def get_pretty_type():
    return "Twitch Prediction"
  
  @staticmethod
  def get_simple_type():
    return "twitch_prediction"
  
  @staticmethod
  def is_displayed():
    return True
  
class ChatMessage(models.Model):
  overlay = models.ForeignKey(CollaborativeOverlay, null = True, on_delete = models.CASCADE)
  user = models.ForeignKey(settings.AUTH_USER_MODEL, null = True, on_delete = models.SET_NULL)
  
  timestamp = models.DateTimeField(auto_now_add = True)
  message = models.TextField(default = "", blank = False, null = False)
  
  class Meta:
    ordering = ('timestamp', )

ITEM_TYPES = [
  ImageItem,
  CanvasItem,
  AudioItem,
  EmbedItem,
  YouTubeEmbedItem,
  TwitchStreamEmbedItem,
  TwitchVideoEmbedItem,
  HorseGameItem,
  TextItem,
  StopwatchItem,
  CountdownItem,
  CounterItem,
  TwitchChatItem,
  TwitchPollItem,
  TwitchPredictionItem,
]

def default_action_data():
  return { "actions": [] }

class AbstractTrigger(NonConsecutiveModel):
  overlay = models.ForeignKey(CollaborativeOverlay, null = True, on_delete = models.CASCADE)
  
  name = models.CharField(max_length = 256, default = "My Action")
  cooldown = models.IntegerField(default = 60)
  last_trigger = models.DateTimeField(default = datetime.datetime(year = 1971, month = 1, day = 1, hour = 0, minute = 0, second = 1, tzinfo = datetime.timezone.utc))
  
  action_data = models.JSONField(default = default_action_data)
  
  class Meta:
    abstract = True
  
  @staticmethod
  def get_description():
    return "Abstract trigger"
  
  @staticmethod
  def get_simple_type():
    return "abstract_trigger"
  
class ChatTrigger(AbstractTrigger):
  trigger_phrase = models.CharField(max_length = 500)
  
  required_user_level = models.IntegerField(choices = TwitchUserLevels, default = 0)
  occurances = models.IntegerField(default = 1)
  occurance_window = models.IntegerField(default = 15)
  
  last_occurance = models.DateTimeField(default = datetime.datetime(year = 1971, month = 1, day = 1, hour = 0, minute = 0, second = 1, tzinfo = datetime.timezone.utc))
  occurance_count = models.IntegerField(default = 0)
  
  @staticmethod
  def get_description():
    return "Trigger on chat messages"
  
  @staticmethod
  def get_simple_type():
    return "chat_trigger"
  
class StreamStartTrigger(AbstractTrigger):
  @staticmethod
  def get_description():
    return "Trigger on stream start"
  
  @staticmethod
  def get_simple_type():
    return "stream_start_trigger"
  
class StreamEndTrigger(AbstractTrigger):
  @staticmethod
  def get_description():
    return "Trigger on stream end"
  
  @staticmethod
  def get_simple_type():
    return "stream_end_trigger"
