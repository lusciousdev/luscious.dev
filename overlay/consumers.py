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
  response_list = []
  broadcast_list = []
  
  def owner_or_editor(self):
    self.user : UserLazyObject = self.scope["user"]
    if self.user.is_anonymous:
      return False
    
    try:
      self.twitchaccount = self.user.socialaccount_set.get(provider = "twitch")
    except SocialAccount.DoesNotExist:
      logging.debug("User does not have a linked Twitch account.")
      return False
    
    if not (self.overlay.owner.id == self.user.id):
      try:
        editormatch = self.overlay.owner.editor_set.get(twitch_id = self.twitchaccount.uid)
      except Editor.DoesNotExist:
        logging.debug("User is not an editor.")
        return False
      
    return True
  
  def send_command(self, command : str, data):
    self.send(text_data = json.dumps({ "command": command, "data": data }))
    
  def queue_command(self, command : str, data):
    self.response_list.append({ "command": command, "data": data })
    
  def queue_broadcast(self, event_data):
    self.broadcast_list.append(event_data)
  
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
    # startTime = time.time()
    
    text_data_json = json.loads(text_data)
    
    if "commands" in text_data_json:
      for command in text_data_json["commands"]:
        self.handle_command(command)
    elif "command" in text_data_json:
      self.handle_command(text_data_json)
      
    if len(self.response_list) == 1:
      self.send_command(self.response_list[0]["command"], self.response_list[0]["data"])
    elif len(self.response_list) > 1:
      self.send(text_data = json.dumps({ "commands": self.response_list }))
      
    self.response_list.clear()
    
    async_to_sync(self.channel_layer.group_send)(
      self.overlay_group_name, 
      { 
        "type": "broadcast_events", 
        "event_list": self.broadcast_list,
      }
    )
    
    self.broadcast_list.clear()
    
  def handle_command(self, command_json):
    command : str = command_json.get("command", "")
    data : dict = command_json.get("data", {})
    
    command = command.lower()
    if command == "get_overlay_items":
      self.get_overlay_items()
    elif command == "add_overlay_item":
      self.add_overlay_item(data)
    elif command == "edit_overlay_item":
      self.edit_overlay_item(data)
    elif command == "delete_overlay_item":
      self.delete_overlay_item(data)
    elif command == "trigger_item_event":
      self.trigger_item_event(data)
    elif command == "record_canvas_event":
      self.record_canvas_event(data)
    elif command == "ping":
      self.ping(data)
    elif command == "mouse_position":
      self.send_mouse_position(data)
    
  def get_overlay_items(self):
    overlay_items = []
    for t in ITEM_TYPES:
      overlay_items.extend(t.objects.filter(overlay_id = self.overlay.id))
      
    response = { "items": [] }
    for item in overlay_items:
      item_dict = {
        "item_type": item.get_simple_type(),
        "is_displayed": item.is_displayed(),
        "item_data": item.to_data_dict(),
      }
      
      response["items"].append(item_dict)
      
    self.queue_command("list_overlay_items", response)
    
  def add_overlay_item(self, data : dict):
    if not self.owner_or_editor():
      self.queue_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    
    if item_type == "":
      self.queue_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_name = t.get_simple_type()
      
      if item_type.lower() == type_name.lower():
        item_model = t
        break
    
    if item_model is None:
      self.queue_command("error", "Unrecognized item type.")
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
    
    self.queue_broadcast({ 
      "command": "overlay_item_added", 
      "data": {
        "editor": self.twitchaccount.uid,
        "item_type": item_instance.item_type,
        "is_displayed": item_instance.is_displayed(),
        "item_data": item_instance.to_data_dict(),
        "edited_data": item_data,
      } 
    })
    
  def delete_overlay_item(self, data : dict):
    if not self.owner_or_editor():
      self.queue_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    item_id = data.get("item_id", "")
    
    if item_type == "" or item_id == "":
      self.queue_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_name = t.get_simple_type()
      
      if item_type.lower() == type_name.lower():
        item_model = t
        break
    
    if item_model is None:
      self.queue_command("error", "Unrecognized item type.")
      return
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      self.queue_command("error", "That item does not exist.")
      return
    
    item_instance.delete()
    
    self.queue_broadcast({ 
      "command": "overlay_item_deleted", 
      "data": {
        "editor": self.twitchaccount.uid,
        "item_id": item_id, 
      } 
    })
    
  def edit_overlay_item(self, data : dict):
    if not self.owner_or_editor():
      self.queue_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    item_id = data.get("item_id", "")
    
    if item_type == "" or item_id == "":
      self.queue_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_name = t.get_simple_type()
      
      if item_type.lower() == type_name.lower():
        item_model = t
        break
    
    if item_model is None:
      self.queue_command("error", "Unrecognized item type.")
      return
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      self.queue_command("error", "That item does not exist.")
      return
    
    for attr, val in data.get("item_data", {}).items():
      try:
        fieldtype = item_model._meta.get_field(attr).get_internal_type()
        # val = val if fieldtype != "BooleanField" else (val.lower() in ['true', '1', 'yes', 't', 'y'])
        setattr(item_instance, attr, val)
      except FieldDoesNotExist:
        continue
    
    item_instance.save()
    
    self.queue_broadcast({ 
      "command": "overlay_item_edited", 
      "data": {
        "editor": self.twitchaccount.uid,
        "item_type": item_instance.get_simple_type(),
        "is_displayed": item_instance.is_displayed(),
        "item_data": item_instance.to_data_dict(), 
      } 
    })
    
  def ping(self, data):
    if self.owner_or_editor():
      self.queue_broadcast({ 
        "command": "user_present", 
        "data": {
          "username": self.twitchaccount.extra_data["login"],
          "uid": self.twitchaccount.uid,
        } 
      })
      
  def send_mouse_position(self, data):
    if "x" not in data or "y" not in data:
      self.queue_command("error", "Mouse reposition missing data.")
      return
    
    if self.owner_or_editor():
      self.queue_broadcast({ 
        "command": "mouse_position", 
        "data": {
          "username": self.twitchaccount.extra_data["login"],
          "uid": self.twitchaccount.uid,
          "x": data["x"],
          "y": data["y"],
        } 
      })
      
  def trigger_item_event(self, data):
    if "event" not in data:
      self.queue_command("error", "Could not trigger an event because you did not provide an event.")
      return
    
    if not self.owner_or_editor():
      self.queue_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    item_id = data.get("item_id", "")
    
    if item_type == "" or item_id == "":
      self.queue_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_name = t.get_simple_type()
      
      if item_type.lower() == type_name.lower():
        item_model = t
        break
    
    if item_model is None:
      self.queue_command("error", "Unrecognized item type.")
      return
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      self.queue_command("error", "That item does not exist.")
      return
    
    self.queue_broadcast({ 
      "command": "item_event_triggered", 
      "data": {
        "username": self.twitchaccount.extra_data["login"],
        "uid": self.twitchaccount.uid,
        "item_id": item_instance.id,
        "item_type": item_instance.get_simple_type(),
        "event": data["event"],
      } 
    })
      
  def record_canvas_event(self, data):
    if "event" not in data:
      self.queue_command("error", "Could not trigger an event because you did not provide an event.")
      return
    
    if not self.owner_or_editor():
      self.queue_command("error", "Invalid user.")
      return
    
    item_type = data.get("item_type", "")
    item_id = data.get("item_id", "")
    
    if item_type == "" or item_id == "":
      self.queue_command("error", "Improperly formatted request.")
      return
    
    item_model = None
    for t in ITEM_TYPES:
      type_name = t.get_simple_type()
      
      if item_type.lower() == type_name.lower():
        item_model = t
        break
      
    if item_model != CanvasItem:
      self.queue_command("error", f"Can't trigger a canvas event on a {item_model.get_pretty_type()}, silly.")
      return
    
    if item_model is None:
      self.queue_command("error", "Unrecognized item type.")
      return
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      self.queue_command("error", "That item does not exist.")
      return
    
    if data["event"] == "start_action":
      action : dict = data["action"]
      action = CanvasAction.objects.create(canvas = item_instance, user = self.user, action = action)
    elif data["event"] == "add_points":
      action : CanvasAction = self.user.canvasaction_set.filter(canvas = item_instance).order_by("-timestamp").first()
      action.action['points'].extend(data["points"])
      action.save()
    if data["event"] == "undo":
      action : CanvasAction = self.user.canvasaction_set.filter(canvas = item_instance).order_by("-timestamp").first()
      if action: 
        action.delete()
    
    self.queue_broadcast({ 
      "command": "canvas_updated", 
      "data": {
        "username": self.twitchaccount.extra_data["login"],
        "uid": self.twitchaccount.uid,
        "item_id": item_instance.id,
        "item_type": item_instance.get_simple_type(),
        "history": item_instance.to_data_dict()['history'], 
      } 
    })
    
  def broadcast_event(self, event):
    event_data = event.get("event_data", {})
    
    command = event_data.get("command", "")
    data = event_data.get("data", {})
    
    self.send_command( command, data )
    
  def broadcast_events(self, event):
    event_list = event.get("event_list", [])
    
    self.send(text_data = json.dumps({ "commands": event_list }))
    
    