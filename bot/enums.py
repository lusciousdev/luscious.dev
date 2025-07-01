from django.db import models
  
class TwitchUserLevels(models.IntegerChoices):
  ANYONE = 0
  SUBSCRIBER = 1
  VIP = 2
  MODERATOR = 3
  OWNER = 4