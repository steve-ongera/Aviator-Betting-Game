from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import random
import math

User = get_user_model()


class GameRound(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('flying', 'Flying'),
        ('crashed', 'Crashed'),
    ]

    round_number = models.AutoField(primary_key=True)
    crash_multiplier = models.FloatField()  # pre-determined crash point
    current_multiplier = models.FloatField(default=1.0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='waiting')
    started_at = models.DateTimeField(null=True, blank=True)
    crashed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-round_number']

    @staticmethod
    def generate_crash_multiplier():
        """
        House-edge algorithm: ~30% chance crash at 1.00x-1.10x,
        ~40% chance 1.1x-2x, ~20% chance 2x-5x, ~10% chance 5x+
        Ensures house keeps edge while occasional big wins keep players engaged.
        """
        r = random.random()
        if r < 0.30:
            # Instant or near-instant crash (house wins big)
            return round(random.uniform(1.00, 1.15), 2)
        elif r < 0.70:
            # Low multiplier
            return round(random.uniform(1.15, 2.5), 2)
        elif r < 0.90:
            # Medium multiplier
            return round(random.uniform(2.5, 6.0), 2)
        elif r < 0.97:
            # High multiplier
            return round(random.uniform(6.0, 20.0), 2)
        else:
            # Rare big win
            return round(random.uniform(20.0, 100.0), 2)

    def __str__(self):
        return f"Round #{self.round_number} - {self.status} @ {self.crash_multiplier}x"


class Bet(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('won', 'Won'),
        ('lost', 'Lost'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bets')
    round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name='bets')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    auto_cashout = models.FloatField(null=True, blank=True)  # auto cashout multiplier
    cashout_multiplier = models.FloatField(null=True, blank=True)
    winnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    placed_at = models.DateTimeField(auto_now_add=True)
    cashed_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-placed_at']
        unique_together = ['user', 'round']

    def __str__(self):
        return f"{self.user.username} - {self.amount} KES @ Round #{self.round.round_number}"


class ChatMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_messages')
    message = models.TextField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}: {self.message[:50]}"


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
        ('bet', 'Bet'),
        ('win', 'Win'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    reference = models.CharField(max_length=100, unique=True, null=True, blank=True)
    mpesa_receipt = models.CharField(max_length=100, null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.transaction_type} - {self.amount} KES"