from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import GameRound, Bet, ChatMessage, Transaction
from backend.accounts.models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'phone_number', 'balance_display', 'total_wagered', 'total_won', 'is_active']
    list_filter = ['is_active', 'is_staff', 'date_joined']
    search_fields = ['username', 'email', 'phone_number']
    readonly_fields = ['total_wagered', 'total_won', 'created_at']

    fieldsets = UserAdmin.fieldsets + (
        ('Wallet', {'fields': ('balance', 'phone_number', 'avatar', 'total_wagered', 'total_won')}),
    )

    def balance_display(self, obj):
        color = 'green' if obj.balance > 0 else 'red'
        return format_html('<span style="color:{}">{} KES</span>', color, obj.balance)
    balance_display.short_description = 'Balance'


@admin.register(GameRound)
class GameRoundAdmin(admin.ModelAdmin):
    list_display = ['round_number', 'crash_multiplier_display', 'status', 'bet_count', 'house_profit_display', 'started_at']
    list_filter = ['status']
    readonly_fields = ['round_number', 'started_at', 'crashed_at']
    ordering = ['-round_number']

    def crash_multiplier_display(self, obj):
        color = 'red' if obj.crash_multiplier < 2 else 'orange' if obj.crash_multiplier < 5 else 'green'
        return format_html('<span style="color:{}; font-weight:bold">{}x</span>', color, obj.crash_multiplier)
    crash_multiplier_display.short_description = 'Crash Point'

    def bet_count(self, obj):
        return obj.bets.count()
    bet_count.short_description = 'Bets'

    def house_profit_display(self, obj):
        total_bet = sum(b.amount for b in obj.bets.all())
        total_won = sum(b.winnings for b in obj.bets.filter(status='won'))
        profit = total_bet - total_won
        color = 'green' if profit >= 0 else 'red'
        return format_html('<span style="color:{}">{} KES</span>', color, round(profit, 2))
    house_profit_display.short_description = 'House Profit'


@admin.register(Bet)
class BetAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'round_id', 'amount', 'status', 'cashout_multiplier', 'winnings', 'placed_at']
    list_filter = ['status', 'placed_at']
    search_fields = ['user__username']
    readonly_fields = ['placed_at', 'cashed_out_at']


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'transaction_type', 'amount', 'status', 'reference', 'created_at']
    list_filter = ['transaction_type', 'status', 'created_at']
    search_fields = ['user__username', 'reference', 'mpesa_receipt']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['user', 'message', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'message']