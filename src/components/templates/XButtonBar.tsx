/**
 * XButtonBar - Action Bar
 * 
 * Renders action buttons configured in XApplication.
 * Controls visibility based on permissions and selection state.
 * Supports confirmation for destructive actions.
 */

import { useState, useCallback, useMemo, type JSX } from 'react';
import { Plus, Pencil, Trash2, Check, X, RefreshCw, Download, Upload, Printer, Search, Eraser, LogOut, ToggleLeft, RotateCcw, UserPlus, Eye, FileText, ListTree, AlertTriangle, Send, FileDown, Ban, type LucideIcon } from 'lucide-react';
import type {
  XButtonBar as XButtonBarType,
  XButton,
  XButtonType,
  XButtonBarPosition,
  XApplicationMode,
} from '@core/types';
import { XButtonAction, XButtonAlignment } from '@core/types';
import { useCompany } from '@core/hooks/useCompany';
import { XHint, type XHintTone } from '@core/components/ui/XHint';
import { XModalShell } from './XModalShell';
import { classeDeCorDoBotao, getFieldValue } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

interface XButtonBarProps {
  buttonBar: XButtonBarType;
  selectedCount: number;
  dataCount: number;
  onAction: (pAction: XButtonAction, pButton: XButton) => void;
  permissions: string[];
  mode: XApplicationMode;
  /** Optional element to render at the far right (e.g., help button) */
  rightSlot?: React.ReactNode;
  /** Selected row data for dynamic button rendering (e.g., ToggleStatus) */
  selectedRowData?: Record<string, unknown> | null;
  /** State control: whether the app has state control enabled */
  hasStateControl?: boolean;
  /** State control: number of rows checked for batch state change */
  stateCheckedCount?: number;
  /** State control: homogeneous state of checked rows */
  stateCheckedStatus?: 'active' | 'inactive' | 'mixed' | 'none';
  /**
   * Embedded mode: renders buttons without the outer wrapper div (no bg, no border,
   * no min-h-row). The parent provides the container and layout.
   * rightSlot is ignored in embedded mode — parent renders it directly.
   */
  embedded?: boolean;
  /**
   * When embedded, restricts which alignment group to render.
   * 'left'  → only left-aligned buttons (Novo, Exportar, etc.)
   * 'right' → only right-aligned buttons (Fechar, etc.)
   * Omit to render all buttons.
   */
  embeddedSide?: 'left' | 'right';
  /**
   * Elemento que fica NO FIM da barra, à direita de tudo — inclusive do Fechar: o botão de Ajuda (dono,
   * 2026-10-21, revogando para a Ajuda a regra de 2026-08-13 do "Fechar sempre o último"). Ignorado no lado
   * esquerdo do modo embutido.
   */
  slotNoFim?: React.ReactNode;
}

// ============================================================================
// Icon Mapping
// ============================================================================

/**
 * O botão aparece nesta linha? (dono, 2026-09-17)
 *
 * Sem `visibleWhenField` declarado, sempre — é o comportamento de toda a barra até aqui. Com ele, o
 * valor do campo na linha selecionada tem de estar entre os declarados.
 *
 * Comparação por TEXTO, do mesmo jeito que a ação de linha faz: a chave de um lookup chega ora como
 * número, ora como string, conforme o caminho que o dado percorreu — comparar por identidade
 * esconderia o botão em metade dos casos, sem erro nenhum à vista.
 *
 * O campo se lê por `getFieldValue`, NUNCA por índice direto: o back declara `EstadoID` (o nome da
 * propriedade C#) e a linha chega serializada em camelCase (`estadoID`). Acesso direto devolveria
 * `undefined`, o valor viraria `''`, nada casaria e o botão sumiria — sem erro nenhum à vista. Foi
 * exatamente o que aconteceu com o "Conferir nota" do pedido (2026-09-17); as ações de linha já
 * usavam `getFieldValue` e por isso nunca sofreram disso.
 *
 * SEM LINHA SELECIONADA o botão aparece: quem exige seleção já declara `requiresSelection`, e somar
 * as duas coisas aqui esconderia botão que só quer filtrar POR estado quando há um.
 */
