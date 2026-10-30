/**
 * ErrorModal - Global modal for error display
 * 
 * Displays errors with different visual styles based on category:
 * - validation: Yellow/warning style with field-level error details
 * - error: Red style for business logic errors (not found, conflict, etc.)
 * - exception: Red/dark style for unexpected server errors
 * - warning: Orange style for non-blocking warnings
 * - message: Blue/info style for informational messages
 * 
 * Compact and user-friendly design focused on user experience.
 */

import { useCallback, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, AlertCircle, Info, ServerCrash, Copy, Check } from 'lucide-react';

import { useError } from '@core/hooks/useError';
import { useTabs } from '@core/hooks/useTabs';
import { useUserMenu } from '@core/hooks/useMenu';
import { getIntlLocale } from '@core/lib';
import { resolvedorDoAppX } from '@core/lib/resolvedorDoAppX';
import type { ErrorCategory, FieldError } from '@core/lib/errorEmitter';
import { MessageText } from '@core/components/ui/MessageText';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';

// ============================================================================
// Category Style Config
// ============================================================================

interface CategoryStyle {
  borderColor: string;
  headerBg: string;
  headerText: string;
  accentColor: string;
  icon: typeof AlertTriangle;
  closeBtnBg: string;
  fieldBg: string;
  fieldBorder: string;
}

const CATEGORY_STYLES: Record<ErrorCategory, CategoryStyle> = {
  validation: {
    borderColor: 'border-warning',
    headerBg: 'bg-warning/10',
    headerText: 'text-warning',
    accentColor: 'text-warning',
    icon: AlertTriangle,
    closeBtnBg: 'bg-warning hover:bg-warning/80',
    fieldBg: 'bg-warning/5',
    fieldBorder: 'border-warning/20',
  },
  error: {
    borderColor: 'border-danger',
    headerBg: 'bg-danger/10',
    headerText: 'text-danger',
    accentColor: 'text-danger',
    icon: AlertCircle,
    closeBtnBg: 'bg-danger hover:bg-danger/80',
    fieldBg: 'bg-danger/5',
    fieldBorder: 'border-danger/20',
  },
  exception: {
    borderColor: 'border-danger',
    headerBg: 'bg-danger/15',
    headerText: 'text-danger',
    accentColor: 'text-danger',
    icon: ServerCrash,
    closeBtnBg: 'bg-danger hover:bg-danger/80',
    fieldBg: 'bg-danger/5',
    fieldBorder: 'border-danger/20',
  },
  warning: {
    borderColor: 'border-amber-500',
    headerBg: 'bg-amber-500/10',
    headerText: 'text-amber-600 dark:text-amber-400',
    accentColor: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
    closeBtnBg: 'bg-amber-500 hover:bg-amber-500/80',
    fieldBg: 'bg-amber-500/5',
    fieldBorder: 'border-amber-500/20',
  },
  message: {
    borderColor: 'border-info',
    headerBg: 'bg-info/10',
    headerText: 'text-info',
    accentColor: 'text-info',
    icon: Info,
    closeBtnBg: 'bg-info hover:bg-info/80',
    fieldBg: 'bg-info/5',
    fieldBorder: 'border-info/20',
  },
};

// ============================================================================
// Category Title
// ============================================================================

function getCategoryTitle(pCategory: ErrorCategory): string {
  switch (pCategory) {
    case 'validation':
      return 'Dados Inválidos';
    case 'error':
      return 'Erro';
    case 'exception':
      // "Erro Inesperado" não diz nada a quem lê — o título nomeia DE QUEM é a falha, e a mensagem
      // (que agora sempre traz operação e detalhe técnico) diz qual foi.
      return 'Falha do Sistema';
    case 'warning':
      return 'Atenção';
    case 'message':
      return 'Aviso';
    default:
      return 'Erro';
  }
}

// ============================================================================
// Field Errors Sub-Component
// ============================================================================

