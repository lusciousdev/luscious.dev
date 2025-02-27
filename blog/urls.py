from django.urls import path
from django.views.generic.base import TemplateView

from . import views

app_name = 'blog'
urlpatterns = [
    path("<slug:slug>/", views.BlogView.as_view(), name="index"),
]
