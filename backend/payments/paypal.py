from core.models import DefaultSetting
from fund.models import Contribution
from payments.base import BasePaymentProvider


class PayPalPaymentProvider(BasePaymentProvider):
    """
    PayPal Personal / Sole Trader provider.
    NOT a PayPal API integration — user sends money manually via PayPal app/web.
    Flow: show PayPal email + paypal.me link → user sends → uploads screenshot → admin confirms.
    Admin confirms via ContributionStatusUpdateView.
    """

    def _get_setting(self, key, default=''):
        setting = DefaultSetting.objects.filter(key=key).first()
        return setting.value if setting else default

    def is_configured(self) -> bool:
        try:
            if self._get_setting('payment_paypal_enabled') != 'true':
                return False
            return bool(self._get_setting('payment_paypal_email')) and \
                   bool(self._get_setting('payment_paypal_me_link'))
        except Exception:
            return False

    def get_unavailable_message(self) -> str:
        return 'PayPal payments are not currently available. Please try another payment method.'

    def get_instructions(self, contribution) -> dict:
        prefix = 'FUND-'
        reference = f"{prefix}{str(contribution.id)[:8].upper()}"
        return {
            'paypal_email':    self._get_setting('payment_paypal_email'),
            'paypal_me_link':  self._get_setting('payment_paypal_me_link'),
            'reference':       reference,
            'amount':          str(contribution.amount),
            'currency':        contribution.currency,
            'instructions':    self._get_setting('payment_paypal_instructions'),
        }

    def initiate_payment(self, contribution) -> dict:
        contribution.status = Contribution.Status.PENDING
        contribution.save(update_fields=['status'])
        return self.get_instructions(contribution)

    def verify_payment(self, contribution) -> bool:
        return contribution.status in (
            Contribution.Status.PENDING_REVIEW,
            Contribution.Status.COMPLETED,
        )
