from celery import Celery, shared_task
from celery.schedules import crontab
import requests
import json
import typing
import datetime
import asyncio
from asgiref.sync import async_to_sync, sync_to_async
import logging
import twitchio
from django.db import models
from django.contrib.auth.models import User
from allauth.socialaccount.models import SocialAccount

from django.conf import settings

from .models import *
from bot.enums import *

User : models.Model = settings.AUTH_USER_MODEL

def increment_counter(item_id : str, delta = 1):
  try:
    counter_item = CounterItem.objects.get(id = item_id)
  except CounterItem.DoesNotExist:
    return
  
  counter_item.count += delta
  counter_item.save()

def trigger_actions(uuid : str, broadcaster : dict, chatter : dict, message : str, emotes : dict, action_data : dict):
  action : dict
  for action in action_data.get("actions", []):
    action_type : str|None = action.get("type", None)
    action_params : dict = action.get("data", {})
    
    if action_type == "increment_counter":
      item_id = action_params.get("item_id", None)
      delta = action_params.get("delta", 1)
      increment_counter(item_id, delta)
    elif action_type == "decrement_counter":
      item_id = action_params.get("item_id", None)
      delta = action_params.get("delta", 1)
      increment_counter(item_id, -1 * delta)
      

@shared_task
def handle_chat_message(uuid : str, broadcaster : dict, chatter : dict, message : str, emotes : dict):
  broadcaster_id = broadcaster.get("id", None)
  
  if broadcaster_id is None:
    return

  try:
    broadcaster_account : SocialAccount = SocialAccount.objects.get(provider = "twitch", uid = broadcaster_id)
    broadcaster_user = broadcaster_account.user
  except SocialAccount.DoesNotExist:
    return
  
  user_level = TwitchUserLevels.ANYONE
  if chatter.get("broadcaster", False):
    user_level = TwitchUserLevels.OWNER
  elif chatter.get("moderator", False):
    user_level = TwitchUserLevels.MODERATOR
  elif chatter.get("vip", False):
    user_level = TwitchUserLevels.VIP
  elif chatter.get("subscriber", False):
    user_level = TwitchUserLevels.SUBSCRIBER
  
  overlay : CollaborativeOverlay
  for overlay in broadcaster_user.collaborativeoverlay_set.all():
    chat_trigger : ChatTrigger
    for chat_trigger in overlay.chattrigger_set.all():
      if user_level < chat_trigger.required_user_level:
        continue
      
      if chat_trigger.trigger_phrase == message:
        time_since_last_trigger = timezone.now() - chat_trigger.last_trigger
        if time_since_last_trigger.total_seconds() < chat_trigger.cooldown:
          continue
        
        time_since_last_occurance = timezone.now() - chat_trigger.last_occurance
        chat_trigger.last_occurance = timezone.now()
        
        if time_since_last_occurance.total_seconds() > chat_trigger.occurance_window:
          chat_trigger.occurance_count = 1
        else:
          chat_trigger.occurance_count += 1
          
        if chat_trigger.occurance_count >= chat_trigger.occurances:
          trigger_actions(uuid, broadcaster, chatter, message, emotes, chat_trigger.action_data)
          
          chat_trigger.occurance_count = 0
          chat_trigger.last_trigger = timezone.now()
          
        chat_trigger.save()
  