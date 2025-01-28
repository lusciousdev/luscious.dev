from django.urls import path

from . import views
from . import api

from asgiref.sync import sync_to_async, async_to_sync, markcoroutinefunction, iscoroutinefunction

app_name = 'youtubeapi'
urlpatterns = [
  path("api/v1/randomplaylist/", api.get_random_playlist_video, name = "api_random_playlist_video"),
]