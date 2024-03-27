from django import forms
from .models import *
from .twitch import *

class CollaborativeOverlayForm(forms.ModelForm):
  class Meta:
    model = CollaborativeOverlay
    fields = [ "name", "description", "width", "height" ]
    
class EditorForm(forms.ModelForm):
  class Meta:
    model = Editor
    fields = [ "username" ]
    
  def __init__(self, user, action, *args, **kwargs):
    self.user = user
    self.action = action
    super().__init__(*args, **kwargs)
    
  def clean(self):
    self.cleaned_data = super(EditorForm, self).clean()
    
    data = self.cleaned_data
    user_id = get_user_id(data['username'])
    
    if user_id == None:
      raise forms.ValidationError({"username": "Twitch user does not exist."})
    else:
      if self.action == "remove":
        try:
          self.user.editor_set.get(twitch_id = user_id)
        except Editor.DoesNotExist:
          raise forms.ValidationError({ "username": "That user is not an editor." })
      
      self.cleaned_data['twitch_id'] = user_id
      self.instance.twitch_id = user_id
      return self.cleaned_data
    
class DeleteCollaborativeOverlayForm(forms.Form):
  overlay_id = forms.IntegerField()
  
  def __init__(self, user, *args, **kwargs):
    self.user = user
    super().__init__(*args, **kwargs)
    
  def clean(self):
    self.cleaned_data = super(DeleteCollaborativeOverlayForm, self).clean()
    
    data = self.cleaned_data
    
    try:
      self.user.collaborativeoverlay_set.get(pk = data['overlay_id'])
    except CollaborativeOverlay.DoesNotExist:
      raise forms.ValidationError({ "overlay_id": "There is no overlay matching that ID." })
    
class EditItemForm(forms.ModelForm):
  item_id = forms.CharField(max_length = 16, widget = forms.HiddenInput())
  overlay_id = forms.CharField(max_length = 16, widget = forms.HiddenInput())
  
  class Meta:
    abstract = True
    
class EditImageItem(EditItemForm):
  class Meta:
    model = ImageItem
    exclude = [ "overlay", "id", "item_type" ]
    
class EditTextItem(EditItemForm):
  class Meta:
    model = TextItem
    exclude = [ "overlay", "id", "item_type" ]
    
class EditCounterItem(EditItemForm):
  class Meta:
    model = CounterItem
    exclude = [ "overlay", "id", "item_type" ]
    
class AddImageItem(forms.ModelForm):
  class Meta:
    model = ImageItem
    exclude = [ "overlay", "id", "item_type" ]
    
class AddTextItem(forms.ModelForm):
  class Meta:
    model = TextItem
    exclude = [ "overlay", "id", "item_type" ]
    
class AddCounterItem(forms.ModelForm):
  class Meta:
    model = CounterItem
    exclude = [ "overlay", "id", "item_type" ]
    

FORMS_MAP = {
  "edit": {
    "ImageItem": EditImageItem,
    "TextItem": EditTextItem,
    "CounterItem": EditCounterItem,
  },
  "add": {
    "ImageItem": AddImageItem,
    "TextItem": AddTextItem,
    "CounterItem": AddCounterItem,
  }
}