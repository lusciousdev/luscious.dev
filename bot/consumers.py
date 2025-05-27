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
import uuid

logger = logging.getLogger("overlay")

class TwitchConsumer(WebsocketConsumer):
  twitch_account = None
  channel_layer : RedisChannelLayer
  
  chat_group_name : str = None
  
  twitch_capabilities = False
  broadcaster_type = 0
  
  def send_bot_command(self, command : str, data):
    async_to_sync(self.channel_layer.group_send)("lusciousbot", { "type": command, "data": data })
  
  def send_command(self, command : str, data):
    self.send(text_data = json.dumps({ "command": command, "data": data }))
    
  def establish_twitch_connection(self, broadcaster_user_id : str):
    self.send_bot_command("join", { "broadcaster_user_id": broadcaster_user_id })
  
    self.chat_group_name = f"twitch_{broadcaster_user_id}"
    
    logger.debug(f"Attempting to join group {self.chat_group_name}")
    async_to_sync(self.channel_layer.group_add)(self.chat_group_name, self.channel_name)
  
  def connect(self):
    logger.debug("Connection attempt started...")
    
    self.user : UserLazyObject = self.scope["user"]
    self.twitch_account : SocialAccount = self.user.socialaccount_set.get(provider="twitch")
    
    self.establish_twitch_connection(self.twitch_account.uid)
    
    logger.debug("Accepting connection...")
    self.accept()
    
  def disconnect(self, close_code):
    print("disconnect")
    async_to_sync(self.channel_layer.group_discard)(
      self.chat_group_name, self.channel_name
    )
  
  def receive(self, text_data = None, bytes_data = None):
    data_json : dict = json.loads(text_data)
    
    command = data_json.get("command", "")
    data : dict = data_json.get("data", {})
    
    if command == "start_poll":
      self.start_poll(data)
    elif command == "start_prediction":
      self.start_prediction(data)
      
  #
  #     COMMAND HANDLERS
  #
  def start_poll(self, data : dict):
    if not self.twitch_capabilities:
      self.send_command("error", "Not connected to Twitch.")
      return
    
    broadcaster_user_id = self.twitch_account.uid
    title = data.get("title")
    choices = data.get("choices")
    duration = data.get("duration", 60)
    delete_poll = data.get("delete_poll", False)
    
    if title is None or choices is None or duration is None:
      self.send_command("error", "Incomplete poll data.")
      return
    
    print("Sending poll start command.")
    self.send_bot_command("start_poll", { "broadcaster_user_id": broadcaster_user_id, "title": title, "choices": choices, "duration": duration, "delete_poll": delete_poll })
    
  def start_prediction(self, data : dict):
    if not self.twitch_capabilities:
      self.send_command("error", "Not connected to Twitch.")
      return
    
    if self.broadcaster_type == 0:
      self.send_command("error", "User is not capable of running a prediction.")
      return 
    
    broadcaster_user_id = self.twitch_account.uid
    title = data.get("title")
    outcomes = data.get("outcomes")
    duration = data.get("duration", 60)
    
    if title is None or outcomes is None or duration is None:
      self.send_command("error", "Incomplete poll data.")
      return
    
    print("Sending poll start command.")
    self.send_bot_command("start_prediction", { "broadcaster_user_id": broadcaster_user_id, "title": title, "outcomes": outcomes, "duration": duration })
    
  #
  #     MESSAGE HANDLERS 
  #
  def twitch_error(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
  
  def twitch_chat_message(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_broadcaster_type(self, event : dict):
    data : dict = event.get("data", {})
    
    self.broadcaster_type = data.get("broadcaster_type", 0)
    self.twitch_capabilities = True
    
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_poll_begin(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_poll_progress(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_poll_end(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_prediction_begin(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_prediction_progress(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_prediction_lock(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_prediction_end(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_redemption_add(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))
    
  def twitch_redemption_update(self, event : dict):
    self.send(text_data = json.dumps({ "command": event.get("type", "unknown"), "data": event.get("data", {}) }))