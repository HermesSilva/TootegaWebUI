import { useEffect, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { X, FileText, Calendar, CreditCard, Package, AlertTriangle, Plus, Trash2, Star, HardDrive, ScanFace, Check } from 'lucide-react';
import { api } from '@core/lib/api';
import { ZIndexManager } from '@core/lib/zIndexManager';
// Moeda sai da fonte ÚNICA (sem símbolo, dono 2026-08-24): esta tela mantinha uma cópia
// local com `style: 'currency'`, e por isso era o último lugar a ainda escrever "R$".
import { formatCurrency } from '@core/lib';
import { FaceCaptureModal } from '@core/components/face/FaceCaptureModal';
import { getFaceConfig, getFaceSelfStatus, deleteSelfFace, type FaceConfig, type FaceSelfStatus } from '@core/components/face/faceApi';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';

interface MyAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManageDeleted?: () => void;
}

interface AccountInfo {
  planName: string;
  planCode: string;
  documentLimitPerMonth: number;
  documentsUsedThisMonth: number;
  subscriptionStatus: string;
  billingCycle: string;
  paymentMethod: string;
  priceAtPurchase: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  activatedAt: string;
  quotaExceeded: boolean;
  deletedDocumentsCount: number;
  storageUsedBytes: number;
}

interface CreditCardInfo {
  id: string;
  cardholderName: string;
  last4Digits: string;
  expirationMonth: number;
  expirationYear: number;
  isDefault: boolean;
  createdAt: string;
  isLinkedToSubscription: boolean;
}

type TabKey = 'plan' | 'cards' | 'facial';

