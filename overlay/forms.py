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
    

BASE_WIDGETS = {
  'name': forms.TextInput(attrs={ "field-type": "text" }),
  'x': forms.NumberInput(attrs={ "field-type": "integer" }),
  'y': forms.NumberInput(attrs={ "field-type": "integer" }),
  'z': forms.NumberInput(attrs={ "field-type": "integer" }),
  'width': forms.NumberInput(attrs={ "field-type": "integer" }),
  'height': forms.NumberInput(attrs={ "field-type": "integer" }),
  'rotation': forms.NumberInput(attrs={ "field-type": "float" }),
  'visible': forms.CheckboxInput(attrs={ "field-type": "boolean" }),
  'minimized': forms.CheckboxInput(attrs={ "field-type": "boolean" }),
}

FONT_CHOICES = (
  ("Roboto Mono", "Roboto Mono"),
  ("EB Garamond", "EB Garamond"),
  ("Playfair Display", "Playfair Display"),
  ("Open Sans", "Open Sans"),
  ("Roboto", "Roboto"),
  ("Ubuntu", "Ubuntu"),
  ("Tangerine", "Tangerine"),
  ("Dancing Script", "Dancing Script"),
  ("Permanent Marker", "Permanent Marker"),
  ("Nabla", "Nabla"),
  ("Honk", "Honk"),
  ("Bungee Spice", "Bungee Spice"),
  ("Runescape", "Runescape")
)

BASE_TEXT_WIDGETS = {
  'font': forms.Select(attrs={ "field-type": "text" }),
  'font_size': forms.NumberInput(attrs={ "field-type": "integer" }),
  'color': forms.TextInput(attrs={ "field-type": "text" }),
  'background': forms.TextInput(attrs={ "field-type": "text" }),
  'background_enabled': forms.CheckboxInput(attrs={ "field-type": "boolean" }),
}
    
class EditItemForm(forms.ModelForm):
  item_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  overlay_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
    
class EditImageItem(EditItemForm):
  def get_pretty_name(self):
    return "Image"
  
  class Meta:
    model = ImageItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'url': forms.Textarea(attrs={ "field-type": "text" }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AbstractEditText(EditItemForm):
  font = forms.ChoiceField(choices = FONT_CHOICES)
  
  class Meta:
    abstract = True
    
class EditTextItem(AbstractEditText):
  def get_pretty_name(self):
    return "Text"
  
  class Meta:
    model = TextItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'text': forms.Textarea(attrs={ "field-type": "text" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class EditStopwatchItem(AbstractEditText):
  def get_pretty_name(self):
    return "Stopwatch"
  
  class Meta:
    model = StopwatchItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'timer_format': forms.Textarea(attrs={ "field-type": "text" }),
      'timer_start': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'pause_time': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'paused': forms.HiddenInput(attrs={ "field-type": "boolean" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class EditCounterItem(AbstractEditText):
  def get_pretty_name(self):
    return "Counter"
  
  class Meta:
    model = CounterItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'counter_format': forms.Textarea(attrs={ "field-type": "text" }),
      'count': forms.NumberInput(attrs={ "field-type": "integer" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddItemForm(forms.ModelForm):
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
    
class AddImageItem(AddItemForm):
  def get_pretty_name(self):
    return "Image"
  
  class Meta:
    model = ImageItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'url': forms.Textarea(attrs={ "field-type": "text" }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AbstractAddText(AddItemForm):
  font = forms.ChoiceField(choices = FONT_CHOICES)
  
  class Meta:
    abstract = True
  
    
class AddTextItem(AbstractAddText):
  def get_pretty_name(self):
    return "Text"
  
  class Meta:
    model = TextItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'text': forms.Textarea(attrs={ "field-type": "text" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddStopwatchItem(AbstractAddText):
  def get_pretty_name(self):
    return "Stopwatch"
  
  class Meta:
    model = StopwatchItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'timer_format': forms.Textarea(attrs={ "field-type": "text" }),
      'timer_start': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'pause_time': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'paused': forms.CheckboxInput(attrs={ "field-type": "boolean" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddCounterItem(AbstractAddText):
  def get_pretty_name(self):
    return "Counter"
  
  class Meta:
    model = CounterItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'counter_format': forms.Textarea(attrs={ "field-type": "text" }),
      'count': forms.NumberInput(attrs={ "field-type": "integer" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    

FORMS_MAP = {
  "edit": {
    "ImageItem": EditImageItem,
    "TextItem": EditTextItem,
    "StopwatchItem": EditStopwatchItem,
    "CounterItem": EditCounterItem,
  },
  "add": {
    "ImageItem": AddImageItem,
    "TextItem": AddTextItem,
    "StopwatchItem": AddStopwatchItem,
    "CounterItem": AddCounterItem,
  }
}