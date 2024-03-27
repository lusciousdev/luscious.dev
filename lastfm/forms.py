from django import forms

PERIOD_CHOICES = (
  ("7day", "Week"),
  ("1month", "Month"),
  ("3month", "3 months"),
  ("6month", "6 months"),
  ("12month", "Year"),
  ("overall", "All"),
)

SIZE_CHOICES = {
  (3, "3x3"),
  (4, "4x4"),
  (5, "5x5"),
  (6, "6x6")
}

class InfoForm(forms.Form):
  username = forms.CharField(label="Username", max_length=128)
  period   = forms.ChoiceField(choices = PERIOD_CHOICES, label = "Period")
  size     = forms.ChoiceField(choices = SIZE_CHOICES, label = "Size")