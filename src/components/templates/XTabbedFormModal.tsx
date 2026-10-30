/**
 * XTabbedFormModal - Modal de Formulário com Abas
 * 
 * Modal avançado que suporta múltiplas abas, onde cada aba pode conter:
 * - Um formulário tradicional (seções com campos)
 * - Uma grade de detalhes (master-detail relationship)
 * 
 * Features:
 * - Navegação por tabs
 * - Cada tab pode ter formulário ou grid
 * - Grid com botões Novo/Excluir
 * - Sincronização de dados entre tabs
 * - Context Help integrado
 */

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type JSX,
} from 'react';
import { Save, Loader2, Plus, Trash2, LogOut, ChevronLeft, ChevronRight, MousePointerClick } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { XApplicationMode, XButtonColor, XDataType } from '@core/types';
import type {
  XTabbedFormView,
  XFormTab,
  XDetailGrid,
  XDetailGridColumn,
  XDataEditor,
  XRowAction,
} from '@core/types';
import { XRowActionFormModal } from './XRowActionFormModal';
import { ApiError } from '@core/lib/api';
import { MessageText } from '@core/components/ui/MessageText';
import { acoesVisiveisNaLinha, matchRules } from '@core/lib/visibility';
import { XFormView } from './XFormView';
import { XEditor } from './editors/XEditor';
import { XModalShell } from './XModalShell';
import { XPermissionEditor } from './XPermissionEditor';
import { XFormTabComponentRegistry } from './XFormTabComponentRegistry';
import { api } from '@core/lib/api';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XBUTTON_PALETTE } from '@core/lib/xButtonPalette';
import { XHint } from '@core/components/ui/XHint';
import { useDevice, useMolduraDeModal, usePreferenciaDoUsuario, chaveDoQuadroDoFormulario, type QuadroDeModal } from '@core/hooks';
import { FormBusyProvider } from '@core/contexts/FormBusyContext';
import { FormValuesProvider } from '@core/contexts/FormValuesContext';
import { XFormBusyVeil } from './XFormBusyVeil';
import { pisoDoFormularioPx, alturaDoCorpoPx, temCampoElastico, ehCampoElastico, MODAL_MAX_PERCENT } from '@core/lib/formScale';
import { CLOSE_BUTTON_STYLE, aplicarTotaisAoVivo, aplicarValoresDirigidos, errosDoPrecoDoItem, formatCurrency, formatDate, formatDateTime, formatDecimal, formatDocument, formatPercentage, getFieldValue, gridAlignmentClass, isTruthy, isVisible } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

export interface XTabbedFormModalProps {
  formView: XTabbedFormView;
  mode: XApplicationMode;
  data: Record<string, unknown>;
  isOpen: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onSave: (pData: Record<string, unknown>) => void;
  onCancel: () => void;
  /** Base API URL for detail operations (optional, uses formView endpoints if not provided) */
  apiBaseURL?: string;
  /** Parent record ID for detail operations */
  parentID?: string;
  /**
   * Recarrega o registro do back. Repassado às abas customizadas (ver XFormTabComponentProps):
   * a aba que dispara uma operação capaz de alterar campos de OUTRAS abas precisa pedir a releitura,
   * senão o formulário salva por cima do que o back acabou de gravar.
   */
  onReloadForm?: () => void | Promise<void>;
  /**
   * Erros POR CAMPO que o servidor devolveu na gravação (campo → texto), dono 2026-10-12: marcam o
   * campo no formulário e abrem a aba do primeiro errado. O diálogo mostra a lista; aqui ela vira
   * borda vermelha com a frase embaixo, para o operador corrigir tudo numa passada.
   */
  serverErrors?: Record<string, string>;
}

/** O formulário é feito SÓ de grades de detalhe — nenhuma linha de campo lhe dá altura. */
function soDeGrades(pFormView: XTabbedFormView): boolean {
  return pFormView.tabs.length > 0 && pFormView.tabs.every((pT) => pT.hasDetailGrid);
}

interface DetailItem {
  id: string;
  [key: string]: unknown;
}

interface LookupItem {
  id: string;
  name: string;
}

// ============================================================================
// Helper: Get Lucide Icon by name
// ============================================================================

function getIconByName(pName: string): React.ComponentType<{ className?: string }> | null {
  if (!pName) return null;
  
  const iconName = pName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  const icon = (LucideIcons as Record<string, unknown>)[iconName];
  return typeof icon === 'function' ? icon as React.ComponentType<{ className?: string }> : null;
}

// ============================================================================
// Tab Header Component
// ============================================================================

interface TabHeaderProps {
  tabs: XFormTab[];
  activeIndex: number;
  onTabClick: (pIndex: number) => void;
  /** Largura que a fileira de abas precisa, medida no navegador — o modal a usa para se alargar. */
  onLarguraNecessaria?: (pPixels: number) => void;
}

/**
 * Fileira de abas — FE-10: aba NENHUMA fica escondida.
 *
 * A largura de uma aba depende do texto TRADUZIDO e da fonte: só o navegador a sabe, e por isso é medida
 * aqui, em execução (o back publica o piso dos CAMPOS — FE-9 —, não o das abas). O que se mede é
 * reportado ao modal, que se alarga até caber a fileira inteira.
 *
 * Alargar tem limite (o teto de 90% da área do App, FE-5). Batido o teto, a fileira ROLA e ganha os
 * botões de navegação — que só existem quando há o que navegar. Antes, ela rolava calada, com a barra de
 * rolagem oculta: a última aba simplesmente sumia na borda, sem sinal nenhum de que existia.
 */
