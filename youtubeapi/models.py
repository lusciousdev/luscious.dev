from django.db import models
from django.utils import timezone
import datetime
import re
import typing
import json

# Create your models here.
class PlaylistInfo(models.Model):
  playlist_id = models.CharField(max_length=255, primary_key = True, blank = False, editable = False)
  
  last_fetched = models.DateTimeField(default = timezone.now)
  info = models.JSONField(blank = True, null = True)
  
  def save(self, *args, **kwargs):
    self.last_fetched = timezone.now()
    super().save(*args, **kwargs)