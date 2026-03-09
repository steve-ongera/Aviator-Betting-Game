"""
Game Engine - runs the Aviator game loop.
Start with: python manage.py run_game_engine
Or auto-starts via AppConfig.ready()
"""
import asyncio
import json
import math
import time
import logging
from decimal import Decimal
from django.utils import timezone

logger = logging.getLogger(__name__)

WAITING_TIME = 7  # seconds between rounds
TICK_RATE = 0.1   # seconds per tick


def get_channel_layer():
    from channels.layers import get_channel_layer as gcl
    return gcl()


async def broadcast(layer, data):
    await layer.group_send("game_room", {"type": "game_state", **data})


async def run_game_loop():
    """Main game loop"""
    from .models import GameRound, Bet
    from django.db import close_old_connections

    layer = get_channel_layer()
    logger.info("🚀 Aviator Game Engine Started")

    while True:
        try:
            close_old_connections()

            # --- WAITING PHASE ---
            crash_point = await asyncio.get_event_loop().run_in_executor(
                None, GameRound.generate_crash_multiplier
            )
            round_obj = await asyncio.get_event_loop().run_in_executor(
                None, lambda: GameRound.objects.create(
                    crash_multiplier=crash_point,
                    status='waiting',
                    current_multiplier=1.0
                )
            )

            # Get history for waiting screen
            history = await asyncio.get_event_loop().run_in_executor(
                None, get_recent_history
            )

            for remaining in range(WAITING_TIME, 0, -1):
                await broadcast(layer, {
                    "type": "game_state",
                    "round_number": round_obj.round_number,
                    "status": "waiting",
                    "current_multiplier": 1.0,
                    "countdown": remaining,
                    "history": history,
                })
                await asyncio.sleep(1)

            # --- FLYING PHASE ---
            round_obj.status = 'flying'
            round_obj.started_at = timezone.now()
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: round_obj.save(update_fields=['status', 'started_at'])
            )

            start_time = time.time()
            current_mult = 1.0

            while current_mult < crash_point:
                elapsed = time.time() - start_time
                # Exponential growth: starts slow, accelerates
                current_mult = round(math.pow(1.0024, elapsed * 100) , 2)
                current_mult = min(current_mult, crash_point)

                # Update DB every 5 ticks to reduce DB load
                if int(elapsed * 10) % 5 == 0:
                    round_obj.current_multiplier = current_mult
                    await asyncio.get_event_loop().run_in_executor(
                        None, lambda: round_obj.save(update_fields=['current_multiplier'])
                    )

                # Check auto cashouts
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda m=current_mult, r=round_obj: process_auto_cashouts(m, r)
                )

                # Get current bets for broadcast
                bets_data = await asyncio.get_event_loop().run_in_executor(
                    None, lambda r=round_obj: get_bets(r)
                )

                await broadcast(layer, {
                    "type": "game_state",
                    "round_number": round_obj.round_number,
                    "status": "flying",
                    "current_multiplier": current_mult,
                    "bets": bets_data,
                    "countdown": 0,
                    "history": [],
                })

                await asyncio.sleep(TICK_RATE)

            # --- CRASHED ---
            round_obj.status = 'crashed'
            round_obj.current_multiplier = crash_point
            round_obj.crashed_at = timezone.now()
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: round_obj.save(update_fields=['status', 'current_multiplier', 'crashed_at'])
            )

            # Mark all remaining active bets as lost
            await asyncio.get_event_loop().run_in_executor(
                None, lambda r=round_obj: mark_bets_lost(r)
            )

            await broadcast(layer, {
                "type": "game_state",
                "round_number": round_obj.round_number,
                "status": "crashed",
                "current_multiplier": crash_point,
                "bets": [],
                "countdown": 0,
                "history": [],
            })

            await asyncio.sleep(3)  # Show crash for 3 seconds

        except Exception as e:
            logger.error(f"Game engine error: {e}")
            await asyncio.sleep(5)


def get_recent_history():
    from .models import GameRound
    rounds = GameRound.objects.filter(status='crashed').order_by('-round_number')[:20]
    return [{"round": r.round_number, "multiplier": r.crash_multiplier} for r in rounds]


def get_bets(round_obj):
    from .models import Bet
    bets = Bet.objects.filter(round=round_obj).select_related('user')
    result = []
    for b in bets:
        result.append({
            "id": b.id,
            "username": b.user.username,
            "avatar": b.user.avatar,
            "amount": float(b.amount),
            "status": b.status,
            "cashout_multiplier": b.cashout_multiplier,
            "winnings": float(b.winnings),
        })
    return result


def process_auto_cashouts(current_mult, round_obj):
    from .models import Bet
    from django.db import transaction
    active_bets = Bet.objects.filter(
        round=round_obj,
        status='active',
        auto_cashout__isnull=False,
        auto_cashout__lte=current_mult
    ).select_related('user')

    for bet in active_bets:
        with transaction.atomic():
            bet.cashout_multiplier = bet.auto_cashout
            bet.winnings = bet.amount * Decimal(str(bet.auto_cashout))
            bet.status = 'won'
            bet.cashed_out_at = timezone.now()
            bet.save()
            # Credit user
            bet.user.balance += bet.winnings
            bet.user.total_won += bet.winnings
            bet.user.save(update_fields=['balance', 'total_won'])


def mark_bets_lost(round_obj):
    from .models import Bet
    Bet.objects.filter(round=round_obj, status='active').update(status='lost')