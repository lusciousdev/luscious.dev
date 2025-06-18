import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from channels.auth import UserLazyObject
from allauth.socialaccount.models import SocialAccount
from django.core.exceptions import FieldDoesNotExist
from django.urls import reverse
from django.utils import timezone
import logging

from bot.consumers import TwitchConsumer

from .models import *
from .forms import *

logger = logging.getLogger("overlay")

class OverlayConsumer(TwitchConsumer):
  response_list = []
  broadcast_list = []
  
  overlay_user : OverlayUserInfo = None
  
  def owner_or_editor(self):
    self.user : UserLazyObject = self.scope["user"]
    if self.user.is_anonymous:
      return False
    
    if self.overlay.owner.id == self.user.id:
      return True
    
    try:
      twitchaccount = self.user.socialaccount_set.get(provider="twitch")
      editormatch = self.overlay.owner.editor_set.get(id_type = 0, identifier = twitchaccount.uid)
      return True
    except Exception as e:
      pass
      
    for email_address in self.user.emailaddress_set.filter(verified = True).all():
      try:
        editormatch = self.overlay.owner.editor_set.get(id_type = 1, identifier = email_address.email)
        return True
      except:
        pass
      
    try:
      editormatch = self.overlay.owner.editor_set.get(id_type = 2, identifier = self.overlay_user.identifier)
      return True
    except:
      pass
    
    logging.debug("User is not an editor.")
    return False
  
  def send_command(self, command : str, data):
    self.send(text_data = json.dumps({ "command": command, "data": data }))
    
  def queue_command(self, command : str, data):
    self.response_list.append({ "command": command, "data": data })
    
  def queue_broadcast(self, event_data):
    self.broadcast_list.append(event_data)
  
  def connect(self):
    logger.debug("Connection attempt started...")
    
    self.user : UserLazyObject = self.scope["user"]
    if not self.user.is_anonymous:
      try:
        self.overlay_user = OverlayUser.objects.get(id = self.user.id).overlay
      except OverlayUser.DoesNotExist:
        ...
    
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
    
    try:
      self.twitch_account = self.overlay.owner.socialaccount_set.get(provider = "twitch")
      
      self.establish_twitch_connection(self.twitch_account.uid)
    except SocialAccount.DoesNotExist:
      ...
    
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
    async_to_sync(self.channel_layer.group_discard)(
      self.chat_group_name, self.channel_name
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
    if command == "get_user_settings":
      self.get_user_settings()
    elif command == "update_user_settings":
      self.update_user_settings(data)
    elif command == "get_overlay_items":
      self.get_overlay_items()
    elif command == "add_overlay_item":
      self.add_overlay_item(data)
    elif command == "move_overlay_item":
      self.move_overlay_item(data)
    elif command == "resize_overlay_item":
      self.resize_overlay_item(data)
    elif command == "edit_overlay_item":
      self.edit_overlay_item(data)
    elif command == "delete_overlay_item":
      self.delete_overlay_item(data)
    elif command == "duplicate_overlay_item":
      self.duplicate_overlay_item(data)
    elif command == "trigger_item_event":
      self.trigger_item_event(data)
    elif command == "record_canvas_event":
      self.record_canvas_event(data)
    elif command == "ping":
      self.ping(data)
    elif command == "request_refresh":
      self.request_refresh(data)
    elif command == "request_tts":
      self.request_tts(data)
    elif command == "mouse_position":
      self.send_mouse_position(data)
    elif command == "get_chat_history":
      self.get_chat_history()
    elif command == "send_chat_message":
      self.send_chat_message(data)
    elif command == "start_poll":
      self.start_poll(data)
    elif command == "start_prediction":
      self.start_prediction(data)
      
  def get_user_settings(self):
    user_settings = {
      "embed_stream": self.overlay_user.embed_stream,
      "notification_volume": self.overlay_user.notification_volume
    }
    
    self.queue_command("user_settings", user_settings)
    
  def update_user_settings(self, data : dict):
    for key, value in data.items():
      setattr(self.overlay_user, key, value)
    self.overlay_user.save()
    
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
      "loopback": True,
      "data": {
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_type": item_instance.get_simple_type(),
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
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_id": item_id, 
      } 
    })
    
  def duplicate_overlay_item(self, data : dict):
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
    
    item_instance.id = None
    item_instance._state.adding = True
    item_instance.save()
    
    self.queue_broadcast({ 
      "command": "overlay_item_added",
      "loopback": True,
      "data": {
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_type": item_instance.get_simple_type(),
        "is_displayed": item_instance.is_displayed(),
        "item_data": item_instance.to_data_dict(),
        "edited_data": item_instance.to_data_dict(),
      } 
    })
    
  def update_overlay_item(self, data : dict):
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
        if (fieldtype == "DateTimeField"):
          val = datetime.datetime.strptime(val, "%Y-%m-%dT%H:%M:%SZ")
        setattr(item_instance, attr, val)
      except FieldDoesNotExist:
        continue
    
    item_instance.save()
    
    return item_instance
    
    
  def move_overlay_item(self, data : dict):
    item_instance = self.update_overlay_item(data)
    
    self.queue_broadcast({ 
      "command": "overlay_item_moved", 
      "data": {
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_id": item_instance.id,
        "x": item_instance.x,
        "y": item_instance.y, 
      } 
    })
    
  def resize_overlay_item(self, data : dict):
    item_instance = self.update_overlay_item(data)
    
    self.queue_broadcast({
      "command": "overlay_item_resized",
      "data": {
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_id": item_instance.id,
        "x": item_instance.x,
        "y": item_instance.y,
        "width": item_instance.width,
        "height": item_instance.height,
      }
    })
    
  def edit_overlay_item(self, data : dict):
    item_instance = self.update_overlay_item(data)
    
    self.queue_broadcast({ 
      "command": "overlay_item_edited",
      "loopback": True,
      "data": {
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_type": item_instance.get_simple_type(),
        "is_displayed": item_instance.is_displayed(),
        "item_data": item_instance.to_data_dict(), 
      } 
    })
    
  def ping(self, data : dict):
    if self.owner_or_editor():
      self.queue_command("pong", {})
      self.queue_broadcast({ 
        "command": "user_present", 
        "data": {
          "username": self.user.username,
          "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        } 
      })
    else:
      self.queue_command("redirect", { "url": reverse("overlay:home") })
      
  def request_refresh(self, data : dict):
    if self.owner_or_editor():
      self.queue_broadcast({
        "command": "refresh",
        "loopback": True,
        "data": {}
      })
  
  def request_tts(self, data : dict):
    if self.owner_or_editor():
      self.queue_broadcast({
        "command": "tts",
        "loopback": True,
        "data": {
          "text": data.get("text", "")
        }
      })
      
  def send_mouse_position(self, data : dict):
    if "x" not in data or "y" not in data:
      self.queue_command("error", "Mouse reposition missing data.")
      return
    
    if self.owner_or_editor():
      self.queue_broadcast({ 
        "command": "mouse_position", 
        "data": {
          "username": self.user.username,
          "uid": None if self.overlay_user is None else self.overlay_user.identifier,
          "x": data["x"],
          "y": data["y"],
        } 
      })
      
  def send_chat_message(self, data : dict):
    if not self.owner_or_editor():
      self.queue_command("error", "Invalid user.")
      return
    
    messageObj = ChatMessage.objects.create(overlay = self.overlay, user = self.user, message = data["message"])
    
    self.queue_broadcast({
      "command": "chat_message_sent",
      "loopback": True,
      "data": {
        "username": self.user.username,
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "epoch": int(messageObj.timestamp.timestamp()),
        "message": messageObj.message,
      }
    })
    
  def get_chat_history(self):
    response = { "messages": [] }
    chat_message : ChatMessage
    for chat_message in self.overlay.chatmessage_set.order_by("-timestamp").all()[:250]:
      message_dict = {
        "username": chat_message.user.username,
        "uid": OverlayUser.objects.get(id = chat_message.user.id).overlay.identifier,
        "epoch": int(chat_message.timestamp.timestamp()),
        "message": chat_message.message,
      }
      
      response["messages"].insert(0, message_dict)
      
    self.queue_command("chat_history", response)
      
  def trigger_item_event(self, data : dict):
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
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_id": item_instance.id,
        "item_type": item_instance.get_simple_type(),
        "event": data["event"],
      } 
    })
      
  def record_canvas_event(self, data : dict):
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
      actionStr : str = data["action"]
      action : int = CanvasActionEnum.FromString(actionStr)
      action_continued = False
      
      action_data : dict = data["action_data"]
      actionObj = CanvasAction.objects.create(canvas = item_instance, user = self.user, action = action, action_data = action_data)
    elif data["event"] == "add_points":
      actionObj : CanvasAction = self.user.canvasaction_set.filter(canvas = item_instance, user = self.user).order_by("-timestamp").first()
      actionObj.action_data['points'].extend(data["points"])
      actionObj.save()
      
      action = actionObj.action
      action_continued = True
      action_data = actionObj.action_data
      action_data["points"] = data["points"]
    elif data["event"] == "undo":
      actionObj : CanvasAction = self.user.canvasaction_set.filter(canvas = item_instance, user = self.user).order_by("-timestamp").first()
      if actionObj: 
        actionObj.delete()
        
      item_instance.refresh_from_db()
      self.queue_broadcast({
        "command": "canvas_undo",
        "loopback": True,
        "data": {
          "uid": None if self.overlay_user is None else self.overlay_user.identifier,
          "item_id": item_instance.id,
          "history": item_instance.to_data_dict()["history"],
        }
      })
      return
    elif data["event"] == "clear":
      action = CanvasActionEnum.CLEAR
      action_continued = False
      action_data = {}
      
      actionObj = CanvasAction.objects.create(canvas = item_instance, user = self.user, action = action, action_data = action_data)
      
    self.queue_broadcast({ 
      "command": "canvas_action", 
      "data": {
        "uid": None if self.overlay_user is None else self.overlay_user.identifier,
        "item_id": item_instance.id,
        "action": action,
        "continue": action_continued,
        "action_data": action_data
      } 
    })
    
  def broadcast_event(self, event):
    event_data = event.get("event_data", {})
    
    command = event_data.get("command", "")
    data = event_data.get("data", {})
    
    self.send_command( command, data )
    
  def broadcast_events(self, event):
    event_list = event.get("event_list", [])
    
    overlay_user_id = None if self.overlay_user is None else self.overlay_user.identifier
    event_list = list(filter(lambda command : command.get("loopback", False) or (command.get("data", {}).get("uid", "") != overlay_user_id), event_list))
    
    if (len(event_list) > 0):
      self.send(text_data = json.dumps({ "commands": event_list }))
    
    