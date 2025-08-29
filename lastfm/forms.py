from django import forms
from django.core.exceptions import ValidationError

from .lastfm import *

PERIOD_CHOICES = (
    ("7day", "Week"),
    ("1month", "Month"),
    ("3month", "3 months"),
    ("6month", "6 months"),
    ("12month", "Year"),
    ("overall", "All"),
)

SIZE_CHOICES = (
    (1, "1x1"),
    (2, "2x2"),
    (3, "3x3"),
    (4, "4x4"),
    (5, "5x5"),
    (6, "6x6"),
    (7, "7x7"),
    (8, "8x8"),
    (9, "9x9"),
    (10, "10x10"),
)


class LastFmUsernameField(forms.CharField):
    def validate(self, value):
        super().validate(value)

        if not check_user_exists(value):
            raise ValidationError(f'last.fm user "{value}" does not exist.')


class InfoForm(forms.Form):
    username = LastFmUsernameField(
        label="Username",
        max_length=128,
        widget=forms.TextInput(attrs={"class": "char-field"}),
    )
    period = forms.ChoiceField(
        choices=PERIOD_CHOICES,
        label="Period",
        widget=forms.Select(attrs={"class": "choice-field"}),
    )
    width = forms.IntegerField(min_value = 1, max_value = 10, step_size = 1, initial = 3)
    height = forms.IntegerField(min_value = 1, max_value = 10, step_size = 1, initial = 3)
