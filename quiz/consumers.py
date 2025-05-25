import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from channels.auth import UserLazyObject
from allauth.socialaccount.models import SocialAccount
from django.core.exceptions import FieldDoesNotExist
from django.urls import reverse
from django.utils import timezone
import logging
from channels_redis.core import RedisChannelLayer

from bot.consumers import TwitchConsumer
from .models import *
from .forms import *

logger = logging.getLogger("quiz")

class QuizConsumer(TwitchConsumer):
  pass