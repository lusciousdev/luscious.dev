from django.db import models
from django.utils import timezone
import datetime

def default_ends_at():
  return timezone.now() + datetime.timedelta(seconds = 60)

# Create your models here.
class ChatPoll(models.Model):
  broadcaster_user_id = models.CharField(max_length = 255)
  in_progress = models.BooleanField(default = True)
  title = models.CharField(max_length = 255)
  choices = models.JSONField()
  votes = models.JSONField()
  started_at = models.DateTimeField(default = timezone.now)
  ends_at = models.DateTimeField(default = default_ends_at)