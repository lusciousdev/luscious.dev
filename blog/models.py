from django.db import models
from django.utils import timezone

# Create your models here.
class Blog(models.Model):
  created_at = models.DateTimeField(default = timezone.now)
  
  slug = models.SlugField(default = "", null = False, blank = False)
  
  title = models.CharField(default = "", max_length = 255, null = False, blank = False)
  content = models.TextField(default = "")
