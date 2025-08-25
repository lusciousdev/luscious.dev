import asyncio
import datetime
import logging
import os
import sys
import typing

import django
import luscioustwitch
import twitchio
import twitchio.authentication
import twitchio.eventsub
from channels.layers import get_channel_layer
from channels_redis.core import RedisChannelLayer
from twitchio.ext import commands as twitchio_commands

sys.path.append(os.path.join(os.path.dirname(__file__), "../"))
os.environ["DJANGO_SETTINGS_MODULE"] = "lusciousdev.settings"

django.setup()

from allauth.socialaccount.models import SocialAccount, SocialToken
from django.conf import settings

from bot.models import *
from lusciousdev.celery import app as celery_app

LOGGER: logging.Logger = logging.getLogger("bot")


def partialuser_to_dict(pu: twitchio.PartialUser | None) -> dict[str, str | None]:
    assert pu is not None

    return {
        "id": pu.id,
        "login": pu.name,
        "display_name": pu.display_name,
    }


def chatter_to_dict(chatter: twitchio.Chatter) -> dict[str, str | bool | None]:
    return {
        "id": chatter.id,
        "login": chatter.name,
        "display_name": chatter.display_name,
        "color": "#737373" if chatter.color is None else chatter.color.html,
        "subscriber": chatter.subscriber,
        "vip": chatter.subscriber,
        "moderator": chatter.moderator,
        "broadcaster": chatter.broadcaster,
    }


def emote_to_dict(emote: twitchio.ChatMessageEmote) -> dict[str, typing.Any]:
    return {
        "set_id": emote.set_id,
        "id": emote.id,
        "owner": partialuser_to_dict(emote.owner),
        "format": emote.format,
    }


def group_name(broadcaster_user_id: str) -> str:
    return f"twitch_{broadcaster_user_id}"


@typing.final
class BroadcasterType:
    DEFAULT = 0
    AFFILIATE = 1
    PARTNER = 2


