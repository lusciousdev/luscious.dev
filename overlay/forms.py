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
  'name': forms.TextInput(attrs={ "field-type": "text", "title": "Item name" }),
  'x': forms.NumberInput(attrs={ "field-type": "integer", "title": "X offset" }),
  'y': forms.NumberInput(attrs={ "field-type": "integer", "title": "Y offset" }),
  'z': forms.NumberInput(attrs={ "field-type": "integer", "title": "Z index. Higher Z appears on top of lower." }),
  'width': forms.NumberInput(attrs={ "field-type": "integer", "title": "Item width" }),
  'height': forms.NumberInput(attrs={ "field-type": "integer", "title": "Item height" }),
  'rotation': forms.NumberInput(attrs={ "field-type": "float", "title": "Item rotation (degrees)" }),
  'opacity': RangeInput(attrs = { "field-type": "float", "min": "0.0", "max": "100.0", 'title': "Item opacity" }),
  'visibility': forms.Select(attrs={ "field-type": "integer", "title": "Item visibility" }),
  'minimized': forms.CheckboxInput(attrs={ "field-type": "boolean", "title": "Completely hide from editors and overlay." }),
  'view_lock': forms.CheckboxInput(attrs={ "field-type": "boolean", "title": "Item will not update on the overlay until unchecked." }),
  'crop_top': forms.NumberInput(attrs={ "field-type": "float", "title": "Crop percentage (from the top down)" }),
  'crop_bottom': forms.NumberInput(attrs={ "field-type": "float", "title": "Crop percentage (from the bottom up)" }),
  'crop_left': forms.NumberInput(attrs={ "field-type": "float", "title": "Crop percentage (from left to right)" }),
  'crop_right': forms.NumberInput(attrs={ "field-type": "float", "title": "Crop percentage (from right to left)" }),
  'scroll_direction': forms.Select(attrs = { "field-type": "integer", "title": "Scroll direction" }),
  'scroll_duration': forms.NumberInput(attrs={ "field-type": "float", "title": "Scroll duration" }),
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
  'view_lock',
  'opacity',
  'scroll_direction',
  'scroll_duration',
]

BASE_TEXT_WIDGETS = {
  'font': forms.Select(attrs = { "field-type": "text", 'title': "Font" }),
  'font_size': forms.NumberInput(attrs = { "field-type": "integer", 'title': "Font size" }),
  'font_weight': forms.Select(attrs = { "field-type": "text", 'title': "Font weight" }),
  'color': forms.TextInput(attrs = { "field-type": "text", "title": "Text color" }),
  'drop_shadow_enabled': forms.CheckboxInput(attrs = { "field-type": "boolean", 'title': "Enable drop shadow" }),
  'drop_shadow_offset_x': forms.NumberInput(attrs = { "field-type": "float", "tabindex": 1, 'title': "Drop shadow X offset" }),
  'drop_shadow_offset_y': forms.NumberInput(attrs = { "field-type": "float", "tabindex": 1, "title": "Drop shadow Y offset" }),
  'drop_shadow_blur_radius': forms.NumberInput(attrs = { "field-type": "float", "tabindex": 1, 'title': 'Drop shadow blur radius' }),
  'drop_shadow_color': forms.TextInput(attrs = { "field-type": "text", 'title': "Drop shadow color" }),
  'text_outline_enabled': forms.CheckboxInput(attrs = { "field-type": "boolean", 'title': "Enable text outline" }),
  'text_outline_width': forms.NumberInput(attrs = { "field-type": "float", 'title': "Text outline width" }),
  'text_outline_color': forms.TextInput(attrs = { "field-type": "text", 'title': "Text outline color" }),
  'background_enabled': forms.CheckboxInput(attrs = { "field-type": "boolean", 'title': 'Enable background' }),
  'background_color': forms.TextInput(attrs = { "field-type": "text", 'title': "Background color" }),
  'text_alignment': forms.Select(attrs = { "field-type": "text", 'title': "Text alignment" })
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

BASE_VIDEO_WIDGETS = {
  'paused': forms.CheckboxInput(attrs = { "field-type": "boolean", "title": "Paused" }),
  'muted': forms.CheckboxInput(attrs = { "field-type": "boolean", "title": "Muted" }),
  'volume': RangeInput(attrs = { "field-type": "integer", "min": 0, "max": 100, "title": "Volume" }),
}

BASE_VIDEO_WIDGET_ORDER = [
  "paused",
  "muted",
  "volume",
]

IMAGE_WIDGETS = {
  'url': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, "title": "Image URL. If you uploaded your own image, make sure this field is empty!" }),
  'image': forms.ClearableFileInput(attrs={ "field-type": "file", "title": "Upload an image. Max file size: 25MB" }),
}

AUDIO_WIDGETS = {
  'audio': forms.FileInput(attrs={ "field-type": "file", "title": "Upload an audio file. Max file size: 25MB", "accept": "audio/*,video/*" }),
  'volume': RangeInput(attrs = { "field-type": "float", "min": "0.0", "max": "100.0", 'title': "Volume" }),
}

EMBED_WIDGETS = {
  'embed_url': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, "title": "Embed URL" }),
}