export function visivelNaLinha(
  pBotao: XButton,
  pLinha?: Record<string, unknown> | null
): boolean {
  const campo = pBotao.visibleWhenField ?? '';
  if (campo === '')
    return true;

  const valores = pBotao.visibleWhenValues ?? [];
  if (valores.length === 0)
    return true;

  if (!pLinha)
    return true;

  const valor = String(getFieldValue(pLinha, campo) ?? '');
  return valores.some((pAceito) => String(pAceito) === valor);
}

const ICON_MAP: Record<string, LucideIcon> = {
  plus: Plus,
  pencil: Pencil,
  'trash-2': Trash2,
  trash: Trash2,
  check: Check,
  x: X,
  'refresh-cw': RefreshCw,
  refresh: RefreshCw,
  download: Download,
  upload: Upload,
  printer: Printer,
  search: Search,
  eraser: Eraser,
  'log-out': LogOut,
  close: LogOut,
  'toggle-left': ToggleLeft,
  'rotate-ccw': RotateCcw,
  'user-plus': UserPlus,
  eye: Eye,
  'file-text': FileText,
  'list-tree': ListTree,

  // Ícones das ações da App que agem sobre a linha selecionada (transmitir, baixar o documento
  // auxiliar, cancelar). Vivem aqui porque essas ações passaram a ser botões da BARRA (dono, 2026-07-13).
  send: Send,
  'file-down': FileDown,
  ban: Ban,
};

// ============================================================================
// Button Type Styles
// ============================================================================

// A cor de botão vive numa fonte só: `xButtonPalette.ts` (a paleta semântica). A barra chama
// `classeDeCorDoBotao(ação, papel)`, que resolve — por papel explícito do botão (custom) ou por ação
// canônica — a classe da paleta; só cai em BUTTON_TYPE_STYLES quando não há papel algum. É o que
// garante a MESMA cor por papel em qualquer App, para botão padrão E custom.
const BUTTON_TYPE_STYLES: Record<XButtonType, string> = {
  1: 'bg-brand-primary hover:bg-brand-primary-dark text-white',              // Primary
  2: 'bg-brand-background hover:bg-hover text-brand-text-primary border border-border', // Secondary
  3: 'bg-success hover:bg-success/90 text-white',                            // Success
  4: 'bg-danger hover:bg-danger/90 text-white',                              // Danger
  5: 'bg-warning hover:bg-warning/90 text-white',                            // Warning
  6: 'bg-info hover:bg-info/90 text-white',                                  // Info
  7: 'text-brand-primary hover:underline bg-transparent',                    // Link
  8: 'p-2 bg-transparent hover:bg-hover text-brand-text-primary',            // Icon
};

// ============================================================================
// Position Styles
// ============================================================================

const POSITION_STYLES: Record<XButtonBarPosition, string> = {
  1: 'flex-row',      // Top
  2: 'flex-row',      // Bottom
  3: 'flex-col',      // Left
  4: 'flex-col',      // Right
};

// ============================================================================
// Confirmation Modal
// ============================================================================

