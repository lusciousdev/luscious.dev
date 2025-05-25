from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Error
from allauth.socialaccount.providers.oauth2.views import (
    OAuth2Adapter,
    OAuth2CallbackView,
    OAuth2LoginView,
)
from allauth.socialaccount.providers.twitch.views import TwitchOAuth2Adapter

# Create your views here.
class TwitchChatbotOAuth2Adapter(TwitchOAuth2Adapter):
    provider_id = "twitch_chatbot"

oauth2_login = OAuth2LoginView.adapter_view(TwitchChatbotOAuth2Adapter)
oauth2_callback = OAuth2CallbackView.adapter_view(TwitchChatbotOAuth2Adapter)