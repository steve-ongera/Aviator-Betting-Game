import json
import asyncio
import time
import math
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from decimal import Decimal


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("game_room", self.channel_name)
        await self.accept()
        # Send current game state on connect
        state = await self.get_current_state()
        await self.send(text_data=json.dumps(state))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("game_room", self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        if msg_type == 'chat_message':
            if self.scope['user'].is_authenticated:
                msg = await self.save_chat_message(data.get('message', ''))
                if msg:
                    await self.channel_layer.group_send("game_room", {
                        "type": "chat_broadcast",
                        "username": self.scope['user'].username,
                        "avatar": self.scope['user'].avatar,
                        "message": msg['message'],
                        "created_at": msg['created_at'],
                    })

    async def game_state(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_broadcast(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "username": event["username"],
            "avatar": event["avatar"],
            "message": event["message"],
            "created_at": event["created_at"],
        }))

    async def bet_placed(self, event):
        await self.send(text_data=json.dumps(event))

    async def cashout_event(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def get_current_state(self):
        from .models import GameRound, Bet
        from .serializers import BetSerializer
        try:
            round_obj = GameRound.objects.filter(
                status__in=['waiting', 'flying']
            ).order_by('-round_number').first()
            if round_obj:
                bets = Bet.objects.filter(round=round_obj).select_related('user')
                bets_data = BetSerializer(bets, many=True).data
                return {
                    "type": "game_state",
                    "round_number": round_obj.round_number,
                    "status": round_obj.status,
                    "current_multiplier": round_obj.current_multiplier,
                    "bets": [dict(b) for b in bets_data],
                }
        except Exception:
            pass
        return {"type": "game_state", "status": "waiting", "current_multiplier": 1.0, "bets": []}

    @database_sync_to_async
    def save_chat_message(self, message):
        from .models import ChatMessage
        if not message or len(message.strip()) == 0:
            return None
        msg = ChatMessage.objects.create(
            user=self.scope['user'],
            message=message[:200].strip()
        )
        return {
            "message": msg.message,
            "created_at": msg.created_at.isoformat(),
        }


class GameEngineConsumer(AsyncWebsocketConsumer):
    """Internal consumer for the game engine - runs the game loop"""

    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass