import os
import sys
import datetime
from asgiref.sync import async_to_sync, sync_to_async
import logging
import asyncio
import json
import time
import typing
import luscioustwitch

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.layers import get_channel_layer
from channels_redis.core import RedisChannelLayer

import django

import twitchio

from twitchio.ext import commands as twitchio_commands
from twitchio.ext import routines as twitchio_routines
import twitchio.eventsub
import twitchio.authentication

sys.path.append(os.path.join(os.path.dirname(__file__), '../'))
os.environ['DJANGO_SETTINGS_MODULE'] = "lusciousdev.settings"

django.setup()

from django.conf import settings

from allauth.socialaccount.models import SocialApp, SocialToken, SocialAccount
from bot.models import *
from bot.provider import TwitchChatbotProvider

from lusciousdev.celery import app as celery_app

LOGGER: logging.Logger = logging.getLogger("bot")
      
def partialuser_to_dict(pu : twitchio.PartialUser) -> dict[str, str]:
  return {
    "id": pu.id,
    "login": pu.name,
    "display_name": pu.display_name,
  }
  
def group_name(broadcaster_user_id : str) -> str:
  return f"twitch_{broadcaster_user_id}"

class BroadcasterType:
  DEFAULT = 0
  AFFILIATE = 1
  PARTNER = 2

