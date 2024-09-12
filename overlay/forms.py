from django import forms
from .models import *
from .twitch import *

logger = logging.getLogger("overlay")

class RangeInput(forms.NumberInput):
  input_type = 'range'

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

VISIBILITY_CHOICES = (
  (0, "Hidden"),
  (1, "Visible to editors"),
  (2, "Visible"),
)

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

FONT_WEIGHTS = (
  ("normal", "normal"),
  ("bold", "bold"),
  ("100", "100"),
  ("200", "200"),
  ("300", "300"),
  ("400", "400"),
  ("500", "500"),
  ("600", "600"),
  ("700", "700"),
  ("800", "800"),
  ("900", "900"),
  ("1000", "1000"),
)

TEXT_ALIGNMENTS = (
  ("left", "left"),
  ("right", "right"),
  ("center", "center"),
  ("justify", "justify"),
)

SCROLL_DIRECTIONS = (
  (0, "None"),
  (1, "Left to right"),
  (2, "Right to left"),
  (3, "Top to bottom"),
  (4, "Bottom to top"),
)
    

BASE_WIDGETS = {
  'name': forms.TextInput(attrs={ "field-type": "text", 'size': 40 }),
  'x': forms.NumberInput(attrs={ "field-type": "integer", 'size': 40 }),
  'y': forms.NumberInput(attrs={ "field-type": "integer", 'size': 40 }),
  'z': forms.NumberInput(attrs={ "field-type": "integer", 'size': 40 }),
  'width': forms.NumberInput(attrs={ "field-type": "integer", 'size': 40 }),
  'height': forms.NumberInput(attrs={ "field-type": "integer", 'size': 40 }),
  'rotation': forms.NumberInput(attrs={ "field-type": "float", 'size': 40 }),
  'opacity': RangeInput(attrs = { "field-type": "float", "min": "0.0", "max": "100.0" }),
  'visibility': forms.Select(attrs={ "field-type": "integer" }),
  'minimized': forms.CheckboxInput(attrs={ "field-type": "boolean" }),
  'crop_top': forms.NumberInput(attrs={ "field-type": "float", 'size': 40 }),
  'crop_bottom': forms.NumberInput(attrs={ "field-type": "float", 'size': 40 }),
  'crop_left': forms.NumberInput(attrs={ "field-type": "float", 'size': 40 }),
  'crop_right': forms.NumberInput(attrs={ "field-type": "float", 'size': 40 }),
  'scroll_direction': forms.Select(attrs = { "field-type": "integer" }),
  'scroll_duration': forms.NumberInput(attrs={ "field-type": "float", 'size': 40 }),
}

BASE_WIDGET_ORDER = [
  'name',
  'x',
  'y',
  'z',
  'width',
  'height',
  'rotation',
  'crop_top',
  'crop_left',
  'crop_bottom',
  'crop_right',
  'visibility',
  'minimized',
  'opacity',
  'scroll_direction',
  'scroll_duration',
]

BASE_TEXT_WIDGETS = {
  'font': forms.Select(attrs = { "field-type": "text" }),
  'font_size': forms.NumberInput(attrs = { "field-type": "integer", 'size': 40 }),
  'font_weight': forms.Select(attrs = { "field-type": "text" }),
  'color': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
  'drop_shadow_enabled': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
  'drop_shadow_offset_x': forms.NumberInput(attrs = { "field-type": "float", 'size': 40, "tabindex": 1 }),
  'drop_shadow_offset_y': forms.NumberInput(attrs = { "field-type": "float", 'size': 40, "tabindex": 1 }),
  'drop_shadow_blur_radius': forms.NumberInput(attrs = { "field-type": "float", 'size': 40, "tabindex": 1 }),
  'drop_shadow_color': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
  'text_outline_enabled': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
  'text_outline_width': forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }),
  'text_outline_color': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
  'background_enabled': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
  'background_color': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
  'text_alignment': forms.Select(attrs = { "field-type": "text" })
}

BASE_TEXT_WIDGET_ORDER = [
  'font',
  'font_size',
  'font_weight',
  'text_alignment',
  'color',
  'drop_shadow_enabled',
  'drop_shadow_offset_x',
  'drop_shadow_offset_y',
  'drop_shadow_blur_radius',
  'drop_shadow_color',
  'text_outline_enabled',
  'text_outline_width',
  'text_outline_color',
  'background_enabled',
  'background_color',
]
    
class EditItemForm(forms.ModelForm):
  item_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  overlay_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  
  visibility = forms.ChoiceField(choices = VISIBILITY_CHOICES)
  scroll_direction = forms.ChoiceField(choices = SCROLL_DIRECTIONS)
  
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
    
