from django.urls import path

from payments.views import (
    PaymentInitiateView,
    PaymentMethodsView,
    PaymentStatusView,
    ReceiptUploadView,
)

urlpatterns = [
    path('methods/', PaymentMethodsView.as_view(), name='payment-methods'),
    path('initiate/', PaymentInitiateView.as_view(), name='payment-initiate'),
    path('<uuid:pk>/receipt/', ReceiptUploadView.as_view(), name='payment-receipt-upload'),
    path('<uuid:pk>/status/', PaymentStatusView.as_view(), name='payment-status'),
]
