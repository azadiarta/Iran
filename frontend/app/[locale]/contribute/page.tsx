'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle,
  Copy,
  CreditCard,
  Upload,
  Camera,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Building2,
  Check,
} from 'lucide-react';
import { paymentsAPI, ContributionDisplayNameChoice } from '@/lib/api';
import { getPaymentMethodLabel, getPaymentMethodUnavailableMessage } from '@/lib/paymentMethodsMeta';
import AdminToggle from '@/components/admin/fields/AdminToggle';
import Turnstile from '@/components/common/Turnstile';
import useAuthStore from '@/store/authStore';
import { SHORT_TEXT_PUBLIC_MAX_LENGTH } from '@/lib/validation';

const AMOUNT_REGEX = /^\d{0,9}(\.\d{0,2})?$/;

interface PaymentMethod {
  method: string;
  label: string;
  is_available: boolean;
  unavailable_message?: string;
}

interface ManualInstructions {
  bank_name: string;
  account_name: string;
  account_number: string;
  sort_code: string;
  reference: string;
  amount: number;
  currency: string;
  instructions?: string;
}

interface PaypalInstructions {
  paypal_email: string;
  paypal_me_link?: string;
  reference: string;
  amount: number;
  currency: string;
  instructions?: string;
}

type Instructions = ManualInstructions | PaypalInstructions;

type Step = 1 | 2 | 3 | 4;

const STEP_KEYS = [
  'contribute.step_amount',
  'contribute.step_instructions',
  'contribute.step_receipt',
  'contribute.step_done',
] as const;

