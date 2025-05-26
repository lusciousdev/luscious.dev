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
from channels.layers import get_channel_layer
from channels_redis.core import RedisChannelLayer

from django.conf import settings
  
from .models import *

def _send_poll_active(poll : ChatPoll, message_type : str):
  channel_layer : RedisChannelLayer = get_channel_layer()
  
  async_to_sync(channel_layer.group_send)(f"twitch_{poll.broadcaster_user_id}", {
    "type": message_type,
    "data": {
      "broadcaster_user_id": poll.broadcaster_user_id,
      "id": poll.pk,
      "title": poll.title,
      "choices": [ { "title": c[0], "votes": c[1] } for c in poll.choices["choices"] ],
      "duration": (poll.started_at - poll.started_at).total_seconds(),
      "time_remaining": (poll.ends_at - timezone.now()).total_seconds(),
    }
  })
  
def send_poll_begin(poll : ChatPoll):
  _send_poll_active(poll, "twitch_poll_begin")
  
def send_poll_progress(poll : ChatPoll):
  _send_poll_active(poll, "twitch_poll_progress")
  
def send_poll_end(poll : ChatPoll):
  channel_layer : RedisChannelLayer = get_channel_layer()
  
  async_to_sync(channel_layer.group_send)(f"twitch_{poll.broadcaster_user_id}", {
    "type": "twitch_poll_end",
    "data": {
      "broadcaster_user_id": poll.broadcaster_user_id,
      "id": poll.pk,
      "title": poll.title,
      "choices": [ { "title": c[0], "votes": c[1] } for c in poll.choices["choices"] ],
    }
  })
  

@shared_task
def start_poll(broadcaster_user_id : str, title: str, choices : list[str], duration : int = 60):
  try:
    poll = ChatPoll.objects.get(broadcaster_user_id = broadcaster_user_id, started_at__lte = timezone.now(), ends_at__gte = timezone.now())
    return
  except ChatPoll.DoesNotExist:
    ...
    
  poll = ChatPoll.objects.create(broadcaster_user_id = broadcaster_user_id,
                                 title = title,
                                 choices = { "choices": [(choice, 0) for choice in choices] },
                                 votes = { "votes": {} },
                                 ends_at = (timezone.now() + datetime.timedelta(seconds = duration)))
  
  poll.save()
  
  send_poll_begin(poll)
  
@shared_task
def broadcast_poll_states():
  poll : ChatPoll
  for poll in ChatPoll.objects.filter(in_progress = True).all():
    if timezone.now() > poll.ends_at:
      poll.in_progress = False
      poll.save()
      send_poll_end(poll)
    else:
      send_poll_progress(poll)
  
@shared_task
def handle_chat_message(uuid : str, broadcaster : dict, chatter : dict, message : str):
  # Log vote in any active polls
  try:
    polls = ChatPoll.objects.filter(broadcaster_user_id = broadcaster["id"], in_progress = True).all()
    
    for poll in polls:
      if timezone.now() > poll.ends_at:
        poll.in_progress = False
        poll.save()
        send_poll_end(poll)
      else:
        choices : list[tuple[str, int]] = poll.choices["choices"]
        votes : dict = poll.votes["votes"]
        
        clean_message = message.lower()
        
        if chatter["id"] not in votes.keys():
          accept_numbers = len(set([c[0].lower() for c in choices]) & set(["1", "2", "3", "4"])) == 0
          accept_letters = len(set([c[0].lower() for c in choices]) & set(["a", "b", "c", "d"])) == 0
          for i, choice in enumerate(choices):
            if clean_message == choice[0].lower() or (accept_numbers and (clean_message == str(i + 1))) or (accept_letters and (clean_message == chr(ord('a') + i))):
              poll.choices["choices"][i][1] += 1
              poll.votes["votes"][chatter["id"]] = i
              break
              
              
        poll.save()
        
        send_poll_progress(poll)
  except ChatPoll.DoesNotExist:
    ...