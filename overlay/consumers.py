import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from channels.auth import UserLazyObject
from allauth.socialaccount.models import SocialAccount
from django.core.exceptions import FieldDoesNotExist
import time
import logging

from .models import *
from .forms import *

logger = logging.getLogger("overlay")

class OverlayConsumer(WebsocketConsumer):
  def owner_or_editor(self):
    self.user : UserLazyObject = self.scope["user"]
    if self.user.is_anonymous:
      return False
    
    try:
      self.twitchaccount = self.user.socialaccount_set.get(provider = "twitch")
    except SocialAccount.DoesNotExist:
      print("User does not have a linked Twitch account.")
      return False
    
    if not (self.overlay.owner.id == self.user.id):
      try:
        editormatch = self.overlay.owner.editor_set.get(twitch_id = self.twitchaccount.uid)
      except Editor.DoesNotExist:
        print("User is not an editor.")
        return False
      
    return True
  
  def send_command(self, command : str, data):
    self.send(text_data = json.dumps({ "command": command, "data": data }))
  
  def connect(self):
    logger.debug("Connection attempt started...")
    
    overlay_id = self.scope["url_route"]["kwargs"]["overlay_id"]
    self.overlay_group_name = f"overlay_{overlay_id}"
    
    logger.debug(f"Attempting to join group {self.overlay_group_name}")
    
    try:
      self.overlay = CollaborativeOverlay.objects.get(id = overlay_id)
    except CollaborativeOverlay.DoesNotExist:
      logger.error(f"Overlay \"{overlay_id}\" does not exist.")
      self.close(reason = f"Overlay \"{overlay_id}\" does not exist.")
      return
    except Exception as e:
      logger.error(f"Error: {e}")
      self.close(reason = f"Error: {e}")
      return
    
    logger.debug("Adding user to overlay group...")
    
    async_to_sync(self.channel_layer.group_add)(
      self.overlay_group_name, self.channel_name
    )
    
    logger.debug("Accepting connection...")
    
    self.accept()
    
  def disconnect(self, close_code):
    async_to_sync(self.channel_layer.group_discard)(
      self.overlay_group_name, self.channel_name
    )
  
  def receive(self, text_data = None, bytes_data = None):
    text_data_json = json.loads(text_data)
    
    command : str = text_data_json.get("command", "")
    data : dict = text_data_json.get("data", {})
    
    command = command.lower()
    if command == "get_overlay_items":
      self.get_overlay_items()
    elif command == "add_overlay_item":
      self.add_overlay_item(data)
    elif command == "edit_overlay_item":
      self.edit_overlay_item(data)
    elif command == "delete_overlay_item":
      self.delete_overlay_item(data)
    elif command == "reset_overlay_item":
      self.reset_overlay_item(data)
    
  def get_overlay_items(self):
    overlay_items = []
    for t in ITEM_TYPES:
      overlay_items.extend(t.objects.filter(overlay_id = self.overlay.id))
      
    response = { "items": [] }
    for item in overlay_items:
      item_dict = {
        "item_type": item.item_type,
        "item_data": item.to_data_dict(),
      }
      
      response["items"].append(item_dict)
      
    self.send_command("list_overlay_items", response)
    
  def add_overlay_item(self, data : dict):
    if not self.owner_or_editor():
      self.send_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    
    if item_type == "":
      self.send_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_field = t._meta.get_field("item_type")
      
      if item_type.lower() == type_field.default.lower():
        item_model = t
        break
    
    if item_model is None:
      self.send_command("error", "Unrecognized item type.")
      return
  
    item_instance = item_model()
    item_data = data.get("item_data", {})
  
    for attr, val in item_data.items():
      try:
        fieldtype = item_model._meta.get_field(attr).get_internal_type()
        # val = val if fieldtype != "BooleanField" else (val.lower() in ['true', '1', 'yes', 't', 'y'])
        setattr(item_instance, attr, val)
      except FieldDoesNotExist:
        continue
      
    item_instance.overlay_id = self.overlay.id
    item_instance.save()
    
    async_to_sync(self.channel_layer.group_send)(
      self.overlay_group_name, 
      { 
       "type": "broadcast_event", 
       "event_data": { 
         "command": "overlay_item_added", 
         "data": {
           "editor": self.twitchaccount.uid,
           "item_type": item_instance.item_type, 
           "item_data": item_instance.to_data_dict(),
           "edited_data": item_data,
          } 
        } 
      }
    )
    
  def delete_overlay_item(self, data : dict):
    if not self.owner_or_editor():
      self.send_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    item_id = data.get("item_id", "")
    
    if item_type == "" or item_id == "":
      self.send_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_field = t._meta.get_field("item_type")
      
      if item_type.lower() == type_field.default.lower():
        item_model = t
        break
    
    if item_model is None:
      self.send_command("error", "Unrecognized item type.")
      return
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      self.send_command("error", "That item does not exist.")
      return
    
    item_instance.delete()
    
    async_to_sync(self.channel_layer.group_send)(
      self.overlay_group_name, 
      { 
       "type": "broadcast_event", 
       "event_data": { 
         "command": "overlay_item_deleted", 
         "data": {
           "editor": self.twitchaccount.uid,
           "item_id": item_id, 
          } 
        } 
      }
    )
    
  def reset_overlay_item(self, data : dict):
    if not self.owner_or_editor():
      self.send_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    item_id = data.get("item_id", "")
    
    if item_type == "" or item_id == "":
      self.send_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_field = t._meta.get_field("item_type")
      
      if item_type.lower() == type_field.default.lower():
        item_model = t
        break
    
    if item_model is None:
      self.send_command("error", "Unrecognized item type.")
      return
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      self.send_command("error", "That item does not exist.")
      return
    
    async_to_sync(self.channel_layer.group_send)(
      self.overlay_group_name, 
      { 
       "type": "broadcast_event", 
       "event_data": { 
         "command": "overlay_item_reset", 
         "data": {
           "editor": self.twitchaccount.uid,
           "item_id": item_id,
          } 
        } 
      }
    )
    
  def edit_overlay_item(self, data : dict):
    if not self.owner_or_editor():
      self.send_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    item_id = data.get("item_id", "")
    
    if item_type == "" or item_id == "":
      self.send_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_field = t._meta.get_field("item_type")
      
      if item_type.lower() == type_field.default.lower():
        item_model = t
        break
    
    if item_model is None:
      self.send_command("error", "Unrecognized item type.")
      return
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      self.send_command("error", "That item does not exist.")
      return
    
    for attr, val in data.get("item_data", {}).items():
      try:
        fieldtype = item_model._meta.get_field(attr).get_internal_type()
        # val = val if fieldtype != "BooleanField" else (val.lower() in ['true', '1', 'yes', 't', 'y'])
        setattr(item_instance, attr, val)
      except FieldDoesNotExist:
        continue
    
    item_instance.save()
    
    async_to_sync(self.channel_layer.group_send)(
      self.overlay_group_name, 
      { 
       "type": "broadcast_event", 
       "event_data": { 
         "command": "overlay_item_edited", 
         "data": {
           "editor": self.twitchaccount.uid,
           "item_type": item_instance.item_type, 
           "item_data": item_instance.to_data_dict(), 
          } 
        } 
      }
    )
    
  def broadcast_event(self, event):
    event_data = event.get("event_data", "")
    
    command = event_data.get("command", "")
    data = event_data.get("data", {})
    
    self.send_command(command, data )