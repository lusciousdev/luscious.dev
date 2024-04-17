from django.urls import re_path, path

from . import consumers

websocket_urlpatterns = [
  path("ws/overlay/<str:overlay_id>/", consumers.OverlayConsumer.as_asgi(), name = "ws_overlay"),
]