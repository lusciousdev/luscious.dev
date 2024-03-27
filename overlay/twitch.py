from django.conf import settings
import luscioustwitch

import json
import typing
import logging

twitch_api = luscioustwitch.TwitchAPI({ "CLIENT_ID": settings.TWITCH_API_CLIENT_ID, "CLIENT_SECRET": settings.TWITCH_API_CLIENT_SECRET })

def get_user_id(username) -> typing.Union[str, None]:
  if username == "":
    return None
  
  try:
    user_id = twitch_api.get_user_id(username)
  except:
    return None
  
  if user_id == "" or user_id == None:
    return None
  
  return user_id