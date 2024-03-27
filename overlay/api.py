from typing import Any
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect, JsonResponse
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import login_required
from allauth.socialaccount.models import SocialAccount
from .forms import *
import json
import typing

User : models.Model = settings.AUTH_USER_MODEL

def get_overlay_items(request):
  if request.method != "GET":
    return JsonResponse({ "error": "Invalid request type." }, status = 501)
  
  overlay_id = request.GET.get("overlay_id", "")
  
  try:
    overlay = CollaborativeOverlay.objects.get(id = overlay_id)
  except CollaborativeOverlay.DoesNotExist:
    return JsonResponse({ "error": "Overlay does not exist." }, status = 404)
  
  overlay_items = []
  for t in ITEM_TYPES:
    overlay_items.extend(t.objects.filter(overlay_id = overlay_id))
  
  response = { "items": [] }
  for item in overlay_items:
    item_dict = {
      "item_type": item.item_type,
      "item_data": item.to_data_dict()
    }
    
    response["items"].append(item_dict)
    
  return JsonResponse(response, status = 200)
  
@login_required
def add_overlay_item(request):
  if request.method != "POST":
    return JsonResponse({ "error": "Invalid request type. "}, status = 501)
  
  json_data = json.loads(request.body)
  
  overlay_id = json_data.get("overlay_id", "")
  
  try:
    overlay = CollaborativeOverlay.objects.get(id = overlay_id)
  except CollaborativeOverlay.DoesNotExist:
    return JsonResponse({ "error": "Overlay does not exist." }, status = 404)
  
  try:
    twitchaccount = request.user.socialaccount_set.all().get(provider = "twitch")
  except SocialAccount.DoesNotExist:
    return JsonResponse({ "error": "User is does not have a Twitch account linked." }, status = 401)
  
  if not (overlay.owner.id == request.user.id):
    try:
      editormatch = overlay.owner.editor_set.all().get(twitch_id = twitchaccount.uid)
    except Editor.DoesNotExist:
      return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  item_type = json_data.get("item_type", "")
  
  if item_type == "":
    return JsonResponse({ "error": "Improperly formatted request." }, status = 400)
  
  item_model = None
  for t in ITEM_TYPES:
    type_field = t._meta.get_field("item_type")
    
    if item_type.lower() == type_field.default.lower():
      item_model = t
      break
  
  if item_model is None:
    return JsonResponse({ "error": "Unrecognized item type." }, status = 400)
  
  item_data = json_data.get("item_data", {})
  item_instance = item_model(**item_data)
  item_instance.overlay_id = overlay_id
  item_instance.save()
  
  return JsonResponse({ "error": "" }, status = 200)

@login_required
def delete_overlay_item(request):
  if request.method != "POST":
    return JsonResponse({ "error": "Invalid request type. "}, status = 501)
  
  json_data = json.loads(request.body)
  
  overlay_id = json_data.get("overlay_id", "")
  
  try:
    overlay = CollaborativeOverlay.objects.get(id = overlay_id)
  except CollaborativeOverlay.DoesNotExist:
    return JsonResponse({ "error": "Overlay does not exist." }, status = 404)
  
  try:
    twitchaccount = request.user.socialaccount_set.all().get(provider = "twitch")
  except SocialAccount.DoesNotExist:
    return JsonResponse({ "error": "User is does not have a Twitch account linked." }, status = 401)
  
  if not (overlay.owner.id == request.user.id):
    try:
      editormatch = overlay.owner.editor_set.all().get(twitch_id = twitchaccount.uid)
    except Editor.DoesNotExist:
      return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  item_type = json_data.get("item_type", "")
  item_id = json_data.get("item_id", "")
  
  if item_type == "" or item_id == "":
    return JsonResponse({ "error": "Improperly formatted request." }, status = 400)
  
  item_model = None
  for t in ITEM_TYPES:
    type_field = t._meta.get_field("item_type")
    
    if item_type.lower() == type_field.default.lower():
      item_model = t
      break
  
  if item_model is None:
    return JsonResponse({ "error": "Unrecognized item type." }, status = 400)
  
  try:
    item_instance = item_model.objects.get(id = item_id)
  except item_model.DoesNotExist:
    return JsonResponse({ "error": "That item does not exist." }, status = 404)
  
  item_instance.delete()
  
  return JsonResponse({ "error": "" }, status = 200)