interface ConfirmModalProps {
  message: string;
  title: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ message, title, confirmText, cancelText, onConfirm, onCancel }: ConfirmModalProps): JSX.Element {
  return (
    <XModalShell
      variant="inline"
      size="sm"
      title={title}
      closeLabel={cancelText}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 sm:py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border
                     hover:bg-hover rounded-lg transition-colors min-h-touch sm:min-h-[36px]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="inline-flex items-center gap-2 px-4 py-3 sm:py-2 text-ui font-semibold text-white
                     bg-danger hover:bg-danger/90 rounded-lg shadow-sm shadow-danger/20 transition-colors
                     min-h-touch sm:min-h-[36px] focus:outline-none focus:ring-2 focus:ring-danger/40"
          >
            <AlertTriangle className="w-4 h-4" />
            {confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3.5 px-4 sm:px-6 py-5">
        <span className="w-11 h-11 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0 ring-1 ring-danger/20">
          <AlertTriangle className="w-5 h-5" />
        </span>
        <p className="text-ui text-brand-text-secondary leading-relaxed pt-1.5">
          {(message ?? '')}
        </p>
      </div>
    </XModalShell>
  );
}

// ============================================================================
// Component
// ============================================================================

export function XButtonBar({
  buttonBar,
  selectedCount,
  dataCount,
  onAction,
  permissions,
  mode,
  rightSlot,
  selectedRowData,
  hasStateControl = false,
  stateCheckedCount = 0,
  stateCheckedStatus = 'none',
  embedded = false,
  embeddedSide,
  slotNoFim,
}: XButtonBarProps): JSX.Element {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------

  // Empresa corrente: ações que dependem dela (importar nota, emitir NF-e/NFS-e) ficam DESABILITADAS
  // enquanto nenhuma empresa estiver escolhida. Genérico (CE-19): quem declara a dependência é o back,
  // pelo `requiresCompany` do botão — o front não conhece App nenhuma.
  const { company } = useCompany();
  const semEmpresa = company === null;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [confirmButton, setConfirmButton] = useState<XButton | null>(null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Transforma botão de ToggleStatus baseado no estado do registro selecionado
  const getTransformedButton = useCallback((pButton: XButton): XButton => {
    // Export: fica ao lado do "Fechar" (alinhado à direita). Cor distinta é
    // aplicada em renderButton (violeta), independente de tema.
    if (pButton.action === 7) // Export
      return { ...pButton, alignment: XButtonAlignment.Right };

    if (pButton.action !== 13) // ToggleStatus
      return pButton;

    // Se não há registro selecionado, retorna o botão original
    if (!selectedRowData)
      return pButton;

    const isActive = selectedRowData['isActive'] === true;

    if (isActive) {
      // Registro ativo: mostrar botão para DESATIVAR (vermelho, lixeira). ToggleStatus age em UMA
      // linha (seleção única) ⇒ mensagem de registro único, sem o {{count}} do fluxo em lote.
      return {
        ...pButton,
        title: 'Desativar',
        icon: 'trash-2',
        buttonType: 4, // Danger (red)
        tooltip: 'Desativar o registro selecionado',
        confirmMessage: 'Deseja realmente desativar este registro?',
      };
    } else {
      // Registro inativo: mostrar botão para ATIVAR (verde, reciclar)
      return {
        ...pButton,
        title: 'Ativar',
        icon: 'rotate-ccw',
        buttonType: 3, // Success (green)
        tooltip: 'Ativar o registro selecionado',
        confirmMessage: 'Deseja realmente ativar este registro?',
      };
    }
  }, [selectedRowData]);

  // Verifica se botão é apropriado para o contexto atual (modo e seleção)
  const isButtonApplicable = useCallback((pButton: XButton): boolean => {
    // Botões específicos por modo
    switch (pButton.action) {
      case 1: // Create - só no modo List
        return mode === 1;
      case 2: // Edit - só no modo List com seleção única
        return mode === 1 && selectedCount === 1;
      case 3: // Delete - só no modo List com seleção
        return mode === 1 && selectedCount > 0;
      case 13: // ToggleStatus - só no modo List com seleção única; oculto em linha travada (stateLocked)
        return mode === 1 && selectedCount === 1 && selectedRowData?.['stateLocked'] !== true;
      case 14: // Activate - only when state-checked rows are ALL inactive
        return mode === 1 && hasStateControl && stateCheckedCount > 0 && stateCheckedStatus === 'inactive';
      case 15: // Deactivate - only when state-checked rows are ALL active
        return mode === 1 && hasStateControl && stateCheckedCount > 0 && stateCheckedStatus === 'active';
      case 17: // RemoveChecked - remove (hard delete) the state-checked rows, any state
        return mode === 1 && hasStateControl && stateCheckedCount > 0;
      case 6: // Refresh - refaz a CONSULTA: só existe no modo List, mesmo sem linha nenhuma na grade
        return mode === 1;
      case 7: // Export - só no modo List com dados
        return mode === 1 && dataCount > 0;
      case 9: // Print - só no modo List com dados
        return mode === 1 && dataCount > 0;
      case 4: // Save - só nos modos Edit/Create
        return mode === 3 || mode === 4;
      case 5: // Cancel - só nos modos Edit/Create/Detail
        return mode !== 1;
      case 12: // Close - sempre visível
        return true;
      default:
        return true;
    }
  }, [selectedCount, dataCount, mode, hasStateControl, stateCheckedCount, stateCheckedStatus, selectedRowData]);

  // ---------------------------------------------------------------------------
  // Filtered Buttons
  // ---------------------------------------------------------------------------

  const visibleButtons = useMemo(() => {
    return buttonBar.buttons
      .filter((btn) => btn.isVisible)
      .filter((btn) => btn.isEnabled)
      .filter((btn) => {
        // Verifica permissão se definida
        if (btn.permission && !permissions.includes(btn.permission))
          return false;

        return true;
      })
      .filter((btn) => {
        // Verifica se requer seleção
        if (btn.requiresSelection && selectedCount === 0)
          return false;

        return true;
      })
      .filter((btn) => visivelNaLinha(btn, selectedRowData))
      .filter((btn) => isButtonApplicable(btn))
      .map((btn) => getTransformedButton(btn))
      .sort((a, b) => a.order - b.order);
  }, [buttonBar.buttons, permissions, selectedCount, selectedRowData, isButtonApplicable, getTransformedButton]);

  // Separar botões por alinhamento
  const leftButtons = useMemo(() => 
    visibleButtons.filter((btn) => btn.alignment !== XButtonAlignment.Right),
  [visibleButtons]);

  const rightButtons = useMemo(() => 
    visibleButtons.filter((btn) => btn.alignment === XButtonAlignment.Right),
  [visibleButtons]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleClick = useCallback((pButton: XButton) => {
    // Guarda de clique: o botão já vem desabilitado, mas a regra não pode depender só do atributo.
    if (pButton.requiresCompany && semEmpresa)
      return;

    // Se requer confirmação, mostra modal
    if (pButton.requiresConfirmation && pButton.confirmMessage) {
      setConfirmButton(pButton);
      return;
    }

    // Executa ação diretamente
    onAction(pButton.action, pButton);
  }, [onAction, semEmpresa]);

  const handleConfirm = useCallback(() => {
    if (confirmButton) {
      onAction(confirmButton.action, confirmButton);
      setConfirmButton(null);
    }
  }, [confirmButton, onAction]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmButton(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (visibleButtons.length === 0 && !embedded)
    return <></>;

  // Função para renderizar um botão
  function renderButton(button: XButton, index: number, buttons: XButton[]): JSX.Element {
    const IconComponent = ICON_MAP[button.icon.toLowerCase()];
    const isIconOnly = button.buttonType === 8;

    // A paleta semântica decide primeiro (papel explícito do custom, ou papel da ação canônica); só
    // na ausência de papel o botão segue o tipo, que o tema pinta.
    const typeStyle = classeDeCorDoBotao(button.action, button.color) ?? BUTTON_TYPE_STYLES[button.buttonType];

    // Adiciona separador se configurado
    const showSeparator = buttonBar.separator && index > 0 && index < buttons.length;

    // Translate button title and tooltip
    const translatedTitle = (button.title ?? '');
    const translatedTooltip = (button.tooltip ?? '');

    // O hint mostra o rótulo como linha forte e o tooltip do back como detalhe. Quando os dois
    // dizem o mesmo (o back não declarou tooltip próprio), o detalhe fica de fora — repetir a
    // mesma frase duas vezes no painel não informa nada.
    const hintBody = translatedTooltip && translatedTooltip !== translatedTitle
      ? translatedTooltip
      : undefined;

    // Ação destrutiva pede um painel que avise. O resto é informativo.
    const hintTone: XHintTone =
      button.action === XButtonAction.Delete || button.action === XButtonAction.Deactivate
        ? 'danger'
        : 'info';

    // Sem empresa corrente, a ação que depende dela aparece — desabilitada — e o painel diz por quê.
    // Escondê-la faria o usuário procurar um botão que existe.
    const bloqueadoPorEmpresa = button.requiresCompany && semEmpresa;
    const hintDetalhe = bloqueadoPorEmpresa ? 'Escolha a empresa em que você está operando para usar esta ação.' : hintBody;

    return (
      <div key={button.id} className="flex items-center gap-1 sm:gap-2" data-tour={`button-${button.name}`}>
        {showSeparator && buttonBar.separator === '|' && (
          <div className="hidden sm:block h-5 w-px bg-border" />
        )}

        <XHint label={translatedTitle} body={hintDetalhe} tone={bloqueadoPorEmpresa ? 'danger' : hintTone} placement="bottom">
          <button
            type="button"
            onClick={() => handleClick(button)}
            disabled={bloqueadoPorEmpresa}
            aria-label={translatedTitle}
            // Pelo NOME do botão, não pelo rótulo: o rótulo vem do back (CE-19) e muda com o texto;
            // o nome é o identificador declarado na App. Mesma chave do data-tour, logo acima.
            data-testid={`appbar-btn-${button.name}`}
            className={`
              inline-flex items-center justify-center gap-1.5 sm:gap-2
              font-medium rounded-lg transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isIconOnly ? 'p-2.5 sm:p-2' : 'px-2.5 sm:px-3 py-2 sm:py-1.5'}
              text-ui-sm sm:text-ui
              min-h-[33px] sm:min-h-[36px]
              ${typeStyle}
            `}
          >
            {buttonBar.showIcons && IconComponent && (
              <IconComponent className="w-4 h-4" />
            )}
            {/* Hide labels on mobile for non-primary actions */}
            {buttonBar.showLabels && !isIconOnly && (
              <span className="hidden sm:inline">{translatedTitle}</span>
            )}
          </button>
        </XHint>
      </div>
    );
  }

  // Embedded mode: render buttons inline without wrapper div.
  // Parent provides the container (unified header row).
  // embeddedSide restricts which alignment group to render ('left' | 'right' | all).
  if (embedded) {
    const embeddedButtons =
      embeddedSide === 'left'  ? leftButtons  :
      embeddedSide === 'right' ? rightButtons :
      [...leftButtons, ...rightButtons];

    const comSlot = embeddedSide !== 'left' && slotNoFim !== undefined;
    if (embeddedButtons.length === 0 && !comSlot)
      return <></>;

    return (
      <>
        {embeddedButtons.map((button, index) => renderButton(button, index, embeddedButtons))}
        {comSlot && slotNoFim}
        {confirmButton && (
          <ConfirmModal
            title={'Confirmação'}
            message={confirmButton.confirmMessage}
            confirmText={'Confirmar'}
            cancelText={'Cancelar'}
            onConfirm={handleConfirm}
            onCancel={handleCancelConfirm}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={`
          min-h-row flex flex-wrap items-center px-2 sm:px-4 py-2 sm:py-0 gap-2
          bg-brand-surface border-b border-border-light
          ${POSITION_STYLES[buttonBar.position]}
        `}
      >
        {/* Left-aligned buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {leftButtons.map((button, index) => renderButton(button, index, leftButtons))}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-[8px]" />

        {/* Right-aligned buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
          {rightButtons.map((button, index) => renderButton(button, index, rightButtons))}
          {rightSlot}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmButton && (
        <ConfirmModal
          title={'Confirmação'}
          message={confirmButton.confirmMessage}
          confirmText={'Confirmar'}
          cancelText={'Cancelar'}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  );
}
