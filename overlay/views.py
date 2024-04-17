import asyncio
from typing import Any
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
from django.utils.decorators import method_decorator, classonlymethod
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from allauth.socialaccount.models import SocialAccount
from channels.db import database_sync_to_async
from .forms import *
import typing

User : models.Model = settings.AUTH_USER_MODEL

# Create your views here.
class IndexView(generic.TemplateView):
  template_name = "overlay/index.html"

class ProfileView(generic.ListView):
  context_object_name = "editable_overlay_list"
  template_name="overlay/profile.html"
  
  @method_decorator(login_required)
  def dispatch(self, *args, **kwargs):
    try:
      twitchaccount = self.request.user.socialaccount_set.all().get(provider="twitch")
      return super(ProfileView, self).dispatch(*args, **kwargs)
    except:
      return HttpResponseRedirect(reverse("overlay:index"))
  
  def get_queryset(self):
    try:
      user_id = self.request.user.socialaccount_set.all().get(provider="twitch").uid
    except SocialAccount.DoesNotExist:
      return HttpResponseRedirect(reverse("overlay:index"))
        
    # get entries for the current user in the editor table
    editor_records = Editor.objects.filter(twitch_id = user_id)
    # get users who have added the current user as an editor
    editable_users = [record.owner for record in editor_records]
    
    # get overlays from those users
    editable_overlays = []
    for user in editable_users:
      editable_overlays.extend(user.collaborativeoverlay_set.all())
    
    return editable_overlays
  
class EditOverlayView(generic.DetailView):
  model = CollaborativeOverlay
  template_name = "overlay/edit.html"
  
  @method_decorator(login_required)
  def dispatch(self, *args, **kwargs):
    try:
      twitchaccount = self.request.user.socialaccount_set.all().get(provider="twitch")
    except:
      return HttpResponseRedirect(reverse("overlay:index"))
    
    overlay = self.get_object()
    if not (overlay.owner.id == self.request.user.id):
      try:
        editormatch = overlay.owner.editor_set.all().get(twitch_id = twitchaccount.uid)
      except:
        return HttpResponseRedirect(reverse("overlay:profile"))
    
    return super(EditOverlayView, self).dispatch(*args, **kwargs)
  
  def get_context_data(self, **kwargs):
    context = super(EditOverlayView, self).get_context_data(**kwargs)
    
    context['forms'] = FORMS_MAP
    context['twitchuserid'] = self.request.user.socialaccount_set.all().get(provider="twitch").uid
    
    return context
  
class ViewOverlayView(generic.DetailView):
  model = CollaborativeOverlay
  template_name = "overlay/view.html"

def view_overlay(request, pk):
  try:
    overlay = CollaborativeOverlay.objects.get(id = pk)
  except CollaborativeOverlay.DoesNotExist:
    return Http404("Overlay does not exist.")
  
  return render(request, "overlay/view.html", { "collaborativeoverlay": overlay })
  
@login_required
def add_editor(request):
  form = EditorForm(request.user, "add")
  if request.method == "POST":
    form = EditorForm(request.user, "add", request.POST)
    
    if form.is_valid():
      editor = form.save(commit = False)
      
      editor.owner = request.user
      editor.save()
      
      return HttpResponseRedirect(reverse("overlay:profile"))
  return render(request, "overlay/editor.html", { "form": form, "action": "add" })
  
@login_required
def remove_editor(request):
  form = EditorForm(request.user, "remove")
  if request.method == "POST":
    form = EditorForm(request.user, "remove", request.POST)
    
    if form.is_valid():
      editor = form.save(commit = False)
      
      try:
        instance = request.user.editor_set.get(twitch_id = editor.twitch_id)
      except Editor.DoesNotExist:
        logging.error("Somehow editor does not exist even though we validated.")
        return render(request, "overlay/editor.html", { "form": form, "action": "remove" })
      
      instance.delete()
      
      return HttpResponseRedirect(reverse("overlay:profile"))
    else:
      return render(request, "overlay/editor.html", { "form": form, "action": "remove"})
    
  return render(request, "overlay/editor.html", { "form": form, "action": "remove" })
  
@login_required
def create_overlay(request):
  form = CollaborativeOverlayForm()
  if request.method == "POST":
    form = CollaborativeOverlayForm(request.POST)
    
    if form.is_valid():
      overlay = form.save(commit = False)
      
      overlay.owner = request.user
      overlay.save()
      
      return HttpResponseRedirect(reverse("overlay:profile"))
    
  return render(request, "overlay/overlay.html", { "form": form, "action": "create" })

@login_required
def delete_overlay(request):
  form = DeleteCollaborativeOverlayForm(request.user)
  if request.method == "POST":
    form = DeleteCollaborativeOverlayForm(request.user, request.POST)
    
    try:
      overlay = request.user.collaborativeoverlay_set.get(pk = request.POST["overlay_id"])
      overlay.delete()
    except:
      form.add_error("overlay_id", "That overlay does not exist.")
      return render(request, "overlay/overlay.html", { "form": form, "action": "delete" })
      
    return HttpResponseRedirect(reverse("overlay:profile"))
  return render(request, "overlay/overlay.html", { "form": form, "action": "delete" })