from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import GameRound, Bet, ChatMessage, Transaction

User = get_user_model()


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone_number', 'balance',
                  'avatar', 'total_wagered', 'total_won', 'net_profit', 'created_at']
        read_only_fields = ['balance', 'total_wagered', 'total_won', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'phone_number', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError("Passwords do not match.")
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class BetSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    avatar = serializers.CharField(source='user.avatar', read_only=True)

    class Meta:
        model = Bet
        fields = ['id', 'username', 'avatar', 'amount', 'auto_cashout',
                  'cashout_multiplier', 'winnings', 'status', 'placed_at']
        read_only_fields = ['cashout_multiplier', 'winnings', 'status', 'placed_at']


class PlaceBetSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=10)
    auto_cashout = serializers.FloatField(required=False, allow_null=True, min_value=1.01)


class CashoutSerializer(serializers.Serializer):
    bet_id = serializers.IntegerField()


class GameRoundSerializer(serializers.ModelSerializer):
    bets_count = serializers.SerializerMethodField()
    total_bets = serializers.SerializerMethodField()

    class Meta:
        model = GameRound
        fields = ['round_number', 'current_multiplier', 'status',
                  'crash_multiplier', 'started_at', 'crashed_at', 'bets_count', 'total_bets']

    def get_bets_count(self, obj):
        return obj.bets.count()

    def get_total_bets(self, obj):
        from django.db.models import Sum
        total = obj.bets.aggregate(Sum('amount'))['amount__sum']
        return float(total or 0)


class GameRoundHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GameRound
        fields = ['round_number', 'crash_multiplier', 'started_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    avatar = serializers.CharField(source='user.avatar', read_only=True)

    class Meta:
        model = ChatMessage
        fields = ['id', 'username', 'avatar', 'message', 'created_at']
        read_only_fields = ['created_at']


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'transaction_type', 'amount', 'status',
                  'reference', 'mpesa_receipt', 'phone_number', 'created_at']
        read_only_fields = ['status', 'mpesa_receipt', 'created_at']


class DepositSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=10)
    phone_number = serializers.CharField(max_length=15)


class WithdrawSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=100)
    phone_number = serializers.CharField(max_length=15)