@login_required
def edit_overlay_item(request):
  if request.method != "POST":
    return JsonResponse({ "error": "Invalid request type." }, status = 501)
  
  json_data = json.loads(request.body)
  
  overlay_id = json_data.get("overlay_id", "")
  item_id = json_data.get("item_id", "")
  item_type = json_data.get("item_type", "")
  
  try:
    overlay = CollaborativeOverlay.objects.get(id = overlay_id)
  except CollaborativeOverlay.DoesNotExist:
    return JsonResponse({ "error": "Overlay does not exist." }, status = 404)
  
  try:
    twitchaccount = request.user.socialaccount_set.all().get(provider = "twitch")
  except SocialAccount.DoesNotExist:
    return JsonResponse({ "error": "User is does not have a Twitch account linked." }, status = 401)
  
  if not (overlay.owner.id == request.user.id):
    try:
      editormatch = overlay.owner.editor_set.all().get(twitch_id = twitchaccount.uid)
    except Editor.DoesNotExist:
      return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  item_model = None
  for t in ITEM_TYPES:
    type_field = t._meta.get_field("item_type")
    
    if item_type.lower() == type_field.default.lower():
      item_model = t
      break
  
  if item_model is None:
    return JsonResponse({ "error": "Unrecognized item type." }, status = 400)
  
  try:
    item_instance = item_model.objects.get(id = item_id)
  except item_model.DoesNotExist:
    return JsonResponse({ "error": "That item does not exist." }, status = 404)
  
  item_data = json_data.get("item_data", {})
  for attr, val in item_data.items():
    setattr(item_instance, attr, val)
  item_instance.save()
  
  return JsonResponse({ "error": "" }, status = 200)

@login_required
def edit_overlay_items(request):
  if request.method != "POST":
    return JsonResponse({ "error": "Invalid request type." }, status = 501)
  
  json_data = json.loads(request.body)
  
  overlay_id = json_data.get("overlay_id", "")
  items = json_data.get("items", [])
  
  try:
    overlay = CollaborativeOverlay.objects.get(id = overlay_id)
  except CollaborativeOverlay.DoesNotExist:
    return JsonResponse({ "error": "Overlay does not exist." }, status = 404)
  
  try:
    twitchaccount = request.user.socialaccount_set.all().get(provider = "twitch")
  except SocialAccount.DoesNotExist:
    return JsonResponse({ "error": "User is does not have a Twitch account linked." }, status = 401)
  
  if not (overlay.owner.id == request.user.id):
    try:
      editormatch = overlay.owner.editor_set.all().get(twitch_id = twitchaccount.uid)
    except Editor.DoesNotExist:
      return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  for item in items:
    item_type = item.get("item_type", "")
    item_id = item.get("item_id", "")
    
    item_model = None
    for t in ITEM_TYPES:
      type_field = t._meta.get_field("item_type")
      
      if item_type.lower() == type_field.default.lower():
        item_model = t
        break
    
    if item_model is None:
      return JsonResponse({ "error": "Unrecognized item type." }, status = 400)
    
    try:
      item_instance = item_model.objects.get(id = item_id)
    except item_model.DoesNotExist:
      return JsonResponse({ "error": "That item does not exist." }, status = 404)
    
    item_data = item.get("item_data", {})
    for attr, val in item_data.items():
      setattr(item_instance, attr, val)
    item_instance.save()
  
  return JsonResponse({ "error": "" }, status = 200)