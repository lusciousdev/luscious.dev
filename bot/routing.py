from django.urls import re_path, path

from . import consumers

websocket_urlpatterns = [
  path("ws/twitch/", consumers.TwitchConsumer.as_asgi(), name = "ws_twitch"),
]
