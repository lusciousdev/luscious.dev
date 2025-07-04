from typing import Any
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect, JsonResponse, HttpRequest
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import login_required
from allauth.socialaccount.models import SocialAccount
from django.core.exceptions import FieldDoesNotExist
from .forms import *
import json
import typing

logger = logging.getLogger("overlay")

User : models.Model = settings.AUTH_USER_MODEL
  
def owner_or_editor(overlay : CollaborativeOverlay, user):
  if user.is_anonymous:
    return False
  
  overlay_user_id = OverlayUser.objects.get(id = user.id).overlay.identifier
  
  if overlay.owner.id == user.id:
    return True
  
  try:
    twitchaccount = user.socialaccount_set.get(provider="twitch")
    editormatch = overlay.owner.editor_set.get(id_type = 0, identifier = twitchaccount.uid)
    return True
  except Exception as e:
    pass
    
  for email_address in user.emailaddress_set.filter(verified = True).all():
    try:
      editormatch = overlay.owner.editor_set.get(id_type = 1, identifier = email_address.email)
      return True
    except:
      pass
    
  try:
    editormatch = overlay.owner.editor_set.get(id_type = 2, identifier = overlay_user_id)
    return True
  except:
    pass
  
  return False

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
      "item_type": item.get_simple_type(),
      "is_displayed": item.is_displayed(),
      "item_data": item.to_data_dict()
    }
    
    response["items"].append(item_dict)
    
  return JsonResponse(response, status = 200)
  
@login_required
def add_overlay_item(request : HttpRequest):
  if request.method != "POST":
    return JsonResponse({ "error": "Invalid request type. "}, status = 501)
  
  overlay_id = request.POST.get("overlay_id", "")
  
  try:
    overlay = CollaborativeOverlay.objects.get(id = overlay_id)
  except CollaborativeOverlay.DoesNotExist:
    return JsonResponse({ "error": "Overlay does not exist." }, status = 404)
  
  if not owner_or_editor(overlay, request.user):
    return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  item_type = request.POST.get("item_type", "")
  
  if item_type == "":
    return JsonResponse({ "error": "Improperly formatted request." }, status = 400)
  
  item_model = None
  for t in ITEM_TYPES:
    type_name = t.get_simple_type()
    
    if item_type.lower() == type_name.lower():
      item_model = t
      break
  
  if item_model is None:
    return JsonResponse({ "error": "Unrecognized item type." }, status = 400)
  
  
  item_instance = item_model()
 
  for attr, val in request.POST.items():
    try:
      fieldtype = item_model._meta.get_field(attr).get_internal_type()
      if fieldtype == "BooleanField":
        val = (val.lower() in ['true', '1', 'yes', 't', 'y'])
      elif fieldtype == "DateTimeField":
        val = datetime.datetime.strptime(val, "%Y-%m-%dT%H:%M:%SZ")
      setattr(item_instance, attr, val)
    except FieldDoesNotExist:
      continue
  
  for attr, val in request.FILES.items():
    try:
      field = item_model._meta.get_field(attr)
      setattr(item_instance, attr, val)
    except FieldDoesNotExist:
      continue
    
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
  
  if not owner_or_editor(overlay, request.user):
    return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  item_type = json_data.get("item_type", "")
  item_id = json_data.get("item_id", "")
  
  if item_type == "" or item_id == "":
    return JsonResponse({ "error": "Improperly formatted request." }, status = 400)
  
  item_model = None
  for t in ITEM_TYPES:
    type_name = t.get_simple_type()
    
    if item_type.lower() == type_name.lower():
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
def edit_overlay_item(request : HttpRequest):
  if request.method != "POST":
    return JsonResponse({ "error": "Invalid request type." }, status = 501)
  
  overlay_id = request.POST.get("overlay_id", "")
  item_id = request.POST.get("item_id", "")
  item_type = request.POST.get("item_type", "")
  
  try:
    overlay = CollaborativeOverlay.objects.get(id = overlay_id)
  except CollaborativeOverlay.DoesNotExist:
    return JsonResponse({ "error": "Overlay does not exist." }, status = 404)
  
  if not owner_or_editor(overlay, request.user):
    return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  item_model = None
  for t in ITEM_TYPES:
    type_name = t.get_simple_type()
    
    if item_type.lower() == type_name.lower():
      item_model = t
      break
  
  if item_model is None:
    return JsonResponse({ "error": "Unrecognized item type." }, status = 400)
  
  try:
    item_instance = item_model.objects.get(id = item_id)
  except item_model.DoesNotExist:
    return JsonResponse({ "error": "That item does not exist." }, status = 404)
  
  for attr, val in request.POST.items():
    try:
      fieldtype = item_model._meta.get_field(attr).get_internal_type()
      val = val if fieldtype != "BooleanField" else (val.lower() in ['true', '1', 'yes', 't', 'y'])
      setattr(item_instance, attr, val)
    except FieldDoesNotExist:
      continue
  
  for attr, val in request.FILES.items():
    try:
      field = item_model._meta.get_field(attr)
      setattr(item_instance, attr, val)
    except FieldDoesNotExist:
      continue
  
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
  
  if not owner_or_editor(overlay, request.user):
    return JsonResponse({ "error": "User is not an editor for the owner of this overlay." }, status = 401)
    
  for item in items:
    item_type = item.get("item_type", "")
    item_id = item.get("item_id", "")
    
    item_model = None
    for t in ITEM_TYPES:
      type_name = t.get_simple_type()
      
      if item_type.lower() == type_name.lower():
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