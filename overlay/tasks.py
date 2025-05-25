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

from django.conf import settings
  