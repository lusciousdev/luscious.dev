from django.db import models
from django.utils import timezone

# Create your models here.
class LastFMGrid(models.Model):
  created_at = models.DateTimeField(default = timezone.now)
  
  username = models.CharField(max_length = 255, blank = False, null = False)
  period = models.CharField(max_length = 255, blank = False, null = False)
  size = models.IntegerField(blank = False, null = False, default = 9)
  
  results = models.JSONField(blank = True, null = True)
  
  def save(self, *args, **kwargs):
    self.created_at = timezone.now()
    super().save(*args, **kwargs)
    
  class Meta:
    unique_together = ("username", "period", "size")