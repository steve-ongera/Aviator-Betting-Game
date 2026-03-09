from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AuthViewSet, UserViewSet, GameViewSet,
    ChatViewSet, PaymentViewSet, AdminStatsViewSet
)

router = DefaultRouter()
router.register('auth', AuthViewSet, basename='auth')
router.register('users', UserViewSet, basename='users')
router.register('game', GameViewSet, basename='game')
router.register('chat', ChatViewSet, basename='chat')
router.register('payments', PaymentViewSet, basename='payments')
router.register('admin-stats', AdminStatsViewSet, basename='admin-stats')

urlpatterns = [
    path('', include(router.urls)),
]