class EditImageItem(EditItemForm):
  image_url = forms.CharField(max_length = 512, widget = forms.TextInput(attrs = { "field-type": "text", 'readonly': 'readonly', 'size': 40 }), label = "Uploaded Image URL")
  
  field_order = BASE_WIDGET_ORDER
  field_order.extend(["image", "image_url", "url"])
  
  class Meta:
    model = ImageItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'url': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
      'image': forms.ClearableFileInput(attrs={ "field-type": "file" }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class EditEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    model = EmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'embed_url': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class EditYouTubeEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    model = YouTubeEmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'video_id': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
      'start_time': forms.NumberInput(attrs = { "field-type": "integer", 'size': 40 }),
      'paused': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'muted': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'volume': RangeInput(attrs = { "field-type": "integer", "min": 0, "max": 100 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class EditTwitchStreamEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    model = TwitchStreamEmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'channel': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
      'paused': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'muted': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'volume': RangeInput(attrs = { "field-type": "integer", "min": 0, "max": 100 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class EditTwitchVideoEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    model = TwitchVideoEmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'video_id': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
      'start_time': forms.NumberInput(attrs = { "field-type": "integer", 'size': 40 }),
      'paused': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'muted': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'volume': RangeInput(attrs = { "field-type": "integer", "min": 0, "max": 100 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AbstractEditText(EditItemForm):
  font = forms.ChoiceField(choices = FONT_CHOICES)
  font_weight = forms.ChoiceField(choices = FONT_WEIGHTS)
  text_alignment = forms.ChoiceField(choices = TEXT_ALIGNMENTS)
  
  drop_shadow_offset_x    = forms.DecimalField(label = "Drop shadow X",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  drop_shadow_offset_y    = forms.DecimalField(label = "Drop shadow Y",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  drop_shadow_blur_radius = forms.DecimalField(label = "Drop shadow blur", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  
  text_outline_width = forms.DecimalField(label = "Text outline width", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
  class Meta:
    abstract = True
    
class EditTextItem(AbstractEditText):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
  class Meta:
    model = TextItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'text': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class EditStopwatchItem(AbstractEditText):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
  class Meta:
    model = StopwatchItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = {
      'timer_format': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
      'timer_start': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'pause_time': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'paused': forms.HiddenInput(attrs={ "field-type": "boolean" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class EditCounterItem(AbstractEditText):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
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
  visibility = forms.ChoiceField(choices = VISIBILITY_CHOICES)
  scroll_direction = forms.ChoiceField(choices = SCROLL_DIRECTIONS)
  
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
    
class AddImageItem(AddItemForm):
  class Meta:
    model = ImageItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'url': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
      'image': forms.ClearableFileInput(attrs={ "field-type": "file" }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AddEmbedItem(AddItemForm):
  class Meta:
    model = EmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'embed_url': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AddYouTubeEmbedItem(AddItemForm):
  class Meta:
    model = YouTubeEmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'video_id': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
      'start_time': forms.NumberInput(attrs = { "field-type": "integer", 'size': 40 }),
      'paused': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'muted': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'volume': RangeInput(attrs = { "field-type": "integer", "min": 0, "max": 100 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AddTwitchStreamEmbedItem(AddItemForm):
  class Meta:
    model = TwitchStreamEmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'channel': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
      'paused': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'muted': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'volume': RangeInput(attrs = { "field-type": "integer", "min": 0, "max": 100 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AddTwitchVideoEmbedItem(AddItemForm):
  class Meta:
    model = TwitchVideoEmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'video_id': forms.TextInput(attrs = { "field-type": "text", 'size': 40 }),
      'start_time': forms.NumberInput(attrs = { "field-type": "integer", 'size': 40 }),
      'paused': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'muted': forms.CheckboxInput(attrs = { "field-type": "boolean" }),
      'volume': RangeInput(attrs = { "field-type": "integer", "min": 0, "max": 100 }),
    }
    
    widgets.update(BASE_WIDGETS)
    
class AbstractAddText(AddItemForm):
  font = forms.ChoiceField(choices = FONT_CHOICES)
  font_weight = forms.ChoiceField(choices = FONT_WEIGHTS)
  text_alignment = forms.ChoiceField(choices = TEXT_ALIGNMENTS)
  
  drop_shadow_offset_x    = forms.DecimalField(label = "Drop shadow X",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  drop_shadow_offset_y    = forms.DecimalField(label = "Drop shadow Y",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  drop_shadow_blur_radius = forms.DecimalField(label = "Drop shadow Blur", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  
  text_outline_width = forms.DecimalField(label = "Text outline width", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", 'size': 40 }))
  
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
  class Meta:
    abstract = True
  
    
class AddTextItem(AbstractAddText):
  class Meta:
    model = TextItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'text': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddStopwatchItem(AbstractAddText):
  class Meta:
    model = StopwatchItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'timer_format': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
      'timer_start': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'pause_time': forms.HiddenInput(attrs={ "field-type": "integer" }),
      'paused': forms.CheckboxInput(attrs={ "field-type": "boolean" }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddCounterItem(AbstractAddText):
  class Meta:
    model = CounterItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = {
      'counter_format': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'columns': 40 }),
      'count': forms.NumberInput(attrs={ "field-type": "integer", 'size': 40 }),
    }
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    

FORMS_MAP = {
  "edit": {
    "ImageItem": EditImageItem,
    "EmbedItem": EditEmbedItem,
    "YouTubeEmbedItem": EditYouTubeEmbedItem,
    "TwitchStreamEmbedItem": EditTwitchStreamEmbedItem,
    "TwitchVideoEmbedItem": EditTwitchVideoEmbedItem,
    "TextItem": EditTextItem,
    "StopwatchItem": EditStopwatchItem,
    "CounterItem": EditCounterItem,
  },
  "add": {
    "ImageItem": AddImageItem,
    "EmbedItem": AddEmbedItem,
    "YouTubeEmbedItem": AddYouTubeEmbedItem,
    "TwitchStreamEmbedItem": AddTwitchStreamEmbedItem,
    "TwitchVideoEmbedItem": AddTwitchVideoEmbedItem,
    "TextItem": AddTextItem,
    "StopwatchItem": AddStopwatchItem,
    "CounterItem": AddCounterItem,
  }
}