function TabHeader({ tabs, activeIndex, onTabClick, onLarguraNecessaria }: TabHeaderProps): JSX.Element {
  const fileiraRef = useRef<HTMLDivElement>(null);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  // Mede o que a fileira precisa e o que ela tem. `scrollWidth` é o conteúdo (as abas não encolhem:
  // whitespace-nowrap + flex-shrink-0), `clientWidth` é o espaço visível.
  const medir = useCallback(() => {
    const fileira = fileiraRef.current;
    if (!fileira) return;

    const sobra = fileira.scrollWidth - fileira.clientWidth;
    setPodeVoltar(fileira.scrollLeft > 1);
    setPodeAvancar(fileira.scrollLeft < sobra - 1);

    onLarguraNecessaria?.(fileira.scrollWidth);
  }, [onLarguraNecessaria]);

  useEffect(() => {
    medir();

    const fileira = fileiraRef.current;
    if (!fileira) return;

    const observador = new ResizeObserver(medir);
    observador.observe(fileira);
    for (const filho of Array.from(fileira.children)) observador.observe(filho);

    return () => observador.disconnect();
  }, [medir, tabs.length]);

  // A aba ativa nunca fica fora de vista — trocar de aba pelo teclado, ou o modal reabrir numa aba
  // distante, traria de volta o problema que os botões vieram resolver.
  useEffect(() => {
    const fileira = fileiraRef.current;
    const ativa = fileira?.children[activeIndex] as HTMLElement | undefined;
    ativa?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  const rolar = useCallback((pDirecao: -1 | 1) => {
    const fileira = fileiraRef.current;
    if (!fileira) return;

    // Rola por PÁGINA (80% do visível): passo fixo em pixels pularia abas curtas e travaria nas longas.
    fileira.scrollBy({ left: pDirecao * fileira.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  const transborda = podeVoltar || podeAvancar;

  const botao = (pDirecao: -1 | 1, pAtivo: boolean): JSX.Element => (
    <button
      type="button"
      onClick={() => rolar(pDirecao)}
      disabled={!pAtivo}
      aria-label={pDirecao === -1 ? 'Rolar para a esquerda' : 'Rolar para a direita'}
      title={pDirecao === -1 ? 'Rolar para a esquerda' : 'Rolar para a direita'}
      className="shrink-0 self-stretch px-1.5 flex items-center justify-center border-b border-border-light
        bg-muted-bg text-brand-text-secondary hover:text-brand-text-primary hover:bg-hover
        disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
    >
      {pDirecao === -1 ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="shrink-0 flex items-stretch bg-muted-bg">
      {transborda && botao(-1, podeVoltar)}

      <div
        ref={fileiraRef}
        onScroll={medir}
        role="tablist"
        className="flex-1 min-w-0 flex items-end border-b border-border-light overflow-x-auto scrollbar-hide"
      >
        {tabs.map((tab, index) => {
          const IconComponent = getIconByName(tab.icon);
          const isActive = index === activeIndex;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabClick(index)}
              className={`
                flex items-center gap-2 px-3 sm:px-4 py-2 mt-1 text-ui-sm sm:text-ui font-medium
                rounded-t-lg transition-all duration-150 whitespace-nowrap flex-shrink-0
                min-h-[40px] sm:min-h-[36px] cursor-pointer
                ${isActive
                  ? 'text-brand-primary bg-brand-surface border border-b-0 border-border shadow-md -mb-px z-10'
                  : 'text-brand-text-secondary bg-muted-bg border border-b-0 border-border-light hover:bg-hover hover:text-brand-text-primary'
                }
              `}
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              <span>{(tab.title ?? '')}</span>
            </button>
          );
        })}
      </div>

      {transborda && botao(1, podeAvancar)}
    </div>
  );
}

// ============================================================================
// Detail Grid Component
// ============================================================================

interface DetailGridProps {
  /** Chave do registro-pai do formulário: substitui {id} nos endpoints. */
  parentID?: string;
  config: XDetailGrid;
  items: DetailItem[];
  isLoading: boolean;
  isReadOnly: boolean;
  onAdd: () => void;
  onRemove: (pID: string) => void;
  /** Recarrega a lista após gravar no painel de edição (master-detail editável). */
  onReload: () => void;
}

function DetailGrid({
  parentID,
  config,
  items,
  isLoading,
  isReadOnly,
  onAdd,
  onRemove,
  onReload
}: DetailGridProps): JSX.Element {

  // Grade FILHA: só existe quando o modelo a declara. É ela que evita despejar, numa aba só, os
  // tributos de todos os itens de uma nota de cem itens — o usuário escolhe a linha e vê o que é dela.
  const [linhaSelecionada, setLinhaSelecionada] = useState<string | null>(null);
  const [itensFilhos, setItensFilhos] = useState<DetailItem[]>([]);
  const [carregandoFilhos, setCarregandoFilhos] = useState(false);

  // Master-detail EDITÁVEL: quando o modelo declara editFields, o painel de baixo é um formulário. O
  // item em edição é o selecionado (editar) ou {} recém-aberto (incluir); null = nada aberto embaixo.
  const camposEdicao = config.editFields ?? [];

  // A grade que grava pelos SEUS endpoints opera mesmo com o formulário em leitura (num visualizador):
  // o modo do formulário fala do "Salvar" dele, não dela (activeInReadOnly, declarado no back).
  const leitura = isReadOnly && !config.activeInReadOnly;
  const editavel = camposEdicao.length > 0 && !leitura;

  // AÇÕES DA GRADE (rowActions + addAction, dono 2026-10-22): botões NA LINHA — a grade de detalhe não
  // tem barra — e o "incluir" como ação em modal. Tudo declarado no back (CE-19); aqui só se executa.
  const acoesDaLinha = config.rowActions ?? [];
  const acaoIncluir = config.addAction ?? null;
  const [acaoAberta, setAcaoAberta] = useState<{
    acao: XRowAction; chave: string; linha?: DetailItem; iniciais?: Record<string, unknown>;
  } | null>(null);
  const [acaoConfirmando, setAcaoConfirmando] = useState<{
    acao: XRowAction; chave: string; corpo: Record<string, unknown>;
  } | null>(null);
  const [acaoOcupada, setAcaoOcupada] = useState(false);
  const [errosDoServidor, setErrosDoServidor] = useState<Record<string, string> | undefined>(undefined);
  const [mensagemDaAcao, setMensagemDaAcao] = useState<string | null>(null);

  // O "incluir" SOME quando alguma linha casa as regras declaradas — a carta de correção não admite uma
  // segunda em aberto. Não convidar ao erro (diretiva "o sistema não deixa o usuário errar").
  const incluirEscondido = (config.addHiddenWhen?.length ?? 0) > 0
    && items.some((pItem) => matchRules(config.addHiddenWhen, pItem));

  const endpointDaAcao = useCallback((pModelo: string, pChave: string) =>
    pModelo.replace('{id}', parentID ?? '').replace('{rowId}', pChave), [parentID]);

  // Executa: baixa (returnsFile) ou POST com o que se coletou. Sucesso fecha o modal e recarrega a grade.
  // A falha JÁ é mostrada pelo diálogo global (com a cor certa); aqui só se marcam os campos acusados e
  // se recarrega — uma recusa da SEFAZ muda o estado da linha (Rejeitada), e a grade tem de mostrá-lo.
  const executarAcao = useCallback(async (pAcao: XRowAction, pChave: string, pCorpo: Record<string, unknown>) => {
    setAcaoOcupada(true);
    try {
      const endpoint = endpointDaAcao(pAcao.endpoint, pChave);

      if (pAcao.returnsFile) {
        const { blob, filename } = await api.downloadBlob(endpoint, {});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const resposta = await api.post<Record<string, unknown>>(endpoint, pCorpo);
      const mensagem = resposta?.mensagem ?? resposta?.message;
      setMensagemDaAcao(typeof mensagem === 'string' && mensagem.length > 0 ? mensagem : null);
      setAcaoAberta(null);
      setErrosDoServidor(undefined);
      onReload();
    } catch (erro) {
      if (erro instanceof ApiError && erro.fieldErrors.length > 0)
        setErrosDoServidor(Object.fromEntries(erro.fieldErrors.map((pE) => [pE.field, pE.messages.join(' ')])));
      onReload();
    } finally {
      setAcaoOcupada(false);
    }
  }, [endpointDaAcao, onReload]);

  // Abre a ação: com campos ⇒ modal (os valores iniciais vêm do loadEndpoint, se declarado); sem campos ⇒
  // confirma (se exigido) e executa.
  const abrirAcao = useCallback(async (pAcao: XRowAction, pLinha?: DetailItem) => {
    const chave = pLinha ? String(getFieldValue(pLinha, config.keyField) ?? pLinha.id) : '';
    setMensagemDaAcao(null);

    if ((pAcao.fields?.length ?? 0) > 0) {
      let iniciais: Record<string, unknown> | undefined;
      if (pAcao.loadEndpoint) {
        try {
          iniciais = await api.get<Record<string, unknown>>(endpointDaAcao(pAcao.loadEndpoint, chave)) ?? {};
        } catch {
          // A recusa (nota que não admite a ação, por exemplo) já foi mostrada pelo diálogo global.
          return;
        }
      }
      setErrosDoServidor(undefined);
      setAcaoAberta({ acao: pAcao, chave, linha: pLinha, iniciais });
      return;
    }

    if (pAcao.requiresConfirmation) {
      setAcaoConfirmando({ acao: pAcao, chave, corpo: {} });
      return;
    }

    void executarAcao(pAcao, chave, {});
  }, [config.keyField, endpointDaAcao, executarAcao]);

  const submeterAcao = useCallback((pValores: Record<string, unknown>) => {
    if (!acaoAberta)
      return;

    if (acaoAberta.acao.requiresConfirmation) {
      setAcaoConfirmando({ acao: acaoAberta.acao, chave: acaoAberta.chave, corpo: pValores });
      return;
    }

    void executarAcao(acaoAberta.acao, acaoAberta.chave, pValores);
  }, [acaoAberta, executarAcao]);
  const [emEdicao, setEmEdicao] = useState<Record<string, unknown> | null>(null);
  const [ehNovo, setEhNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const { isMobile } = useDevice();

  // Item selecionado: é dele que o PAINEL DE DETALHE (config.detailFields) tira o texto por extenso.
  // Nenhuma consulta nova — o dado já veio na linha.
  const itemSelecionado = useMemo(() => items.find(
    (pI) => String(getFieldValue(pI, config.keyField) ?? pI.id) === linhaSelecionada) ?? null,
    [items, config.keyField, linhaSelecionada]);

  // A linha só reage ao clique quando há o que abrir por baixo dela.
  const linhaSelecionavel = Boolean(config.childGrid) || (config.detailFields?.length ?? 0) > 0 || editavel;

  const selecionarLinha = useCallback(async (pItem: DetailItem) => {
    const filha = config.childGrid;
    const temPainel = (config.detailFields?.length ?? 0) > 0;

    // Linha só é selecionável quando há algo a mostrar por baixo: a grade filha, o painel de detalhe
    // ou o formulário de edição.
    if (!filha && !temPainel && !editavel)
      return;

    const chave = String(getFieldValue(pItem, config.keyField) ?? pItem.id);

    // Clicar de novo na mesma linha fecha o que estava aberto: o gesto é um interruptor.
    if (chave === linhaSelecionada) {
      setLinhaSelecionada(null);
      setItensFilhos([]);
      setEmEdicao(null);
      return;
    }

    setLinhaSelecionada(chave);

    // Master-detail editável: carrega o item selecionado no formulário de baixo (cópia, para não
    // alterar a linha da grade enquanto se digita). Salvar grava; cancelar descarta.
    if (editavel) {
      setEmEdicao({ ...pItem });
      setEhNovo(false);
      setErroEdicao(null);
    }

    if (!filha || !parentID)
      return;

    setCarregandoFilhos(true);

    // As linhas anteriores PERMANECEM na tela durante a carga. Esvaziá-las faria a tabela sumir, o
    // modal encolher e crescer de novo a cada troca de item — o piscar que o usuário vê.
    try {
      const endpoint = filha.dataEndpoint
        .replace('{id}', parentID)
        .replace('{rowId}', chave);

      setItensFilhos(await api.get<DetailItem[]>(endpoint) ?? []);
    } catch (error) {
      console.error('Child grid load error:', error);
      setItensFilhos([]);
    } finally {
      setCarregandoFilhos(false);
    }
  }, [config.childGrid, config.detailFields, config.keyField, parentID, linhaSelecionada]);

  // Abre o formulário de baixo em branco para um item novo — nada selecionado na grade.
  const incluirNovo = useCallback(() => {
    setLinhaSelecionada(null);
    setItensFilhos([]);
    setEmEdicao({});
    setEhNovo(true);
    setErroEdicao(null);
  }, []);

  const alterarCampo = useCallback((pCampo: string, pValor: unknown, pBindings?: Record<string, unknown>) => {
    setEmEdicao((prev) => {
      const novo: Record<string, unknown> = { ...(prev ?? {}), [pCampo]: pValor };
      if (pBindings)
        for (const [chave, valor] of Object.entries(pBindings))
          novo[chave] = valor;
      return novo;
    });
  }, []);

  const cancelarEdicao = useCallback(() => {
    setEmEdicao(null);
    setEhNovo(false);
    setLinhaSelecionada(null);
    setErroEdicao(null);
  }, []);

  // Grava o item do formulário de baixo: POST cria (item novo), PUT/{itemId} edita. Sucesso ⇒ recarrega
  // a lista e fecha o formulário. Falha não é muda: a mensagem do servidor aparece ali mesmo (CE-21).
  const salvarEdicao = useCallback(async () => {
    if (!emEdicao || !parentID || !config.saveEndpoint)
      return;

    setSalvando(true);
    setErroEdicao(null);

    try {
      const base = config.saveEndpoint.replace('{id}', parentID);

      if (ehNovo) {
        await api.post(base, emEdicao);
      } else {
        const itemID = String(getFieldValue(emEdicao, config.keyField) ?? (emEdicao as DetailItem).id);
        await api.put(`${base}/${itemID}`, emEdicao);
      }

      setEmEdicao(null);
      setEhNovo(false);
      setLinhaSelecionada(null);
      onReload();
    } catch (erro) {
      setErroEdicao(erro instanceof Error ? erro.message : 'Não foi possível gravar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }, [emEdicao, ehNovo, parentID, config.saveEndpoint, config.keyField, onReload]);

  const translateTitle = useCallback((pTitle: string | undefined) => {
    return (pTitle ?? '');
  }, []);

  const formatValue = useCallback((pValue: unknown, pColumn: XDetailGridColumn): string => {
    if (pValue === null || pValue === undefined) return '';
    
    switch (pColumn.dataType) {
      case XDataType.Date:
        return formatDate(pValue);
      case XDataType.DateTime:
        return formatDateTime(pValue);
      case XDataType.Boolean:
        return pValue ? 'Sim' : 'Não';
      // Número não se lê como texto: valor monetário e decimal saem com DUAS casas, no formato do
      // locale. Sem isto, "34.23" e "1" apareciam crus, e a coluna não se lia de cima a baixo.
      case XDataType.Decimal:
        return formatDecimal(Number(pValue), 2);
      case XDataType.Currency:
        return formatCurrency(Number(pValue));
      case XDataType.Percentage:
        return formatPercentage(Number(pValue));
      case XDataType.CPF:
      case XDataType.CNPJ:
        return formatDocument(String(pValue));
      default:
        // A célula chega como TEXTO pt-BR do back (dono, 2026-08-03).
        return String(pValue);
    }
  }, []);

  // Regra única do motor: número à direita, texto à esquerda (gridAlignmentClass).
  const alignmentClass = useCallback(
    (pColumn: XDetailGridColumn): string => gridAlignmentClass(pColumn.alignment, pColumn.dataType),
    []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {(config.canAdd || editavel || acaoIncluir) && !leitura && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-light bg-muted-bg">
          <span className="text-sm text-brand-text-secondary">
            {`${items.length} item`}
          </span>
          {acaoIncluir ? (
            // INCLUIR como AÇÃO em modal (addAction): verde da paleta, como todo "Novo", com o rótulo do back.
            !incluirEscondido && (
              <button
                type="button"
                onClick={() => void abrirAcao(acaoIncluir)}
                title={acaoIncluir.title || 'Novo'}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${XBUTTON_PALETTE[XButtonColor.Create]}`}
              >
                <Plus className="w-4 h-4" />
                {acaoIncluir.title || 'Novo'}
              </button>
            )
          ) : (
          /* O MESMO botão de criar da grade de itens (dono, 2026-09-17): "Novo", verde, com o
             "+". A cor vem da paleta semântica (XButtonColor.Create), não do laranja da marca que
             estava cravado aqui — criar é criar em qualquer grade do produto, e o operador
             reconhece a ação pela cor antes de ler o rótulo. */
          <button
            type="button"
            onClick={editavel ? incluirNovo : onAdd}
            title={'Novo'}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${XBUTTON_PALETTE[XButtonColor.Create]}`}
          >
            <Plus className="w-4 h-4" />
            {'Novo'}
          </button>
          )}
        </div>
      )}

      {/* DESFECHO da última ação (o número e o protocolo da carta autorizada, por exemplo), formatado
          pelo MessageText. A recusa não vem por aqui: ela sai no diálogo global, na cor certa. */}
      {mensagemDaAcao && (
        <div className="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-border-light bg-success/10">
          <MessageText text={mensagemDaAcao} className="text-ui-sm text-brand-text-primary" />
          <button
            type="button"
            onClick={() => setMensagemDaAcao(null)}
            className="shrink-0 text-ui-xs text-brand-text-muted hover:text-brand-text-primary"
          >
            {'Fechar'}
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-brand-text-muted">
            {(config.emptyMessage ?? '') || 'Nenhum item encontrado'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted-bg sticky top-0">
              <tr>
                {config.columns.map((col) => (
                  <th
                    key={col.id}
                    className={`px-4 py-2 text-xs font-medium text-brand-text-secondary tracking-wider whitespace-nowrap ${alignmentClass(col)}`}
                    style={{ width: col.flexWidth ? undefined : `${col.width}px` }}
                  >
                    {translateTitle(col.title)}
                  </th>
                ))}
                {acoesDaLinha.length > 0 && !leitura && (
                  <th className="px-2 py-2" />
                )}
                {config.canRemove && !leitura && (
                  <th className="w-12 px-2 py-2" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {items.map((item) => {
                const chave = String(getFieldValue(item, config.keyField) ?? item.id);
                const estaSelecionada = chave === linhaSelecionada;

                return (
                <tr
                  key={item.id}
                  onClick={linhaSelecionavel ? () => void selecionarLinha(item) : undefined}
                  className={`transition-colors
                    ${linhaSelecionavel ? 'cursor-pointer' : ''}
                    ${estaSelecionada
                      ? `bg-brand-primary/20 hover:bg-brand-primary/25 font-medium
                         [&>td:first-child]:shadow-[inset_3px_0_0_0_hsl(var(--brand-primary))]`
                      : 'hover:bg-hover'}
                  `}
                >
                  {config.columns.map((col) => (
                    <td
                      key={col.id}
                      className={`px-4 py-3 text-sm text-brand-text-primary ${alignmentClass(col)}`}
                    >
                      {formatValue(getFieldValue(item, col.fieldName), col)}
                    </td>
                  ))}
                  {acoesDaLinha.length > 0 && !leitura && (
                    // BOTÕES NA LINHA: só as ações que valem para ESTA linha (visibleWhen). O clique não
                    // seleciona a linha — o gesto é a ação, não o painel de baixo.
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {acoesVisiveisNaLinha(acoesDaLinha, item).map((acao: XRowAction) => {
                          const Icone = getIconByName(acao.icon);
                          const cor = acao.color !== undefined && acao.color !== XButtonColor.Default
                            ? XBUTTON_PALETTE[acao.color] ?? XBUTTON_PALETTE[XButtonColor.Default]
                            : XBUTTON_PALETTE[XButtonColor.Default];
                          return (
                            <button
                              key={acao.id ?? acao.name}
                              type="button"
                              disabled={acaoOcupada}
                              onClick={(pEvento) => { pEvento.stopPropagation(); void abrirAcao(acao, item); }}
                              title={acao.title}
                              data-testid={`detail-action-${acao.name}`}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-ui-xs font-medium rounded-md
                                          transition-colors disabled:opacity-50 ${cor}`}
                            >
                              {Icone && <Icone className="w-3.5 h-3.5" />}
                              {acao.title}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                  {config.canRemove && !leitura && (
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 text-danger hover:text-danger/80 hover:bg-danger-bg
                                 rounded transition-colors"
                        title={config.removeLabel || 'Remover'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Estado OCIOSO do master-detail editável: há itens, mas nenhum aberto embaixo. Sem isto a aba
          terminava numa faixa escura vazia, com ar de inacabada. Aqui ela vira um convite à ação — que
          também guia o usuário (selecionar para editar, ou Novo para criar). Só quando há linhas:
          com a grade vazia, a própria mensagem de vazio já preenche o espaço. */}
      {editavel && !emEdicao && items.length > 0 && (
        <div className="border-t border-border-light px-4 py-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary/10">
            <MousePointerClick className="w-5 h-5 text-brand-primary" />
          </div>
          <p className="max-w-sm text-ui-sm text-brand-text-muted">
            Selecione um item da lista para editar, ou clique em{' '}
            <span className="font-medium text-brand-primary">Novo</span> para adicionar um.
          </p>
        </div>
      )}

      {/* PAINEL DE EDIÇÃO (master-detail editável): o formulário do item selecionado ou do novo. É o
          "grade em cima, formulário embaixo" — a lista de versões acima, o texto do prompt aqui. Só
          aparece quando o modelo declara editFields e há um item aberto (selecionado ou incluído). */}
      {editavel && emEdicao && (
        <div className="border-t border-border-light">
          <div className="px-4 py-2 flex items-center justify-between text-xs font-medium tracking-wider text-brand-primary bg-muted-bg">
            <span>{ehNovo ? 'Novo item' : translateTitle(config.editTitle)}</span>
          </div>

          <div className="px-4 py-3 max-h-[28rem] overflow-y-auto">
            {/* UMA árvore por dispositivo (2026-10-12), como no XFormView: as duas no DOM com o CSS
                escondendo uma duplicavam o id de cada campo no mesmo form. */}
            {/* Mobile: um campo por linha — meia coluna num celular fica ilegível. */}
            {isMobile && (
            <div className="flex flex-col gap-3">
              {camposEdicao.map((campo: XDataEditor) => (
                <XEditor
                  key={campo.id}
                  editor={campo}
                  value={getFieldValue(emEdicao, campo.fieldName)}
                  onChange={(valor, bindings) => alterarCampo(campo.fieldName, valor, bindings)}
                />
              ))}
            </div>
            )}

            {/* Desktop: grade de 32 colunas (a mesma do formulário) — o campo ocupa o `colSpan` que o
                back declarou (16 = metade, 32 = linha cheia), e dois campos de 16 partilham a linha. */}
            {!isMobile && (
            <div
              className="grid gap-x-4 gap-y-3"
              style={{ gridTemplateColumns: 'repeat(32, minmax(0, 1fr))' }}
            >
              {camposEdicao.map((campo: XDataEditor) => (
                <div
                  key={campo.id}
                  className="min-w-0"
                  style={{ gridColumn: `span ${campo.colSpan > 1 ? campo.colSpan : 32}` }}
                >
                  <XEditor
                    editor={campo}
                    value={getFieldValue(emEdicao, campo.fieldName)}
                    onChange={(valor, bindings) => alterarCampo(campo.fieldName, valor, bindings)}
                  />
                </div>
              ))}
            </div>
            )}

            {erroEdicao && (
              <div className="mt-3 text-ui-sm text-danger whitespace-pre-wrap">{erroEdicao}</div>
            )}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelarEdicao}
                disabled={salvando}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border
                         hover:bg-hover transition-colors disabled:opacity-50"
              >
                {'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => void salvarEdicao()}
                disabled={salvando}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white
                         bg-brand-primary hover:bg-brand-primary-dark rounded-lg transition-colors
                         disabled:opacity-50"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DE DETALHE da linha selecionada: os campos declarados pelo back, POR EXTENSO — texto
          longo quebra linha e rola, nunca é cortado em reticências. É onde se lê o motivo inteiro pelo
          qual o Fisco recusou a nota; a grade acima só cabe o resumo. Sem consulta nova: o dado já veio
          na linha (dono, 2026-07-13). Não convive com o painel de edição: um OU outro. */}
      {!editavel && itemSelecionado && (config.detailFields?.length ?? 0) > 0 && (
        <div className="border-t border-border-light">
          {config.detailTitle && (
            <div className="px-4 py-2 text-xs font-medium tracking-wider text-brand-primary bg-muted-bg">
              {translateTitle(config.detailTitle)}
            </div>
          )}

          <dl className="px-4 py-3 max-h-64 overflow-y-auto space-y-3">
            {config.detailFields!.map((campo) => (
              <div key={campo.id}>
                <dt className="text-ui-xs font-medium text-brand-text-secondary">
                  {translateTitle(campo.title)}
                </dt>
                <dd className="text-ui text-brand-text-primary whitespace-pre-wrap break-words">
                  {formatValue(getFieldValue(itemSelecionado, campo.fieldName), campo)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Grade filha da linha selecionada. */}
      {config.childGrid && linhaSelecionada && (
        <div className="border-t border-border-light">
          {config.childTitle && (
            <div className="px-4 py-2 text-xs font-medium tracking-wider text-brand-primary bg-muted-bg">
              {translateTitle(config.childTitle)}
            </div>
          )}

          {/* Durante a carga a tabela continua no lugar, sob um véu com o indicador por cima: a altura
              do modal não muda, e não há o piscar de encolher-e-crescer a cada item. */}
          <div className="relative">
            {carregandoFilhos && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-surface/60">
                <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
              </div>
            )}

            {itensFilhos.length === 0 && !carregandoFilhos ? (
            <div className="py-8 text-center text-sm text-brand-text-muted">
              {(config.childGrid.emptyMessage ?? '') || 'Nenhum item encontrado'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted-bg">
                <tr>
                  {config.childGrid.columns.map((col) => (
                    <th
                      key={col.id}
                      className={`px-4 py-2 text-xs font-medium text-brand-text-secondary tracking-wider whitespace-nowrap ${alignmentClass(col)}`}
                      style={{ width: col.flexWidth ? undefined : `${col.width}px` }}
                    >
                      {translateTitle(col.title)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {itensFilhos.map((filho, indice) => (
                  <tr key={`${filho.id ?? indice}`} className="hover:bg-hover transition-colors">
                    {config.childGrid!.columns.map((col) => (
                      <td
                        key={col.id}
                        className={`px-4 py-2 text-sm text-brand-text-primary ${alignmentClass(col)}`}
                      >
                        {formatValue(getFieldValue(filho, col.fieldName), col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>
      )}

      {/* Modal de COLETA da ação (incluir, alterar, visualizar). Contido no quadro de quem chamou — o
          card do formulário, que é o ancestral posicionado — como todo diálogo de App (variante inline). */}
      {acaoAberta && (
        <XRowActionFormModal
          action={acaoAberta.acao}
          rowID={acaoAberta.chave}
          parentID={parentID}
          rowData={acaoAberta.linha}
          initialValues={acaoAberta.iniciais}
          serverErrors={errosDoServidor}
          isBusy={acaoOcupada}
          onSubmit={submeterAcao}
          onCancel={() => { setAcaoAberta(null); setErrosDoServidor(undefined); }}
        />
      )}

      {acaoConfirmando && (
        <ConfirmModal
          isOpen
          message={acaoConfirmando.acao.confirmMessage || acaoConfirmando.acao.title}
          confirmLabel={acaoConfirmando.acao.title}
          confirmColor={acaoConfirmando.acao.color}
          onConfirm={() => {
            const pendente = acaoConfirmando;
            setAcaoConfirmando(null);
            void executarAcao(pendente.acao, pendente.chave, pendente.corpo);
          }}
          onCancel={() => setAcaoConfirmando(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Add Item Modal Component
// ============================================================================

interface AddItemModalProps {
  isOpen: boolean;
  title: string;
  items: LookupItem[];
  isLoading: boolean;
  multiSelect?: boolean;
  onConfirm: (pItems: LookupItem[]) => void;
  onCancel: () => void;
}

function AddItemModal({ 
  isOpen, 
  title, 
  items, 
  isLoading,
  multiSelect = true,
  onConfirm, 
  onCancel 
}: AddItemModalProps): JSX.Element | null {
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const searchLower = search.toLowerCase();
    return items.filter((item) => 
      item.name.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedItems(new Set());
    }
  }, [isOpen]);

  const handleToggleItem = useCallback((pItemID: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (multiSelect) {
        if (next.has(pItemID))
          next.delete(pItemID);
        else
          next.add(pItemID);
      } else {
        // Single select - clear and set
        next.clear();
        next.add(pItemID);
      }
      return next;
    });
  }, [multiSelect]);

  const handleConfirm = useCallback(() => {
    const selected = items.filter((item) => selectedItems.has(item.id));
    if (selected.length > 0)
      onConfirm(selected);
  }, [items, selectedItems, onConfirm]);

  if (!isOpen) return null;

  const hasSelection = selectedItems.size > 0;

  return (
    <XModalShell
      variant="inline"
      size="sm"
      title={title}
      closeLabel={'Fechar'}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-ui font-medium text-brand-text-primary
                     bg-brand-surface border border-border rounded-lg hover:bg-hover
                     transition-colors min-h-touch sm:min-h-[36px]"
          >
            {'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasSelection}
            className={`
              flex-1 px-4 py-2 text-ui font-medium rounded-lg transition-colors min-h-touch sm:min-h-[36px]
              ${hasSelection
                ? 'text-white bg-brand-primary hover:bg-brand-primary-dark'
                : 'text-brand-text-muted bg-brand-surface border border-border cursor-not-allowed'
              }
            `}
          >
            {'Confirmar'}
          </button>
        </>
      }
    >
      {/* Search */}
      <div className="px-4 py-3 border-b border-border-light sticky top-0 bg-brand-surface">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={'Buscar...'}
          className="w-full px-3 min-h-editor text-ui border border-border rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
          autoFocus
        />
      </div>

      {/* List */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-8 text-center text-brand-text-muted">
            {'Nenhum item disponível'}
          </div>
        ) : (
          <div>
            {filteredItems.map((item, index) => {
              const isSelected = selectedItems.has(item.id);
              const isEven = index % 2 === 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleItem(item.id)}
                  className={`
                    w-full px-4 text-left text-ui transition-colors
                    flex items-center gap-3 min-h-touch
                    ${isSelected
                      ? 'bg-brand-primary/10'
                      : isEven
                        ? 'bg-brand-surface hover:bg-hover'
                        : 'bg-muted-bg hover:bg-hover'
                    }
                  `}
                >
                  {/* Checkbox or Radio */}
                  <div className={`
                    flex-shrink-0 w-5 h-5 border-2 flex items-center justify-center
                    transition-colors
                    ${multiSelect ? 'rounded' : 'rounded-full'}
                    ${isSelected
                      ? 'border-brand-primary bg-brand-primary'
                      : 'border-border bg-brand-surface'
                    }
                  `}>
                    {isSelected && (
                      multiSelect ? (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      )
                    )}
                  </div>
                  <span className="flex-1">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </XModalShell>
  );
}

// ============================================================================
// Confirm Remove Modal
// ============================================================================

interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  /** Rótulo do botão de confirmação; ausente ⇒ "Remover". Ex.: "Invalidar" quando a ação encerra em vez de apagar. */
  confirmLabel?: string;
  /**
   * Papel de cor do botão de confirmar (paleta semântica). Ausente ⇒ o vermelho de remover. Uma ação de
   * linha que confirma algo POSITIVO (autorizar) não pode aparecer pintada de exclusão.
   */
  confirmColor?: XButtonColor;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ isOpen, message, confirmLabel, confirmColor, onConfirm, onCancel }: ConfirmModalProps): JSX.Element | null {

  if (!isOpen) return null;

  return (
    <XModalShell
      variant="inline"
      size="sm"
      title={'Confirmação'}
      closeLabel={'Cancelar'}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-ui font-medium text-brand-text-primary
                     bg-brand-surface border border-border rounded-lg hover:bg-hover transition-colors min-h-touch sm:min-h-[36px]"
          >
            {'Cancelar'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-ui font-medium rounded-lg transition-colors min-h-touch sm:min-h-[36px] ${
              confirmColor !== undefined && confirmColor !== XButtonColor.Default
                ? XBUTTON_PALETTE[confirmColor] ?? XBUTTON_PALETTE[XButtonColor.Danger]
                : 'text-white bg-danger hover:bg-danger/80'}`}
          >
            {confirmLabel || 'Remover'}
          </button>
        </>
      }
    >
      <p className="px-4 sm:px-6 py-4 text-ui text-brand-text-secondary">{message}</p>
    </XModalShell>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function XTabbedFormModal({
  formView,
  mode,
  data: initialData,
  isOpen,
  isLoading,
  isSaving,
  onSave,
  onCancel,
  parentID,
  onReloadForm,
  serverErrors,
}: XTabbedFormModalProps): JSX.Element | null {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------


  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const modalID = 'tabbed-form-modal';
  const [activeTabIndex, setActiveTabIndex] = useState(formView.defaultTabIndex || 0);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setIsDirty] = useState(false);
  const [modalZIndex, setModalZIndex] = useState(0);

  // Detail grid state
  const [detailItems, setDetailItems] = useState<Record<string, DetailItem[]>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeDetailGrid, setActiveDetailGrid] = useState<XDetailGrid | null>(null);
  const [availableItems, setAvailableItems] = useState<LookupItem[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ gridID: string; itemID: string } | null>(null);

  // Todos os campos das abas de formulario, achatados: e sobre eles que as regras de valor correm.
  const camposDoFormulario = useMemo(
    () => formView.tabs.flatMap((pAba) => (pAba.sections ?? []).flatMap((pSecao) => pSecao.fields)),
    [formView.tabs]
  );

  // ---------------------------------------------------------------------------
  // Sync initial data
  // ---------------------------------------------------------------------------

  // Cópia DURANTE A RENDERIZAÇÃO, pelo mesmo motivo do XFormModal (ver o comentário longo lá): num
  // efeito, existe um render em que os campos já estão na tela e o estado interno ainda está vazio, e
  // salvar nesse instante manda um corpo sem os campos carregados — o servidor lê ausência como
  // valor, apaga texto e desliga booleano, sem erro nenhum. Com abas o estrago é maior: some o que
  // está nas abas que o usuário nem abriu.
  const [dadosCarregados, setDadosCarregados] = useState<Record<string, unknown> | null>(null);

  if (isOpen && initialData !== dadosCarregados) {
    setDadosCarregados(initialData);

    // Abre ja com o rodape fechado (subtotal/valor final), inclusive quando os itens vem carregados
    // — o documento com abas fecha igual ao sem abas (dono, 2026-08-02).
    const inicial = { ...initialData };
    if (formView.pricing)
      aplicarTotaisAoVivo(inicial, formView.pricing);
    // Valores dirigidos por regra (CE-19): na ABERTURA so preenchem campo VAZIO — o registro ja
    // gravado permanece como esta.
    aplicarValoresDirigidos(null, inicial, camposDoFormulario);
    setFormData(inicial);
    setErrors({});
    setIsDirty(false);
    setActiveTabIndex(formView.defaultTabIndex || 0);

    // Initialize detail items from initial data if present
    const newDetailItems: Record<string, DetailItem[]> = {};
    for (const tab of formView.tabs) {
      if (tab.hasDetailGrid && tab.detailGrid) {
        const key = tab.detailGrid.id;
        const items = (initialData[key] as DetailItem[]) || [];
        newDetailItems[key] = items;
      }
    }
    setDetailItems(newDetailItems);
  }

  if (!isOpen && dadosCarregados !== null)
    setDadosCarregados(null);

  useEffect(() => {
    if (isOpen)
      setModalZIndex(ZIndexManager.next());
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Load detail data when switching to detail tab
  // ---------------------------------------------------------------------------

  const loadDetailData = useCallback(async (pGrid: XDetailGrid) => {
    if (!parentID || mode === XApplicationMode.Create) return;

    const key = pGrid.id;
    if (detailLoading[key]) return;

    setDetailLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const endpoint = pGrid.dataEndpoint.replace('{id}', parentID);
      const items = await api.get<DetailItem[]>(endpoint);
      setDetailItems((prev) => ({ ...prev, [key]: items }));
    } catch (error) {
      console.error('Error loading detail data:', error);
    } finally {
      setDetailLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, [parentID, mode, detailLoading]);

  // ---------------------------------------------------------------------------
  // Reload detail data when language changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen || !parentID || mode === XApplicationMode.Create) return;

    // Reload all detail grids when language changes
    for (const tab of formView.tabs) {
      if (tab.hasDetailGrid && tab.detailGrid) {
        const grid = tab.detailGrid;
        const key = grid.id;
        
        // Force reload by clearing loading state first
        setDetailLoading((prev) => ({ ...prev, [key]: true }));
        
        const endpoint = grid.dataEndpoint.replace('{id}', parentID);
        api.get<DetailItem[]>(endpoint)
          .then((items) => {
            setDetailItems((prev) => ({ ...prev, [key]: items }));
          })
          .catch((error) => {
            console.error('Error reloading detail data on language change:', error);
          })
          .finally(() => {
            setDetailLoading((prev) => ({ ...prev, [key]: false }));
          });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, ['pt-BR']);

  // ---------------------------------------------------------------------------
  // Add item handlers
  // ---------------------------------------------------------------------------

  const handleOpenAddModal = useCallback(async (pGrid: XDetailGrid) => {
    setActiveDetailGrid(pGrid);
    setShowAddModal(true);
    setLoadingAvailable(true);

    try {
      const endpoint = pGrid.lookupEndpoint.replace('{id}', parentID || '');
      const items = await api.get<LookupItem[]>(endpoint);
      setAvailableItems(items);
    } catch (error) {
      console.error('Error loading available items:', error);
      setAvailableItems([]);
    } finally {
      setLoadingAvailable(false);
    }
  }, [parentID]);

  const handleConfirmItems = useCallback(async (pItems: LookupItem[]) => {
    if (!activeDetailGrid || !parentID || pItems.length === 0) return;

    try {
      const key = activeDetailGrid.id;
      const addedItems: DetailItem[] = [];
      const addedIDs = new Set<string>();

      for (const item of pItems) {
        const endpoint = activeDetailGrid.addEndpoint.replace('{id}', parentID);
        const newItem = await api.post<DetailItem>(endpoint, { profileID: item.id });
        addedItems.push(newItem);
        addedIDs.add(item.id);
      }
      
      setDetailItems((prev) => ({
        ...prev,
        [key]: [...(prev[key] || []), ...addedItems]
      }));
      
      // Remove from available
      setAvailableItems((prev) => prev.filter((i) => !addedIDs.has(i.id)));
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding items:', error);
    }
  }, [activeDetailGrid, parentID]);

  // ---------------------------------------------------------------------------
  // Remove item handlers
  // ---------------------------------------------------------------------------

  const handleRemoveClick = useCallback((pGridID: string, pItemID: string) => {
    setItemToRemove({ gridID: pGridID, itemID: pItemID });
    setShowConfirmRemove(true);
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!itemToRemove || !parentID) return;

    const { gridID, itemID } = itemToRemove;
    const tab = formView.tabs.find((t) => t.detailGrid?.id === gridID);
    if (!tab?.detailGrid) return;

    try {
      const endpoint = tab.detailGrid.removeEndpoint
        .replace('{id}', parentID)
        .replace('{itemId}', itemID);
      await api.delete(endpoint);

      setDetailItems((prev) => ({
        ...prev,
        [gridID]: (prev[gridID] || []).filter((i) => i.id !== itemID)
      }));
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setShowConfirmRemove(false);
      setItemToRemove(null);
    }
  }, [itemToRemove, parentID, formView.tabs]);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  // Largura que a fileira de abas pede, medida no navegador (FE-10). Zero até a primeira medição — e aí
  // a fórmula abaixo recai exatamente no comportamento anterior.
  const [larguraDasAbas, setLarguraDasAbas] = useState(0);

  // Largura do card (FE-3/FE-9/FE-10) e altura do corpo (FE-4) — mesma mecânica do XFormModal, mesma
  // fonte de medidas (formScale): dois cálculos separados divergiriam.
  //
  // Três forças, nesta ordem:
  //   1. o PERCENTUAL que o back pediu (FE-3);
  //   2. a FILEIRA DE ABAS, que alarga o card até o teto de 90% (FE-5) — passou disso, as abas rolam e
  //      ganham os botões de navegação, em vez de sumir na borda;
  //   3. o PISO DOS EDITORES (FE-9), a única coisa que pode ultrapassar o teto: campo que não cabe é
  //      defeito, e aí quem rola é a área do App.
  const larguraDoCard = useMemo(() => {
    const percentual = Math.min(formView.modalWidth || MODAL_MAX_PERCENT, MODAL_MAX_PERCENT);
    const comAbas = `min(max(${percentual}%, ${Math.ceil(larguraDasAbas)}px), ${MODAL_MAX_PERCENT}%)`;

    return `max(${comAbas}, ${pisoDoFormularioPx(formView)}px)`;
  }, [formView, larguraDasAbas]);

  const alturaDoCorpo = useMemo(() => alturaDoCorpoPx(formView), [formView]);

  // ── CAMPO ELÁSTICO EXIGE ALTURA DEFINIDA NO CARD ─────────────────────────────────────────────
  //
  // A grade de itens (FE-11) só rola nas linhas se houver uma altura de onde ceder — e essa altura
  // NÃO pode vir de percentual encadeado (`height:100%` sobre `1fr` degenera para `auto`, a grade
  // cresce com as linhas e o excedente é cortado no rodapé). Vem de uma altura REAL no topo da
  // cascata: o card assume `h-[90%]` (o próprio teto FE-5) e, a partir dele, header/rodapé são
  // `shrink-0` e o CORPO é `flex-1` — altura resolvida pela flexbox, que desce como altura real por
  // toda a cadeia (corpo → wrapper → XFormView → seção → item flex → grade `flex-1`).
  //
  // Basta UMA aba ter grade para o card assumir a altura plena: assim a moldura é a MESMA em todas
  // as abas (não pula ao trocar), e a aba só de campos apenas tem espaço livre abaixo — preço barato
  // ante o alternativo, que era a grade não rolar. Formulário SEM grade alguma segue com altura pelo
  // conteúdo, previsível porque linha de campo não cresce.
  //
  // `ModalRows`/`MaxHeight` (altura em pixels declarada pelo back) NÃO substitui a altura plena quando
  // há campo elástico (dono, 2026-10-12). A altura literal valia enquanto cabia no card; numa janela
  // em que `linhas × 60px` + cabeçalho + rodapé passa do teto de 90%, o card (só `max-h`) comprime o
  // corpo, a altura do corpo deixa de ser DEFINIDA para a cascata de `height:100%` abaixo dele, a
  // grade cresce com as linhas e o excedente é cortado no rodapé — sem barra de rolagem, porque o
  // corte vem do `overflow-hidden` do corpo, não de um teto da grade. Foi o que se viu na aba
  // "Cruzamentos" da Regra de ICMS (11 linhas declaradas, 15 itens). Com campo elástico o card tem
  // SEMPRE altura real (`h-[90%]`), e é a flexbox que distribui; a altura literal fica para o
  // formulário sem grade, onde cada linha tem altura própria e o número de linhas é a altura.
  //
  // Formulário feito SÓ de grades de detalhe (dono, 2026-10-22 — as cartas de correção) também tem
  // altura plena: não há linha de campo que dê a altura, e pelo conteúdo o card encolhia até as poucas
  // linhas da grade — e o diálogo de coleta, CONTIDO nele, nascia espremido e com duas rolagens.
  const alturaPlena = useMemo(() => temCampoElastico(formView) || soDeGrades(formView), [formView]);

  // ── A ALTURA NÃO ENCOLHE AO TROCAR DE ABA ────────────────────────────────────────────────────
  //
  // Cada aba tem o seu conteúdo, e alturas diferentes faziam o card pular: sair de um resumo com
  // dezesseis campos para uma aba de um campo só encolhia o modal à metade, o rodapé subia e o
  // "Fechar" mudava de lugar debaixo do cursor. Trocar de aba é olhar OUTRA FACE da mesma coisa —
  // a moldura não tem por que mudar de tamanho.
  //
  // Guarda-se a MAIOR altura que o corpo já teve nesta abertura e ela vira piso. E o que se mede é
  // o `clientHeight` — o que EFETIVAMENTE coube na tela —, nunca o `scrollHeight`: um piso maior que
  // o card empurraria a moldura para fora e comeria a barra de abas. Como o piso só repete um
  // tamanho que já existiu ali, ele não pode estourar o card. A medida também converge: aplicado o
  // piso, o `clientHeight` das abas menores passa a ser o próprio piso, e o máximo para de crescer.
  const corpoRef = useRef<HTMLDivElement>(null);
  // Moldura comum a todo diálogo (dono, 2026-10-25): borda, brilho, ARRASTAR pelo cabeçalho e
  // redimensionar pelas bordas. Posição e tamanho ficam no PERFIL do usuário, por formulário, e voltam na
  // próxima abertura. No celular o modal é cheio (FE-0): nada se arrasta nem se restaura.
  const { isMobile: ehCelular } = useDevice();
  const [quadroSalvo, salvarQuadro] = usePreferenciaDoUsuario<QuadroDeModal | null>(
    chaveDoQuadroDoFormulario(formView.name || 'formulario-em-abas'), null);
  const moldura = useMolduraDeModal({
    arrastavel: !ehCelular, redimensionavel: !ehCelular, aberto: isOpen,
    quadroSalvo: ehCelular ? null : quadroSalvo, aoMudarQuadro: salvarQuadro,
  });
  const [pisoDoCorpo, setPisoDoCorpo] = useState(0);

  useLayoutEffect(() => {
    const medida = corpoRef.current?.clientHeight ?? 0;
    if (medida > 0)
      setPisoDoCorpo(pAtual => (medida > pAtual ? medida : pAtual));
  }, [activeTabIndex, isLoading, formData]);

  // Fechou, esquece: o próximo registro pode ter outro conteúdo (um formulário de criação, uma aba
  // condicional a menos), e herdar a altura do anterior deixaria um vazio sem explicação.
  useEffect(() => {
    if (!isOpen)
      setPisoDoCorpo(0);
  }, [isOpen]);

  const title = useMemo(() => {
    switch (mode) {
      case XApplicationMode.Create:
        return (formView.createTitle ?? '') || 'Novo Registro';
      case XApplicationMode.Edit:
        return (formView.editTitle ?? '') || 'Editar Registro';
      case XApplicationMode.Detail:
        return (formView.viewTitle ?? '') || 'Visualizar Registro';
      default:
        return (formView.title ?? '');
    }
  }, [mode, formView]);

  const isReadOnly = mode === XApplicationMode.Detail;
  const showSaveButton = mode === XApplicationMode.Create || mode === XApplicationMode.Edit;

  // Abas efetivamente visíveis: filtra as condicionais pela seleção corrente do formulário (CE-19).
  // Duas formas convivem e valem JUNTAS: visibleWhenField (legado, "tem valor") e visibleWhen (lista
  // de regras, conjunção). Recalcula a cada mudança de dado — trocar o campo condicionante mostra/esconde.
  const visibleTabs = useMemo(
    () => formView.tabs.filter((tab) =>
      (!tab.visibleWhenField || isTruthy(getFieldValue(formData, tab.visibleWhenField)))
      && isVisible(tab.visibleWhen, formData)),
    [formView.tabs, formData]);

  const activeTab = visibleTabs[activeTabIndex];

  // Aba de grade mestre-detalhe se GRAVA sozinha (Novo/Salvar/Excluir próprios). O rodapé do modal
  // — Cancelar/Salvar do formulário — não age sobre ela: mostrá-lo ali duplicaria os botões do painel
  // de edição e ofereceria um "Salvar" que nada faz. Nessa aba o rodapé some; fechar é pelo "X" do topo.
  const rodapeVisivel = !activeTab?.hasDetailGrid;

  // A ABA ATIVA tem campo elástico? Então ela CONTÉM, não rola: a grade é que cede e rola nas suas
  // LINHAS, com cabeçalho e botão fixos (dono, 2026-08-28). Com `overflow-y-auto`, o transbordo era
  // resolvido ROLANDO, antes de a cascata do flex apertar a grade — e ia embora justamente o
  // cabeçalho das colunas, que precisa ficar à vista. Aba só de campos segue rolando, se precisar.
  //
  // São DOIS elos, e conter num só não adianta: o CORPO do modal e o wrapper da aba. Corrigido só o
  // de dentro, o de fora continuava rolando — é ancestral, resolve o transbordo primeiro, e o
  // sintoma permanecia idêntico (a barra na borda do card, o cabeçalho subindo com as linhas).
  const abaContem = useMemo(
    () => (activeTab?.sections ?? []).some((pS) => pS.fields.some(ehCampoElastico)),
    [activeTab]);

  // ERROS DO SERVIDOR marcam os campos (dono, 2026-10-12). Entram no mesmo estado da validação local,
  // então o editor fica vermelho com a frase embaixo e a marca sai quando o campo muda. Se a aba ativa
  // não tem nenhum dos campos acusados, abre a primeira que tem — o erro escondido numa aba fechada
  // seria, para quem olha, um formulário sem erro nenhum.
  useEffect(() => {
    if (!serverErrors || Object.keys(serverErrors).length === 0)
      return;
    setErrors((prev) => ({ ...prev, ...serverErrors }));
    const campos = new Set(Object.keys(serverErrors));
    const temCampo = (pAba: { sections: { fields: { editor: { fieldName: string } }[] }[] }): boolean =>
      pAba.sections.some((pS) => pS.fields.some((pF) => campos.has(pF.editor.fieldName)));
    const ativa = visibleTabs[activeTabIndex];
    if (ativa && temCampo(ativa))
      return;
    const indice = visibleTabs.findIndex(temCampo);
    if (indice >= 0)
      setActiveTabIndex(indice);
  // Só quando os erros chegam: a aba que o operador escolher depois é dele.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverErrors]);

  // Se a aba ativa deixou de existir (o usuário desmarcou o que a tornava visível), volta à primeira.
  useEffect(() => {
    if (activeTabIndex >= visibleTabs.length && visibleTabs.length > 0)
      setActiveTabIndex(0);
  }, [visibleTabs.length, activeTabIndex]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleFieldChange = useCallback((
    pFieldName: string,
    pValue: unknown,
    pBindings?: Record<string, unknown>
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [pFieldName]: pValue };
      if (pBindings) {
        for (const [key, val] of Object.entries(pBindings))
          updated[key] = val;
      }

      // Fechamento ao vivo do rodape (subtotal/valor final), quando o formulario o declara (CE-19).
      if (formView.pricing)
        aplicarTotaisAoVivo(updated, formView.pricing);

      // Campo que o modelo preenche ao ENTRAR numa condicao: a borda e medida contra `prev`, e por
      // isso a escolha do usuario sobrevive enquanto a condicao continuar valendo.
      aplicarValoresDirigidos(prev, updated, camposDoFormulario);

      return updated;
    });
    setIsDirty(true);
    if (errors[pFieldName])
      setErrors((prev) => ({ ...prev, [pFieldName]: '' }));
  }, [errors, camposDoFormulario, formView.pricing]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Only validate form tabs (not detail grid tabs)
    for (const tab of formView.tabs) {
      if (tab.hasDetailGrid) continue;
      
      for (const section of tab.sections) {
        for (const field of section.fields) {
          if (field.editor.editor.isRequired) {
            const value = getFieldValue(formData, field.editor.fieldName);
            if (value === undefined || value === null || value === '') {
              newErrors[field.editor.fieldName] = `${field.editor.title} é obrigatório`;
              isValid = false;
            }
          }
        }
      }
    }

    // O PREÇO DO ITEM fora da regra (igual ou maior que o unitário) não grava: o desconto sairia de um preço que a
    // regra recusa. A frase nomeia todos os itens de uma vez, no campo da grade.
    const camposDasAbas = formView.tabs
      .filter((pAba) => !pAba.hasDetailGrid)
      .flatMap((pAba) => pAba.sections.flatMap((pS) => pS.fields));
    const dosPrecos = errosDoPrecoDoItem(camposDasAbas, formData);
    if (Object.keys(dosPrecos).length > 0) {
      Object.assign(newErrors, dosPrecos);
      isValid = false;
    }

    setErrors(newErrors);

    // Erro em aba fechada é, para quem olha, formulário sem erro: abre a primeira aba com campo recusado, a menos que
    // a ativa já tenha um — a mesma regra dos erros do servidor.
    if (!isValid) {
      const recusados = new Set(Object.keys(newErrors));
      const temCampo = (pAba: XFormTab): boolean =>
        pAba.sections.some((pS) => pS.fields.some((pF) => recusados.has(pF.editor.fieldName)));
      const ativa = visibleTabs[activeTabIndex];
      if (!(ativa && temCampo(ativa))) {
        const indice = visibleTabs.findIndex(temCampo);
        if (indice >= 0)
          setActiveTabIndex(indice);
      }
    }

    return isValid;
  }, [formView.tabs, formData, visibleTabs, activeTabIndex]);

  const handleSave = useCallback(() => {
    // Carregando ⇒ não há o que salvar. Ver XFormModal: gravar antes de o registro chegar envia um
    // corpo sem os campos que o usuário não viu, e ausência vira valor no servidor.
    if (isLoading)
      return;

    if (!validateForm()) return;
    onSave(formData);
  }, [isLoading, formData, onSave, validateForm]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleTabClick = useCallback((pIndex: number) => {
    setActiveTabIndex(pIndex);

    // Load detail data if switching to a detail grid tab
    const tab = visibleTabs[pIndex];
    if (tab?.hasDetailGrid && tab.detailGrid && mode !== XApplicationMode.Create) {
      const key = tab.detailGrid.id;
      if (!detailItems[key] || detailItems[key].length === 0) {
        loadDetailData(tab.detailGrid);
      }
    }
  }, [visibleTabs, mode, detailItems, loadDetailData]);

  // ESC NÃO FECHA O MODAL (dono, 2026-10-17): um formulário aberto pela barra de botões ou pela grade
  // só sai por Cancelar/Fechar — o Esc era um toque fora de hora que descartava o que estava sendo
  // digitado (um picker ou uma lista aberta por cima também o recebem). Só o Ctrl+S fica.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (showSaveButton && !isSaving && !isLoading)
        handleSave();
    }
  }, [handleSave, showSaveButton, isSaving, isLoading]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  const confirmMessage = activeDetailGrid?.removeConfirmMessage || 'Tem certeza que deseja remover este item?';
  const confirmLabel = activeDetailGrid?.removeLabel || '';

  return (
    <FormBusyProvider emInclusao={mode === XApplicationMode.Create}>
    <FormValuesProvider valores={formData}>
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: modalZIndex }}
      onKeyDown={handleKeyDown}
      data-tour="tabbed-form-modal"
      data-modal-id={modalID}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 sm:backdrop-blur-sm animate-in fade-in duration-200"
        role="presentation"
      />

      {/* Véu de "ocupado": cobre o formulário enquanto SALVA (a gravação pode demorar — ela toca
          várias tabelas) e enquanto um editor tem trabalho em curso (a consulta do documento à
          Receita, que vai reescrever vários campos). */}
      <XFormBusyVeil isSaving={isSaving} />

      {/* Card centrado, de largura DETERMINADA (FE-1/FE-3): o percentual declarado pelo back sobre a
          área do App, elevado pelo PISO das larguras mínimas dos editores (FE-9) — e é só o piso que
          pode passar do teto de 90%, caso em que a área do App rola. O conteúdo nunca estica o card:
          texto longo trunca dentro do campo (FE-6). No celular, modal cheio (FE-0). */}
      <div
        ref={moldura.ref}
        className={`
          x-moldura-modal relative w-full sm:w-[var(--x-modal-width)]
          flex flex-col bg-brand-surface
          animate-in fade-in duration-200 transition-none will-change-transform
          rounded-2xl
          max-h-[90%] ${alturaPlena ? 'h-[90%]' : ''}
        `}
        style={{
          '--x-modal-width': larguraDoCard,
        } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tabbed-form-modal-title"
      >
        {moldura.alcasDeRedimensionar}
        {/* Header. `shrink-0`: num flex column de altura limitada, o corpo (com altura mínima própria)
            comprimiria o título e a barra de abas até engoli-los — quem cede espaço é o CONTEÚDO, que
            rola, nunca a moldura. */}
        <div
          className={`shrink-0 flex items-center justify-between px-4 sm:px-6 py-2 sm:py-2.5 border-b border-border-light bg-brand-surface rounded-t-[14px] z-10 ${
            ehCelular ? '' : 'cursor-move select-none touch-none'}`}
          data-testid="form-alca-arrasto"
          {...moldura.alca}
        >
          <h2
            id="tabbed-form-modal-title"
            className="text-base sm:text-lg font-semibold text-brand-text-primary whitespace-nowrap pr-2"
          >
            {title}
          </h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <XHint label={'Fechar'} shortcut="Esc" placement="left">
              <button
                type="button"
                onClick={handleCancel}
                aria-label={'Fechar'}
                className="p-2 rounded-lg hover:bg-hover transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <LogOut className="w-5 h-5 text-brand-text-muted" />
              </button>
            </XHint>
          </div>
        </div>

        {/* Tab Headers */}
        {formView.showTabs && visibleTabs.length > 1 && (
          <TabHeader
            tabs={visibleTabs}
            activeIndex={activeTabIndex}
            onTabClick={handleTabClick}
            onLarguraNecessaria={setLarguraDasAbas}
          />
        )}

        {/* Conteúdo: é ELE que rola e é ele que cede. A altura desejada pelo modelo (linhas ou pixels)
            entra como ALTURA-ALVO, não como piso: um piso maior que o card empurraria a moldura para
            fora e comeria a barra de abas — o defeito que se via com aba de conteúdo alto. */}
        <div
          ref={corpoRef}
          data-corpo-do-modal
          className={`flex-1 min-h-0 ${abaContem ? 'overflow-y-hidden' : 'overflow-y-auto'} ${rodapeVisivel ? '' : 'rounded-b-[14px]'}`}
          style={{
            // Com altura plena a flexbox do card é quem mede o corpo; a altura literal só vale sem
            // campo elástico (ver `alturaPlena`).
            ...(alturaDoCorpo > 0 && !alturaPlena ? { height: `${alturaDoCorpo}px` } : {}),
            ...(pisoDoCorpo > 0 ? { minHeight: `${pisoDoCorpo}px` } : {}),
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : activeTab?.customComponentName === 'PermissionEditor' ? (
            <div className="h-full overflow-auto">
              <XPermissionEditor
                dataEndpoint={activeTab.dataEndpoint || ''}
                formData={formData}
                onFormDataChange={handleFieldChange}
                isReadOnly={isReadOnly}
                mode={mode}
              />
            </div>
          ) : activeTab?.customComponentName && XFormTabComponentRegistry.has(activeTab.customComponentName) ? (
            <div className="h-full overflow-auto">
              {(() => {
                const Comp = XFormTabComponentRegistry.resolve(activeTab.customComponentName!)!;
                return (
                  <Comp
                    formData={formData}
                    onFormDataChange={handleFieldChange}
                    isReadOnly={isReadOnly}
                    mode={mode}
                    tab={activeTab}
                    onReloadForm={onReloadForm}
                  />
                );
              })()}
            </div>
          ) : activeTab?.hasDetailGrid && activeTab.detailGrid ? (
            <div className="h-full overflow-auto">
              <DetailGrid
                parentID={parentID}
                config={activeTab.detailGrid}
                items={detailItems[activeTab.detailGrid.id] || []}
                isLoading={detailLoading[activeTab.detailGrid.id] || false}
                isReadOnly={isReadOnly || mode === XApplicationMode.Create}
                onAdd={() => handleOpenAddModal(activeTab.detailGrid!)}
                onRemove={(id) => handleRemoveClick(activeTab.detailGrid!.id, id)}
                onReload={() => void loadDetailData(activeTab.detailGrid!)}
              />
            </div>
          ) : activeTab ? (
            <div className={`h-full overflow-x-hidden ${abaContem ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
              <XFormView
                formView={{ ...formView, sections: activeTab.sections }}
                data={formData}
                originalData={initialData}
                onChange={handleFieldChange}
                errors={errors}
                isReadOnly={isReadOnly}
              />
            </div>
          ) : null}
        </div>

        {/* Footer - Sticky at bottom. Só quando a aba tem algo que o formulário grava: a aba de grade
            mestre-detalhe se salva sozinha e dispensa este rodapé (senão os botões duplicariam). */}
        {rodapeVisivel && (
        <div className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5 border-t border-border-light bg-muted-bg rounded-b-[14px]">
          {/* Em leitura o botão é FECHAR: mesma cor e mesmo ícone do Fechar da App. Em edição é
              CANCELAR — ação neutra, que desfaz sem sair. Rótulos distintos, tratamentos distintos.
              O hint diz o que se perde: cancelar descarta alterações, e isso merece tom de aviso. */}
          <XHint
            label={isReadOnly ? 'Fechar' : 'Cancelar'}
            body={isReadOnly ? 'Encerra a consulta e retorna à listagem. Nada é alterado.' : 'Descarta as alterações não salvas e retorna à listagem.'}
            tone={isReadOnly ? 'info' : 'warning'}
            shortcut="Esc"
          >
          <button
            type="button"
            onClick={handleCancel}
            className={`
              inline-flex items-center justify-center gap-2
              px-4 py-3 sm:py-2 text-ui font-medium rounded-lg
              transition-colors min-h-[44px] sm:min-h-[36px]
              ${isReadOnly
                ? CLOSE_BUTTON_STYLE
                : 'text-brand-text-primary bg-brand-background hover:bg-hover border border-border'}
            `}
          >
            {isReadOnly && <LogOut className="w-4 h-4" />}
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </button>
          </XHint>

          {showSaveButton && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              // MESMO testid do XFormModal, de propósito: assim o teste e2e não precisa saber se a
              // App declarou formulário simples ou em abas — só que está salvando um formulário.
              data-testid="form-save"
              className="
                px-4 py-3 sm:py-2 text-ui font-medium rounded-lg
                text-white bg-brand-primary hover:bg-brand-primary-dark
                transition-colors flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
                min-h-[44px] sm:min-h-[36px]
              "
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {'Salvando...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {'Salvar'}
                </>
              )}
            </button>
          )}
        </div>
        )}
      </div>

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={showAddModal}
        title={'Selecionar Perfil'}
        items={availableItems}
        isLoading={loadingAvailable}
        multiSelect={true}
        onConfirm={handleConfirmItems}
        onCancel={() => setShowAddModal(false)}
      />

      {/* Confirm Remove Modal */}
      <ConfirmModal
        isOpen={showConfirmRemove}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        onConfirm={handleConfirmRemove}
        onCancel={() => {
          setShowConfirmRemove(false);
          setItemToRemove(null);
        }}
      />
    </div>
    </FormValuesProvider>
    </FormBusyProvider>
  );
}