class LusciousBot(twitchio_commands.Bot):
    channel_layer: RedisChannelLayer

    bot_group_name: str = "lusciousbot"
    channel_name: str = ""

    def __init__(self):
        self.channel_layer = get_channel_layer()

        self.bot_channel_task: asyncio.Task[typing.Any] | None = None

        super().__init__(
            client_id=settings.TWITCH_API_CLIENT_ID,
            client_secret=settings.TWITCH_API_CLIENT_SECRET,
            bot_id="1062442212",
            owner_id="82920215",
            prefix="?",
        )

    @typing.override
    async def close(self, **options: typing.Any) -> None:
        if self.bot_channel_task is not None:
            _ = self.bot_channel_task.cancel()
        await self.channel_layer.group_discard(self.bot_group_name, self.channel_name)

    @typing.override
    async def setup_hook(self) -> None:
        await self.add_component(LusciousBotComponent(self))

        self.channel_name = await self.channel_layer.new_channel()
        await self.channel_layer.group_add(self.bot_group_name, self.channel_name)

    @typing.override
    async def add_token(
        self, token: str, refresh: str
    ) -> twitchio.authentication.ValidateTokenPayload:
        resp: twitchio.authentication.ValidateTokenPayload = await super().add_token(
            token, refresh
        )

        account = None
        try:
            if set(resp.scopes) == set(
                settings.SOCIALACCOUNT_PROVIDERS.get("twitch", {}).get("SCOPE", [])
            ):
                account = await SocialAccount.objects.aget(
                    provider="twitch", uid=resp.user_id
                )
            elif set(resp.scopes) == set(
                settings.SOCIALACCOUNT_PROVIDERS.get("twitch_chatbot", {}).get(
                    "SCOPE", []
                )
            ):
                account = await SocialAccount.objects.aget(
                    provider="twitch_chatbot", uid=resp.user_id
                )
        except SocialAccount.DoesNotExist:
            LOGGER.debug(f"Token added for unknown user: {resp.user_id}")
            return resp

        if account:
            await SocialToken.objects.aupdate_or_create(
                account=account,
                defaults={
                    "token": token,
                    "token_secret": refresh,
                    "expires_at": datetime.datetime.now(tz=datetime.UTC)
                    + datetime.timedelta(seconds=resp.expires_in),
                },
            )

        return resp

    @typing.override
    async def load_tokens(self, path: str | None = None) -> None:
        bot_account = await SocialAccount.objects.aget(
            provider="twitch_chatbot", uid=self.bot_id
        )
        bot_token = await SocialToken.objects.aget(account=bot_account)

        _ = await self.add_token(bot_token.token, bot_token.token_secret)

    async def check_bot_channel(self) -> None:
        while True:
            try:
                LOGGER.debug("Waiting for next message...")
                msg = await self.channel_layer.receive(self.channel_name)
                await self.handle_bot_channel_messages(msg)
            except Exception as e:
                LOGGER.error(e)

    async def send_user_group_message(
        self, buid: str, type: str, data: dict[str, typing.Any]
    ) -> None:
        await self.channel_layer.group_send(
            group_name(buid),
            {
                "type": f"twitch_{type}",
                "data": data,
            },
        )

    async def send_user_group_error(self, buid: str, code: str, reason: str) -> None:
        await self.channel_layer.group_send(
            group_name(buid),
            {"type": "twitch_error", "data": {"code": code, "reason": reason}},
        )

    async def handle_bot_channel_messages(self, message: dict[str, typing.Any]) -> None:
        msgtype: str | None = message.get("type")
        msgdata: dict[str, typing.Any] | None = message.get("data")

        if msgtype is None:
            LOGGER.error("Bot channel message missing message type")
            return

        if msgdata is None:
            LOGGER.error("Bot channel message missing msgdata")
            return

        buid: str | None = msgdata.get("broadcaster_user_id")

        if buid is None:
            LOGGER.error("Bot channel message missing broadcaster user ID")
            return

        if msgtype == "join":
            await self.add_user(buid)
        elif msgtype == "send_message":
            chatmsg: str | None = msgdata.get("message")

            if chatmsg is None:
                await self.send_user_group_error(
                    buid,
                    "send_message.bad_data",
                    "Send message request does not contain a message.",
                )
                return

            await self.add_user(buid)
            await self.send_chat_message(buid, chatmsg)
        elif msgtype == "start_poll":
            title: str | None = msgdata.get("title")
            choices: list[str] | None = msgdata.get("choices")
            poll_duration: int = msgdata.get("duration", 60)
            delete_poll = msgdata.get("delete_poll", False)

            if title is None or choices is None:
                await self.send_user_group_error(
                    buid,
                    "poll.bad_data",
                    "Start poll request does not contain necessary information.",
                )
                return

            await self.add_user(buid)
            await self.start_poll(buid, title, choices, poll_duration, delete_poll)
        elif msgtype == "start_prediction":
            title = msgdata.get("title")
            outcomes: list[str] | None = msgdata.get("outcomes")
            prediction_duration: int = msgdata.get("duration", 60)

            if title is None or outcomes is None:
                await self.send_user_group_error(
                    buid,
                    "prediction.bad_data",
                    "Start prediction request does not contain necessary information.",
                )
                return

            await self.add_user(buid)
            await self.start_prediction(buid, title, outcomes, prediction_duration)
        else:
            LOGGER.debug("ERROR: unhandled message type.")

    async def event_ready(self) -> None:
        LOGGER.debug(f"Successfully logged in as: {self.bot_id}")

        self.bot_channel_task = asyncio.create_task(self.check_bot_channel())

    @typing.override
    async def event_message(self, payload: twitchio.ChatMessage) -> None:
        msg_data = {
            "uuid": payload.id,
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "chatter": chatter_to_dict(payload.chatter),
            "message": payload.text,
            "emotes": {
                frag.text: emote_to_dict(frag.emote)
                for frag in payload.fragments
                if frag.emote is not None
            },
        }

        celery_app.send_task("bot.tasks.handle_chat_message", kwargs=msg_data)
        celery_app.send_task("overlay.tasks.handle_chat_message", kwargs=msg_data)
        await self.send_user_group_message(
            payload.broadcaster.id, "chat_message", msg_data
        )

    async def event_poll_begin(self, payload: twitchio.ChannelPollBegin) -> None:
        poll_data = {
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "id": payload.id,
            "title": payload.title,
            "choices": [
                {"title": pollchoice.title, "votes": pollchoice.votes}
                for pollchoice in payload.choices
            ],
            "duration": (payload.ends_at - payload.started_at).total_seconds(),
            "time_remaining": (
                payload.ends_at - datetime.datetime.now(datetime.timezone.utc)
            ).total_seconds(),
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "poll_begin", poll_data
        )

    async def event_poll_progress(self, payload: twitchio.ChannelPollProgress) -> None:
        poll_data = {
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "id": payload.id,
            "title": payload.title,
            "choices": [
                {"title": pollchoice.title, "votes": pollchoice.votes}
                for pollchoice in payload.choices
            ],
            "duration": (payload.ends_at - payload.started_at).total_seconds(),
            "time_remaining": (
                payload.ends_at - datetime.datetime.now(datetime.timezone.utc)
            ).total_seconds(),
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "poll_progress", poll_data
        )

    async def event_poll_end(self, payload: twitchio.ChannelPollEnd) -> None:
        poll_data = {
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "id": payload.id,
            "title": payload.title,
            "choices": [
                {"title": pollchoice.title, "votes": pollchoice.votes}
                for pollchoice in payload.choices
            ],
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "poll_end", poll_data
        )

    async def event_prediction_begin(
        self, payload: twitchio.ChannelPredictionBegin
    ) -> None:
        prediction_data = {
            "id": payload.id,
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "title": payload.title,
            "outcomes": [
                {
                    "id": outcome.id,
                    "title": outcome.title,
                    "channel_points": outcome.channel_points,
                }
                for outcome in payload.outcomes
            ],
            "duration": (payload.locks_at - payload.started_at).total_seconds(),
            "time_remaining": (payload.locks_at - timezone.now()).total_seconds(),
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "prediction_begin", prediction_data
        )

    async def event_prediction_progress(
        self, payload: twitchio.ChannelPredictionProgress
    ) -> None:
        prediction_data = {
            "id": payload.id,
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "title": payload.title,
            "outcomes": [
                {
                    "id": outcome.id,
                    "title": outcome.title,
                    "channel_points": outcome.channel_points,
                }
                for outcome in payload.outcomes
            ],
            "duration": (payload.locks_at - payload.started_at).total_seconds(),
            "time_remaining": (payload.locks_at - timezone.now()).total_seconds(),
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "prediction_progress", prediction_data
        )

    async def event_prediction_lock(
        self, payload: twitchio.ChannelPredictionLock
    ) -> None:
        prediction_data = {
            "id": payload.id,
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "title": payload.title,
            "outcomes": [
                {
                    "id": outcome.id,
                    "title": outcome.title,
                    "channel_points": outcome.channel_points,
                }
                for outcome in payload.outcomes
            ],
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "prediction_lock", prediction_data
        )

    async def event_prediction_end(
        self, payload: twitchio.ChannelPredictionEnd
    ) -> None:
        prediction_data = {
            "id": payload.id,
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "title": payload.title,
            "outcomes": [
                {
                    "id": outcome.id,
                    "title": outcome.title,
                    "channel_points": outcome.channel_points,
                }
                for outcome in payload.outcomes
            ],
            "winning_outcome": (
                {
                    "id": payload.winning_outcome.id,
                    "title": payload.winning_outcome.title,
                    "channel_points": payload.winning_outcome.channel_points,
                }
                if payload.winning_outcome
                else None
            ),
            "status": payload.status,
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "prediction_end", prediction_data
        )

    @typing.override
    async def event_custom_redemption_add(
        self, payload: twitchio.ChannelPointsRedemptionAdd
    ) -> None:
        redemption_data = {
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "user": partialuser_to_dict(payload.user),
            "user_input": payload.user_input,
            "id": payload.id,
            "status": payload.status,
            "redeemed_at": payload.redeemed_at.strftime(
                luscioustwitch.TWITCH_API_TIME_FORMAT
            ),
            "reward": {
                "id": payload.reward.id,
                "title": payload.reward.title,
                "cost": payload.reward.cost,
            },
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "redemption_add", redemption_data
        )

    @typing.override
    async def event_custom_redemption_update(
        self, payload: twitchio.ChannelPointsRedemptionUpdate
    ) -> None:
        redemption_data = {
            "broadcaster": partialuser_to_dict(payload.broadcaster),
            "user": partialuser_to_dict(payload.user),
            "user_input": payload.user_input,
            "id": payload.id,
            "status": payload.status,
            "redeemed_at": payload.redeemed_at.strftime(
                luscioustwitch.TWITCH_API_TIME_FORMAT
            ),
            "reward": {
                "id": payload.reward.id,
                "title": payload.reward.title,
                "cost": payload.reward.cost,
            },
        }

        await self.send_user_group_message(
            payload.broadcaster.id, "redemption_update", redemption_data
        )

    async def send_chat_message(self, buid: str, message: str) -> None:
        broadcaster = self.create_partialuser(user_id=buid)
        _ = await broadcaster.send_message(message, sender=self.bot_id)

    async def add_user(self, buid: str) -> None:
        success = True
        reason = ""
        if buid not in self.tokens:
            success, reason = await self.add_user_token(buid)

        if not success:
            await self.send_user_group_error(buid, "user.unauth", reason)
        else:
            await self.subscribe_to_user(buid)

    async def start_poll(
        self,
        buid: str,
        title: str,
        choices: list[str],
        duration: int = 60,
        delete_poll: bool = False,
    ) -> None:
        broadcaster_type = await self.get_broadcaster_type(buid)

        if broadcaster_type == BroadcasterType.DEFAULT:
            try:
                poll = await ChatPoll.objects.aget(
                    broadcaster_user_id=buid,
                    started_at__lte=timezone.now(),
                    ends_at__gte=timezone.now(),
                )

                await self.send_user_group_error(
                    buid, "poll.active", "There's already a poll active."
                )
                return
            except ChatPoll.DoesNotExist:
                ...

            celery_app.send_task(
                "bot.tasks.start_poll",
                kwargs={
                    "broadcaster_user_id": buid,
                    "title": title,
                    "choices": choices,
                    "duration": duration,
                },
            )

            await self.send_chat_message(buid, "Poll started! Vote now!")
        else:
            broadcaster_partial_user = self.create_partialuser(user_id=buid)

            polls = await broadcaster_partial_user.fetch_polls()

            for poll in polls:
                if poll.status == "ACTIVE":
                    if not delete_poll:
                        await self.send_user_group_error(
                            buid, "poll.active", "There's already a poll active."
                        )
                        return
                    try:
                        _ = await broadcaster_partial_user.end_poll(
                            id=poll.id, status="ARCHIVED"
                        )
                    except Exception as e:
                        LOGGER.error(e)

            poll_title = title if len(title) <= 60 else f"{ title[:57] }..."
            poll_choices = [c if len(c) <= 25 else f"{ c[:22] }..." for c in choices]
            poll_duration = max(15, min(1800, duration))

            if 5 < len(poll_choices) < 2:
                await self.send_user_group_error(
                    buid, "poll.choices", "Invalid number of poll choices."
                )
                return

            _ = await broadcaster_partial_user.create_poll(
                title=poll_title, choices=poll_choices, duration=poll_duration
            )

            await self.send_chat_message(buid, "Poll started! Vote now!")

    async def start_prediction(
        self, buid: str, title: str, outcomes: list[str], duration: int = 60
    ) -> None:
        broadcaster_type = await self.get_broadcaster_type(buid)

        if broadcaster_type == BroadcasterType.DEFAULT:
            await self.send_user_group_error(
                buid, "user.broadcaster_type", "User is not an affiliate or partner."
            )
            return

        bpu = self.create_partialuser(user_id=buid)

        predictions = await bpu.fetch_predictions()

        for pred in predictions:
            if pred.status == "ACTIVE":
                await self.send_user_group_error(
                    buid, "prediction.active", "There's already a prediction active."
                )
                return

        pred_title = title if len(title) <= 45 else f"{title[:42]}..."
        pred_outcomes = [o if len(o) <= 25 else f"{o[:22]}..." for o in outcomes]
        pred_duration = max(30, min(1800, duration))

        if 10 < len(pred_outcomes) < 2:
            await self.send_user_group_error(
                buid, "prediction.outcomes", "Invalid number of prediction outcomes."
            )
            return

        _ = await bpu.create_prediction(
            title=pred_title, outcomes=pred_outcomes, prediction_window=pred_duration
        )

    async def create_channel_point_reward(
        self,
        buid: str,
        title: str,
        cost: int,
        enabled: bool,
        redemptions_skip_queue: bool,
        prompt: str | None = None,
        background_color: str | twitchio.Colour | None = None,
        max_per_stream: int | None = None,
        max_per_user: int | None = None,
        global_cooldown: int | None = None,
    ):
        broadcaster_type = await self.get_broadcaster_type(buid)

        if broadcaster_type == BroadcasterType.DEFAULT:
            await self.send_user_group_error(
                buid, "user.broadcaster_type", "User is not an affiliate or partner."
            )
            return

        bpu = self.create_partialuser(user_id=buid)

        reward_title = title if len(title) <= 45 else title[:45]
        reward_cost = max(1, cost)
        reward_prompt = prompt if prompt is None or len(prompt) <= 200 else prompt[:200]
        reward_max_per_stream = (
            max_per_stream if max_per_stream is None else max(1, max_per_stream)
        )
        reward_max_per_user = (
            max_per_user if max_per_user is None else max(1, max_per_user)
        )
        reward_global_cooldown = (
            global_cooldown if global_cooldown is None else max(1, global_cooldown)
        )

        custom_reward: twitchio.CustomReward = await bpu.create_custom_reward(
            title=reward_title,
            cost=reward_cost,
            prompt=reward_prompt,
            enabled=enabled,
            max_per_stream=reward_max_per_stream,
            max_per_user=reward_max_per_user,
            global_cooldown=reward_global_cooldown,
            redemptions_skip_queue=redemptions_skip_queue,
        )

        await self.send_user_group_message(
            buid,
            "custom_reward_created",
            {"id": custom_reward.id, "title": custom_reward.title},
        )

    async def add_user_token(self, buid: str) -> tuple[bool, str]:
        try:
            socialaccount = await SocialAccount.objects.aget(
                provider="twitch", uid=buid
            )
            socialtoken = await SocialToken.objects.aget(account=socialaccount)
            _ = await self.add_token(socialtoken.token, socialtoken.token_secret)

            return (True, "")
        except SocialToken.DoesNotExist:
            return (False, "Twitch user is not authenticated.")
        except Exception as e:
            return (False, e.__str__())

    async def get_broadcaster_type(self, broadcaster_user_id: str) -> int:
        userlist = await self.fetch_users(
            ids=[
                broadcaster_user_id,
            ]
        )
        broadcaster = userlist[0]

        if broadcaster.broadcaster_type == "affiliate":
            return BroadcasterType.AFFILIATE
        if broadcaster.broadcaster_type == "partner":
            return BroadcasterType.PARTNER
        return BroadcasterType.DEFAULT

    async def subscribe_to_user(self, buid: str) -> None:
        broadcaster_type = await self.get_broadcaster_type(buid)
        await self.send_user_group_message(
            buid, "broadcaster_type", {"broadcaster_type": broadcaster_type}
        )

        broadcaster_subscriptions: list[str] = []
        for _, sub in self.websocket_subscriptions().items():
            if sub.condition.get("broadcaster_user_id", "") == buid:
                broadcaster_subscriptions.append(sub.type.value)

        if "channel.chat.message" not in broadcaster_subscriptions:
            subscription = twitchio.eventsub.ChatMessageSubscription(
                broadcaster_user_id=buid, user_id=self.bot_id
            )
            _ = await self.subscribe_websocket(payload=subscription)

        if broadcaster_type >= BroadcasterType.AFFILIATE:
            if "channel.poll.begin" not in broadcaster_subscriptions:
                subscription = twitchio.eventsub.ChannelPollBeginSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if "channel.poll.progress" not in broadcaster_subscriptions:
                subscription = twitchio.eventsub.ChannelPollProgressSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if "channel.poll.end" not in broadcaster_subscriptions:
                subscription = twitchio.eventsub.ChannelPollEndSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if "channel.prediction.begin" not in broadcaster_subscriptions:
                subscription = twitchio.eventsub.ChannelPredictionBeginSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if "channel.prediction.progress" not in broadcaster_subscriptions:
                subscription = twitchio.eventsub.ChannelPredictionProgressSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if "channel.prediction.lock" not in broadcaster_subscriptions:
                subscription = twitchio.eventsub.ChannelPredictionLockSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if "channel.prediction.end" not in broadcaster_subscriptions:
                subscription = twitchio.eventsub.ChannelPredictionEndSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if (
                "channel.channel_points_custom_reward_redemption.add"
                not in broadcaster_subscriptions
            ):
                subscription = twitchio.eventsub.ChannelPointsRedeemAddSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)

            if (
                "channel.channel_points_custom_reward_redemption.update"
                not in broadcaster_subscriptions
            ):
                subscription = twitchio.eventsub.ChannelPointsRedeemUpdateSubscription(
                    broadcaster_user_id=buid
                )
                _ = await self.subscribe_websocket(payload=subscription)


class LusciousBotComponent(twitchio_commands.Component):
    def __init__(self, bot: LusciousBot):
        self.bot: LusciousBot = bot


def main() -> None:
    twitchio.utils.setup_logging(level=logging.INFO)

    async def runner() -> None:
        async with LusciousBot() as bot:
            await bot.start(with_adapter=False)

    try:
        asyncio.run(runner())
    except KeyboardInterrupt:
        LOGGER.warning("Shutting down due to KeyboardInterrupt...")


if __name__ == "__main__":
    main()