export function MyAccountModal({ isOpen, onClose, onManageDeleted }: MyAccountModalProps): JSX.Element | null {
  const queryClient = useQueryClient();
  const [zIndex, setZIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('plan');
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiryMonth, setCardExpiryMonth] = useState('');
  const [cardExpiryYear, setCardExpiryYear] = useState('');
  const [isDefaultCard, setIsDefaultCard] = useState(false);
  const [cardFormError, setCardFormError] = useState('');
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);
  const [confirmFaceRemove, setConfirmFaceRemove] = useState(false);

  useEffect(() => {
    if (isOpen)
      setZIndex(ZIndexManager.next());
  }, [isOpen]);

  const { data: account, isLoading, isError, error } = useQuery<AccountInfo>({
    queryKey: ['account-info'],
    // Silent: a tenant user without a subscription gets 404 here — show inline, no global toast.
    queryFn: ({ signal }) => api.get<AccountInfo>('/doc/account', signal, true),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    enabled: isOpen && activeTab === 'plan',
  });

  const { data: creditCards = [], isLoading: isLoadingCards } = useQuery<CreditCardInfo[]>({
    queryKey: ['credit-cards', 'pt-BR'],
    queryFn: ({ signal }) => api.get<CreditCardInfo[]>('/doc/account/credit-cards', signal, true),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    enabled: isOpen && activeTab === 'cards',
  });

  const createCardMutation = useMutation({
    mutationFn: (pData: { cardNumber: string; cardholderName: string; expirationMonth: number; expirationYear: number; isDefault: boolean }) =>
      api.post<CreditCardInfo>('/doc/account/credit-cards', pData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      resetCardForm();
    },
    onError: (pError: unknown) => {
      const msg = (pError as { message?: string })?.message;
      setCardFormError(msg ?? 'Não foi possível salvar o cartão.');
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (pCardID: string) => api.delete(`/doc/account/credit-cards/${pCardID}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: (pData: { id: string; cardholderName: string; isDefault: boolean }) =>
      api.put<CreditCardInfo>(`/doc/account/credit-cards/${pData.id}`, {
        cardholderName: pData.cardholderName,
        isDefault: pData.isDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
    },
  });

  // Facial recognition (self-enroll) — hooks MUST stay above the `if (!isOpen) return null` guard.
  const faceStatusQuery = useQuery<FaceSelfStatus>({
    queryKey: ['face-self-status'],
    queryFn: ({ signal }) => getFaceSelfStatus(signal),
    enabled: isOpen && activeTab === 'facial',
    staleTime: 30_000,
  });
  const faceConfigQuery = useQuery<FaceConfig>({
    queryKey: ['face-config'],
    queryFn: ({ signal }) => getFaceConfig(signal),
    enabled: isOpen && activeTab === 'facial',
    staleTime: 600_000,
  });
  const removeFaceMutation = useMutation({
    mutationFn: () => deleteSelfFace(),
    onSuccess: () => {
      setConfirmFaceRemove(false);
      queryClient.invalidateQueries({ queryKey: ['face-self-status'] });
    },
  });

  function resetCardForm(): void {
    setShowCardForm(false);
    setCardNumber('');
    setCardHolder('');
    setCardExpiryMonth('');
    setCardExpiryYear('');
    setIsDefaultCard(false);
    setCardFormError('');
  }

  function handleCreateCard(): void {
    setCardFormError('');
    const month = parseInt(cardExpiryMonth, 10);
    const year = parseInt(cardExpiryYear, 10);

    if (!cardNumber.replace(/\s/g, '') || !cardHolder.trim() || isNaN(month) || isNaN(year))
    {
      setCardFormError('Preencha todos os campos.');
      return;
    }

    createCardMutation.mutate({
      cardNumber: cardNumber.replace(/\s/g, ''),
      cardholderName: cardHolder.trim(),
      expirationMonth: month,
      expirationYear: year,
      isDefault: isDefaultCard,
    });
  }

  function formatDate(pDateStr: string): string {
    if (!pDateStr) return '—';
    return new Date(pDateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function formatBytes(pBytes: number): string {
    if (pBytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(pBytes) / Math.log(k));
    return `${parseFloat((pBytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  if (!isOpen) return null;

  const usagePercent = account
    ? Math.min(100, Math.round((account.documentsUsedThisMonth / account.documentLimitPerMonth) * 100))
    : 0;

  const progressColor = usagePercent >= 90
    ? 'bg-danger'
    : usagePercent >= 70
      ? 'bg-warning'
      : 'bg-brand-primary';

  const faceEnrolled = faceStatusQuery.data?.enrolled ?? false;
  const faceServerEnabled = faceConfigQuery.data?.serverEnabled ?? false;

  const tabs: { key: TabKey; label: string; icon: JSX.Element }[] = [
    { key: 'plan', label: 'Plano', icon: <Package size={16} /> },
    { key: 'cards', label: 'Cartões', icon: <CreditCard size={16} /> },
    { key: 'facial', label: 'Rosto', icon: <ScanFace size={16} /> },
  ];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      {/* Teto duro de modal: 80% da área, largura e altura (dono, 2026-07-12). */}
      <XCartaoDeModal className="bg-brand-surface rounded-xl w-full max-w-[min(32rem,80vw)] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <Package size={20} className="text-brand-primary" />
            </div>
            <h2 className="text-lg font-semibold text-brand-text-primary">
              {'Minha conta'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-hover rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={'Fechar'}
          >
            <X size={20} className="text-brand-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-light flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-ui font-medium transition-colors min-h-[44px] border-b-2 ${
                activeTab === tab.key
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-brand-text-secondary hover:text-brand-text-primary hover:bg-hover'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Plan Tab */}
          {activeTab === 'plan' && (
            <>
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-pulse text-brand-text-secondary text-ui">
                    {'Carregando...'}
                  </div>
                </div>
              )}

              {isError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-danger text-ui">
                  {`Os dados da sua conta não puderam ser carregados: a consulta ao servidor falhou.${error instanceof Error && error.message ? `\n\n${error.message}` : ''}`}
                </div>
              )}

              {account && (
                <div className="space-y-5">
                  {/* Plan Info */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Package size={16} className="text-brand-primary" />
                      <h3 className="text-ui font-semibold text-brand-text-primary">
                        {'Plano'}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Plano'}</p>
                        <p className="text-ui font-medium text-brand-text-primary">{account.planName}</p>
                      </div>
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Estado'}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-ui-xs font-medium bg-success/10 text-success">
                          {`myAccount.statusValues.${account.subscriptionStatus}`}
                        </span>
                      </div>
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Ciclo de cobrança'}</p>
                        <p className="text-ui text-brand-text-primary">
                          {`myAccount.cycleValues.${account.billingCycle}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Preço'}</p>
                        <p className="text-ui font-medium text-brand-text-primary">
                          {formatCurrency(account.priceAtPurchase)}
                          <span className="text-brand-text-muted text-ui-xs ml-1">
                            /{account.billingCycle === 'Monthly' ? 'por mês' : 'por ano'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </section>

                  <hr className="border-border-light" />

                  {/* Usage */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={16} className="text-brand-primary" />
                      <h3 className="text-ui font-semibold text-brand-text-primary">
                        {'Uso'}
                      </h3>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-ui text-brand-text-primary font-medium">
                          {account.documentsUsedThisMonth} / {account.documentLimitPerMonth}
                        </span>
                        <span className="text-ui-xs text-brand-text-muted">{usagePercent}%</span>
                      </div>
                      <div className="w-full bg-brand-background rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${progressColor}`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <p className="text-ui-xs text-brand-text-muted mt-1">
                        {'Documentos usados'}
                      </p>
                    </div>
                    {account.quotaExceeded && (
                      <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg mt-2">
                        <AlertTriangle size={16} className="text-danger flex-shrink-0" />
                        <p className="text-ui-xs text-danger">{'Limite excedido'}</p>
                      </div>
                    )}

                    {/* Deleted Documents & Storage */}
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-light">
                      {/* Deleted Documents */}
                      <div
                        className={`p-3 rounded-lg border ${
                          account.deletedDocumentsCount > 0
                            ? 'border-warning/30 bg-warning/5 cursor-pointer hover:bg-warning/10 transition-colors'
                            : 'border-brand-border bg-brand-background'
                        }`}
                        onClick={() => account.deletedDocumentsCount > 0 && onManageDeleted?.()}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Trash2 size={14} className={account.deletedDocumentsCount > 0 ? 'text-warning' : 'text-brand-text-muted'} />
                          <span className="text-ui-xs text-brand-text-muted">{'Documentos excluídos'}</span>
                        </div>
                        <p className={`text-ui font-medium ${account.deletedDocumentsCount > 0 ? 'text-warning' : 'text-brand-text-primary'}`}>
                          {account.deletedDocumentsCount}
                        </p>
                        {account.deletedDocumentsCount > 0 && onManageDeleted && (
                          <p className="text-ui-xs text-warning/80 mt-1">{'Clique para gerenciar'}</p>
                        )}
                      </div>

                      {/* Storage Used */}
                      <div className="p-3 rounded-lg border border-brand-border bg-brand-background">
                        <div className="flex items-center gap-2 mb-1">
                          <HardDrive size={14} className="text-brand-text-muted" />
                          <span className="text-ui-xs text-brand-text-muted">{'Armazenamento usado'}</span>
                        </div>
                        <p className="text-ui font-medium text-brand-text-primary">
                          {formatBytes(account.storageUsedBytes)}
                        </p>
                      </div>
                    </div>
                  </section>

                  <hr className="border-border-light" />

                  {/* Period */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={16} className="text-brand-primary" />
                      <h3 className="text-ui font-semibold text-brand-text-primary">
                        {'Período'}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Início do período'}</p>
                        <p className="text-ui text-brand-text-primary">{formatDate(account.currentPeriodStart)}</p>
                      </div>
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Fim do período'}</p>
                        <p className="text-ui text-brand-text-primary">{formatDate(account.currentPeriodEnd)}</p>
                      </div>
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Ativado em'}</p>
                        <p className="text-ui text-brand-text-primary">{formatDate(account.activatedAt)}</p>
                      </div>
                      <div>
                        <p className="text-ui-xs text-brand-text-muted">{'Forma de pagamento'}</p>
                        <p className="text-ui text-brand-text-primary">
                          <CreditCard size={14} className="inline mr-1 text-brand-text-secondary" />
                          {`myAccount.paymentValues.${account.paymentMethod}`}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}

          {/* Cards Tab */}
          {activeTab === 'cards' && (
            <div className="space-y-4">
              {/* Add Card Button */}
              {!showCardForm && (
                <button
                  onClick={() => setShowCardForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-ui font-medium min-h-[44px]"
                >
                  <Plus size={16} />
                  {'Adicionar cartão'}
                </button>
              )}

              {/* Card Form */}
              {showCardForm && (
                <div className="border border-border-light rounded-lg p-4 space-y-3 bg-brand-background">
                  <h4 className="text-ui font-semibold text-brand-text-primary">
                    {'Novo cartão'}
                  </h4>
                  <div>
                    <label className="text-ui-xs text-brand-text-muted block mb-1">
                      {'Número do cartão'}
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      className="w-full px-3 py-2 rounded-lg border border-border-light bg-brand-surface text-brand-text-primary text-ui focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="text-ui-xs text-brand-text-muted block mb-1">
                      {'Titular do cartão'}
                    </label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder={'Nome impresso no cartão'}
                      className="w-full px-3 py-2 rounded-lg border border-border-light bg-brand-surface text-brand-text-primary text-ui focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-ui-xs text-brand-text-muted block mb-1">
                        {'Mês'}
                      </label>
                      <input
                        type="text"
                        value={cardExpiryMonth}
                        onChange={(e) => setCardExpiryMonth(e.target.value)}
                        placeholder="MM"
                        maxLength={2}
                        className="w-full px-3 py-2 rounded-lg border border-border-light bg-brand-surface text-brand-text-primary text-ui focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="text-ui-xs text-brand-text-muted block mb-1">
                        {'Ano'}
                      </label>
                      <input
                        type="text"
                        value={cardExpiryYear}
                        onChange={(e) => setCardExpiryYear(e.target.value)}
                        placeholder="AA"
                        maxLength={4}
                        className="w-full px-3 py-2 rounded-lg border border-border-light bg-brand-surface text-brand-text-primary text-ui focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={isDefaultCard}
                      onChange={(e) => setIsDefaultCard(e.target.checked)}
                      className="w-4 h-4 rounded border-border-light text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-ui text-brand-text-primary">{'Tornar padrão'}</span>
                  </label>
                  {cardFormError && (
                    <div className="text-danger text-ui-xs bg-danger/10 border border-danger/20 rounded-lg p-2">
                      {cardFormError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateCard}
                      disabled={createCardMutation.isPending}
                      className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-ui font-medium min-h-[44px] disabled:opacity-50"
                    >
                      {createCardMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={resetCardForm}
                      className="px-4 py-2 border border-border-light rounded-lg hover:bg-hover transition-colors text-ui text-brand-text-secondary min-h-[44px]"
                    >
                      {'Cancelar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isLoadingCards && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-pulse text-brand-text-secondary text-ui">
                    {'Carregando...'}
                  </div>
                </div>
              )}

              {/* Card List */}
              {!isLoadingCards && creditCards.length === 0 && !showCardForm && (
                <div className="text-center py-8 text-brand-text-muted text-ui">
                  <CreditCard size={32} className="mx-auto mb-2 opacity-40" />
                  <p>{'Nenhum cartão cadastrado'}</p>
                </div>
              )}

              {creditCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-3 border border-border-light rounded-lg bg-brand-background"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard size={18} className="text-brand-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-ui font-medium text-brand-text-primary truncate">
                        •••• {card.last4Digits}
                      </p>
                      {card.isLinkedToSubscription && (
                        <Star size={14} className="text-warning flex-shrink-0" fill="currentColor" />
                      )}
                    </div>
                    <p className="text-ui-xs text-brand-text-muted truncate">
                      {card.cardholderName} — {String(card.expirationMonth).padStart(2, '0')}/{card.expirationYear}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!card.isLinkedToSubscription && (
                      <button
                        onClick={() => updateCardMutation.mutate({ id: card.id, cardholderName: card.cardholderName, isDefault: true })}
                        className="p-2 hover:bg-hover rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title={'Definir como padrão'}
                      >
                        <Star size={16} className="text-brand-text-secondary" />
                      </button>
                    )}
                    {!card.isLinkedToSubscription && (
                      <button
                        onClick={() => deleteCardMutation.mutate(card.id)}
                        disabled={deleteCardMutation.isPending}
                        className="p-2 hover:bg-danger/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title={'Excluir'}
                      >
                        <Trash2 size={16} className="text-danger" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Facial recognition Tab */}
          {activeTab === 'facial' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-ui font-semibold text-brand-text-primary mb-1">{'Reconhecimento facial'}</h3>
                <p className="text-ui-sm text-brand-text-secondary">{'Gerencie o login por reconhecimento facial.'}</p>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border border-border-light">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${faceEnrolled ? 'bg-brand-primary/10 text-brand-primary' : 'bg-hover text-brand-text-muted'}`}>
                  {faceEnrolled ? <Check size={20} /> : <ScanFace size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ui font-medium text-brand-text-primary">
                    {faceEnrolled ? 'Rosto cadastrado' : 'Nenhum rosto cadastrado'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowFaceEnroll(true)}
                  disabled={!faceServerEnabled}
                  className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-brand-primary text-white font-medium
                    hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ScanFace size={16} />
                  {faceEnrolled ? 'Cadastrar outro' : 'Cadastrar rosto'}
                </button>
                {faceEnrolled && (
                  <button
                    type="button"
                    onClick={() => setConfirmFaceRemove(true)}
                    className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-danger/40 text-danger font-medium
                      hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 size={16} />
                    {'Remover'}
                  </button>
                )}
              </div>

              {confirmFaceRemove && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 space-y-3">
                  <p className="text-ui-sm text-brand-text-primary">{'Deseja remover o rosto cadastrado?'}</p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmFaceRemove(false)}
                      className="px-3 min-h-[40px] rounded-lg border border-border-light text-brand-text-primary text-ui-sm hover:bg-hover transition-colors"
                    >
                      {'Cancelar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFaceMutation.mutate()}
                      disabled={removeFaceMutation.isPending}
                      className="px-3 min-h-[40px] rounded-lg bg-danger text-white text-ui-sm hover:bg-danger/90 disabled:opacity-60 transition-colors"
                    >
                      {'Remover'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </XCartaoDeModal>

      {showFaceEnroll && faceConfigQuery.data && (
        <FaceCaptureModal
          mode="enroll"
          config={faceConfigQuery.data}
          onClose={() => setShowFaceEnroll(false)}
          onEnrolled={() => {
            setShowFaceEnroll(false);
            queryClient.invalidateQueries({ queryKey: ['face-self-status'] });
          }}
        />
      )}
    </div>,
    document.body
  );
}