class LusciousBot(twitchio_commands.Bot):
  channel_layer : RedisChannelLayer = None
  
  bot_group_name : str = "lusciousbot"
  channel_name : str = None
  
  active_chatmessage_subscriptions = {}
  
  def __init__(self):
    self.channel_layer = get_channel_layer()
    
    super().__init__(
      client_id = settings.TWITCH_API_CLIENT_ID,
      client_secret = settings.TWITCH_API_CLIENT_SECRET,
      bot_id = "1062442212",
      owner_id = "82920215",
      prefix = "?",
    )
    
  async def close(self) -> None:
    self.bot_channel_task.cancel()
    await self.channel_layer.group_discard(self.bot_group_name, self.channel_name)
    
  async def setup_hook(self) -> None:
    await self.add_component(LusciousBotComponent(self))
    
    self.channel_name = await self.channel_layer.new_channel()
    await self.channel_layer.group_add(self.bot_group_name, self.channel_name)
    
    # self.rejoin_bot_channel.start()
    
  async def add_token(self, token : str, refresh : str) -> twitchio.authentication.ValidateTokenPayload:
    resp : twitchio.authentication.ValidateTokenPayload = await super().add_token(token, refresh)
    
    account = None
    
    try:
      if set(resp.scopes) == set(settings.SOCIALACCOUNT_PROVIDERS.get("twitch", {}).get("SCOPE", [])):
        account = await SocialAccount.objects.aget(provider = "twitch", uid = resp.user_id)
      elif set(resp.scopes) == set(settings.SOCIALACCOUNT_PROVIDERS.get("twitch_chatbot", {}).get("SCOPE", [])):
        account = await SocialAccount.objects.aget(provider = "twitch_chatbot", uid = resp.user_id)
    except SocialAccount.DoesNotExist:
      LOGGER.debug(f"Token added for unknown user: {resp.user_id}")
      return resp
    
    if account:
      await SocialToken.objects.aupdate_or_create(
        account = account, 
        defaults = {
          "token": token,
          "token_secret": refresh,
          "expires_at": datetime.datetime.now(tz = datetime.UTC) + datetime.timedelta(seconds = resp.expires_in),
        }
      )
    
    return resp
    
  async def load_tokens(self, path : str | None = None) -> None:
    bot_account = await SocialAccount.objects.aget(provider = "twitch_chatbot", uid = self.bot_id)
    bot_token = await SocialToken.objects.aget(account = bot_account)
    
    await self.add_token(bot_token.token, bot_token.token_secret)
    
      
  async def check_bot_channel(self) -> None:
    while True:
      LOGGER.debug("Waiting for next message...")
      msg = await self.channel_layer.receive(self.channel_name)
      await self.handle_bot_channel_messages(msg)
      
  async def send_user_group_message(self, buid : str, type : str, data : dict) -> None:
    await self.channel_layer.group_send(group_name(buid), { 'type': f"twitch_{type}", "data": data, })
    
  async def send_user_group_error(self, buid : str, code : str, reason : str) -> None:
    await self.channel_layer.group_send(group_name(buid), { "type": "twitch_error", "data": { "code": code, "reason": reason }})
    
  async def handle_bot_channel_messages(self, message : dict) -> None:
    msgtype : str = message.get("type", "")
    msgdata : dict = message.get("data", {})
    
    LOGGER.debug(message)
    
    if msgtype == "join":
      broadcaster_user_id = message["data"]["broadcaster_user_id"]
      await self.add_user(broadcaster_user_id)
    elif msgtype == "send_message":
      await self.send_chat_message(**message["data"])
    elif msgtype == "start_poll":
      buid = msgdata.get("broadcaster_user_id")
      title = msgdata.get("title")
      choices = msgdata.get("choices")
      duration = msgdata.get("duration")
      delete_poll = msgdata.get("delete_poll", False)
      
      if buid is None:
        return
      elif title is None or choices is None or duration is None:
        self.send_user_group_error(buid, "poll.bad_data", "Start poll request does not contain necessary information.")
        return
      
      await self.start_poll(buid, title, choices, duration, delete_poll)
    elif msgtype == "start_prediction":
      buid = msgdata.get("broadcaster_user_id")
      title = msgdata.get("title")
      outcomes = msgdata.get("outcomes")
      duration = msgdata.get("duration")
      
      if buid is None:
        return
      elif title is None or outcomes is None or duration is None:
        self.send_user_group_error(buid, "prediction.bad_data", "Start prediction request does not contain necessary information.")
        return
      
      await self.start_prediction(buid, title, outcomes, duration)
    else:
      LOGGER.debug("ERROR: unhandled message type.")
  
  async def event_ready(self) -> None:
    LOGGER.debug(f"Successfully logged in as: {self.bot_id}")
    
    self.bot_channel_task = asyncio.create_task(self.check_bot_channel())
    
  async def event_message(self, payload : twitchio.ChatMessage) -> None:
    msg_data = { 
      "uuid": payload.id,
      "broadcaster": partialuser_to_dict(payload.broadcaster), 
      "chatter": partialuser_to_dict(payload.chatter), 
      "message": payload.text 
    }
    
    celery_app.send_task("bot.tasks.handle_chat_message", kwargs = msg_data)
    await self.send_user_group_message(payload.broadcaster.id, "chat_message", msg_data)
    
  async def event_poll_begin(self, payload : twitchio.ChannelPollBegin) -> None:
    poll_data = {
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "id": payload.id,
      "title": payload.title,
      "choices": [ { "title": pollchoice.title, "votes": pollchoice.votes } for pollchoice in payload.choices ],
      "duration": (payload.ends_at - payload.started_at).total_seconds(),
      "time_remaining": (payload.ends_at - datetime.datetime.now(datetime.timezone.utc)).total_seconds(),
    }
    
    await self.send_user_group_message(payload.broadcaster.id, 'poll_begin', poll_data)
    
  async def event_poll_progress(self, payload : twitchio.ChannelPollProgress) -> None:
    poll_data = {
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "id": payload.id,
      "title": payload.title,
      "choices": [ { "title": pollchoice.title, "votes": pollchoice.votes } for pollchoice in payload.choices ],
      "duration": (payload.ends_at - payload.started_at).total_seconds(),
      "time_remaining": (payload.ends_at - datetime.datetime.now(datetime.timezone.utc)).total_seconds(),
    }
    
    await self.send_user_group_message(payload.broadcaster.id, 'poll_progress', poll_data)
    
  async def event_poll_end(self, payload : twitchio.ChannelPollEnd) -> None:
    poll_data = {
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "id": payload.id,
      "title": payload.title,
      "choices": [ { "title": pollchoice.title, "votes": pollchoice.votes } for pollchoice in payload.choices ],
    }
    
    await self.send_user_group_message(payload.broadcaster.id, 'poll_end', poll_data)
    
  async def event_prediction_begin(self, payload : twitchio.ChannelPredictionBegin) -> None:
    prediction_data = {
      "id": payload.id,
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "title": payload.title,
      "outcomes": [ (outcome.id, outcome.title, outcome.channel_points) for outcome in payload.outcomes ],
      "duration": (payload.locks_at - payload.started_at).total_seconds(),
      "time_remaining": (payload.locks_at - timezone.now()).total_seconds(),
    }
    
    await self.send_user_group_message(payload.broadcaster.id, "prediction_begin", prediction_data)
    
  async def event_prediction_progress(self, payload : twitchio.ChannelPredictionProgress) -> None:
    prediction_data = {
      "id": payload.id,
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "title": payload.title,
      "outcomes": [ (outcome.id, outcome.title, outcome.channel_points) for outcome in payload.outcomes ],
      "duration": (payload.locks_at - payload.started_at).total_seconds(),
      "time_remaining": (payload.locks_at - timezone.now()).total_seconds(),
    }
    
    await self.send_user_group_message(payload.broadcaster.id, "prediction_progress", prediction_data)
    
  async def event_prediction_lock(self, payload : twitchio.ChannelPredictionLock) -> None:
    prediction_data = {
      "id": payload.id,
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "title": payload.title,
      "outcomes": [ (outcome.id, outcome.title, outcome.channel_points) for outcome in payload.outcomes ],
    }
    
    await self.send_user_group_message(payload.broadcaster.id, "prediction_lock", prediction_data)
    
  async def event_prediction_end(self, payload : twitchio.ChannelPredictionEnd) -> None:
    prediction_data = {
      "id": payload.id,
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "title": payload.title,
      "outcomes": [ (outcome.id, outcome.title, outcome.channel_points) for outcome in payload.outcomes ],
      "winning_outcome": (payload.winning_outcome.id, payload.winning_outcome.title, payload.winning_outcome.channel_points) if payload.winning_outcome else None,
      "status": payload.status,
    }
    
    await self.send_user_group_message(payload.broadcaster.id, "prediction_end", prediction_data)
    
  async def event_custom_redemption_add(self, payload : twitchio.ChannelPointsRedemptionAdd) -> None:
    redemption_data = {
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "user": partialuser_to_dict(payload.user),
      "user_input": payload.user_input,
      "id": payload.id,
      'status': payload.status,
      "redeemed_at": payload.redeemed_at.strftime(luscioustwitch.TWITCH_API_TIME_FORMAT),
      "reward": {
        "id": payload.reward.id,
        "title": payload.reward.title,
        "cost": payload.reward.cost,
      }
    }
    
    await self.send_user_group_message(payload.broadcaster.id, "redemption_add", redemption_data)
    
  async def event_custom_redemption_update(self, payload : twitchio.ChannelPointsRedemptionUpdate) -> None:
    redemption_data = {
      "broadcaster": partialuser_to_dict(payload.broadcaster),
      "user": partialuser_to_dict(payload.user),
      "user_input": payload.user_input,
      "id": payload.id,
      'status': payload.status,
      "redeemed_at": payload.redeemed_at.strftime(luscioustwitch.TWITCH_API_TIME_FORMAT),
      "reward": {
        "id": payload.reward.id,
        "title": payload.reward.title,
        "cost": payload.reward.cost,
      }
    }
    
    await self.send_user_group_message(payload.broadcaster.id, "redemption_update", redemption_data)
    
  async def event_subscription_revoked(self, payload : twitchio.SubscriptionRevoked) -> None:
    if payload.id in self.active_chatmessage_subscriptions.values():
      self.active_chatmessage_subscriptions = { k: v for k, v in self.active_chatmessage_subscriptions.items() if v != payload.id }
      
  async def send_chat_message(self, buid, message) -> None:
    broadcaster = self.create_partialuser(user_id = buid)
    await broadcaster.send_message(message, sender = self.bot_id)
    
  async def add_user(self, buid : str) -> None:
    success, reason = await self.add_user_token(buid)
    if not success:
      await self.send_user_group_error(buid, "user.unauth", reason)
    else:
      await self.subscribe_to_user(buid)
    
  async def start_poll(self, buid : str, title : str, choices : list[str], duration : int = 60, delete_poll : bool = False) -> None:
    broadcaster_type = await self.get_broadcaster_type(buid)
    
    if broadcaster_type == BroadcasterType.DEFAULT:
      try:
        poll = await ChatPoll.objects.aget(broadcaster_user_id = buid, started_at__lte = timezone.now(), ends_at__gte = timezone.now())
        
        await self.send_user_group_error(buid, "poll.active", "There's already a poll active.")
        return
      except ChatPoll.DoesNotExist:
        ...
        
      celery_app.send_task("bot.tasks.start_poll", kwargs = { "broadcaster_user_id": buid, "title": title, "choices": choices, "duration": duration })
      
      await self.send_chat_message(buid, "Poll started! Vote now!")
    else:
      broadcaster_partial_user = self.create_partialuser(user_id = buid)
      
      polls = await broadcaster_partial_user.fetch_polls()
      
      for poll in polls:
        if poll.status == "ACTIVE":
          if not delete_poll:
            await self.send_user_group_error(buid, "poll.active", "There's already a poll active.")
            return
          else:
            await poll.end_poll(status = "ARCHIVED")
      
      poll_title = title if len(title) <= 60 else f"{ title[:57] }..."
      poll_choices = [ c if len(c) <= 25 else f"{ c[:22] }..." for c in choices ]
      poll_duration = max(15, min(1800, duration))
      
      if 5 < len(poll_choices) < 2:
        await self.send_user_group_error(buid, "poll.choices", "Invalid number of poll choices.")
        return
      
      await broadcaster_partial_user.create_poll(title = poll_title, choices = poll_choices, duration = poll_duration)
      
      await self.send_chat_message(buid, "Poll started! Vote now!")
      
  async def start_prediction(self, buid : str, title : str, outcomes : list[str], duration : int = 60) -> None:
    broadcaster_type = await self.get_broadcaster_type(buid)
    
    if broadcaster_type == BroadcasterType.DEFAULT:
      await self.send_user_group_error(buid, "user.broadcaster_type", "User is not an affiliate or partner.")
      return
    
    bpu = self.create_partialuser(user_id = buid)
    
    predictions = await bpu.fetch_predictions()
    
    for pred in predictions:
      if pred.status == "ACTIVE":
        await self.send_user_group_error(buid, "prediction.active", "There's already a prediction active.")
        return
        
    pred_title = title if len(title) <= 45 else f"{title[:42]}..."
    pred_outcomes = [ o if len(o) <= 25 else f"{o[:22]}..." for o in outcomes ]
    pred_duration = max(30, min(1800, duration))
    
    if 10 < len(pred_outcomes) < 2:
      await self.send_user_group_error(buid, "prediction.outcomes", "Invalid number of prediction outcomes.")
      return
    
    await bpu.create_prediction(title = pred_title, outcomes = pred_outcomes, prediction_window = pred_duration)
    
  async def create_channel_point_reward(self, buid : str, title : str, cost : int, enabled : bool, redemptions_skip_queue : bool, prompt : str | None = None, background_color : str | twitchio.Colour | None = None, max_per_stream : str | None = None, max_per_user : int | None = None, global_cooldown : int | None = None):
    broadcaster_type = await self.get_broadcaster_type(buid)
    
    if broadcaster_type == BroadcasterType.DEFAULT:
      await self.send_user_group_error(buid, "user.broadcaster_type", "User is not an affiliate or partner.")
      return
    
    bpu = self.create_partialuser(user_id = buid)
    
    reward_title = title if len(title) <= 45 else title[:45]
    reward_cost = max(1, cost)
    reward_prompt = prompt if prompt is None or len(prompt) <= 200 else prompt[:200]
    reward_max_per_stream = max_per_stream if max_per_stream is None else max(1, max_per_stream)
    reward_max_per_user = max_per_user if max_per_user is None else max(1, max_per_user)
    reward_global_cooldown = global_cooldown if global_cooldown is None else max(1, global_cooldown)
    
    custom_reward : twitchio.CustomReward = await bpu.create_custom_reward(title = reward_title, 
                                                                           cost = reward_cost, 
                                                                           prompt = reward_prompt,
                                                                           enabled = enabled,
                                                                           max_per_stream = reward_max_per_stream,
                                                                           max_per_user = reward_max_per_user,
                                                                           global_cooldown = reward_global_cooldown,
                                                                           redemptions_skip_queue = redemptions_skip_queue)
    
    await self.send_user_group_message(buid, "custom_reward_created", { "id": custom_reward.id, "title": custom_reward.title })
    
      
  async def add_user_token(self, buid : str) -> typing.Tuple[bool, str]:
    try:
      socialaccount = await SocialAccount.objects.aget(provider = "twitch", uid = buid)
      socialtoken = await SocialToken.objects.aget(account = socialaccount)
      await self.add_token(socialtoken.token, socialtoken.token_secret)
      return (True, "")
    except SocialToken.DoesNotExist:
      return (False, "Twitch user is not authenticated.")
    except Exception as e:
      return (False, e.__str__())
    
  async def get_broadcaster_type(self, broadcaster_user_id : str) -> int:
    userlist = await self.fetch_users(ids = [ broadcaster_user_id, ])
    broadcaster = userlist[0]
    
    if broadcaster.broadcaster_type == "affiliate":
      return BroadcasterType.AFFILIATE
    elif broadcaster.broadcaster_type == "partner":
      return BroadcasterType.PARTNER
    else:
      return BroadcasterType.DEFAULT
    
  async def subscribe_to_user(self, buid : str) -> None:
    broadcaster_type = await self.get_broadcaster_type(buid)
    await self.send_user_group_message(buid, "broadcaster_type", { "broadcaster_type": broadcaster_type })
    
    broadcaster_subscriptions : list[str] = []
    for _, sub in self.websocket_subscriptions().items():
      if sub.condition.get("broadcaster_user_id", "") == buid:
        broadcaster_subscriptions.append(sub.type.value)
    
    if "channel.chat.message" not in broadcaster_subscriptions:
      subscription = twitchio.eventsub.ChatMessageSubscription(broadcaster_user_id = buid, user_id = self.bot_id)
      await self.subscribe_websocket(payload = subscription)
    
    if broadcaster_type >= BroadcasterType.AFFILIATE:
      if "channel.poll.begin" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPollBeginSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
      if "channel.poll.progress" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPollProgressSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
      if "channel.poll.end" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPollEndSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
      if "channel.prediction.begin" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPredictionBeginSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
    
      if "channel.prediction.progress" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPredictionProgressSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
      if "channel.prediction.lock" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPredictionLockSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
      if "channel.prediction.end" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPredictionEndSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
      if "channel.channel_points_custom_reward_redemption.add" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPointsRedeemAddSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
      if "channel.channel_points_custom_reward_redemption.update" not in broadcaster_subscriptions:
        subscription = twitchio.eventsub.ChannelPointsRedeemUpdateSubscription(broadcaster_user_id = buid)
        await self.subscribe_websocket(payload = subscription)
      
    
class LusciousBotComponent(twitchio_commands.Component):
  def __init__(self, bot : LusciousBot):
    self.bot = bot
    
    
def main() -> None:
  twitchio.utils.setup_logging(level=logging.INFO)

  async def runner() -> None:
    async with LusciousBot() as bot:
      await bot.start(with_adapter = False)

  try:
    asyncio.run(runner())
  except KeyboardInterrupt:
    LOGGER.warning("Shutting down due to KeyboardInterrupt...")
      
if __name__ == "__main__":
  main()