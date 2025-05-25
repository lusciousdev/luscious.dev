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

from django.conf import settings

channel_layer = get_channel_layer()
  
@shared_task
def start_poll():
  ...
  
@shared_task
def handle_chat_message(uuid : str, broadcaster : dict, chatter : dict, message : str):
  ...
  