YOUTUBE_VIDEO_WIDGETS = {
  'video_id': forms.TextInput(attrs = { "field-type": "text", "title": "YouTube Video ID (https://www.youtube.com/watch?v=<THIS PART>)" }),
  'start_time': forms.NumberInput(attrs = { "field-type": "integer", "title": "Video start time (hit reset to seek to this time)" }),
}

TWITCH_STREAM_WIDGETS = {
  'channel': forms.TextInput(attrs = { "field-type": "text", "title": "Twitch channel name (i.e. itswill)" }),
}

TWITCH_VIDEO_WIDGETS = {
  'video_id': forms.TextInput(attrs = { "field-type": "text", "title": "Twitch Video ID" }),
  'start_time': forms.NumberInput(attrs = { "field-type": "integer", "title": "Video start time (hit reset to seek to this time)" }),
}

TEXT_WIDGETS = {
  'text': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, "title": "Text" }),
}

STOPWATCH_WIDGETS = {
  'timer_format': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'title': "Must include {0} as this gets replaced with the timer." }),
  'timer_start': forms.HiddenInput(attrs={ "field-type": "integer" }),
  'pause_time': forms.HiddenInput(attrs={ "field-type": "integer" }),
  'paused': forms.HiddenInput(attrs={ "field-type": "boolean", "title": "Paused" }),
}

COUNTER_WIDGETS = {
  'counter_format': forms.Textarea(attrs={ "field-type": "text", 'rows': 3, 'title': "Must include {0} as this gets replaced with the timer." }),
  'count': forms.NumberInput(attrs={ "field-type": "integer", "title": "Count" }),
}

NO_DISPLAY_ITEM_EXCLUDES = [
  "x",
  "y",
  "z",
  "width",
  "height",
  "rotation",
  "opacity",
  "visibility",
  "minimized",
  "view_lock",
  "scroll_direction",
  "scroll_duration",
  "crop_top",
  "crop_bottom",
  "crop_left",
  "crop_right",
]
    
class EditItemForm(forms.ModelForm):
  item_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  overlay_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  
  visibility = forms.ChoiceField(choices = VISIBILITY_CHOICES, initial = 1)
  scroll_direction = forms.ChoiceField(choices = SCROLL_DIRECTIONS)
  
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
    
class EditNoDisplayItemForm(forms.ModelForm):
  item_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  overlay_id = forms.CharField(max_length=16, widget=forms.HiddenInput(attrs={ "field-type": "text" }))
  
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
    
class EditImageItem(EditItemForm):
  image_url = forms.CharField(max_length = 512, widget = forms.TextInput(attrs = { "field-type": "text", 'readonly': 'readonly' }), label = "Uploaded Image URL")
  
  field_order = BASE_WIDGET_ORDER
  field_order.extend(["image", "image_url", "url"])
  
  class Meta:
    model = ImageItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = IMAGE_WIDGETS
    widgets.update(BASE_WIDGETS)
    
class EditAudioItem(EditNoDisplayItemForm):
  audio_url = forms.CharField(max_length = 512, widget = forms.TextInput(attrs = { "field-type": "text", 'readonly': 'readonly' }), label = "Uploaded Audio URL")
  
  field_order = BASE_WIDGET_ORDER
  field_order.extend(["audio", "audio_url"])
  
  class Meta:
    model = AudioItem
    exclude = []
    exclude.extend(EditItemForm.Meta.exclude)
    exclude.extend(NO_DISPLAY_ITEM_EXCLUDES)
    
    widgets = BASE_WIDGETS
    widgets.update(AUDIO_WIDGETS)
    
class EditEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    model = EmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = EMBED_WIDGETS
    widgets.update(BASE_WIDGETS)
    
class EditYouTubeEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(["video_id", "start_time"])
  field_order.extend(BASE_VIDEO_WIDGET_ORDER)
  
  class Meta:
    model = YouTubeEmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = YOUTUBE_VIDEO_WIDGETS
    
    widgets.update(BASE_VIDEO_WIDGETS)
    widgets.update(BASE_WIDGETS)
    
class EditTwitchStreamEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(["channel"])
  field_order.extend(BASE_VIDEO_WIDGET_ORDER)
  
  class Meta:
    model = TwitchStreamEmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = TWITCH_STREAM_WIDGETS
    
    widgets.update(BASE_VIDEO_WIDGETS)
    widgets.update(BASE_WIDGETS)
    
class EditTwitchVideoEmbedItem(EditItemForm):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(["video_id", "start_time"])
  field_order.extend(BASE_VIDEO_WIDGET_ORDER)
  
  class Meta:
    model = TwitchVideoEmbedItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = TWITCH_VIDEO_WIDGETS
    
    widgets.update(BASE_VIDEO_WIDGETS)
    widgets.update(BASE_WIDGETS)
    