function FieldErrorList({ fieldErrors, accentColor }: { fieldErrors: FieldError[]; accentColor: string }): JSX.Element {
  return (
    <ul className="space-y-2">
      {fieldErrors.map((fe) => (
        <li key={fe.field}>
          {/*
            The field name is what orients the user, so it carries the weight: bold, and in the
            severity's accent colour (amber for a warning, red for an error) rather than the neutral
            text tone. Reading the dialog, the eye lands on WHICH field before WHAT is wrong with it.
          */}
          <span className={`font-bold text-sm break-words ${accentColor}`}>{fe.field}</span>
          <ul className="mt-0.5 ml-3">
            {fe.messages.map((msg, idx) => (
              <li key={idx} className="text-xs text-brand-text-secondary flex items-start gap-1.5 py-0.5">
                <span className={`${accentColor} mt-0.5 shrink-0`}>•</span>
                {/* A mensagem de campo carrega o VALOR recusado, que pode ser longo e sem espaço. */}
                <span className="min-w-0 break-words">{msg}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ErrorModal(): JSX.Element | null {
  const { error, clearError, isDebugMode } = useError();
  const { data: menu } = useUserMenu();
  const { openTab, setActiveTab, getTabsByMenuItemID, activeTabId } = useTabs();
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  /**
   * Resolve o App que a mensagem cita (`[[app:Nome|Rótulo]]`) contra o MENU DO PRÓPRIO USUÁRIO: o back
   * manda um NOME de App, nunca um endereço, e o que não está no menu dele não vira link (sem permissão,
   * ou nome que não existe mais). Genérico por construção — o front não conhece App nenhuma (CE-19);
   * resolve o nome que vier.
   *
   * Já aberto ⇒ foca a aba existente em vez de abrir uma segunda: quem clica no link quer CHEGAR à tela,
   * não colecionar cópias dela.
   */
  const resolverLinkApp = useCallback((
    pNomeApp: string,
    pRecorte?: Record<string, string>,
    pRegistroID?: string
  ): (() => void) | null => {
    // A mensagem nasceu dentro de um AppX (pela aba de origem): só abre SubAppX do próprio AppX, e link para App do
    // menu fica texto — de um AppX nunca se abre uma App do menu (dono, 2026-10-25; RX-1).
    const doAppX = resolvedorDoAppX(error?.originTabId);
    if (doAppX) {
      const abrir = doAppX(pNomeApp, pRecorte, pRegistroID);
      return abrir ? () => { abrir(); clearError(); } : null;
    }

    const item = menu?.groups
      .flatMap((pGrupo) => pGrupo.items)
      .find((pItem) => pItem.name.toLowerCase() === pNomeApp.toLowerCase());

    if (!item)
      return null;

    return () => {
      const abertas = getTabsByMenuItemID(item.id);

      // Com RECORTE ou REGISTRO, abre uma aba NOVA mesmo já havendo uma: focar a existente entregaria
      // a tela com o filtro que estava lá, e não o registro que a mensagem cita — o link pareceria
      // não funcionar.
      if (abertas.length > 0 && !pRecorte && !pRegistroID)
        setActiveTab(abertas[0].id);
      else
        openTab(item, pRecorte, pRegistroID);

      clearError();
    };
  }, [menu, openTab, setActiveTab, getTabsByMenuItemID, clearError, error?.originTabId]);

  const handleCopyDetails = useCallback(() => {
    if (!error) return;

    const details = [
      `${'Erro'}: ${error.title}`,
      `${'Mensagem'}: ${error.message}`,
      error.statusCode ? `${'Status'}: ${error.statusCode}` : '',
      error.url ? `${'URL'}: ${error.method || 'GET'} ${error.url}` : '',
      error.details ? `${'Detalhes'}: ${error.details}` : '',
      error.fieldErrors?.length
        ? `\n${'Campos com problemas'}:\n${error.fieldErrors.map(fe => `  ${fe.field}: ${fe.messages.join(', ')}`).join('\n')}`
        : '',
      `${'Timestamp'}: ${error.timestamp.toISOString()}`,
      error.stack ? `\n${'Stack Trace'}:\n${error.stack}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [error]);

  /**
   * Copia a MENSAGEM que o usuário lê — só ela, sem status, URL nem rastro (o "Copiar" do rodapé de
   * diagnóstico já faz o pacote técnico). A marcação de apresentação (`**`, `[[app:…]]`, o `N. ` dos
   * passos) sai: o que vai para a área de transferência é o texto limpo que a pessoa copiaria à mão
   * para colar num chamado — um QR Code longo, o motivo de uma rejeição da SEFAZ.
   */
  const handleCopyMessage = useCallback(() => {
    if (!error) return;

    const plano = error.message
      .replace(/\[\[app:[A-Za-z0-9_.-]+\|([^|\]]+)\]\]/g, '$1')   // link de App → só o rótulo
      .replace(/\*\*(.+?)\*\*/g, '$1')                            // **destaque** → texto
      .replace(/^[ \t]*(\d+)\.[ \t]+/gm, '$1. ')                 // normaliza o recuo dos passos
      .trim();

    navigator.clipboard.writeText(plano).then(() => {
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    });
  }, [error]);

  if (!error) return null;

  // CONTEXTO DA ABA (dono, 2026-08-08; binária). A mensagem pertence ao App que a provocou: enquanto
  // outra aba está à frente, ela NÃO aparece — aviso do faturamento de um Pedido não fica por cima da
  // grade de Pessoas. Não é descarte: o erro continua no estado, e voltar à aba de origem o traz de
  // volta, com o mesmo texto e o mesmo horário. Origem vazia = mensagem da CASCA (pré-login, sessão),
  // que não pertence a aba nenhuma e por isso aparece sempre.
  if (error.originTabId && error.originTabId !== activeTabId)
    return null;

  const category = error.category || 'error';
  const style = CATEGORY_STYLES[category];
  const IconComponent = style.icon;
  const title = getCategoryTitle(category);
  const hasFieldErrors = (error.fieldErrors?.length ?? 0) > 0;

  // ESCOPO do diálogo (dono, 2026-08-08, binária): mensagem que nasce de um App NUNCA vira splash de
  // página inteira — TODA categoria (aviso, mensagem, validação, erro e falha do sistema) fica contida
  // na ÁREA DA APLICAÇÃO (`[data-app-area]`), sem tapar o menu, o cabeçalho nem as abas. Revoga a
  // exceção de 2026-07-15, que deixava o vermelho cobrir a página: a gravidade da falha muda a COR e o
  // texto, não o quadro — quem lê "não foi possível faturar" precisa continuar vendo o pedido que
  // tentou faturar. `absolute` dentro dessa área + z acima do modal de formulário (ZIndexManager ~1000).
  // Sem área de App no DOM (login, cadastro, landing), não há App para conter: aí é diálogo da CASCA e
  // cai no `fixed` de página inteira.
  const areaApp = typeof document !== 'undefined'
    ? document.querySelector('[data-app-area]')
    : null;

  const conteudo = (
    <div className={`${areaApp ? 'absolute' : 'fixed'} inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4`}>
      {/*
        TETO DE METADE DA ÁREA (dono, 2026-08-08; binária): nenhuma mensagem passa de 50% da área em
        que está — nem em altura, nem em largura. O que excede vira ROLAGEM no texto, não janela
        maior. Sem o teto, uma recusa item a item (uma linha por produto sem grupo IBS/CBS) esticava
        o diálogo até o rodapé sair da tela, e o botão "Fechar" ficava inalcançável.

        `flex-col` + o corpo em `min-h-0` são o que faz a rolagem existir: cabeçalho e rodapé não
        encolhem, e sobra do texto rola entre eles. Sem `min-h-0` o filho flexível se recusa a
        encolher abaixo do conteúdo, e o `overflow-y-auto` nunca chega a ter o que rolar.

        A largura tem PISO: 50% de uma área estreita (celular) daria uma coluna de texto ilegível.
        Fica o menor entre a largura de leitura (32rem) e a metade da área — mas nunca abaixo de
        20rem, e nunca além dos 100% que o `w-full` já limita.
      */}
      <XCartaoDeModal
        className={`flex flex-col w-full max-h-[50%] bg-brand-surface ${style.borderColor} rounded-xl`}
        style={{ maxWidth: 'min(32rem, max(50%, 20rem))' }}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-4 py-2.5 border-b ${style.borderColor}/30 ${style.headerBg} rounded-t-[10px]`}>
          <div className={`flex items-center gap-2 ${style.headerText}`}>
            <IconComponent className="w-5 h-5" />
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <button
            onClick={clearError}
            className="min-h-touch min-w-touch flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors"
            title={'Fechar'}
            aria-label={'Fechar'}
          >
            <X className={`w-4 h-4 ${style.headerText}`} />
          </button>
        </div>

        {/* CORPO — é ELE que rola (dono, 2026-08-08). `flex-1 min-h-0` é o par que faz a rolagem
            existir: `min-h-0` autoriza o item a encolher abaixo do próprio conteúdo, e sem isso o
            texto simplesmente VAZA para fora do cartão. Aqui não cabe a variante "moldura fixa +
            filho rolando com `h-full`": a moldura tem altura resolvida pelo flex, não declarada, e
            `height:100%` sobre altura `auto` volta a ser `auto` — não recorta nada. Foi exatamente o
            que se viu: cartão parando em 50% e o texto escorrendo por baixo do rodapé. */}
        <div className="relative flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {/* "Copiar" DISCRETO, colado ao canto superior direito do corpo. `sticky` porque o corpo é
              quem rola: assim o botão acompanha o texto em vez de subir com ele e sumir justamente na
              mensagem longa — a que alguém quer copiar. O `-mb-*` desconta a linha que ele ocuparia,
              para o texto começar onde começava antes. Some no fundo (baixo contraste) e só ganha
              contraste no hover. Serve a quem leva o texto a um chamado — um QR Code longo, o motivo
              de uma rejeição da SEFAZ. */}
          <div className="sticky top-0 z-10 flex justify-end -mb-5">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="
                flex items-center gap-1 px-1.5 py-0.5 rounded
                text-[11px] text-brand-text-muted
                hover:bg-black/10 hover:text-brand-text-primary
                focus:outline-none focus-visible:ring-1 focus-visible:ring-current
                transition-colors
              "
              title={'Copiar'}
              aria-label={'Copiar'}
            >
              {messageCopied ? (
                <>
                  <Check className="w-3 h-3 text-success" />
                  <span className="text-success">{'Copiado'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{'Copiar'}</span>
                </>
              )}
            </button>
          </div>

          {/* Mensagem principal, FORMATADA (CE-21, dono 2026-07-16): parágrafos, passos numerados,
              destaques em negrito e LINK para a App que resolve o problema. `pr-16` na primeira área de
              texto reserva a faixa do botão, para ele não cobrir a primeira linha. */}
          <MessageText
            text={error.message}
            className="text-brand-text-primary text-sm leading-relaxed pr-16"
            resolveAppLink={resolverLinkApp}
            linkClassName={style.accentColor}
          />

          {/* Field Errors (validation category) */}
          {hasFieldErrors && (
            <div className={`p-3 ${style.fieldBg} border ${style.fieldBorder} rounded-lg`}>
              <FieldErrorList fieldErrors={error.fieldErrors!} accentColor={style.accentColor} />
            </div>
          )}

          {/* Debug Info — detalhe técnico, status, URL e rastro de pilha. TUDO só em modo de
              diagnóstico (dono, 2026-07-12): fora dele, o usuário lê apenas a mensagem de alto nível.
              Texto de exceção ("The LINQ expression could not be translated…") não diz nada a quem
              opera o sistema — diz ao desenvolvedor, e é aqui que ele o encontra.
              SÓ em erro/exceção (vermelho): o AVISO de negócio (laranja) e a validação são de alto nível,
              elegantes — nunca mostram rastro, mesmo em diagnóstico (padrão do projeto, dono 2026-07-15). */}
          {isDebugMode && (category === 'error' || category === 'exception') && (
            <div className="space-y-2 pt-1">
              {error.details && error.details !== error.message && (
                <div className={`p-3 ${style.fieldBg} border ${style.fieldBorder} rounded-lg`}>
                  {/* Detalhe técnico é o texto que MAIS traz token gigante sem espaço (URL, XML,
                      expressão). Sem a quebra, ele vaza para fora da caixa. */}
                  <p className="text-xs text-brand-text-secondary whitespace-pre-line break-words">{error.details}</p>
                </div>
              )}
              {/* Status and URL */}
              {(error.statusCode || error.url) && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  {error.statusCode && (
                    <span className="text-brand-text-muted">
                      <span className={style.accentColor}>{'Status'}:</span> {error.statusCode}
                    </span>
                  )}
                  {/* `truncate` num item de flex só corta se ele puder encolher: sem `min-w-0` a URL
                      define a largura mínima do item e estoura a linha em vez de cortar. */}
                  {error.url && (
                    <span className="text-brand-text-muted min-w-0 max-w-full truncate">
                      <span className={style.accentColor}>{'URL'}:</span>{' '}
                      <span className="text-brand-text-secondary">{error.method || 'GET'}</span>{' '}
                      {error.url}
                    </span>
                  )}
                </div>
              )}

              {/* Stack Trace */}
              {error.stack && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-brand-text-muted">{'Stack Trace (Debug)'}</span>
                    <button
                      onClick={handleCopyDetails}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-brand-text-muted hover:text-brand-text-secondary transition-colors"
                      title={'Copiar detalhes'}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-success" />
                          <span className="text-success">{'Copiado'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{'Copiar'}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2 bg-black/40 border border-border-light rounded text-[10px] text-brand-text-muted overflow-auto max-h-32 font-mono leading-tight">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RODAPÉ — fora da área que rola (dono, 2026-08-08): o "Fechar" fica sempre visível. Antes
            ele era a última linha do texto, e numa recusa item a item o usuário tinha de rolar a
            mensagem inteira para achar como sair dela. */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border-light">
          <span className="text-[10px] text-brand-text-muted">
            {error.timestamp.toLocaleString(getIntlLocale())}
          </span>
          <button
            onClick={clearError}
            className={`px-4 py-1.5 ${style.closeBtnBg} text-white rounded-lg text-xs font-medium transition-colors min-h-[32px]`}
          >
            {'Fechar'}
          </button>
        </div>
      </XCartaoDeModal>
    </div>
  );

  // Há área de App ⇒ portal para dentro dela (fica sobre o conteúdo do App, não sobre o menu, o
  // cabeçalho ou as abas); sem área de App (casca pré-login) já está em `fixed` de página inteira.
  return areaApp ? createPortal(conteudo, areaApp) : conteudo;
}
