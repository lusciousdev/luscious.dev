from django.urls import re_path, path

from . import consumers

websocket_urlpatterns = [
  path("ws/quiz/<str:user_id>/", consumers.QuizConsumer.as_asgi(), name = "ws_quiz"),
]