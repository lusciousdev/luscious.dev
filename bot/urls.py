from allauth.socialaccount.providers.oauth2.urls import default_urlpatterns

from .provider import TwitchChatbotProvider

urlpatterns = [
  
] + default_urlpatterns(TwitchChatbotProvider)