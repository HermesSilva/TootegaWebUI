import { useCallback, useEffect, useState, type JSX } from 'react';
import { ShieldAlert, Clock, XCircle, CalendarOff, Lock, LogOut, AlertTriangle, Loader2, Mail, CreditCard, QrCode, RotateCcw, CheckCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '@core/lib';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';

type SubscriptionStatusKey = 'None' | 'PendingPayment' | 'PastDue' | 'Cancelled' | 'Expired' | 'Suspended';
type PaymentMethodKey = 'Pix' | 'CreditCard' | 'BankSlip';

interface StatusConfig {
  icon: typeof ShieldAlert;
  iconColor: string;
  bgGradient: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  actionBg: string;
  actionBorder: string;
}

const STATUS_CONFIG: Record<SubscriptionStatusKey, StatusConfig> = {
  None: {
    icon: ShieldAlert,
    iconColor: 'text-red-400',
    bgGradient: 'from-red-500/20 to-red-900/10',
    borderColor: 'border-red-500/40',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-400',
    actionBg: 'bg-red-500/5',
    actionBorder: 'border-red-500/20',
  },
  PendingPayment: {
    icon: Clock,
    iconColor: 'text-amber-400',
    bgGradient: 'from-amber-500/20 to-amber-900/10',
    borderColor: 'border-amber-500/40',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    actionBg: 'bg-amber-500/5',
    actionBorder: 'border-amber-500/20',
  },
  PastDue: {
    icon: AlertTriangle,
    iconColor: 'text-orange-400',
    bgGradient: 'from-orange-500/20 to-orange-900/10',
    borderColor: 'border-orange-500/40',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-400',
    actionBg: 'bg-orange-500/5',
    actionBorder: 'border-orange-500/20',
  },
  Cancelled: {
    icon: XCircle,
    iconColor: 'text-red-400',
    bgGradient: 'from-red-500/20 to-red-900/10',
    borderColor: 'border-red-500/40',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-400',
    actionBg: 'bg-red-500/5',
    actionBorder: 'border-red-500/20',
  },
  Expired: {
    icon: CalendarOff,
    iconColor: 'text-slate-400',
    bgGradient: 'from-slate-500/20 to-slate-900/10',
    borderColor: 'border-slate-500/40',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-400',
    actionBg: 'bg-slate-500/5',
    actionBorder: 'border-slate-500/20',
  },
  Suspended: {
    icon: Lock,
    iconColor: 'text-red-400',
    bgGradient: 'from-red-600/20 to-red-900/10',
    borderColor: 'border-red-600/40',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-400',
    actionBg: 'bg-red-500/5',
    actionBorder: 'border-red-500/20',
  },
};

interface AccountInfo {
  planName: string;
  planCode: string;
  subscriptionStatus: string;
  billingCycle: string;
  paymentMethod: string;
  priceAtPurchase: number;
  activatedAt: string;
  canRetryPayment: boolean;
  lastPaymentStatus: string | null;
  lastPaymentStatusDetail: string | null;
  paymentExpiresAt: string | null;
  pixQRCode: string | null;
  pixKey: string | null;
  boletoURL: string | null;
  boletoBarcode: string | null;
}

interface RetryPaymentResponse {
  success: boolean;
  message: string;
  paymentMethod?: string;
  pixQRCode?: string;
  pixKey?: string;
  pixExpiration?: string;
  boletoURL?: string;
  boletoBarcode?: string;
}

type RetryStep = 'idle' | 'selectMethod' | 'cardForm' | 'processing' | 'success' | 'pixPending' | 'boletoPending';

interface SubscriptionBlockedModalProps {
  status: string;
  userName?: string;
  onLogout: () => void;
}

/** Texto por estado da assinatura (dono, 2026-08-03). */
const MENSAGEM_POR_ESTADO: Record<string, string> = {

};

const ACAO_POR_ESTADO: Record<string, string> = {

};

export function SubscriptionBlockedModal({ status, userName, onLogout }: SubscriptionBlockedModalProps): JSX.Element {
  const statusKey = (STATUS_CONFIG[status as SubscriptionStatusKey] ? status : 'None') as SubscriptionStatusKey;
  const config = STATUS_CONFIG[statusKey];
  const Icon = config.icon;

  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(statusKey !== 'None');
  const [retryStep, setRetryStep] = useState<RetryStep>('idle');
  const [retryError, setRetryError] = useState<string | null>(null);
  const [, setSelectedMethod] = useState<PaymentMethodKey | null>(null);
  const [retryResponse, setRetryResponse] = useState<RetryPaymentResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');

  const fetchAccountInfo = useCallback(() => {
    if (statusKey === 'None') return;
    setLoadingAccount(true);
    api.get<AccountInfo>('/doc/account')
      .then((data) => setAccountInfo(data))
      .catch(() => { /* Silently ignore */ })
      .finally(() => setLoadingAccount(false));
  }, [statusKey]);

  useEffect(() => { fetchAccountInfo(); }, [fetchAccountInfo]);

  const supportEmail = 'privacidade@tootega.com.br';

  // Determine if the subscription's payment method uses instant processing (no "pending" waiting)
  const paymentMethod = accountInfo?.paymentMethod as PaymentMethodKey | undefined;
  const isBankSlip = paymentMethod === 'BankSlip';

  // BankSlip pending: has valid boleto data
  const hasPendingBoleto = isBankSlip && accountInfo?.boletoBarcode && accountInfo?.boletoURL;
  // Pix pending: has valid QR code
  const hasPendingPix = paymentMethod === 'Pix' && accountInfo?.pixQRCode && accountInfo?.pixKey;

  const canRetry = accountInfo?.canRetryPayment ?? false;

  // Resolve the message key based on status + payment method combination
  function getMessageKey(): string {
    if (statusKey === 'PendingPayment') {
      if (isBankSlip && hasPendingBoleto)
        return 'Há um boleto aguardando pagamento.';
      if (isBankSlip)
        return 'O boleto venceu. Gere um novo para continuar.';
      if (paymentMethod === 'Pix' && hasPendingPix)
        return 'Há um Pix aguardando pagamento.';
      // CreditCard or Pix without pending data = failed/expired → show retry message
      return 'Seu pagamento está pendente.';
    }
    return MENSAGEM_POR_ESTADO[statusKey] ?? '';
  }

  function getActionKey(): string {
    if (statusKey === 'PendingPayment') {
      if (isBankSlip && hasPendingBoleto)
        return 'Abrir boleto';
      if (isBankSlip)
        return 'Gerar novo boleto';
      if (paymentMethod === 'Pix' && hasPendingPix)
        return 'Ver Pix';
      return 'Tentar novamente';
    }
    return ACAO_POR_ESTADO[statusKey] ?? '';
  }

  function handleStartRetry(): void {
    setRetryError(null);
    setRetryStep('selectMethod');
    setSelectedMethod(null);
  }

  function handleSelectMethod(method: PaymentMethodKey): void {
    setSelectedMethod(method);
    if (method === 'CreditCard') {
      setRetryStep('cardForm');
    } else {
      handleProcessRetry(method);
    }
  }

  async function handleProcessRetry(method: PaymentMethodKey): Promise<void> {
    setRetryStep('processing');
    setRetryError(null);

    const body: Record<string, unknown> = {
      paymentMethod: method === 'Pix' ? 1 : method === 'CreditCard' ? 2 : 3,
    };

    if (method === 'CreditCard') {
      body.cardNumber = cardNumber;
      body.cardHolder = cardHolder;
      body.cardExpiry = cardExpiry;
      body.cardCVV = cardCVV;
    }

    try {
      const result = await api.post<RetryPaymentResponse>('/doc/account/retry-payment', body);
      setRetryResponse(result);

      if (method === 'CreditCard' && result.success) {
        setRetryStep('success');
        // Reload page after brief delay to reflect new Active status
        setTimeout(() => window.location.reload(), 2000);
      } else if (method === 'Pix') {
        setRetryStep('pixPending');
      } else if (method === 'BankSlip') {
        setRetryStep('boletoPending');
      } else {
        setRetryStep('success');
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.';
      setRetryError(message);
      setRetryStep('selectMethod');
    }
  }

  async function handleCopy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* Clipboard API not available */ }
  }

  function formatCardNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3)
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  }

  // ─── Render: Retry success ────────────────────────────────────────
  if (retryStep === 'success')
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <XCartaoDeModal className={`bg-brand-surface border-green-500/40 rounded-2xl w-full max-w-lg overflow-hidden`}>
          <div className="bg-gradient-to-b from-green-500/20 to-green-900/10 px-6 pt-8 pb-6 flex flex-col items-center gap-4">
            <div className="text-green-400 p-4 rounded-2xl bg-black/20 backdrop-blur-sm">
              <CheckCircle size={44} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-brand-text">{'Pagamento confirmado'}</h2>
            <p className="text-brand-text-secondary text-sm text-center">{'Sua assinatura foi reativada.'}</p>
          </div>
          <div className="px-6 py-4 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-brand-text-secondary mr-2" />
            <span className="text-brand-text-secondary text-sm">{'Carregando...'}</span>
          </div>
        </XCartaoDeModal>
      </div>
    );

  // ─── Render: Pix QR code pending ─────────────────────────────────
  if (retryStep === 'pixPending' && retryResponse)
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <XCartaoDeModal className={`bg-brand-surface border-amber-500/40 rounded-2xl w-full max-w-lg overflow-hidden`}>
          <div className="bg-gradient-to-b from-amber-500/20 to-amber-900/10 px-6 pt-8 pb-6 flex flex-col items-center gap-4">
            <div className="text-amber-400 p-4 rounded-2xl bg-black/20 backdrop-blur-sm">
              <QrCode size={44} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-brand-text">{'Pagamento via Pix'}</h2>
            <p className="text-brand-text-secondary text-sm text-center">{'Escaneie o QR code ou copie a chave Pix para pagar.'}</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            {retryResponse.pixQRCode && (
              <div className="flex justify-center">
                <img src={`data:image/png;base64,${retryResponse.pixQRCode}`} alt={'QR Code Pix'} className="w-48 h-48 rounded-lg" />
              </div>
            )}
            {retryResponse.pixKey && (
              <button
                onClick={() => handleCopy(retryResponse.pixKey!)}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors border border-amber-500/30"
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado' : 'Copiar chave Pix'}
              </button>
            )}
            <button onClick={() => window.location.reload()} className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-sm font-medium transition-colors border border-brand-primary/30">
              <RefreshCw size={18} />
              {'Verificar pagamento'}
            </button>
          </div>
          <div className="px-6 pb-6 pt-2">
            <button onClick={onLogout} className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-text/10 hover:bg-brand-text/15 text-brand-text text-sm font-medium transition-colors">
              <LogOut size={18} />
              {'Sair'}
            </button>
          </div>
        </XCartaoDeModal>
      </div>
    );

  // ─── Render: Boleto pending ───────────────────────────────────────
  if (retryStep === 'boletoPending' && retryResponse)
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <XCartaoDeModal className={`bg-brand-surface border-amber-500/40 rounded-2xl w-full max-w-lg overflow-hidden`}>
          <div className="bg-gradient-to-b from-amber-500/20 to-amber-900/10 px-6 pt-8 pb-6 flex flex-col items-center gap-4">
            <div className="text-amber-400 p-4 rounded-2xl bg-black/20 backdrop-blur-sm">
              <Clock size={44} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-brand-text">{'Pagamento via boleto'}</h2>
            <p className="text-brand-text-secondary text-sm text-center">{'Use a linha digitável ou abra o boleto para pagar.'}</p>
          </div>
          <div className="px-6 py-5 space-y-3">
            {retryResponse.boletoBarcode && (
              <button
                onClick={() => handleCopy(retryResponse.boletoBarcode!)}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors border border-amber-500/30"
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado' : 'Copiar código de barras'}
              </button>
            )}
            {retryResponse.boletoURL && (
              <a href={retryResponse.boletoURL} target="_blank" rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-sm font-medium transition-colors border border-brand-primary/30">
                <ExternalLink size={18} />
                {'Abrir boleto'}
              </a>
            )}
            <button onClick={() => window.location.reload()} className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-text/5 hover:bg-brand-text/10 text-brand-text-secondary text-sm font-medium transition-colors">
              <RefreshCw size={18} />
              {'Verificar pagamento'}
            </button>
          </div>
          <div className="px-6 pb-6 pt-2">
            <button onClick={onLogout} className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-text/10 hover:bg-brand-text/15 text-brand-text text-sm font-medium transition-colors">
              <LogOut size={18} />
              {'Sair'}
            </button>
          </div>
        </XCartaoDeModal>
      </div>
    );

  // ─── Render: Main blocked modal ───────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <XCartaoDeModal className={`bg-brand-surface ${config.borderColor} rounded-2xl w-full max-w-lg overflow-hidden`}>

        {/* Header with gradient */}
        <div className={`bg-gradient-to-b ${config.bgGradient} px-6 pt-8 pb-6 flex flex-col items-center gap-4`}>
          <div className={`${config.iconColor} p-4 rounded-2xl bg-black/20 backdrop-blur-sm`}>
            <Icon size={44} strokeWidth={1.5} />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-brand-text">
              {'Assinatura pendente'}
            </h2>
            {userName && (
              <p className="text-brand-text-secondary text-sm">{userName}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">

          {/* Status badge */}
          <div className="flex justify-center">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${config.badgeBg} ${config.badgeText}`}>
              <Icon size={16} />
              {`myAccount.statusValues.${statusKey}`}
            </span>
          </div>

          {/* Subscription details (fetched from backend) */}
          {loadingAccount && (
            <div className="flex items-center justify-center py-2">
              <Loader2 size={20} className="animate-spin text-brand-text-secondary" />
            </div>
          )}
          {accountInfo && !loadingAccount && (
            <div className="bg-brand-background/60 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-text-secondary">{'Plano'}</span>
                <span className="text-brand-text font-medium">{accountInfo.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-text-secondary">{'Ciclo de cobrança'}</span>
                <span className="text-brand-text font-medium">
                  {`myAccount.cycleValues.${accountInfo.billingCycle}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-text-secondary">{'Forma de pagamento'}</span>
                <span className="text-brand-text font-medium">
                  {`myAccount.paymentValues.${accountInfo.paymentMethod}`}
                </span>
              </div>
            </div>
          )}

          {/* Existing Pix QR code (from account info, before retry) */}
          {hasPendingPix && retryStep === 'idle' && (
            <div className="space-y-3">
              {accountInfo!.pixQRCode && (
                <div className="flex justify-center">
                  <img src={`data:image/png;base64,${accountInfo!.pixQRCode}`} alt={'QR Code Pix'} className="w-40 h-40 rounded-lg" />
                </div>
              )}
              <button
                onClick={() => handleCopy(accountInfo!.pixKey!)}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors border border-amber-500/30"
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado' : 'Copiar chave Pix'}
              </button>
            </div>
          )}

          {/* Existing Boleto (from account info, before retry) */}
          {hasPendingBoleto && retryStep === 'idle' && (
            <div className="space-y-3">
              {accountInfo!.boletoBarcode && (
                <button
                  onClick={() => handleCopy(accountInfo!.boletoBarcode!)}
                  className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors border border-amber-500/30"
                >
                  {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar código de barras'}
                </button>
              )}
              {accountInfo!.boletoURL && (
                <a href={accountInfo!.boletoURL} target="_blank" rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-sm font-medium transition-colors border border-brand-primary/30">
                  <ExternalLink size={16} />
                  {'Abrir boleto'}
                </a>
              )}
            </div>
          )}

          {/* Explanation message */}
          <p className="text-brand-text-secondary text-sm text-center leading-relaxed">
            {getMessageKey()}
          </p>

          {/* Action instruction box */}
          <div className={`${config.actionBg} border ${config.actionBorder} rounded-xl p-4`}>
            <p className="text-brand-text text-sm text-center font-medium leading-relaxed">
              {getActionKey()}
            </p>
          </div>

          {/* Retry error message */}
          {retryError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm text-center">{retryError}</p>
            </div>
          )}

          {/* ─── Retry: Select payment method ──────────────────────── */}
          {retryStep === 'selectMethod' && (
            <div className="space-y-3">
              <p className="text-brand-text text-sm font-medium text-center">{'Escolha a forma de pagamento'}</p>
              <div className="grid gap-2">
                <button onClick={() => handleSelectMethod('Pix')}
                  className="w-full inline-flex items-center gap-3 min-h-[52px] rounded-xl bg-brand-background/80 hover:bg-brand-background border border-brand-text/10 hover:border-brand-primary/40 px-4 text-sm text-brand-text transition-all">
                  <QrCode size={20} className="text-brand-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Pix</div>
                    <div className="text-xs text-brand-text-secondary">{'Pague na hora com Pix'}</div>
                  </div>
                </button>
                <button onClick={() => handleSelectMethod('CreditCard')}
                  className="w-full inline-flex items-center gap-3 min-h-[52px] rounded-xl bg-brand-background/80 hover:bg-brand-background border border-brand-text/10 hover:border-brand-primary/40 px-4 text-sm text-brand-text transition-all">
                  <CreditCard size={20} className="text-brand-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{'Cartão de crédito'}</div>
                    <div className="text-xs text-brand-text-secondary">{'Pague com cartão de crédito'}</div>
                  </div>
                </button>
                <button onClick={() => handleSelectMethod('BankSlip')}
                  className="w-full inline-flex items-center gap-3 min-h-[52px] rounded-xl bg-brand-background/80 hover:bg-brand-background border border-brand-text/10 hover:border-brand-primary/40 px-4 text-sm text-brand-text transition-all">
                  <Clock size={20} className="text-brand-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{'Boleto'}</div>
                    <div className="text-xs text-brand-text-secondary">{'Pague com boleto bancário'}</div>
                  </div>
                </button>
              </div>
              <button onClick={() => setRetryStep('idle')}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-text/5 hover:bg-brand-text/10 text-brand-text-secondary text-sm transition-colors">
                {'Voltar'}
              </button>
            </div>
          )}

          {/* ─── Retry: Card form ──────────────────────────────────── */}
          {retryStep === 'cardForm' && (
            <div className="space-y-3">
              <p className="text-brand-text text-sm font-medium text-center">{'Dados do cartão'}</p>
              <input type="text" value={cardNumber} maxLength={19}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder={'Número do cartão'}
                className="w-full min-h-[44px] rounded-xl bg-brand-background border border-brand-text/15 px-4 text-sm text-brand-text placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary/50"
              />
              <input type="text" value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                placeholder={'Nome do titular'}
                className="w-full min-h-[44px] rounded-xl bg-brand-background border border-brand-text/15 px-4 text-sm text-brand-text placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary/50"
              />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={cardExpiry} maxLength={5}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder={'MM/AA'}
                  className="min-h-[44px] rounded-xl bg-brand-background border border-brand-text/15 px-4 text-sm text-brand-text placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary/50"
                />
                <input type="text" value={cardCVV} maxLength={4}
                  onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ''))}
                  placeholder="CVV"
                  className="min-h-[44px] rounded-xl bg-brand-background border border-brand-text/15 px-4 text-sm text-brand-text placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary/50"
                />
              </div>
              <button
                onClick={() => handleProcessRetry('CreditCard')}
                disabled={!cardNumber || !cardHolder || !cardExpiry || !cardCVV}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                <CreditCard size={18} />
                {'Pagar'}
              </button>
              <button onClick={() => setRetryStep('selectMethod')}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-text/5 hover:bg-brand-text/10 text-brand-text-secondary text-sm transition-colors">
                {'Voltar'}
              </button>
            </div>
          )}

          {/* ─── Retry: Processing spinner ─────────────────────────── */}
          {retryStep === 'processing' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={28} className="animate-spin text-brand-primary" />
              <p className="text-brand-text-secondary text-sm">{'Processando pagamento…'}</p>
            </div>
          )}

          {/* ─── Retry / Refresh buttons (idle state) ──────────────── */}
          {retryStep === 'idle' && canRetry && (
            <button
              onClick={handleStartRetry}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-medium transition-colors"
            >
              <RotateCcw size={18} />
              {'Tentar novamente'}
            </button>
          )}

          {/* Check payment button for BankSlip/Pix pending */}
          {retryStep === 'idle' && (hasPendingBoleto || hasPendingPix) && (
            <button onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-text/5 hover:bg-brand-text/10 text-brand-text-secondary text-sm font-medium transition-colors">
              <RefreshCw size={16} />
              {'Verificar pagamento'}
            </button>
          )}

          {/* Support contact */}
          <div className="flex items-center justify-center gap-2 text-xs text-brand-text-secondary">
            <Mail size={14} />
            <span>{'Suporte'}</span>
            <a
              href={`mailto:${supportEmail}`}
              className="text-brand-primary hover:underline font-medium"
            >
              {supportEmail}
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-brand-text/10 hover:bg-brand-text/15 active:bg-brand-text/20 text-brand-text text-sm font-medium transition-colors"
          >
            <LogOut size={18} />
            {'Sair'}
          </button>
        </div>
      </XCartaoDeModal>
    </div>
  );
}
