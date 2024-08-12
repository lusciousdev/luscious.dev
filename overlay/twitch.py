from django.conf import settings
import luscioustwitch

import json
import typing
import logging

logger = logging.getLogger("overlay")

def get_user_id(username) -> typing.Union[str, None]:
  twitch_api = luscioustwitch.TwitchAPI({ "CLIENT_ID": settings.TWITCH_API_CLIENT_ID, "CLIENT_SECRET": settings.TWITCH_API_CLIENT_SECRET })
  
  if username == "":
    return None
  
  try:
    user_id = twitch_api.get_user_id(username)
  except Exception as e:
    logger.warning(e)
    return None
  
  if user_id == "" or user_id == None:
    return None
  
  return user_id