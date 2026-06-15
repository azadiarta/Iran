// Bilingual labels and unavailable-messages for payment methods.
// Backend (payments/factory.py) sends English labels/messages — this maps
// the known method ids to localized text, falling back to the raw
// backend-provided text for any method not listed here.

export const PAYMENT_METHOD_LABELS: Record<string, { en: string; fa: string }> = {
  manual: { en: 'Bank Transfer', fa: 'انتقال بانکی' },
  paypal: { en: 'PayPal', fa: 'پی‌پال' },
  stripe: { en: 'Stripe', fa: 'استرایپ' },
  google_pay: { en: 'Google Pay', fa: 'گوگل پی' },
  other: { en: 'Other', fa: 'سایر' },
};

const UNAVAILABLE_MESSAGES: Record<string, { en: string; fa: string }> = {
  manual: {
    en: 'Bank transfer is not currently available. Please try another payment method.',
    fa: 'انتقال بانکی در حال حاضر در دسترس نیست. لطفاً روش دیگری را انتخاب کنید.',
  },
  paypal: {
    en: 'PayPal payments are not currently available. Please try another payment method.',
    fa: 'پرداخت با پی‌پال در حال حاضر در دسترس نیست. لطفاً روش دیگری را انتخاب کنید.',
  },
};

export function getPaymentMethodLabel(method: string, fallback: string, isRTL: boolean): string {
  const meta = PAYMENT_METHOD_LABELS[method];
  if (!meta) return fallback;
  return isRTL ? meta.fa : meta.en;
}

export function getPaymentMethodUnavailableMessage(
  method: string,
  fallback: string | null | undefined,
  isRTL: boolean,
): string {
  const meta = UNAVAILABLE_MESSAGES[method];
  if (meta) return isRTL ? meta.fa : meta.en;
  if (!isRTL) return fallback || `${getPaymentMethodLabel(method, method, isRTL)} is not currently available.`;
  return `${getPaymentMethodLabel(method, method, isRTL)} در حال حاضر در دسترس نیست.`;
}
