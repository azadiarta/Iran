from abc import ABC, abstractmethod


class BasePaymentProvider(ABC):
    """
    Abstract base for all payment providers.
    Adding a new provider (e.g. Stripe):
      1. Create payments/stripe.py extending BasePaymentProvider
      2. Register it in payments/factory.py
      No other files need to change.
    """

    @abstractmethod
    def is_configured(self) -> bool:
        """
        Returns True only if all required DefaultSetting keys exist and the
        provider is enabled. Returns False silently — never raises.
        """

    @abstractmethod
    def get_instructions(self, contribution) -> dict:
        """
        Returns display data for the user: account details, reference, amount, etc.
        Called after is_configured() returns True.
        """

    @abstractmethod
    def initiate_payment(self, contribution) -> dict:
        """
        Prepares the contribution for payment (sets status, generates reference).
        Returns the same dict as get_instructions().
        Must never raise unhandled exceptions.
        """

    @abstractmethod
    def verify_payment(self, contribution) -> bool:
        """
        Checks whether this contribution has been fulfilled.
        For manual/PayPal this means checking for pending_review or completed status.
        Actual admin approval happens via ContributionStatusUpdateView.
        """

    def get_unavailable_message(self) -> str:
        """Friendly message shown when is_configured() returns False."""
        return 'This payment method is not currently available. Please try another method.'
