from payments.manual import ManualPaymentProvider
from payments.paypal import PayPalPaymentProvider

# Registry maps payment_method value → provider class (or None if not yet built).
# To add a new provider: create payments/<name>.py, add it here. Nothing else changes.
_REGISTRY = {
    'manual':     ManualPaymentProvider,
    'paypal':     PayPalPaymentProvider,
    'stripe':     None,      # future phase
    'google_pay': None,      # future phase
}

_METHOD_LABELS = {
    'manual':     'Bank Transfer',
    'paypal':     'PayPal',
    'stripe':     'Stripe',
    'google_pay': 'Google Pay',
}


class PaymentFactory:

    @classmethod
    def get_provider(cls, payment_method):
        """
        Returns a provider instance for the given method, or None if
        the method is unknown or not yet implemented.
        Never raises.
        """
        provider_class = _REGISTRY.get(payment_method)
        if provider_class is None:
            return None
        return provider_class()

    @classmethod
    def all_methods(cls):
        """
        Returns list of dicts describing every known payment method and its
        availability — used by PaymentMethodsView.
        """
        results = []
        for method, provider_class in _REGISTRY.items():
            label = _METHOD_LABELS.get(method, method)
            if provider_class is None:
                results.append({
                    'method':              method,
                    'label':               label,
                    'is_available':        False,
                    'unavailable_message': f'{label} is not currently available.',
                })
                continue
            provider = provider_class()
            if provider.is_configured():
                results.append({
                    'method':              method,
                    'label':               label,
                    'is_available':        True,
                    'unavailable_message': None,
                })
            else:
                results.append({
                    'method':              method,
                    'label':               label,
                    'is_available':        False,
                    'unavailable_message': provider.get_unavailable_message(),
                })
        return results