class AbstractEditText(EditItemForm):
  font = forms.ChoiceField(choices = FONT_CHOICES)
  font_weight = forms.ChoiceField(choices = FONT_WEIGHTS)
  text_alignment = forms.ChoiceField(choices = TEXT_ALIGNMENTS)
  
  drop_shadow_offset_x    = forms.DecimalField(label = "Drop shadow X",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Drop shadow X offset" }))
  drop_shadow_offset_y    = forms.DecimalField(label = "Drop shadow Y",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Drop shadow Y offset" }))
  drop_shadow_blur_radius = forms.DecimalField(label = "Drop shadow blur", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Drop shadow blur" }))
  
  text_outline_width = forms.DecimalField(label = "Text outline width", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Text outline width" }))
  
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
    
    widgets = TEXT_WIDGETS
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class EditStopwatchItem(AbstractEditText):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
  class Meta:
    model = StopwatchItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = STOPWATCH_WIDGETS
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class EditCounterItem(AbstractEditText):
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
  class Meta:
    model = CounterItem
    exclude = EditItemForm.Meta.exclude
    
    widgets = COUNTER_WIDGETS
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddItemForm(forms.ModelForm):
  visibility = forms.ChoiceField(choices = VISIBILITY_CHOICES, initial = 1)
  scroll_direction = forms.ChoiceField(choices = SCROLL_DIRECTIONS)
  
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
    
class AddNoDisplayItemForm(forms.ModelForm):
  field_order = BASE_WIDGET_ORDER
  
  class Meta:
    abstract = True
    exclude = [ "overlay", "id", "item_type" ]
  
    
class AddImageItem(AddItemForm):
  class Meta:
    model = ImageItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = IMAGE_WIDGETS
    widgets.update(BASE_WIDGETS)
    
class AddAudioItem(AddNoDisplayItemForm):
  class Meta:
    model = AudioItem
    exclude = []
    exclude.extend(AddItemForm.Meta.exclude)
    exclude.extend(NO_DISPLAY_ITEM_EXCLUDES)
    
    widgets = BASE_WIDGETS
    widgets.update(AUDIO_WIDGETS)
    
class AddEmbedItem(AddItemForm):
  class Meta:
    model = EmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = EMBED_WIDGETS
    widgets.update(BASE_WIDGETS)
    
class AddYouTubeEmbedItem(AddItemForm):
  class Meta:
    model = YouTubeEmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = YOUTUBE_VIDEO_WIDGETS
    
    widgets.update(BASE_VIDEO_WIDGETS)
    widgets.update(BASE_WIDGETS)
    
class AddTwitchStreamEmbedItem(AddItemForm):
  class Meta:
    model = TwitchStreamEmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = TWITCH_STREAM_WIDGETS
    
    widgets.update(BASE_VIDEO_WIDGETS)
    widgets.update(BASE_WIDGETS)
    
class AddTwitchVideoEmbedItem(AddItemForm):
  class Meta:
    model = TwitchVideoEmbedItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = TWITCH_VIDEO_WIDGETS
    
    widgets.update(BASE_VIDEO_WIDGETS)
    widgets.update(BASE_WIDGETS)
    
class AbstractAddText(AddItemForm):
  font = forms.ChoiceField(choices = FONT_CHOICES)
  font_weight = forms.ChoiceField(choices = FONT_WEIGHTS)
  text_alignment = forms.ChoiceField(choices = TEXT_ALIGNMENTS)
  
  drop_shadow_offset_x    = forms.DecimalField(label = "Drop shadow X",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Drop shadow X offset" }))
  drop_shadow_offset_y    = forms.DecimalField(label = "Drop shadow Y",    decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Drop shadow Y offset" }))
  drop_shadow_blur_radius = forms.DecimalField(label = "Drop shadow blur", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Drop shadow blur" }))
  
  text_outline_width = forms.DecimalField(label = "Text outline width", decimal_places = 1, step_size = 0.1, initial = 0.0, widget = forms.NumberInput(attrs = { "field-type": "float", "title": "Text outline width" }))
  
  field_order = BASE_WIDGET_ORDER
  field_order.extend(BASE_TEXT_WIDGET_ORDER)
  
  class Meta:
    abstract = True
  
    
class AddTextItem(AbstractAddText):
  class Meta:
    model = TextItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = TEXT_WIDGETS
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddStopwatchItem(AbstractAddText):
  class Meta:
    model = StopwatchItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = STOPWATCH_WIDGETS
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    
class AddCounterItem(AbstractAddText):
  class Meta:
    model = CounterItem
    exclude = AddItemForm.Meta.exclude
    
    widgets = COUNTER_WIDGETS
    
    widgets.update(BASE_WIDGETS)
    widgets.update(BASE_TEXT_WIDGETS)
    

FORMS_MAP = {
  "edit": {
    "ImageItem": EditImageItem,
    "AudioItem": EditAudioItem,
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
    "AudioItem": AddAudioItem,
    "EmbedItem": AddEmbedItem,
    "YouTubeEmbedItem": AddYouTubeEmbedItem,
    "TwitchStreamEmbedItem": AddTwitchStreamEmbedItem,
    "TwitchVideoEmbedItem": AddTwitchVideoEmbedItem,
    "TextItem": AddTextItem,
    "StopwatchItem": AddStopwatchItem,
    "CounterItem": AddCounterItem,
  }
}