export default function ContributePage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'fa';
  const { isAuthenticated } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [showInPublicList, setShowInPublicList] = useState(false);
  const [displayNameChoice, setDisplayNameChoice] = useState<ContributionDisplayNameChoice>('display_name');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  useEffect(() => {
    const fetchMethods = async () => {
      setLoadingMethods(true);
      try {
        const res = await paymentsAPI.getMethods();
        const data = res.data as unknown as { methods: PaymentMethod[] };
        setMethods(data?.methods || []);
      } catch {
        setMethods([]);
      } finally {
        setLoadingMethods(false);
      }
    };
    fetchMethods();
  }, []);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleInitiate = async () => {
    if (!selectedMethod || !amount) return;
    if (!captchaToken) {
      setError(t('common.captcha_required_error'));
      return;
    }
    setInitiating(true);
    setError(null);
    try {
      const payload: {
        amount: number;
        payment_method: string;
        guest_name?: string;
        show_in_public_list?: boolean;
        display_name_choice?: ContributionDisplayNameChoice;
        public_display_name?: string;
        message?: string;
        captcha_token: string;
      } = {
        amount: parseFloat(amount),
        payment_method: selectedMethod,
        show_in_public_list: showInPublicList,
        display_name_choice: displayNameChoice,
        captcha_token: captchaToken,
      };
      if (!isAuthenticated && guestName.trim()) {
        payload.guest_name = guestName.trim();
      }
      if (showInPublicList && displayNameChoice === 'custom') {
        payload.public_display_name = customDisplayName.trim();
      }
      if (message.trim()) {
        payload.message = message.trim();
      }
      const res = await paymentsAPI.initiate(payload);
      const data = res.data as unknown as {
        is_available: boolean;
        contribution_id: string;
        payment_method: string;
        status: string;
        instructions: Instructions;
        unavailable_message?: string;
      };
      if (!data.is_available) {
        setError(getPaymentMethodUnavailableMessage(data.payment_method || selectedMethod, data.unavailable_message, isRTL) || t('contribute.unavailable_msg'));
        return;
      }
      setContributionId(data.contribution_id);
      setInstructions(data.instructions);
      setStep(2);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || t('contribute.error_generic'));
      setCaptchaToken('');
      setCaptchaResetKey((k) => k + 1);
    } finally {
      setInitiating(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !contributionId) return;
    setUploading(true);
    setUploadError(null);
    try {
      await paymentsAPI.uploadReceipt(contributionId, selectedFile);
      setStep(4);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setUploadError(axiosErr?.response?.data?.message || t('contribute.upload_error'));
    } finally {
      setUploading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' ';
    return `${symbol}${Number(amount).toFixed(2)}`;
  };

  const handleAmountChange = (value: string) => {
    if (value === '' || AMOUNT_REGEX.test(value)) {
      setAmount(value);
      setAmountError(null);
      return;
    }
    setAmountError(t('contribute.amount_invalid'));
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(120);
    }
    setTimeout(() => setAmountError(null), 3000);
  };

  const nameChoices: ContributionDisplayNameChoice[] = isAuthenticated
    ? ['display_name', 'full_name', 'custom']
    : ['display_name', 'custom'];

  const nameChoiceLabel = (choice: ContributionDisplayNameChoice) => {
    if (!isAuthenticated && choice === 'display_name') {
      return t('contribute.display_name_choice_my_name');
    }
    return t(`contribute.display_name_choice_${choice}`);
  };

  const allUnavailable = methods.length > 0 && methods.every((m) => !m.is_available);
  const canProceed =
    parseFloat(amount) > 0 &&
    selectedMethod !== null &&
    (isAuthenticated || guestName.trim().length > 0) &&
    (!showInPublicList || displayNameChoice !== 'custom' || customDisplayName.trim().length > 0) &&
    !!captchaToken;

  const manualInstructions = instructions as ManualInstructions | null;
  const paypalInstructions = instructions as PaypalInstructions | null;
  const isManual = selectedMethod === 'manual';

  const referenceCode = instructions?.reference || '';

  // ── Step Indicator ────────────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-10 gap-0">
      {[1, 2, 3, 4].map((s, idx) => {
        const isActive = s === step;
        const isDone = s < step;
        const isFuture = s > step;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
                style={{
                  borderColor: isDone ? '#10b981' : isActive ? '#00ffff' : 'rgba(255,255,255,0.2)',
                  color: isDone ? '#10b981' : isActive ? '#00ffff' : 'rgba(255,255,255,0.3)',
                  backgroundColor: isDone
                    ? 'rgba(16,185,129,0.15)'
                    : isActive
                      ? 'rgba(0,255,255,0.1)'
                      : 'transparent',
                  boxShadow: isActive ? '0 0 12px rgba(0,255,255,0.3)' : 'none',
                }}
              >
                {isDone ? <Check className="w-4 h-4" /> : s}
              </div>
              <span
                className="text-[10px] hidden sm:block text-center max-w-[80px] leading-tight"
                style={{
                  color: isDone ? '#10b981' : isActive ? '#00ffff' : 'rgba(255,255,255,0.3)',
                }}
              >
                {t(STEP_KEYS[idx])}
              </span>
            </div>
            {idx < 3 && (
              <div
                className="w-10 sm:w-16 h-0.5 mx-1 mb-5 transition-all"
                style={{
                  backgroundColor: s < step ? '#10b981' : 'rgba(255,255,255,0.1)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Amount input */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          {t('contribute.amount_label')}
        </label>
        <div className="relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold"
            style={{ color: '#00ffff' }}
          >
            £
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full pl-10 pr-4 py-4 text-xl font-bold rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all"
          />
        </div>
        {amountError && (
          <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>{amountError}</p>
        )}
      </div>

      {/* Guest name (unauthenticated only) */}
      {!isAuthenticated && (
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            {t('contribute.guest_name_label')}{' '}
            <span className="text-[#ef4444]">*</span>
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder={t('contribute.guest_name_placeholder')}
            maxLength={SHORT_TEXT_PUBLIC_MAX_LENGTH}
            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all"
          />
          <p className="text-xs text-white/30 mt-1 text-right">
            {guestName.length}/{SHORT_TEXT_PUBLIC_MAX_LENGTH}
          </p>
        </div>
      )}

      {/* Payment methods */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-3">
          {t('contribute.method_label')}
        </label>
        {loadingMethods ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 h-20 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {methods.map((m) => {
              const isSelected = selectedMethod === m.method;
              return (
                <button
                  key={m.method}
                  onClick={() => m.is_available && setSelectedMethod(m.method)}
                  disabled={!m.is_available}
                  title={!m.is_available ? getPaymentMethodUnavailableMessage(m.method, m.unavailable_message, isRTL) : undefined}
                  className="relative rounded-2xl border p-5 text-left transition-all group"
                  style={{
                    borderColor: isSelected
                      ? '#00ffff'
                      : 'rgba(255,255,255,0.1)',
                    backgroundColor: isSelected
                      ? 'rgba(0,255,255,0.1)'
                      : 'rgba(255,255,255,0.03)',
                    opacity: !m.is_available ? 0.4 : 1,
                    cursor: !m.is_available ? 'not-allowed' : 'pointer',
                    boxShadow: isSelected ? '0 0 16px rgba(0,255,255,0.2)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {m.method === 'manual' ? (
                      <Building2 className="w-6 h-6" style={{ color: isSelected ? '#00ffff' : 'rgba(255,255,255,0.5)' }} />
                    ) : (
                      <CreditCard className="w-6 h-6" style={{ color: isSelected ? '#00ffff' : 'rgba(255,255,255,0.5)' }} />
                    )}
                    <span
                      className="font-semibold text-sm"
                      style={{ color: isSelected ? '#00ffff' : 'rgba(255,255,255,0.8)' }}
                    >
                      {getPaymentMethodLabel(m.method, m.label, isRTL)}
                    </span>
                  </div>
                  {!m.is_available && (
                    <p className="text-xs text-white/40 mt-1 truncate">
                      {getPaymentMethodUnavailableMessage(m.method, m.unavailable_message, isRTL)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {allUnavailable && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-4">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            <p className="text-sm" style={{ color: '#f59e0b' }}>
              {t('contribute.unavailable_msg')}
            </p>
          </div>
        )}
      </div>

      {/* Public contributors list */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <AdminToggle
          checked={showInPublicList}
          onChange={setShowInPublicList}
          label={t('contribute.show_in_public_list_label')}
          description={t('contribute.show_in_public_list_hint')}
        />

        {showInPublicList && (
          <div className="mt-5 pt-5 border-t border-white/10 space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                {t('contribute.display_name_choice_label')}
              </label>
              <div className="flex flex-col gap-2">
                {nameChoices.map((choice) => (
                  <label key={choice} className="flex items-center gap-2 cursor-pointer text-sm text-white/70">
                    <input
                      type="radio"
                      name="display_name_choice"
                      value={choice}
                      checked={displayNameChoice === choice}
                      onChange={() => setDisplayNameChoice(choice)}
                      className="accent-[#00ffff] w-4 h-4"
                    />
                    {nameChoiceLabel(choice)}
                  </label>
                ))}
              </div>
              {displayNameChoice === 'custom' && (
                <input
                  type="text"
                  value={customDisplayName}
                  onChange={(e) => setCustomDisplayName(e.target.value)}
                  maxLength={SHORT_TEXT_PUBLIC_MAX_LENGTH}
                  placeholder={t('contribute.custom_name_placeholder')}
                  className="mt-3 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all"
                />
              )}
              {displayNameChoice === 'custom' && (
                <p className="text-xs text-white/30 mt-1 text-right">
                  {customDisplayName.length}/{SHORT_TEXT_PUBLIC_MAX_LENGTH}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                {t('contribute.message_label')}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, SHORT_TEXT_PUBLIC_MAX_LENGTH))}
                maxLength={SHORT_TEXT_PUBLIC_MAX_LENGTH}
                rows={3}
                placeholder={t('contribute.message_placeholder')}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff]/30 transition-all resize-none"
              />
              <p className="text-xs text-white/30 mt-1 text-right">
                {message.length}/{SHORT_TEXT_PUBLIC_MAX_LENGTH}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CAPTCHA */}
      <div className="flex justify-center">
        <Turnstile
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken('')}
          resetKey={captchaResetKey}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {/* Next button */}
      <button
        onClick={handleInitiate}
        disabled={!canProceed || initiating || allUnavailable}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          backgroundColor: canProceed && !allUnavailable ? '#00ffff' : 'rgba(0,255,255,0.1)',
          color: canProceed && !allUnavailable ? '#0a0a0f' : '#00ffff',
          boxShadow: canProceed && !allUnavailable ? '0 0 24px rgba(0,255,255,0.3)' : 'none',
        }}
      >
        {initiating ? (
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {t('contribute.next')}
            <ChevronRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const CopyButton = ({ value, fieldKey }: { value: string; fieldKey: string }) => (
    <button
      onClick={() => copyToClipboard(value, fieldKey)}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
      style={{
        color: copiedField === fieldKey ? '#10b981' : '#00ffff',
        border: `1px solid ${copiedField === fieldKey ? 'rgba(16,185,129,0.3)' : 'rgba(0,255,255,0.3)'}`,
        backgroundColor: copiedField === fieldKey ? 'rgba(16,185,129,0.1)' : 'rgba(0,255,255,0.05)',
      }}
    >
      {copiedField === fieldKey ? (
        <><Check className="w-3 h-3" /> {t('contribute.copied')}</>
      ) : (
        <><Copy className="w-3 h-3" /> {t('contribute.copy')}</>
      )}
    </button>
  );

  const InfoRow = ({ label, value, fieldKey }: { label: string; value: string; fieldKey: string }) => (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5">
      <span className="text-sm text-white/50 min-w-[120px]">{label}</span>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className="font-semibold text-white text-sm text-right break-all">{value}</span>
        <CopyButton value={value} fieldKey={fieldKey} />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        {isManual && manualInstructions ? (
          <>
            {/* Amount prominent */}
            <div className="text-center mb-6 pb-6 border-b border-white/10">
              <p className="text-sm text-white/50 mb-1">{t('contribute.amount_to_send')}</p>
              <p
                className="text-3xl font-bold"
                style={{ color: '#10b981', textShadow: '0 0 16px rgba(16,185,129,0.4)' }}
              >
                {formatAmount(manualInstructions.amount, manualInstructions.currency)}
              </p>
            </div>

            <InfoRow label={t('contribute.bank_name')} value={manualInstructions.bank_name} fieldKey="bank_name" />
            <InfoRow label={t('contribute.account_name')} value={manualInstructions.account_name} fieldKey="account_name" />
            <InfoRow label={t('contribute.account_number')} value={manualInstructions.account_number} fieldKey="account_number" />
            <InfoRow label={t('contribute.sort_code')} value={manualInstructions.sort_code} fieldKey="sort_code" />
            <InfoRow label={t('contribute.reference')} value={manualInstructions.reference} fieldKey="reference" />

            {manualInstructions.instructions && (
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-white/60 leading-relaxed">{manualInstructions.instructions}</p>
              </div>
            )}
          </>
        ) : paypalInstructions ? (
          <>
            {/* Amount prominent */}
            <div className="text-center mb-6 pb-6 border-b border-white/10">
              <p className="text-sm text-white/50 mb-1">{t('contribute.amount_to_send')}</p>
              <p
                className="text-3xl font-bold"
                style={{ color: '#10b981', textShadow: '0 0 16px rgba(16,185,129,0.4)' }}
              >
                {formatAmount(paypalInstructions.amount, paypalInstructions.currency)}
              </p>
            </div>

            <InfoRow label={t('contribute.paypal_email')} value={paypalInstructions.paypal_email} fieldKey="paypal_email" />
            {paypalInstructions.paypal_me_link && (
              <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5">
                <span className="text-sm text-white/50 min-w-[120px]">{t('contribute.paypal_link')}</span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <a
                    href={paypalInstructions.paypal_me_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm underline break-all"
                    style={{ color: '#00ffff' }}
                  >
                    {paypalInstructions.paypal_me_link}
                  </a>
                  <CopyButton value={paypalInstructions.paypal_me_link} fieldKey="paypal_link" />
                </div>
              </div>
            )}
            <InfoRow label={t('contribute.reference')} value={paypalInstructions.reference} fieldKey="reference" />

            {paypalInstructions.instructions && (
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-white/60 leading-relaxed">{paypalInstructions.instructions}</p>
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('contribute.back')}
        </button>
        <button
          onClick={() => setStep(3)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all"
          style={{
            backgroundColor: '#00ffff',
            color: '#0a0a0f',
            boxShadow: '0 0 24px rgba(0,255,255,0.3)',
          }}
        >
          {t('contribute.continue_receipt')}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <p className="text-white/60 text-sm mb-5">{t('contribute.receipt_desc')}</p>

        {/* Upload area */}
        <div
          className="w-full border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 transition-all"
          style={{
            borderColor: selectedFile ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)',
          }}
        >
          <Upload
            className="w-10 h-10"
            style={{ color: selectedFile ? '#10b981' : 'rgba(255,255,255,0.3)' }}
          />
          {selectedFile ? (
            <div className="text-center">
              <p className="font-semibold text-sm" style={{ color: '#10b981' }}>
                {selectedFile.name}
              </p>
              <p className="text-xs text-white/40 mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-white/60">
                {t('contribute.click_to_upload')}
              </p>
              <p className="text-xs text-white/30 mt-1">JPG, PNG, PDF</p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-all"
            >
              <Upload className="w-4 h-4" />
              {t('contribute.choose_file')}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-all"
            >
              <Camera className="w-4 h-4" />
              {t('contribute.take_photo')}
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setSelectedFile(file);
              setUploadError(null);
            }
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setSelectedFile(file);
              setUploadError(null);
            }
          }}
        />

        {/* Upload progress */}
        {uploading && (
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full animate-[progress_1.5s_ease-in-out_infinite]"
                style={{
                  backgroundColor: '#00ffff',
                  animation: 'progress 1.5s ease-in-out infinite',
                  width: '60%',
                }}
              />
            </div>
            <style>{`
              @keyframes progress {
                0% { transform: translateX(-100%); width: 60%; }
                50% { transform: translateX(60%); width: 60%; }
                100% { transform: translateX(200%); width: 60%; }
              }
            `}</style>
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <p className="text-sm" style={{ color: '#ef4444' }}>{uploadError}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('contribute.back')}
        </button>
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: selectedFile && !uploading ? '#00ffff' : 'rgba(0,255,255,0.1)',
            color: selectedFile && !uploading ? '#0a0a0f' : '#00ffff',
            boxShadow: selectedFile && !uploading ? '0 0 24px rgba(0,255,255,0.3)' : 'none',
          }}
        >
          {uploading ? (
            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Upload className="w-5 h-5" />
              {t('contribute.upload_receipt')}
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ── Step 4 ────────────────────────────────────────────────────────────────
  const renderStep4 = () => (
    <div className="flex flex-col items-center text-center py-8 gap-6">
      <CheckCircle
        className="w-20 h-20"
        style={{
          color: '#10b981',
          filter: 'drop-shadow(0 0 24px rgba(16,185,129,0.6))',
        }}
      />
      <div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: '#10b981', textShadow: '0 0 20px rgba(16,185,129,0.4)' }}
        >
          {t('contribute.success_title')}
        </h2>
        <p className="text-white/70 text-sm max-w-sm">
          {t('contribute.success_msg')}
        </p>
      </div>

      {referenceCode && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          <p className="text-xs text-white/40 mb-1">{t('contribute.reference_label')}</p>
          <p
            className="font-mono font-bold text-lg"
            style={{ color: '#00ffff', letterSpacing: '0.1em' }}
          >
            {referenceCode}
          </p>
        </div>
      )}

      <button
        onClick={() => router.push(`/${locale}`)}
        className="px-8 py-3 rounded-2xl font-bold transition-all"
        style={{
          backgroundColor: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(16,185,129,0.4)',
          color: '#10b981',
        }}
      >
        {t('contribute.back_home')}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Page heading */}
        <h1
          className="text-3xl font-bold mb-8 text-center"
          style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.5)' }}
        >
          {t('contribute.title')}
        </h1>

        <StepIndicator />

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
}
