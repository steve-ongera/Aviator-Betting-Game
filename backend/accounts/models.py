from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    avatar = models.CharField(max_length=5, default='🎮')  # emoji avatar
    total_wagered = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username

    @property
    def net_profit(self):
        return self.total_won - self.total_wagered