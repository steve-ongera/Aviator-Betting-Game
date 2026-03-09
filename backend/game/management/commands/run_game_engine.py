import asyncio
from django.core.management.base import BaseCommand
from backend.game.engine import run_game_loop


class Command(BaseCommand):
    help = 'Run the Aviator game engine'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting Aviator Game Engine...'))
        asyncio.run(run_game_loop())