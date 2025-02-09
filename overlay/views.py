import asyncio
from typing import Any
from django.db.models.query import QuerySet
from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.views import generic
from django.conf import settings
from django.utils.decorators import method_decorator, classonlymethod
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from channels.db import database_sync_to_async
from .forms import *
import typing
import markdown

logger = logging.getLogger("overlay")

MARKDOWN = markdown.Markdown(extensions = [ "fenced_code" ])

# Create your views here.
class HomeView(generic.TemplateView):
  @method_decorator(login_required)
  def post(self, request, **kwargs):
    action = request.POST.get("action", "")
    
    if action == "delete_overlay":
      form = DeleteCollaborativeOverlayForm(request.user, request.POST)
      
      try:
        overlay = request.user.collaborativeoverlay_set.get(pk = request.POST["overlay_id"])
        overlay.delete()
      except:
        form.add_error("overlay_id", "That overlay does not exist.")
        return render(request, reverse("overlay:home"), { "delete_overlay_form": form })
        
      return HttpResponseRedirect(reverse("overlay:home"))
    
  def get_template_names(self):
    if (self.request.user.is_authenticated):
      return [ "overlay/userhome.html" ]
    else:
      return [ "overlay/home.html" ]
  
  def get_context_data(self, **kwargs) -> dict[str, Any]:
    context = super(HomeView, self).get_context_data(**kwargs)
    
    editable_users = set()
    
    try:
      twitch_uid = self.request.user.socialaccount_set.all().get(provider="twitch").uid
      # get entries for the current user in the editor table
      editor_records = Editor.objects.filter(id_type = 0, identifier = twitch_uid)
      # get users who have added the current user as an editor
      editable_users.update([record.owner for record in editor_records])
    except:
      pass
    
    try:
      for email_address in self.request.user.emailaddress_set.filter(verified = True).all():
        editor_records = Editor.objects.filter(id_type = 1, identifier = email_address.email)
        editable_users.update([record.owner for record in editor_records])
    except:
      pass
    
    try:
      identifier = OverlayUser.objects.get(id = self.request.user.id).overlay.identifier
      editor_records = Editor.objects.filter(id_type = 2, identifier = identifier)
      editable_users.update([record.owner for record in editor_records])
    except:
      pass
    
    # get overlays from those users
    editable_overlays = []
    for user in editable_users:
      editable_overlays.extend(user.collaborativeoverlay_set.all())
    
    context["editable_overlay_list"] = editable_overlays
    
    return context
    
class ProfileView(generic.TemplateView):
  template_name="overlay/profile.html"
  
  @method_decorator(login_required)
  def get(self, request, **kwargs):
    return super(ProfileView, self).get(request, **kwargs)
    
  @method_decorator(login_required)
  def post(self, request, **kwargs):
    action = request.POST.get("action", "")
    
    try:
      overlay_identifier = OverlayUser.objects.get(id = self.request.user.id).overlay.identifier
    except OverlayUser.DoesNotExist:
      overlay_identifier = "ERROR"
    
    if action == "remove_editor":
      remove_editor_form = EditorForm(request.user, "remove", request.POST)
    
      if remove_editor_form.is_valid():
        editor = remove_editor_form.save(commit = False)
        
        try:
          instance = request.user.editor_set.get(identifier = editor.identifier)
        except Editor.DoesNotExist:
          logger.error("Somehow editor does not exist even though we validated.")
          return render(request, "overlay/profile.html", { 'overlay_identifier': overlay_identifier, "add_editor_form": EditorForm(request.user, "add"), "remove_editor_form": remove_editor_form})
        
        instance.delete()
        return render(request, "overlay/profile.html", { 'overlay_identifier': overlay_identifier, "add_editor_form": EditorForm(request.user, "add"), "remove_editor_form": remove_editor_form})
      else:
        return render(request, "overlay/profile.html", { 'overlay_identifier': overlay_identifier, "add_editor_form": EditorForm(request.user, "add"), "remove_editor_form": remove_editor_form})
    elif action == "add_editor":
      add_editor_form = EditorForm(request.user, "add", request.POST)
      
      if add_editor_form.is_valid():
        editor = add_editor_form.save(commit = False)
        
        editor.owner = request.user
        editor.save()
        
      return render(request, "overlay/profile.html", { 'overlay_identifier': overlay_identifier, "add_editor_form": add_editor_form, "remove_editor_form": EditorForm(request.user, "remove")})
  
  def get_context_data(self, **kwargs):
    context = super(ProfileView, self).get_context_data(**kwargs)
    
    try:
      context['overlay_identifier'] = OverlayUser.objects.get(id = self.request.user.id).overlay.identifier
    except OverlayUser.DoesNotExist:
      context['overlay_identifier'] = "ERROR"
    context['add_editor_form'] = EditorForm(self.request.user, "add")
    context['remove_editor_form'] = EditorForm(self.request.user, "remove")
  
    return context
  
class ChangeLogView(generic.ListView):
  context_object_name = "change_log"
  template_name = "overlay/changelog.html"
  
  def get_queryset(self) -> QuerySet[Any]:
    change_log = []
    
    for entry in ChangeLogEntry.objects.order_by("-date").all():
      log = { "title": entry.title, "description":MARKDOWN.convert(entry.description), "date": entry.date.strftime("%Y/%m/%d") }
      
      change_log.append(log)
      
    return change_log
  
class EditOverlayView(generic.DetailView):
  model = CollaborativeOverlay
  template_name = "overlay/edit.html"
  
  @method_decorator(login_required)
  def dispatch(self, *args, **kwargs):
    overlay = self.get_object()
    if (overlay.owner.id == self.request.user.id):    
      return super(EditOverlayView, self).dispatch(*args, **kwargs)
    else:
      try:
        editormatch = overlay.owner.editor_set.get(id_type = 0, identifier = twitchaccount.uid)
        return super(EditOverlayView, self).dispatch(*args, **kwargs)
      except:
        pass
      
      for email_address in self.request.user.emailaddress_set.filter(verified = True).all():
        try:
          editormatch = overlay.owner.editor_set.get(id_type = 1, identifier = email_address.email)
          return super(EditOverlayView, self).dispatch(*args, **kwargs)
        except:
          pass
      
      try:
        editormatch = overlay.owner.editor_set.get(id_type = 2, identifier = OverlayUser.objects.get(id = self.request.user.id).overlay.identifier)
        return super(EditOverlayView, self).dispatch(*args, **kwargs)
      except:
        pass
    
      return HttpResponseRedirect(reverse("overlay:home"))
  
  def get_context_data(self, **kwargs):
    context = super(EditOverlayView, self).get_context_data(**kwargs)
    
    context['item_types'] = ITEM_TYPES
    context['forms'] = FORMS_MAP
    context['twitchuserid'] = self.request.user.socialaccount_set.all().get(provider="twitch").uid
    
    return context

def view_overlay(request, pk):
  try:
    overlay = CollaborativeOverlay.objects.get(id = pk)
  except CollaborativeOverlay.DoesNotExist:
    return Http404("Overlay does not exist.")
  
  return render(request, "overlay/view.html", { "collaborativeoverlay": overlay })
  
@login_required
def create_overlay(request):
  form = CollaborativeOverlayForm()
  if request.method == "POST":
    form = CollaborativeOverlayForm(request.POST)
    
    if form.is_valid():
      overlay = form.save(commit = False)
      
      overlay.owner = request.user
      overlay.save()
      
      return HttpResponseRedirect(reverse("overlay:home"))
    
  return render(request, "overlay/createoverlay.html", { "form": form, "action": "create" })