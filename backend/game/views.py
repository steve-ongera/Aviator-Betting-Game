from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Count, Avg
from decimal import Decimal
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import uuid

from .models import GameRound, Bet, ChatMessage, Transaction
from .serializers import (
    BetSerializer, PlaceBetSerializer, CashoutSerializer,
    GameRoundSerializer, GameRoundHistorySerializer,
    ChatMessageSerializer, TransactionSerializer,
    DepositSerializer, WithdrawSerializer,
    RegisterSerializer, UserProfileSerializer
)

User = get_user_model()


class AuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Give new users a small demo balance when DEBUG=True
            from django.conf import settings
            if settings.DEBUG:
                user.balance = Decimal('1000.00')
                user.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data,
            })
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    @action(detail=False, methods=['post'])
    def refresh_token(self, request):
        try:
            refresh = RefreshToken(request.data.get('refresh'))
            return Response({'access': str(refresh.access_token)})
        except Exception:
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)


class UserViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def profile(self, request):
        return Response(UserProfileSerializer(request.user).data)

    @action(detail=False, methods=['patch'])
    def update_profile(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def bet_history(self, request):
        bets = Bet.objects.filter(user=request.user).select_related('round')[:50]
        data = []
        for b in bets:
            data.append({
                'id': b.id,
                'round': b.round.round_number,
                'amount': float(b.amount),
                'cashout_multiplier': b.cashout_multiplier,
                'winnings': float(b.winnings),
                'status': b.status,
                'placed_at': b.placed_at.isoformat(),
            })
        return Response(data)

    @action(detail=False, methods=['get'])
    def transactions(self, request):
        txns = Transaction.objects.filter(user=request.user)[:50]
        return Response(TransactionSerializer(txns, many=True).data)


class GameViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def current_round(self, request):
        round_obj = GameRound.objects.filter(
            status__in=['waiting', 'flying']
        ).order_by('-round_number').first()
        if round_obj:
            return Response(GameRoundSerializer(round_obj).data)
        return Response({'status': 'waiting', 'current_multiplier': 1.0})

    @action(detail=False, methods=['get'])
    def history(self, request):
        rounds = GameRound.objects.filter(status='crashed').order_by('-round_number')[:50]
        return Response(GameRoundHistorySerializer(rounds, many=True).data)

    @action(detail=False, methods=['post'])
    def place_bet(self, request):
        serializer = PlaceBetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data['amount']
        auto_cashout = serializer.validated_data.get('auto_cashout')

        # Get current waiting round
        round_obj = GameRound.objects.filter(status='waiting').order_by('-round_number').first()
        if not round_obj:
            return Response({'error': 'No round accepting bets right now'}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing bet
        if Bet.objects.filter(user=request.user, round=round_obj).exists():
            return Response({'error': 'You already have a bet in this round'}, status=status.HTTP_400_BAD_REQUEST)

        # Check balance
        if request.user.balance < amount:
            return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            request.user.balance -= amount
            request.user.total_wagered += amount
            request.user.save(update_fields=['balance', 'total_wagered'])

            bet = Bet.objects.create(
                user=request.user,
                round=round_obj,
                amount=amount,
                auto_cashout=auto_cashout,
                status='active'
            )

            # Also create transaction record
            Transaction.objects.create(
                user=request.user,
                transaction_type='bet',
                amount=amount,
                status='completed',
                reference=f"BET-{bet.id}"
            )

        # Broadcast bet placed
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)("game_room", {
            "type": "bet_placed",
            "bet_id": bet.id,
            "username": request.user.username,
            "avatar": request.user.avatar,
            "amount": float(amount),
            "round_number": round_obj.round_number,
        })

        return Response({
            'bet_id': bet.id,
            'amount': float(amount),
            'round_number': round_obj.round_number,
            'balance': float(request.user.balance),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def cashout(self, request):
        serializer = CashoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        bet_id = serializer.validated_data['bet_id']

        try:
            bet = Bet.objects.select_related('round', 'user').get(
                id=bet_id,
                user=request.user,
                status='active'
            )
        except Bet.DoesNotExist:
            return Response({'error': 'Bet not found or already settled'}, status=status.HTTP_404_NOT_FOUND)

        if bet.round.status != 'flying':
            return Response({'error': 'Round is not active'}, status=status.HTTP_400_BAD_REQUEST)

        current_mult = bet.round.current_multiplier

        with transaction.atomic():
            winnings = bet.amount * Decimal(str(current_mult))
            bet.cashout_multiplier = current_mult
            bet.winnings = winnings
            bet.status = 'won'
            bet.cashed_out_at = timezone.now()
            bet.save()

            request.user.balance += winnings
            request.user.total_won += winnings
            request.user.save(update_fields=['balance', 'total_won'])

            Transaction.objects.create(
                user=request.user,
                transaction_type='win',
                amount=winnings,
                status='completed',
                reference=f"WIN-{bet.id}"
            )

        # Broadcast cashout
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)("game_room", {
            "type": "cashout_event",
            "username": request.user.username,
            "avatar": request.user.avatar,
            "multiplier": current_mult,
            "winnings": float(winnings),
            "bet_id": bet.id,
        })

        return Response({
            'multiplier': current_mult,
            'winnings': float(winnings),
            'balance': float(request.user.balance),
        })

    @action(detail=False, methods=['get'])
    def my_active_bet(self, request):
        round_obj = GameRound.objects.filter(
            status__in=['waiting', 'flying']
        ).order_by('-round_number').first()
        if not round_obj:
            return Response({'bet': None})
        try:
            bet = Bet.objects.get(user=request.user, round=round_obj, status='active')
            return Response({'bet': BetSerializer(bet).data, 'round_status': round_obj.status})
        except Bet.DoesNotExist:
            return Response({'bet': None, 'round_status': round_obj.status if round_obj else 'waiting'})


class ChatViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def messages(self, request):
        msgs = ChatMessage.objects.select_related('user').order_by('-created_at')[:50]
        return Response(ChatMessageSerializer(msgs, many=True).data)

    @action(detail=False, methods=['post'])
    def send(self, request):
        message = request.data.get('message', '').strip()
        if not message or len(message) > 200:
            return Response({'error': 'Invalid message'}, status=status.HTTP_400_BAD_REQUEST)

        msg = ChatMessage.objects.create(user=request.user, message=message)

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)("game_room", {
            "type": "chat_broadcast",
            "username": request.user.username,
            "avatar": request.user.avatar,
            "message": msg.message,
            "created_at": msg.created_at.isoformat(),
        })

        return Response(ChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class PaymentViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def deposit(self, request):
        from django.conf import settings
        serializer = DepositSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data['amount']
        phone = serializer.validated_data['phone_number']
        ref = f"DEP-{uuid.uuid4().hex[:8].upper()}"

        if not settings.DEBUG:
            # Production: Initiate M-Pesa STK Push
            result = initiate_mpesa_stk(phone, amount, ref)
            if not result['success']:
                return Response({'error': result['message']}, status=status.HTTP_400_BAD_REQUEST)
            txn = Transaction.objects.create(
                user=request.user,
                transaction_type='deposit',
                amount=amount,
                status='pending',
                reference=ref,
                phone_number=phone
            )
            return Response({'message': 'STK Push sent. Enter PIN on your phone.', 'reference': ref})
        else:
            # DEBUG: Instantly credit balance
            with transaction.atomic():
                request.user.balance += amount
                request.user.save(update_fields=['balance'])
                txn = Transaction.objects.create(
                    user=request.user,
                    transaction_type='deposit',
                    amount=amount,
                    status='completed',
                    reference=ref,
                    phone_number=phone
                )
            return Response({
                'message': f'KES {amount} credited (debug mode)',
                'balance': float(request.user.balance),
                'reference': ref
            })

    @action(detail=False, methods=['post'])
    def withdraw(self, request):
        from django.conf import settings
        serializer = WithdrawSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data['amount']
        phone = serializer.validated_data['phone_number']

        if request.user.balance < amount:
            return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)

        ref = f"WD-{uuid.uuid4().hex[:8].upper()}"

        with transaction.atomic():
            request.user.balance -= amount
            request.user.save(update_fields=['balance'])
            txn = Transaction.objects.create(
                user=request.user,
                transaction_type='withdrawal',
                amount=amount,
                status='pending' if not settings.DEBUG else 'completed',
                reference=ref,
                phone_number=phone
            )

        return Response({
            'message': 'Withdrawal initiated' if not settings.DEBUG else 'Withdrawal processed (debug)',
            'balance': float(request.user.balance),
            'reference': ref
        })

    @action(detail=False, methods=['post'])
    def mpesa_callback(self, request):
        """M-Pesa IPN callback"""
        body = request.data.get('Body', {})
        callback = body.get('stkCallback', {})
        result_code = callback.get('ResultCode')
        merchant_ref = callback.get('CheckoutRequestID')

        if result_code == 0:
            # Success
            items = callback.get('CallbackMetadata', {}).get('Item', [])
            amount = next((i['Value'] for i in items if i['Name'] == 'Amount'), 0)
            receipt = next((i['Value'] for i in items if i['Name'] == 'MpesaReceiptNumber'), '')

            txn = Transaction.objects.filter(reference__contains=merchant_ref).first()
            if txn and txn.status == 'pending':
                txn.status = 'completed'
                txn.mpesa_receipt = receipt
                txn.save()
                txn.user.balance += txn.amount
                txn.user.save(update_fields=['balance'])

        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


def initiate_mpesa_stk(phone, amount, reference):
    """M-Pesa Daraja API STK Push"""
    import requests
    import base64
    from datetime import datetime
    from django.conf import settings

    try:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password = base64.b64encode(
            f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
        ).decode()

        # Get access token
        auth_resp = requests.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET)
        )
        token = auth_resp.json().get('access_token')

        # STK Push
        payload = {
            "BusinessShortCode": settings.MPESA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
            "PartyA": phone,
            "PartyB": settings.MPESA_SHORTCODE,
            "PhoneNumber": phone,
            "CallBackURL": f"{settings.MPESA_CALLBACK_URL}/api/payments/mpesa_callback/",
            "AccountReference": "AviatorBet",
            "TransactionDesc": reference
        }

        resp = requests.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            json=payload,
            headers={'Authorization': f'Bearer {token}'}
        )
        data = resp.json()
        if data.get('ResponseCode') == '0':
            return {'success': True, 'checkout_id': data.get('CheckoutRequestID')}
        return {'success': False, 'message': data.get('errorMessage', 'M-Pesa error')}
    except Exception as e:
        return {'success': False, 'message': str(e)}


class AdminStatsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        from django.db.models import Sum, Count
        stats = {
            'total_users': User.objects.count(),
            'total_rounds': GameRound.objects.filter(status='crashed').count(),
            'total_bets': Bet.objects.count(),
            'total_wagered': float(Bet.objects.aggregate(Sum('amount'))['amount__sum'] or 0),
            'total_won': float(Bet.objects.filter(status='won').aggregate(Sum('winnings'))['winnings__sum'] or 0),
            'house_profit': 0,
        }
        stats['house_profit'] = stats['total_wagered'] - stats['total_won']
        return Response(stats)

    @action(detail=False, methods=['get'])
    def recent_rounds(self, request):
        rounds = GameRound.objects.filter(status='crashed').order_by('-round_number')[:20]
        data = []
        for r in rounds:
            bets = r.bets.all()
            total_bet = sum(b.amount for b in bets)
            total_won = sum(b.winnings for b in bets if b.status == 'won')
            data.append({
                'round': r.round_number,
                'crash_multiplier': r.crash_multiplier,
                'total_bets': float(total_bet),
                'total_won': float(total_won),
                'house_profit': float(total_bet - total_won),
                'bet_count': bets.count(),
                'started_at': r.started_at.isoformat() if r.started_at else None,
            })
        return Response(data)