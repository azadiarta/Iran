import logging

from core.models import DefaultSetting
from fund.models import Contribution
from payments.base import BasePaymentProvider

logger = logging.getLogger(__name__)

_REQUIRED_KEYS = [
    'payment_manual_bank_name',
    'payment_manual_account_name',
    'payment_manual_account_number',
    'payment_manual_sort_code',
    'payment_manual_reference_prefix',
]


class ManualPaymentProvider(BasePaymentProvider):
    """
    Manual bank transfer provider.
    No third-party API — user reads bank details and transfers manually.
    Admin confirms via ContributionStatusUpdateView.
    """

    def _get_setting(self, key, default=''):
        setting = DefaultSetting.objects.filter(key=key).first()
        return setting.value if setting else default

    def is_configured(self) -> bool:
        try:
            if self._get_setting('payment_manual_enabled') != 'true':
                return False
            return all(
                bool(self._get_setting(key))
                for key in _REQUIRED_KEYS
            )
        except Exception:
            logger.exception('Failed to determine whether the manual payment provider is configured')
            return False

    def get_unavailable_message(self) -> str:
        return 'Bank transfer is not currently available. Please try another payment method.'

    def get_instructions(self, contribution) -> dict:
        prefix = self._get_setting('payment_manual_reference_prefix', 'FUND-')
        reference = f"{prefix}{str(contribution.id)[:8].upper()}"
        return {
            'bank_name':       self._get_setting('payment_manual_bank_name'),
            'account_name':    self._get_setting('payment_manual_account_name'),
            'account_number':  self._get_setting('payment_manual_account_number'),
            'sort_code':       self._get_setting('payment_manual_sort_code'),
            'reference':       reference,
            'amount':          str(contribution.amount),
            'currency':        contribution.currency,
            'instructions':    self._get_setting('payment_manual_instructions'),
        }

    def initiate_payment(self, contribution) -> dict:
        prefix = self._get_setting('payment_manual_reference_prefix', 'FUND-')
        reference = f"{prefix}{str(contribution.id)[:8].upper()}"

        contribution.status = Contribution.Status.PENDING
        existing_notes = contribution.notes.strip()
        ref_line = f"Reference: {reference}"
        contribution.notes = f"{ref_line}\n{existing_notes}" if existing_notes else ref_line
        contribution.save(update_fields=['status', 'notes'])

        return self.get_instructions(contribution)

    def verify_payment(self, contribution) -> bool:
        return contribution.status in (
            Contribution.Status.PENDING_REVIEW,
            Contribution.Status.COMPLETED,
        )
