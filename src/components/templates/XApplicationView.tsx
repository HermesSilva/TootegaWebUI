/**
 * XApplicationView - Container Principal de Aplicação
 * 
 * Orquestra todos os componentes de uma aplicação dinâmica:
 * - XButtonBar: Barra de ações
 * - XFilter: Painel de filtros
 * - XDataView: Grid de dados
 * - XPagination: Navegação de páginas
 * - XFormModal: Modal de formulário (Create/Edit/Detail)
 * 
 * O modal é renderizado dentro da Tab, permitindo:
 * - Alternar entre tabs com modal aberto
 * - Cada tab ter seu próprio estado de modal
 * - O modal cobre apenas a área da tab
 * 
 * Gerencia o estado da aplicação incluindo modo, seleção, filtros e ordenação.
 */

import { useState, useCallback, useMemo, useRef, useEffect, type JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleHelp, Search, X } from 'lucide-react';
import { XPainelAjuda } from '@core/components/ajuda/XPainelAjuda';
import { XSortDirection, XApplicationMode, XButtonAction, XButtonType, XButtonColor, XButtonAlignment, XFilterOperator, XFilterLogicalOperator, XViewTemplate } from '@core/types';
import type {
  XApplication,
  XApplicationViewer,
  XApplicationState,
  XQueryRequest,
  XQueryFilterItem,
  XButton,
  XExportRequest,
  XFilterInfo,
  XSortInfo,
  XRowAction,
} from '@core/types';
import { useApplicationData } from '@core/hooks';
import { useAppX } from '@core/hooks/useAppX';
import { useSeletorDeArquivo } from '@core/hooks/useSeletorDeArquivo';
import { api, ApiError } from '@core/lib/api';
import { safeRandomUUID } from '@core/lib/uuid';
import { baseDaApp } from '@core/lib/baseDaApp';
import { getFieldValue } from '@core/lib/fieldAccess';
import { prepararDadosParaGravar } from '@core/lib/prepararDadosParaGravar';
import { abreEmLeitura } from '@core/lib/visibility';
import { XButtonBar } from './XButtonBar';
import { XFilter } from './XFilter';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XDataView } from './XDataView';
import { XPagination } from './XPagination';
import { XFormModal } from './XFormModal';
import { XTabbedFormModal } from './XTabbedFormModal';
import { XExportDialog } from './XExportDialog';
import { XCustomView } from './XCustomView';
import { XDashboardView } from './XDashboardView';
import { XSingleFormView } from './XSingleFormView';
import { XSettingsFormView } from './XSettingsFormView';
import { XCardListView } from './XCardListView';
import { XWorkspaceView } from './XWorkspaceView';
import { XNavigatorView } from './XNavigatorView';
import { XButtonActionRegistry } from './XButtonActionRegistry';
import { XImportDialog } from './XImportDialog';
import { XConfirmModal } from './XConfirmModal';
import { XRowActionFormModal } from './XRowActionFormModal';
import { acoesVisiveisNaLinha, valoresPadraoDeFormulario } from '@core/lib';
import { valoresPadraoDeFiltro } from '@core/lib/filtroPadrao';

// ============================================================================
// Types
// ============================================================================

export interface XApplicationViewProps {
  application: XApplication;
  tabID: string;
  onClose?: () => void;
  /**
   * Recorte com que a tela ABRE, chaveado pelo nome do CAMPO. Vem de quem abriu a aba apontando para
   * algo específico — o alerta de log que leva ao evento que o disparou. Some sobre os padrões do
   * back; campo que a App não filtra é ignorado, e não vira consulta com critério inventado.
   */
  filtroInicial?: Record<string, string>;
  /**
   * Registro que a tela ABRE em visualização, pela chave. Complementa o `filtroInicial`: aquele diz
   * QUAIS linhas interessam, este diz em qual delas o usuário estava sendo levado a olhar. Vem do
   * mesmo lugar — a mensagem que cita a App —, e é o que faz o aviso do sino terminar no registro em
   * vez de terminar numa grade.
   */
  registroInicial?: string;
}

// Stable id for the synthetic "Editar"/"Visualizar" buttons injected on row selection.
// safeRandomUUID (not crypto.randomUUID) so module load doesn't throw on
// insecure-context LAN access (http://<ip>:3003), which would blank the app.
const SYNTHETIC_EDIT_BUTTON_ID = safeRandomUUID();
const SYNTHETIC_VIEW_BUTTON_ID = safeRandomUUID();
const SYNTHETIC_CLOSE_BUTTON_ID = safeRandomUUID();
const SYNTHETIC_REFRESH_BUTTON_ID = safeRandomUUID();

// ============================================================================
// Component
// ============================================================================

export function XApplicationView({
  application,
  tabID,
  onClose,
  filtroInicial,
  registroInicial,
}: XApplicationViewProps): JSX.Element {
  // Cliente do React Query, para invalidar caches que uma AÇÃO DE LINHA torna obsoletos (ex.: o lookup
  // de parcelas em aberto, depois de baixar uma). Chamado ANTES dos early returns de template — os
  // hooks têm de rodar em toda renderização, na mesma ordem.
  const queryClient = useQueryClient();
  // Dentro de um AppX, a ação que leva a um nível (o "Abrir" do repositório) navega por ele; fora, não existe.
  const appX = useAppX();

  // ---------------------------------------------------------------------------
  // Template Routing — delegate to specialized views for non-DataGrid templates
  // ---------------------------------------------------------------------------

  const viewTemplate = application.viewTemplate ?? XViewTemplate.DataGrid;

  if (viewTemplate === XViewTemplate.Custom)
    return <XCustomView application={application} tabID={tabID} onClose={onClose} />;

  if (viewTemplate === XViewTemplate.Dashboard)
    return <XDashboardView application={application} tabID={tabID} onClose={onClose} />;

  if (viewTemplate === XViewTemplate.SingleForm)
    return <XSingleFormView application={application} tabID={tabID} onClose={onClose} />;

  // Formulário de configuração: o registro do contexto, na largura declarada, com o Salvar logo abaixo dos campos.
  if (viewTemplate === XViewTemplate.SettingsForm)
    return <XSettingsFormView application={application} tabID={tabID} onClose={onClose} />;

  // Lista de cartões: cada registro da consulta num cartão, com o formulário editável no lugar.
  if (viewTemplate === XViewTemplate.CardList)
    return <XCardListView application={application} tabID={tabID} onClose={onClose} />;

  // Painel de trabalho: o registro que ele acompanha é o `registroInicial` da aba.
  if (viewTemplate === XViewTemplate.Workspace)
    return <XWorkspaceView application={application} tabID={tabID} onClose={onClose} registroInicial={registroInicial} />;

  // Navegador: a lista do que se gerencia à esquerda e a App do elemento à direita, dentro desta área.
  if (viewTemplate === XViewTemplate.Navigator)
    return <XNavigatorView application={application} tabID={tabID} filtroInicial={filtroInicial} />;

  // ---------------------------------------------------------------------------
  // DataGrid Template — Standard CRUD layout (below)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Os filtros já nascem preenchidos com o que o back declarou (`defaultValue`, com tokens de data
  // resolvidos aqui — ver `filtroPadrao`). Vão para `filterValues` E `appliedFilters`: a tela abre
  // mostrando o recorte e já consultando por ele, senão a primeira carga viria sem filtro nenhum e
  // a grade contradiria os campos preenchidos logo acima dela.
  const filtrosIniciais = useMemo(() => {
    const padrao = valoresPadraoDeFiltro(application.dataView.filter.editors);

    if (!filtroInicial)
      return padrao;

    // Quem abriu a aba aponta pelo CAMPO ("Impressao"), não pelo nome do editor: o nome do editor é
    // detalhe interno do modelo, e um chamador de fora — o alerta que leva ao evento — não tem como
    // conhecê-lo. A tradução é aqui, onde os editores estão. Campo que a App não filtra é IGNORADO:
    // uma consulta com critério inventado devolveria um recorte que a tela não sabe explicar.
    const comRecorte = { ...padrao };

    for (const [campo, valor] of Object.entries(filtroInicial)) {
      for (const editor of application.dataView.filter.editors) {
        if (editor.fieldName.toLowerCase() === campo.toLowerCase())
          comRecorte[editor.name] = valor;
      }
    }

    return comRecorte;
  }, [application.dataView.filter.editors, filtroInicial]);

  const [state, setState] = useState<XApplicationState>({
    currentMode: application.currentMode,
    selectedRows: [],
    filterValues: filtrosIniciais,
    appliedFilters: filtrosIniciais,
    sortConfig: null,
    currentPage: 1,
    pageSize: application.dataView.pagination.pageSize,
  });

  // Form modal state
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isFormLoading, setIsFormLoading] = useState(false);
  // Ajuda estruturada da tela (dono, 2026-10-18): o painel abre DENTRO da área do App, na aba do formulário em foco.
  const [ajuda, setAjuda] = useState<{ aberta: boolean; aba: string }>({ aberta: false, aba: '' });
  const [isFormSaving, setIsFormSaving] = useState(false);
  // Erros POR CAMPO da última gravação recusada (campo → texto): vão ao modal, que marca os campos
  // (dono, 2026-10-12). Zerados ao abrir, ao fechar e ao tentar gravar de novo.
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Export dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  /**
   * Ação custom em curso. Guarda o comando E um `nonce` — e o nonce é o ponto.
   *
   * Com um `string | null`, reclicar o MESMO botão chamava `setState` com o mesmo valor, o React
   * descartava a atualização e o componente da ação NÃO remontava. Toda ação que só faz efeito ao
   * montar (`useEffect(…, [])` — abrir um seletor de arquivo, por exemplo) morria em silêncio: o
   * usuário clicava e nada acontecia, sem erro no console.
   *
   * Foi exatamente o defeito da App de Certificados (2026-07-25): cancelar o diálogo de arquivos
   * deixava a ação montada, e o botão "Adicionar" parava de responder para sempre.
   *
   * O nonce cresce a cada disparo, então a chave do componente muda e ele SEMPRE remonta.
   */
  const [customAction, setCustomAction] = useState<{ command: string; nonce: number } | null>(null);
  const dispararAcaoCustom = useCallback((pCommand: string) => {
    setCustomAction((pAnterior) => ({ command: pCommand, nonce: (pAnterior?.nonce ?? 0) + 1 }));
  }, []);

  // ---------------------------------------------------------------------------
  // Query Request Builder
  // ---------------------------------------------------------------------------

  // A consulta lê os filtros APLICADOS, não os que estão sendo digitados. Ligá-la a `filterValues`
  // fazia uma requisição por tecla — o debounce do XFilter adiava o `onSearch`, mas a query já tinha
  // disparado sozinha. Quem promove digitado → aplicado é `handleSearch`, chamado pelo debounce ou
  // pelo botão de pesquisar.
  const queryRequest = useMemo((): XQueryRequest => {
    const filters: XQueryFilterItem[] = [];

    // Os filtros são chaveados pelo NOME DO EDITOR: é o que permite dois editores sobre o mesmo
    // campo (o "de" e o "até" de um período), cada um com o seu operador. O que vai para a consulta
    // é o `fieldName` do editor — o campo do DTO —, e não a chave do estado.
    for (const [editorName, value] of Object.entries(state.appliedFilters)) {
      if (value === undefined || value === null || value === '')
        continue;

      const editor = application.dataView.filter.editors.find((e) => e.name === editorName);
      if (!editor)
        continue;

      filters.push({
        fieldName: editor.fieldName,
        operator: editor.defaultOperator ?? XFilterOperator.Contains,
        value: String(value),
      });
    }

    return {
      filters,
      sort: state.sortConfig
        ? [{
            fieldName: state.sortConfig.field,
            direction: state.sortConfig.direction,
          }]
        : [],
      page: state.currentPage,
      pageSize: state.pageSize,
    };
  }, [
    state.appliedFilters,
    state.sortConfig,
    state.currentPage,
    state.pageSize,
    application.dataView.filter.editors,
  ]);

  // ---------------------------------------------------------------------------
  // Data Query
  // ---------------------------------------------------------------------------

  const {
    data: queryResponse,
    isLoading,
    isFetching,
    isPlaceholderData,
    refetch,
  } = useApplicationData({
    endpoint: application.dataView.dataEndpoint,
    request: queryRequest,
    enabled: state.currentMode === XApplicationMode.List,
  });

  // Loading real = está carregando E não tem dados placeholder
  const isReallyLoading = isLoading && !isPlaceholderData;
  // Fetching com dados = está buscando novos dados mas tem dados para mostrar
  const isFetchingWithData = isFetching && (queryResponse?.records?.length ?? 0) > 0;

  // ---------------------------------------------------------------------------
  // Computed - Data (needed by handlers)
  // ---------------------------------------------------------------------------

  const data = useMemo(() => {
    return queryResponse?.records ?? [];
  }, [queryResponse?.records]);

  const totalCount = useMemo(() => {
    return queryResponse?.totalRecords ?? 0;
  }, [queryResponse?.totalRecords]);

  // Dados do registro selecionado (para botões dinâmicos como ToggleStatus)
  const selectedRowData = useMemo((): Record<string, unknown> | null => {
    if (state.selectedRows.length !== 1)
      return null;

    const selectedID = state.selectedRows[0];
    const record = data.find((r: Record<string, unknown>) => 
      String(getFieldValue(r, application.dataView.keyField)) === selectedID
    );

    return record ?? null;
  }, [state.selectedRows, data, application.dataView.keyField]);

  // A LINHA abre em LEITURA? A regra vem do back (CE-19) e fala do ESTADO do registro; a decisão em si
  // vive em `abreEmLeitura` (lib/visibility), pura e testada à parte.
  const linhaSomenteLeitura = useCallback(
    (pLinha: Record<string, unknown> | null | undefined): boolean =>
      abreEmLeitura(application.dataView.readOnlyWhen, pLinha),
    [application.dataView.readOnlyWhen]
  );

  // Botão que ABRE a linha selecionada, injetado pelo motor quando a App não declarou o seu. A
  // CAPACIDADE decide qual: App editável ganha "Editar"; App somente-leitura ganha "Visualizar" — a
  // mesma regra que o duplo clique já segue (`canEdit ? Editar : Visualizar`). Sem o segundo caso, a
  // App não-editável ficava SEM botão nenhum ao selecionar a linha, e o registro só se alcançava pelo
  // duplo clique — que ninguém adivinha (defeito real na Emissão de NFS-e, 2026-07-13).
  //
  // `canEdit` vem do back, calculado sobre as permissões DESTE usuário (documento XApplication). O
  // XButtonBar cuida da visibilidade por seleção (`selectedCount === 1`), como em qualquer botão.
  //
  // "Visualizar" só nasce onde há COMO mostrar o registro: um formulário com carga (LoadEndpoint) ou um
  // visualizador declarado. App sem nenhum dos dois — Certificados, cujo formulário existe só para
  // servir ao Excluir — não ganha um botão que abriria um modal vazio.
  //
  // A decisão é POR LINHA, não só por App: a capacidade (`canEdit`) diz se o usuário pode editar; o
  // `readOnlyWhen` diz se ESTE registro ainda aceita edição. Linha travada ⇒ o botão nasce "Visualizar",
  // e o modal abre em leitura — a tela deixa de oferecer o que o back recusaria ao salvar.
  const effectiveButtonBar = useMemo(() => {
    const acaoAbrir = application.canEdit && !linhaSomenteLeitura(selectedRowData)
      ? XButtonAction.Edit
      : XButtonAction.View;

    // A App que declara o próprio botão de abrir manda: o motor não duplica (é o caso de Notas
    // Fiscais, que declara dois visualizadores — resumo e detalhe).
    if (application.buttonBar.buttons.some((b) => b.action === acaoAbrir))
      return application.buttonBar;

    const podeCarregar = Boolean(
      application.tabbedFormView?.loadEndpoint
      || application.formView.loadEndpoint
      || application.viewers?.length
    );

    if (acaoAbrir === XButtonAction.View && !podeCarregar)
      return application.buttonBar;

    // A App pode declarar N visualizadores; o botão injetado abre o PRINCIPAL — o primeiro na ordem do
    // back, o mesmo que o duplo clique escolhe. O handler o encontra pelo NOME do botão.
    //
    // MAS SÓ OS QUE NÃO TÊM BOTÃO PRÓPRIO (dono, 2026-09-17). O visualizador que a App já acionou por
    // um botão declarado não pode ser "adotado" pelo sintético: os dois ficariam com o MESMO nome, e
    // o sintético — que vem depois na lista — engoliria o declarado. Foi exatamente o que aconteceu
    // com o "Conferir nota" do pedido: ele sumiu da barra, e o "Editar" passou a abrir a conferência.
    const viewersComBotaoProprio = new Set(
      application.buttonBar.buttons.map((pBotao) => pBotao.name));

    const viewerPrincipal = acaoAbrir === XButtonAction.View && application.viewers?.length
      ? [...application.viewers]
          .filter((pViewer) => !viewersComBotaoProprio.has(pViewer.key))
          .sort((a, b) => a.order - b.order)[0]
      : undefined;

    const ehVisualizar = acaoAbrir === XButtonAction.View;

    const abrirButton: XButton = {
      id: ehVisualizar ? SYNTHETIC_VIEW_BUTTON_ID : SYNTHETIC_EDIT_BUTTON_ID,
      name: viewerPrincipal?.key ?? (ehVisualizar ? 'view' : 'edit'),
      title: ehVisualizar ? 'Visualizar' : 'Editar',
      description: '',
      isVisible: true,
      isEnabled: true,
      order: 5,
      cssClass: '',
      icon: ehVisualizar ? 'eye' : 'pencil',
      tooltip: ehVisualizar ? 'Visualizar' : 'Editar',
      // Cor pela AÇÃO (View→leitura, Edit→azul), resolvida na paleta; sem papel explícito.
      color: XButtonColor.Default,
      buttonType: XButtonType.Primary,
      action: acaoAbrir,
      actionCommand: '',
      confirmMessage: '',
      requiresSelection: true,
      requiresConfirmation: false,
      requiresCompany: false,
      shortcut: '',
      permission: '',
      alignment: XButtonAlignment.Left,
    };

    // Linha SOMENTE-LEITURA (dado livre de plataforma, D51, ou regra readOnlyWhen da App): a tela não
    // oferece o que o back recusaria — o botão DESTRUTIVO (Delete) nasce desabilitado sobre ela. Não é a
    // defesa (o servidor recusa e devolve aviso laranja); é não convidar ao erro ("o sistema não deixa o
    // usuário errar"). Editar já vira Visualizar acima; aqui fechamos o Excluir.
    const linhaTravada = linhaSomenteLeitura(selectedRowData);
    const base = application.buttonBar.buttons.map((b) =>
      linhaTravada && b.action === XButtonAction.Delete ? { ...b, isEnabled: false } : b
    );

    return { ...application.buttonBar, buttons: [...base, abrirButton] };
  }, [
    application.buttonBar,
    application.canEdit,
    application.viewers,
    application.formView.loadEndpoint,
    application.tabbedFormView?.loadEndpoint,
    linhaSomenteLeitura,
    selectedRowData,
  ]);

  // AS AÇÕES DA APP VIVEM NA BARRA, não dentro da linha (dono, 2026-07-13). O que a App declara em
  // `dataView.rowActions` — transmitir a nota, baixar o documento auxiliar, cancelar — vira botão da
  // BARRA, ao lado de "Novo" e "Visualizar", e age sobre a LINHA SELECIONADA. A grade voltou a ser só
  // grade: nenhuma coluna de botões.
  //
  // O botão só aparece quando a linha selecionada o comporta — a mesma regra de sempre
  // (`visibleWhenField` + `visibleWhenValues`), agora avaliada contra a linha escolhida: "Autorizar" na
  // nota que ainda não foi, "DANFSe" e "Cancelar" na autorizada, nada na cancelada. Nenhum conhecimento
  // de App aqui: o motor lê o modelo e desenha (CE-19).
  const barraComAcoesDaLinha = useMemo(() => {
    // A ação que leva a um nível do AppX só aparece dentro de um AppX que tem esse nível (o modelo chega podado).
    const acoes = (application.dataView.rowActions ?? []).filter((pA) => !pA.openLevel || appX?.temNivel(pA.openLevel));
    if (acoes.length === 0 || !selectedRowData)
      return effectiveButtonBar;

    const disponiveis = acoesVisiveisNaLinha(acoes, selectedRowData);
    if (disponiveis.length === 0)
      return effectiveButtonBar;

    const botoes: XButton[] = disponiveis.map((pAcao: XRowAction, pIndice: number) => ({
      id: pAcao.id,
      name: pAcao.name,
      title: pAcao.title,
      description: '',
      isVisible: true,
      isEnabled: true,
      // Depois do botão de abrir (5) e do "Novo" (10), na ordem em que o back as declarou.
      order: 50 + pIndice,
      cssClass: '',
      icon: pAcao.icon,
      tooltip: pAcao.title,
      // Papel de cor declarado na ação de linha (DANFE→documento, emitir→destaque, cancelar→perigo);
      // sem declaração, cai em neutro pela paleta. RowAction não tem cor por ação canônica.
      color: pAcao.color ?? XButtonColor.Default,
      buttonType: pAcao.buttonType,
      action: XButtonAction.RowAction,
      actionCommand: '',

      // A confirmação e a coleta pertencem ao FLUXO da ação (handleRowAction), não ao botão: pedi-las
      // aqui faria a barra perguntar ANTES de coletar o motivo do cancelamento.
      confirmMessage: '',
      requiresSelection: true,
      requiresConfirmation: false,

      requiresCompany: pAcao.requiresCompany,
      shortcut: '',
      permission: '',
      alignment: XButtonAlignment.Left,
    }));

    return { ...effectiveButtonBar, buttons: [...effectiveButtonBar.buttons, ...botoes] };
  }, [effectiveButtonBar, application.dataView.rowActions, selectedRowData, appX]);

  // Toda App de GRADE tem "Atualizar", e ele é o PRIMEIRO BOTÃO DA BARRA — o mais à esquerda de
  // todos, qualquer que seja a quantidade de botões (dono, 2026-08-13). Lugar fixo é o que torna o
  // gesto automático: a mão vai ao mesmo ponto em toda App, e não passa a caçá-lo porque esta tela
  // tem quatro ações e aquela tem uma. Refazer a consulta é gesto do motor, não da App — nenhuma
  // precisa declará-lo. Só ÍCONE, sem rótulo: a ação é reconhecida pelo símbolo e o texto só roubaria
  // espaço da barra; quem precisa de palavras tem o XHint e o aria-label. A App que declarar o seu
  // Refresh manda, e o motor não duplica.
  const buttonBarComAtualizar = useMemo(() => {
    const jaTemAtualizar = barraComAcoesDaLinha.buttons.some((b) => b.action === XButtonAction.Refresh);
    if (jaTemAtualizar)
      return barraComAcoesDaLinha;

    // A ordem é CALCULADA, não cravada: a barra ordena por `order`, e um número fixo (ainda que
    // baixo) empataria ou perderia para o que o back declarasse mais baixo ainda. Menor que o menor
    // de todos é a única forma de "primeiro" valer sempre — inclusive numa App futura cujos botões
    // comecem em zero ou em negativo.
    const menorOrdem = barraComAcoesDaLinha.buttons.reduce((pMenor, pBotao) => Math.min(pMenor, pBotao.order), 0);

    const refreshButton: XButton = {
      id: SYNTHETIC_REFRESH_BUTTON_ID,
      name: 'refresh',
      title: 'Atualizar',
      description: '',
      isVisible: true,
      isEnabled: true,
      order: menorOrdem - 1,
      cssClass: '',
      icon: 'refresh-cw',
      tooltip: 'Refazer a consulta e trazer os dados como estão agora',
      // Cor pela AÇÃO (Refresh→neutro), resolvida na paleta.
      color: XButtonColor.Default,
      // Icon = botão sem texto (XButtonBar não desenha rótulo para este tipo).
      buttonType: XButtonType.Icon,
      action: XButtonAction.Refresh,
      actionCommand: '',
      confirmMessage: '',
      // Atualizar não depende de linha escolhida nem de empresa corrente: relê o que a tela já mostra.
      requiresSelection: false,
      requiresConfirmation: false,
      requiresCompany: false,
      shortcut: '',
      permission: '',

      // ESQUERDA, e não direita: o grupo da direita é o do "Fechar", que fecha a barra do outro lado.
      alignment: XButtonAlignment.Left,
    };

    // Primeiro do array, além de primeiro na ordem: a ordenação da barra é estável, então quem entra
    // na frente também ganha o desempate se algum botão declarar a mesma ordem.
    return { ...barraComAcoesDaLinha, buttons: [refreshButton, ...barraComAcoesDaLinha.buttons] };
  }, [barraComAcoesDaLinha]);

  // Toda App tem "Fechar", no extremo DIREITO da barra — não importa a categoria. Fechar a aba é
  // gesto do sistema, não da App: nenhuma precisa declará-lo, e nenhuma pode se esquecer dele. A App
  // que quiser um fechar próprio (com confirmação, por exemplo) o declara, e o motor não injeta.
  const buttonBarComFechar = useMemo(() => {
    const jaTemFechar = buttonBarComAtualizar.buttons.some((b) => b.action === XButtonAction.Close);
    if (jaTemFechar || !onClose)
      return buttonBarComAtualizar;

    const closeButton: XButton = {
      id: SYNTHETIC_CLOSE_BUTTON_ID,
      name: 'close',
      title: 'Fechar',
      description: '',
      isVisible: true,
      isEnabled: true,
      order: 9999,
      cssClass: '',
      // Mesmo ícone do fechar da aba (AppTabBar): fechar a aplicação é um gesto só, e o usuário o
      // reconhece pelo símbolo, não pelo lugar onde clicou.
      icon: 'log-out',
      tooltip: 'Fechar',
      // Cor pela AÇÃO (Close→vermelho abafado), resolvida na paleta.
      color: XButtonColor.Default,
      buttonType: XButtonType.Secondary,
      action: XButtonAction.Close,
      actionCommand: '',
      confirmMessage: '',
      requiresSelection: false,
      requiresConfirmation: false,
      requiresCompany: false,
      shortcut: '',
      permission: '',
      alignment: XButtonAlignment.Right,
    };

    return { ...buttonBarComAtualizar, buttons: [...buttonBarComAtualizar.buttons, closeButton] };
  }, [buttonBarComAtualizar, onClose]);

  // ---------------------------------------------------------------------------
  // State Control - Track checked rows for batch activate/deactivate
  // ---------------------------------------------------------------------------

  const [stateCheckedRows, setStateCheckedRows] = useState<string[]>([]);

  // Ação de LINHA (modelo do back — CE-19): a que está COLETANDO dados, a que está aguardando
  // confirmação (com o que já se coletou), e a mensagem do desfecho.
  const [rowActionForm, setRowActionForm] = useState<
    { action: XRowAction; rowID: string; rowData?: Record<string, unknown>; reloadFormAfter?: boolean } | null>(null);
  const [pendingRowAction, setPendingRowAction] = useState<
    { action: XRowAction; rowID: string; corpo: Record<string, unknown> } | null>(null);
  const [rowActionResult, setRowActionResult] = useState<string | null>(null);

  // Visualizador ativo (a App pode declarar N). Nulo = nenhum aberto.
  const [activeViewer, setActiveViewer] = useState<XApplicationViewer | null>(null);
  const [viewerData, setViewerData] = useState<Record<string, unknown>>({});
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [isExportandoViewer, setIsExportandoViewer] = useState(false);

  // Importação dirigida por modelo: o input fica fora da árvore visível e é acionado pelo botão.
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [mobileFilterZ, setMobileFilterZ] = useState(0);
  const mobileFilterBtnRef = useRef<HTMLButtonElement>(null);
  const mobileFilterPanelRef = useRef<HTMLDivElement>(null);

  // Close the mobile filter dropdown on outside click (mirrors the tab overflow dropdown).
  useEffect(() => {
    if (!showMobileFilter)
      return;
    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as Node;
      // Ignore clicks inside a portaled editor dropdown (XComboBoxEditor renders its
      // options in document.body, OUTSIDE the panel DOM). Without this guard, picking a
      // combobox option counts as an outside click and closes the panel on mousedown,
      // unmounting the editor before its onClick fires — so nothing gets selected.
      if (target instanceof Element && target.closest('[data-x-portal-dropdown]'))
        return;
      if (mobileFilterPanelRef.current && !mobileFilterPanelRef.current.contains(target) &&
          mobileFilterBtnRef.current && !mobileFilterBtnRef.current.contains(target))
        setShowMobileFilter(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMobileFilter]);

  // Compute the homogeneous state of checked rows (all active, all inactive, or mixed)
  const stateCheckedStatus = useMemo((): 'active' | 'inactive' | 'mixed' | 'none' => {
    if (!application.hasStateControl || stateCheckedRows.length === 0)
      return 'none';

    let hasActive = false;
    let hasInactive = false;

    for (const rowID of stateCheckedRows) {
      const record = data.find((r: Record<string, unknown>) =>
        String(getFieldValue(r, application.dataView.keyField)) === rowID
      );
      if (!record) continue;

      if (record['isActive'] === true)
        hasActive = true;
      else
        hasInactive = true;

      if (hasActive && hasInactive)
        return 'mixed';
    }

    if (hasActive && !hasInactive) return 'active';
    if (hasInactive && !hasActive) return 'inactive';
    return 'none';
  }, [stateCheckedRows, data, application.dataView.keyField, application.hasStateControl]);

  const handleStateCheckRow = useCallback((pRowID: string) => {
    setStateCheckedRows((prev) =>
      prev.includes(pRowID)
        ? prev.filter((id) => id !== pRowID)
        : [...prev, pRowID]
    );
  }, []);

  const handleStateCheckAll = useCallback((pChecked: boolean) => {
    if (pChecked) {
      // Só linhas MARCÁVEIS: pular as travadas (stateLocked) — senão o estado das marcadas vira
      // "misto" (ativas + inativas) e nem Ativar nem Desativar aparecem.
      const allIDs = data
        .filter((r: Record<string, unknown>) => r['stateLocked'] !== true)
        .map((r: Record<string, unknown>) => String(getFieldValue(r, application.dataView.keyField)));
      setStateCheckedRows(allIDs);
    } else {
      setStateCheckedRows([]);
    }
  }, [data, application.dataView.keyField]);

  // ---------------------------------------------------------------------------
  // Handlers - Form Modal
  // ---------------------------------------------------------------------------

  /**
   * O registro com que o "Novo" abre: os `defaultValue` que a App declarou (CE-19).
   *
   * Sem isto o formulário nascia vazio e o operador redigitava, a cada registro, a resposta que é a
   * mesma em quase toda operação — o tipo "Saída" e a finalidade "Normal" de um pedido de venda.
   * Quem sabe qual é o caso comum é o back; aqui só se monta o registro.
   */
  const valoresIniciaisDeCriacao = useCallback(
    (): Record<string, unknown> =>
      valoresPadraoDeFormulario(application.formView, application.tabbedFormView),
    [application.formView, application.tabbedFormView]);

  // Cada abertura (e cada fechamento) do formulário ganha um número. A resposta do contexto que chega DEPOIS de o
  // formulário fechar, ou de outro abrir, não pode cair sobre ele: confere-se o número antes de juntar.
  const aberturaDoFormulario = useRef(0);

  const openFormModal = useCallback((pMode: XApplicationMode, pData: Record<string, unknown> = {}) => {
    aberturaDoFormulario.current += 1;
    setFormData(pData);
    setServerErrors({});
    setState((prev) => ({ ...prev, currentMode: pMode }));
  }, []);

  /**
   * O CONTEXTO do formulário (`contextEndpoint`, dono 2026-10-27): valores que não são do registro, mas mudam como a
   * tela se comporta — a configuração da empresa que liga uma coluna ou um modo de cálculo. Buscado a cada abertura,
   * para valer o que está configurado AGORA. Falha ⇒ formulário sem contexto: o `api.ts` já levou ao usuário a
   * mensagem que nomeia a rota e o status (erro não-mudo), e a tela segue no comportamento padrão.
   */
  const contextEndpoint = application.tabbedFormView?.contextEndpoint || application.formView.contextEndpoint || '';

  const buscarContexto = useCallback(async (): Promise<Record<string, unknown>> => {
    if (!contextEndpoint)
      return {};

    try {
      return (await api.get<Record<string, unknown>>(contextEndpoint)) ?? {};
    } catch {
      return {};
    }
  }, [contextEndpoint]);

  /**
   * Abre o formulário de CRIAÇÃO. Com contexto declarado, o modal mostra o carregamento até ele chegar — o
   * formulário não aparece (nem grava) no modo errado — e o contexto entra sob os valores iniciais.
   */
  const abrirCriacao = useCallback((pDados: Record<string, unknown>) => {
    openFormModal(XApplicationMode.Create, pDados);

    if (!contextEndpoint)
      return;

    const abertura = aberturaDoFormulario.current;
    setIsFormLoading(true);
    void buscarContexto()
      .then((pContexto) => {
        if (aberturaDoFormulario.current === abertura)
          setFormData((pAnterior) => ({ ...pContexto, ...pAnterior }));
      })
      .finally(() => {
        if (aberturaDoFormulario.current === abertura)
          setIsFormLoading(false);
      });
  }, [openFormModal, contextEndpoint, buscarContexto]);

  const closeFormModal = useCallback(() => {
    aberturaDoFormulario.current += 1;
    setIsFormLoading(false);
    setState((prev) => ({
      ...prev,
      currentMode: XApplicationMode.List,
    }));
    setFormData({});
    setServerErrors({});
  }, []);

  const [idDoFormulario, setIdDoFormulario] = useState<string | undefined>(undefined);

  const loadFormData = useCallback(async (pID: string) => {
    setIsFormLoading(true);
    // O registro que o formulário tem aberto — resolve o `{id}` do recálculo, venha a abertura da grade,
    // do botão ou de um link de outra App (que não seleciona linha nenhuma).
    setIdDoFormulario(pID);

    try {
      // Use tabbedFormView endpoint if available, otherwise formView
      const loadEndpoint = application.tabbedFormView?.loadEndpoint || application.formView.loadEndpoint;

      // Fetch the full detail (includes child collections for aggregate forms). Fall back
      // to the in-memory list row only when no load endpoint is configured.
      // O registro e o CONTEXTO em paralelo; o registro prevalece em nome repetido (o contexto é só o que falta).
      if (loadEndpoint) {
        const endpoint = loadEndpoint.replace('{id}', pID);
        const [detail, contexto] = await Promise.all([
          api.get<Record<string, unknown>>(endpoint),
          buscarContexto(),
        ]);
        setFormData({ ...contexto, ...(detail ?? {}) });
      } else {
        const record = data.find((r: Record<string, unknown>) => String(getFieldValue(r, application.dataView.keyField)) === pID);
        const contexto = await buscarContexto();
        setFormData({ ...contexto, ...((record as Record<string, unknown>) ?? {}) });
      }
    } catch (error) {
      console.error('Load error:', error);
      // Fallback: at least populate from the list row so the form is not empty.
      const record = data.find((r: Record<string, unknown>) => String(getFieldValue(r, application.dataView.keyField)) === pID);
      if (record)
        setFormData(record as Record<string, unknown>);
    } finally {
      setIsFormLoading(false);
    }
  }, [application.formView.loadEndpoint, application.tabbedFormView?.loadEndpoint, application.dataView.keyField, data, buscarContexto]);

  /**
   * Prepara os dados do formulário para envio à API: converte pelo tipo do editor (o combo de enumerado liga texto; o
   * contrato espera número) e colapsa a chave que o servidor mandou em camelCase com a que o editor grava em PascalCase.
   * O preparo mora em `prepararDadosParaGravar` (dono, 2026-10-26), o mesmo do formulário de configuração, da lista de
   * cartões e do "+" do navegador.
   */
  const prepareDataForSave = useCallback((pData: Record<string, unknown>): Record<string, unknown> =>
    prepararDadosParaGravar(pData, application.formView, application.tabbedFormView),
  [application.formView, application.tabbedFormView]);

  const handleFormSave = useCallback(async (pData: Record<string, unknown>) => {
    setIsFormSaving(true);
    setServerErrors({});

    try {
      const isCreate = state.currentMode === XApplicationMode.Create;
      // Use tabbedFormView endpoint if available, otherwise formView
      const baseEndpoint = application.tabbedFormView?.saveEndpoint || application.formView.saveEndpoint;
      const dataToSend = prepareDataForSave(pData);

      // Ensure 'apps' array exists for profile creation/update (required by backend)
      if (dataToSend.apps === undefined && (baseEndpoint.includes('/profiles') || baseEndpoint.includes('/sys/profiles')))
        dataToSend.apps = [];

      if (isCreate) {
        // POST para criar novo registro
        await api.post(baseEndpoint, dataToSend);
      } else {
        // PUT para atualizar registro existente
        const id = pData.id || state.selectedRows[0];
        const url = baseEndpoint.includes('{id}')
          ? baseEndpoint.replace('{id}', String(id))
          : `${baseEndpoint}/${id}`;
        await api.put(url, dataToSend);
      }

      // Close modal and refresh data
      closeFormModal();
      refetch();
    } catch (error) {
      console.error('Save error:', error);
      // O diálogo é do ErrorContext global; aqui só o que o formulário precisa para MARCAR os campos
      // que o servidor recusou (dono, 2026-10-12) — todos de uma vez, com a frase de cada um.
      if (error instanceof ApiError && error.fieldErrors.length > 0)
        setServerErrors(Object.fromEntries(error.fieldErrors.map((fe) => [fe.field, fe.messages.join('\n')])));
    } finally {
      setIsFormSaving(false);
    }
  }, [state.currentMode, state.selectedRows, application.formView.saveEndpoint, application.tabbedFormView?.saveEndpoint, closeFormModal, refetch, prepareDataForSave]);

  // Delete the selected record(s). Confirmation is handled by the button bar
  // (RequiresConfirmation); here we just call DELETE {endpoint}/{id} and refresh.
  const handleDelete = useCallback(async () => {
    if (!application.canDelete || state.selectedRows.length === 0)
      return;

    const baseEndpoint = application.tabbedFormView?.saveEndpoint || application.formView.saveEndpoint;

    try {
      for (const id of state.selectedRows) {
        const url = baseEndpoint.includes('{id}')
          ? baseEndpoint.replace('{id}', String(id))
          : `${baseEndpoint}/${id}`;
        await api.delete(url);
      }
      setState((prev) => ({ ...prev, selectedRows: [] }));
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      // Erro é capturado pelo ErrorContext global
    }
  }, [application.canDelete, application.tabbedFormView?.saveEndpoint, application.formView.saveEndpoint, state.selectedRows, refetch]);

  // ---------------------------------------------------------------------------
  // Handlers - Filter
  // ---------------------------------------------------------------------------

  const handleFilterChange = useCallback((pFieldName: string, pValue: unknown) => {
    setState((prev) => ({
      ...prev,
      filterValues: {
        ...prev.filterValues,
        [pFieldName]: pValue,
      },
    }));
  }, []);

  // Promove o que está digitado a filtro efetivo. É o único caminho que dispara a consulta.
  const handleSearch = useCallback(() => {
    setState((prev) => ({
      ...prev,
      appliedFilters: prev.filterValues,
      currentPage: 1,  // Reset para primeira página ao buscar
    }));
  }, []);

  // "Limpar" devolve o filtro ao ESTADO EM QUE A TELA ABRE, e não ao vazio: se a App declarou um
  // período padrão, limpar para o vazio pediria o histórico inteiro do assinante — o oposto do que
  // quem clicou em "limpar" espera de um botão que existe para reduzir o que está na tela.
  const handleClearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filterValues: filtrosIniciais,
      appliedFilters: filtrosIniciais,
      currentPage: 1,
    }));
  }, [filtrosIniciais]);

  // ---------------------------------------------------------------------------
  // Handlers - Sort
  // ---------------------------------------------------------------------------

  const handleSort = useCallback((pFieldName: string) => {
    setState((prev) => {
      const currentSort = prev.sortConfig;

      // Se já está ordenando por este campo, inverte a direção
      if (currentSort?.field === pFieldName) {
        if (currentSort.direction === XSortDirection.Ascending)
          return { ...prev, sortConfig: { field: pFieldName, direction: XSortDirection.Descending } };

        // Se já está descendente, remove ordenação
        return { ...prev, sortConfig: null };
      }

      // Nova ordenação ascendente
      return {
        ...prev,
        sortConfig: { field: pFieldName, direction: XSortDirection.Ascending },
      };
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers - Selection
  // ---------------------------------------------------------------------------

  const handleSelect = useCallback((pID: string) => {
    setState((prev) => {
      const selectionMode = application.dataView.row.selectionMode;

      if (selectionMode === 1) {
        // Single selection
        const isSelected = prev.selectedRows.includes(pID);
        return {
          ...prev,
          selectedRows: isSelected ? [] : [pID],
        };
      }

      // Multiple selection
      const isSelected = prev.selectedRows.includes(pID);
      return {
        ...prev,
        selectedRows: isSelected
          ? prev.selectedRows.filter((id) => id !== pID)
          : [...prev.selectedRows, pID],
      };
    });
  }, [application.dataView.row.selectionMode]);

  const handleSelectAll = useCallback((pIDs: string[]) => {
    setState((prev) => ({
      ...prev,
      selectedRows: pIDs,
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers - Visualizadores (N por App) e importação
  // ---------------------------------------------------------------------------

  const abrirViewer = useCallback(async (pViewer: XApplicationViewer, pID: string) => {
    setActiveViewer(pViewer);
    setViewerData({});

    if (!pViewer.loadEndpoint)
      return;

    setIsViewerLoading(true);
    try {
      const detalhe = await api.get<Record<string, unknown>>(pViewer.loadEndpoint.replace('{id}', pID));
      setViewerData(detalhe ?? {});
    } catch (error) {
      console.error('Viewer load error:', error);
    } finally {
      setIsViewerLoading(false);
    }
  }, []);

  /**
   * Baixa o visualizador ativo em PDF (o back declara `exportEndpoint` no viewer).
   *
   * É o MESMO documento que está na tela, e por isso um endpoint próprio do visualizador — não a
   * exportação da grade, que baixaria a LISTA de registros em vez do relatório aberto.
   *
   * GET, e NÃO o POST que o `downloadBlob` assume por padrão (dono, 2026-09-20): isto é LEITURA de um
   * documento identificado pelo `{id}` da URL — nada se grava, nada se reserva, nada se transmite, e
   * não há corpo a enviar. O padrão POST serve à exportação da GRADE, que manda filtros e colunas no
   * corpo. Aqui ele só produzia 405: o `ExportEndpoint` do visualizador é declarado `HttpGet` no back
   * (FaturamentoController, `preview.pdf`), pela mesma razão.
   */
  const exportarViewer = useCallback(async (pViewer: XApplicationViewer, pID: string) => {
    if (!pViewer.exportEndpoint)
      return;

    setIsExportandoViewer(true);
    try {
      const { blob, filename } = await api.downloadBlob(pViewer.exportEndpoint.replace('{id}', pID), undefined, 'GET');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportandoViewer(false);
    }
  }, []);

  const fecharViewer = useCallback(() => {
    setActiveViewer(null);
    setViewerData({});
  }, []);

  const handleDoubleClick = useCallback((pID: string) => {
    const row = application.dataView.row;
    if (!row.allowDoubleClick)
      return;

    const action = row.doubleClickAction;
    if (action === 'none')
      return;

    setState((prev) => ({ ...prev, selectedRows: [pID] }));

    // Regra do duplo clique, uniforme para toda App: EDITAR quando a App é editável E a linha ainda
    // aceita edição; senão VISUALIZAR. Sem override por doubleClickAction ('none'/allowDoubleClick
    // apenas desligam o gesto) — é a MESMA regra do botão de abrir, para o gesto e o botão nunca
    // discordarem sobre a mesma linha.
    const linha = data.find(
      (r: Record<string, unknown>) => String(getFieldValue(r, application.dataView.keyField)) === pID
    );
    const querVisualizar = !application.canEdit || linhaSomenteLeitura(linha);

    // A App pode declarar N visualizadores; o duplo clique abre o PRINCIPAL — o primeiro na ordem
    // declarada pelo back. É o gesto de "quero ver esta linha", e o principal é o que responde.
    if (querVisualizar && application.viewers?.length) {
      const principal = [...application.viewers].sort((a, b) => a.order - b.order)[0];
      void abrirViewer(principal, pID);
      return;
    }

    openFormModal(querVisualizar ? XApplicationMode.Detail : XApplicationMode.Edit);
    loadFormData(pID);
  }, [
    application.canEdit, application.dataView.row, application.dataView.keyField, application.viewers,
    data, linhaSomenteLeitura, abrirViewer, openFormModal, loadFormData,
  ]);

  /**
   * A aba pode nascer APONTANDO PARA UM REGISTRO (`registroInicial`), e então ela abre nele: é assim
   * que o aviso do sino termina no evento de que fala. **O que a grade atrás está mostrando é
   * irrelevante** (dono, 2026-08-12): link com chave abre AQUELE registro, ponto — e é por isso que
   * o recorte da grade deixou de acompanhar o link do alerta.
   *
   * Abre pela MESMA regra do duplo clique — editor quando a App edita e a linha aceita, visualização
   * quando não —, para o mesmo registro não se comportar de um jeito pelo link e de outro pela grade.
   *
   * A carga vem do `loadEndpoint` da App, então NÃO espera a grade: a linha pode estar na página 7,
   * ou nem estar na consulta corrente.
   *
   * `useRef` de disparo único: sem ele, fechar o detalhe faria o efeito reabri-lo na renderização
   * seguinte, e o modal viraria uma porta que não fecha.
   */
  const registroInicialAberto = useRef(false);

  useEffect(() => {
    if (!registroInicial || registroInicialAberto.current)
      return;

    registroInicialAberto.current = true;
    setState((prev) => ({ ...prev, selectedRows: [registroInicial] }));

    // A linha pode não estar carregada — e então vale o que a App declara sobre si mesma.
    const linha = data.find(
      (r: Record<string, unknown>) => String(getFieldValue(r, application.dataView.keyField)) === registroInicial
    );
    const querVisualizar = !application.canEdit || linhaSomenteLeitura(linha);

    if (querVisualizar && application.viewers?.length) {
      const principal = [...application.viewers].sort((a, b) => a.order - b.order)[0];
      void abrirViewer(principal, registroInicial);
      return;
    }

    openFormModal(querVisualizar ? XApplicationMode.Detail : XApplicationMode.Edit);
    void loadFormData(registroInicial);
  }, [
    registroInicial, application.canEdit, application.viewers, application.dataView.keyField,
    data, linhaSomenteLeitura, abrirViewer, openFormModal, loadFormData,
  ]);

  // ---------------------------------------------------------------------------
  // Handlers - Pagination
  // ---------------------------------------------------------------------------

  const handlePageChange = useCallback((pPage: number) => {
    setState((prev) => ({
      ...prev,
      currentPage: pPage,
    }));
  }, []);

  const handlePageSizeChange = useCallback((pSize: number) => {
    setState((prev) => ({
      ...prev,
      pageSize: pSize,
      currentPage: 1,  // Reset para primeira página ao mudar tamanho
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers - Button Actions
  // ---------------------------------------------------------------------------

  const handleToggleStatus = useCallback(async () => {
    if (state.selectedRows.length !== 1)
      return;

    const selectedID = state.selectedRows[0];

    try {
      const baseURL = baseDaApp(application.apiBaseURL, application.dataView.dataEndpoint.replace('/query', ''));
      const endpoint = `${baseURL}/${selectedID}/toggle-status`;

      await api.post(endpoint, {});

      // Refresh data after toggle
      refetch();

      // Clear selection
      setState((prev) => ({ ...prev, selectedRows: [] }));
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  }, [state.selectedRows, application.apiBaseURL, application.dataView.dataEndpoint, refetch]);

  const handleBatchActivate = useCallback(async () => {
    if (stateCheckedRows.length === 0) return;

    try {
      const baseURL = baseDaApp(application.apiBaseURL, application.dataView.dataEndpoint.replace('/query', ''));
      await api.post(`${baseURL}/batch-activate`, stateCheckedRows);
      setStateCheckedRows([]);
      refetch();
    } catch (error) {
      console.error('Error batch activating:', error);
    }
  }, [stateCheckedRows, application.apiBaseURL, application.dataView.dataEndpoint, refetch]);

  const handleBatchDeactivate = useCallback(async () => {
    if (stateCheckedRows.length === 0) return;

    try {
      const baseURL = baseDaApp(application.apiBaseURL, application.dataView.dataEndpoint.replace('/query', ''));
      await api.post(`${baseURL}/batch-deactivate`, stateCheckedRows);
      setStateCheckedRows([]);
      refetch();
    } catch (error) {
      console.error('Error batch deactivating:', error);
    }
  }, [stateCheckedRows, application.apiBaseURL, application.dataView.dataEndpoint, refetch]);

  const handleBatchRemove = useCallback(async () => {
    if (stateCheckedRows.length === 0) return;

    try {
      const baseURL = baseDaApp(application.apiBaseURL, application.dataView.dataEndpoint.replace('/query', ''));
      await api.post(`${baseURL}/batch-remove`, stateCheckedRows);
      setStateCheckedRows([]);
      refetch();
    } catch (error) {
      console.error('Error batch removing:', error);
    }
  }, [stateCheckedRows, application.apiBaseURL, application.dataView.dataEndpoint, refetch]);

  // --- Ações de LINHA -------------------------------------------------------------------------
  //
  // O modelo do back declara a ação (rótulo, ícone, endpoint, quando aparece); o motor a executa: POST
  // no endpoint com {id} = chave da linha, e recarrega a grade. Nenhum conhecimento da App aqui (CE-19).

  const executarRowAction = useCallback(async (
    pAction: XRowAction,
    pRowID: string,
    pCorpo: Record<string, unknown> = {},
    pRecarregarFormId?: string,
  ) => {
    try {
      const endpoint = pAction.endpoint.replace('{id}', pRowID);

      // Ação que devolve ARQUIVO (o back declara `returnsFile`): baixa-se o corpo e pronto — não há
      // desfecho a mostrar nem grade a recarregar. É como o documento auxiliar (DANFE/DANFSe) sai da
      // grade sem uma linha de código dedicada à App (CE-19).
      if (pAction.returnsFile) {
        const { blob, filename } = await api.downloadBlob(endpoint, {});

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      // O corpo é o que a ação COLETOU (quando ela declara campos); vazio, quando não coleta nada.
      const resposta = await api.post<Record<string, unknown>>(endpoint, pCorpo);

      // O back devolve o desfecho ({ mensagem }): mostrá-lo é o que diz ao usuário se a nota foi
      // autorizada ou recusada — e, sendo recusada, por quê.
      const mensagem = resposta?.mensagem ?? resposta?.message;
      if (typeof mensagem === 'string' && mensagem.length > 0)
        setRowActionResult(mensagem);

      refetch();

      // Ação de uma GRADE EMBUTIDA (baixa da parcela dentro do form): recarrega o FORM aberto, para a
      // parcela virar Baixada e a situação do título atualizar sem fechar o modal.
      if (pRecarregarFormId)
        await loadFormData(pRecarregarFormId);

      // A ação mudou o estado no back (uma baixa liquidou a parcela), então os LOOKUPS que dependem
      // desse estado ficaram obsoletos — o combo de "parcelas em aberto" ainda listava a que acabou de
      // ser baixada (staleTime de 1 min no useLookupSearch). Invalida todos os lookups para que a
      // próxima abertura re-busque do back; são leves e só re-carregam sob demanda (dono, 2026-08-23).
      void queryClient.invalidateQueries({ queryKey: ['lookup'] });
    } catch (error) {
      // A falha JÁ foi mostrada pelo diálogo global (ErrorModal), com a cor certa: aviso laranja para
      // falha de negócio, vermelho para erro/exceção. NÃO se abre um SEGUNDO diálogo aqui — dois diálogos
      // para a mesma falha confundem (dono, 2026-07-15). Aqui só se registra para diagnóstico.
      console.error('Error executing row action:', error);
    }
  }, [refetch, queryClient, loadFormData]);

  /**
   * O gesto tem até TRÊS etapas, e quem decide quais existem é o modelo do back (CE-19):
   *
   *   1. COLETA   — a ação declara campos (`fields`) ⇒ abre o modal genérico que os pede.
   *   2. CONFIRMA — a ação exige confirmação (`requiresConfirmation`) ⇒ pergunta antes de executar,
   *                 repetindo o aviso (é o portão de um ato irreversível, como o cancelamento fiscal).
   *   3. EXECUTA  — POST no endpoint, com o que se coletou como corpo.
   *
   * Ação sem campos e sem confirmação executa direto, como sempre.
   */
  const handleRowAction = useCallback((pAction: XRowAction, pRowID: string) => {
    // Leva o AppX ao nível, com a linha como registro: nada se posta.
    if (pAction.openLevel) {
      appX?.irPara(pAction.openLevel, pRowID);
      return;
    }

    if ((pAction.fields?.length ?? 0) > 0) {
      setRowActionForm({ action: pAction, rowID: pRowID });
      return;
    }

    if (pAction.requiresConfirmation) {
      setPendingRowAction({ action: pAction, rowID: pRowID, corpo: {} });
      return;
    }

    void executarRowAction(pAction, pRowID);
  }, [executarRowAction, appX]);

  // Ação por linha de uma GRADE EMBUTIDA (o "Baixar" na linha da parcela, dentro do form de título):
  // a "linha" é a parcela, e o {id} do endpoint sai de `endpointKeyField` sobre ela (não da KeyField da
  // App). Abre o mesmo modal de coleta (a parcela vem pré-preenchida/travada por bindings de `rowData`),
  // e marca `reloadFormAfter` para, ao confirmar, RECARREGAR o form aberto (a parcela vira baixada) em
  // vez de recarregar a grade principal. Delegado até aqui pelo XItemsGridEditor (CE-19).
  const handleGridRowAction = useCallback((pAction: XRowAction, pRow: Record<string, unknown>) => {
    const chave = pAction.endpointKeyField
      ? String(getFieldValue(pRow, pAction.endpointKeyField) ?? '')
      : '';
    setRowActionForm({ action: pAction, rowID: chave, rowData: pRow, reloadFormAfter: true });
  }, []);

  // Coletado o formulário: confirma (se a ação o exige) ou executa.
  const handleRowActionFormSubmit = useCallback((pValores: Record<string, unknown>) => {
    const pendente = rowActionForm;
    if (!pendente)
      return;

    setRowActionForm(null);

    if (pendente.action.requiresConfirmation) {
      setPendingRowAction({ action: pendente.action, rowID: pendente.rowID, corpo: pValores });
      return;
    }

    // Ação da grade embutida ⇒ ao terminar, recarrega o FORM aberto (não a grade). O id do form é o do
    // registro corrente (a linha selecionada que abriu o título).
    const recarregarForm = pendente.reloadFormAfter ? state.selectedRows[0] : undefined;
    void executarRowAction(pendente.action, pendente.rowID, pValores, recarregarForm);
  }, [rowActionForm, executarRowAction, state.selectedRows]);

  // Importacao de arquivo pela barra de botoes. Passa pelo useSeletorDeArquivo em vez de um
  // `input.click()` solto: o `<input type="file">` nao avisa cancelamento, e um caminho unico no
  // front evita que o proximo fluxo repita o defeito que travou o botao "Adicionar" dos
  // Certificados (2026-07-25). Aqui cancelar e inofensivo — nada foi armado antes de abrir —, e
  // por isso nao ha `onCancelar`.
  const seletorImportacao = useSeletorDeArquivo({
    onEscolher: (pArquivos) => setImportFiles(pArquivos),
  });

  const handleButtonAction = useCallback((pAction: XButtonAction, pButton: XButton) => {
    switch (pAction) {
      case XButtonAction.Create:
        if (application.canCreate)
          abrirCriacao(valoresIniciaisDeCriacao());
        break;

      // A guarda repete a do botão de propósito: o botão de editar não é oferecido numa linha travada,
      // mas a ação pode chegar aqui por outro caminho (atalho, botão declarado pela App). Quem decide
      // é a regra, não quem chamou.
      case XButtonAction.Edit:
        if (application.canEdit && !linhaSomenteLeitura(selectedRowData) && state.selectedRows.length === 1) {
          openFormModal(XApplicationMode.Edit);
          loadFormData(state.selectedRows[0]);
        }
        break;

      case XButtonAction.View:
        if (state.selectedRows.length === 1) {
          // A App pode declarar N visualizadores; o botão diz qual, pelo seu nome. Sem visualizador
          // declarado, o comportamento é o de sempre: o próprio formulário, em leitura.
          const viewer = application.viewers?.find((v) => v.key === pButton.name);
          if (viewer) {
            void abrirViewer(viewer, state.selectedRows[0]);
          } else {
            openFormModal(XApplicationMode.Detail);
            loadFormData(state.selectedRows[0]);
          }
        }
        break;

      // Ação da App sobre a linha selecionada (o botão é sintético; a ação é a do modelo). Daqui em
      // diante o caminho é o de sempre: coleta o que a ação pede, confirma, posta e recarrega.
      case XButtonAction.RowAction: {
        const acao = (application.dataView.rowActions ?? []).find((pA) => pA.name === pButton.name);
        if (acao && state.selectedRows.length === 1)
          handleRowAction(acao, state.selectedRows[0]);
        break;
      }

      case XButtonAction.Import:
        if (application.importEndpoint)
          seletorImportacao.abrir();
        break;

      case XButtonAction.Delete:
        void handleDelete();
        break;

      case XButtonAction.ToggleStatus:
        handleToggleStatus();
        break;

      case XButtonAction.Activate:
        handleBatchActivate();
        break;

      case XButtonAction.Deactivate:
        handleBatchDeactivate();
        break;

      case XButtonAction.RemoveChecked:
        handleBatchRemove();
        break;

      case XButtonAction.Refresh:
        refetch();
        break;

      case XButtonAction.Export:
        if (application.canExport)
          setIsExportDialogOpen(true);
        break;

      case XButtonAction.Print:
        if (application.canPrint) {
          // TODO: Implementar impressão
          console.log('Print');
        }
        break;

      case XButtonAction.Cancel:
        closeFormModal();
        break;

      case XButtonAction.Save:
        // Save is handled by the modal
        break;

      case XButtonAction.Search:
        handleSearch();
        break;

      case XButtonAction.Clear:
        handleClearFilters();
        break;

      case XButtonAction.Custom:
        if (XButtonActionRegistry.has(pButton.actionCommand))
          dispararAcaoCustom(pButton.actionCommand!);
        else
          console.log('Custom action (no handler registered):', pButton.actionCommand);
        break;

      case XButtonAction.Close:
        if (onClose)
          onClose();
        break;

      default:
        break;
    }
  }, [
    application.canCreate,
    application.canEdit,
    application.canDelete,
    application.canExport,
    application.canPrint,
    application.dataView.rowActions,
    application.importEndpoint,
    application.viewers,
    state.selectedRows,
    linhaSomenteLeitura,
    selectedRowData,
    handleDelete,
    handleRowAction,
    handleToggleStatus,
    handleBatchActivate,
    handleBatchDeactivate,
    handleBatchRemove,
    abrirViewer,
    openFormModal,
    abrirCriacao,
    closeFormModal,
    loadFormData,
    valoresIniciaisDeCriacao,
    refetch,
    handleSearch,
    handleClearFilters,
    onClose,
  ]);

  // ---------------------------------------------------------------------------
  // Handlers - Export
  // ---------------------------------------------------------------------------

  const currentFilters = useMemo((): XFilterInfo[] => {
    const filters: XFilterInfo[] = [];

    // Mesma chave do queryRequest: nome do EDITOR (ver o comentário lá). É o que o diálogo de
    // exportação recebe, para que o arquivo saia com os filtros que estão na tela.
    for (const [editorName, value] of Object.entries(state.filterValues)) {
      if (value === undefined || value === null || value === '')
        continue;

      const editor = application.dataView.filter.editors.find((e) => e.name === editorName);
      if (!editor)
        continue;

      filters.push({
        fieldName: editor.fieldName,
        operator: editor.defaultOperator ?? XFilterOperator.Contains,
        value: String(value),
      });
    }

    return filters;
  }, [state.filterValues, application.dataView.filter.editors]);

  const currentSort = useMemo((): XSortInfo[] => {
    if (!state.sortConfig)
      return [];

    return [{
      fieldName: state.sortConfig.field,
      direction: state.sortConfig.direction,
    }];
  }, [state.sortConfig]);

  const totalPages = useMemo(() => {
    if (totalCount === 0)
      return 1;
    return Math.ceil(totalCount / state.pageSize);
  }, [totalCount, state.pageSize]);

  const handleExport = useCallback(async (pRequest: XExportRequest) => {
    setIsExporting(true);

    try {
      // O endpoint de exportação é IRMÃO do de consulta: /stq/inventory/query → /stq/inventory/export.
      // Derivá-lo do dataEndpoint (e não do apiBaseURL) é o que faz a rota bater: o apiBaseURL de
      // alguns módulos já traz o prefixo "/api", que o cliente HTTP acrescenta de novo — o pedido
      // saía para /api/api/stq/export e nenhuma App conseguia exportar. O fallback cobre a App cujo
      // dataEndpoint não termine em /query.
      const dataEndpoint = application.dataView.dataEndpoint;
      const exportEndpoint = dataEndpoint.endsWith('/query')
        ? `${dataEndpoint.slice(0, -'/query'.length)}/export`
        : `${baseDaApp(application.apiBaseURL)}/export`;

      // Download the file
      const { blob, filename } = await api.downloadBlob(exportEndpoint, pRequest);

      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Close dialog after successful export
      setIsExportDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      // Error is handled by the global ErrorContext
    } finally {
      setIsExporting(false);
    }
  }, [application.apiBaseURL, application.dataView.dataEndpoint]);

  const handleExportCancel = useCallback(() => {
    setIsExportDialogOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const isFormModalOpen = state.currentMode !== XApplicationMode.List;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    // `overflow-x-auto`: um modal cujo PISO (soma das larguras mínimas dos editores da linha mais
    // larga) exceda a área do App ultrapassa o teto de 90% — e então é a ÁREA DO APP que rola
    // horizontalmente, em vez de o campo nascer menor que a sua máscara (FE-9).
    <div
      className="relative flex flex-col h-full bg-brand-surface overflow-x-auto"
      data-tab-id={tabID}
      data-application-id={application.id}
    >
      {/* Unified Header — always one row regardless of filter visibility.
          Order: [filter-editors] [🔍] [🧹] [spacer] [left-btns] [?help] [right-btns=Fechar] */}
      <div
        className="hidden sm:flex flex-wrap items-end px-2 sm:px-4 py-2 border-b border-border-light bg-brand-surface min-h-row gap-1 sm:gap-2"
        data-tour="header"
      >
        {/* Filter region — desktop only in header. On mobile it opens as a modal
            from the footer "Filtro" button. `hidden sm:contents` keeps desktop
            layout identical while removing it from the header on mobile. */}
        <div className="hidden sm:contents">
          {/* Filter editors inline (no outer wrapper) */}
          {application.dataView.filter.isVisible && (
            <XFilter
              filter={application.dataView.filter}
              values={state.filterValues}
              onChange={handleFilterChange}
              onSearch={handleSearch}
              embedded
            />
          )}

          {/* Search — immediately after filter editors, before spacer. Âmbar fixo em
              TODOS os temas: --brand-primary muda de matiz entre temas e o botão de
              pesquisa precisa de cor estável. */}
          {application.dataView.filter.isVisible &&
            application.dataView.filter.showSearchButton &&
            !application.dataView.filter.autoSearch && (
            <button
              type="button"
              onClick={handleSearch}
              title={'Pesquisar'}
              className="h-10 sm:h-8 sm:w-8 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-500 min-h-[44px] sm:min-h-[32px] px-3 sm:px-0"
            >
              <Search className="w-4 h-4" />
              <span className="sm:hidden text-ui">{'Pesquisar'}</span>
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-[8px]" />

        {/* Action buttons — desktop only in header. On mobile they move to the
            footer below pagination (see "Mobile action footer" below).
            `hidden sm:contents` keeps desktop layout identical (wrapper is
            transparent) while removing them from the header on mobile. */}
        <div className="hidden sm:contents">
          {/* Left-aligned action buttons (Novo, Exportar, etc.) */}
          <XButtonBar
            buttonBar={buttonBarComFechar}
            selectedCount={state.selectedRows.length}
            dataCount={data.length}
            onAction={handleButtonAction}
            permissions={application.permissions}
            mode={XApplicationMode.List}
            selectedRowData={selectedRowData}
            hasStateControl={application.hasStateControl}
            stateCheckedCount={stateCheckedRows.length}
            stateCheckedStatus={stateCheckedStatus}
            embedded
            embeddedSide="left"
          />


          {/* Right-aligned action buttons (Fechar) — always rightmost */}
          <XButtonBar
            buttonBar={buttonBarComFechar}
            selectedCount={state.selectedRows.length}
            dataCount={data.length}
            onAction={handleButtonAction}
            permissions={application.permissions}
            mode={XApplicationMode.List}
            selectedRowData={selectedRowData}
            hasStateControl={application.hasStateControl}
            stateCheckedCount={stateCheckedRows.length}
            stateCheckedStatus={stateCheckedStatus}
            embedded
            embeddedSide="right"
            // Ajuda: a documentação desta tela (abre na aba em foco, se houver). É o ÚLTIMO botão, à direita do
            // Fechar, encostado no limite da área (dono, 2026-10-21) — por isso vai no fim da barra da direita.
            slotNoFim={
              <button
                type="button"
                onClick={() => {
                  const abaEmFoco = document.querySelector(`[data-tab-id="${tabID}"] [role="tab"][aria-selected="true"]`)?.textContent?.trim() ?? '';
                  setAjuda((pAtual) => ({ aberta: !pAtual.aberta, aba: abaEmFoco }));
                }}
                // Destacado com o fundo da marca, como o "Nova conversa" da Jaci (dono, 2026-10-21).
                className={`flex items-center justify-center h-8 w-8 rounded-full bg-brand-primary text-white shadow-sm
                            hover:bg-brand-primary/90 active:scale-95 transition-all ${ajuda.aberta ? 'ring-2 ring-brand-primary/40 ring-offset-1 ring-offset-brand-surface' : ''}`}
                title={`Ajuda: documentação de ${application.title}`}
                aria-label={`Ajuda: documentação de ${application.title}`}
                aria-pressed={ajuda.aberta}
                data-testid="botao-ajuda"
              >
                <CircleHelp size={18} />
              </button>
            }
          />
        </div>
      </div>

      {/* Painel de ajuda: coluna à direita, contida na área do App (nunca cobre a casca nem as abas). */}
      {ajuda.aberta && (
        <XPainelAjuda app={application.name} tituloDaApp={application.title} aba={ajuda.aba} onFechar={() => setAjuda({ aberta: false, aba: '' })} />
      )}

      {/* Data View */}
      <div data-tour="data-grid" className="flex-1 min-h-0 overflow-auto">
        <XDataView
          dataView={application.dataView}
          data={data}
          isLoading={isReallyLoading}
          isFetching={isFetchingWithData}
          selectedRows={state.selectedRows}
          sortConfig={state.sortConfig}
          onSort={handleSort}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onDoubleClick={handleDoubleClick}
          hasStateControl={application.hasStateControl}
          stateCheckedRows={stateCheckedRows}
          onStateCheckRow={handleStateCheckRow}
          onStateCheckAll={handleStateCheckAll}
        />
      </div>

      {/* Pagination */}
      {application.dataView.pagination.isEnabled && (
        <div data-tour="pagination">
          <XPagination
            pagination={application.dataView.pagination}
            totalItems={totalCount}
            currentPage={state.currentPage}
            pageSize={state.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}

      {/* Mobile action footer — below pagination. Left: a "Filtro" button that
          opens the filter as a modal. Right: the action buttons (right-aligned,
          as before). Desktop keeps everything in the header. */}
      <div className="sm:hidden flex items-center gap-1 px-2 py-1 border-t border-border-light bg-brand-surface">
        {application.dataView.filter.isVisible && (
          <div className="relative">
            <button
              ref={mobileFilterBtnRef}
              type="button"
              onClick={() => { setMobileFilterZ(ZIndexManager.next()); setShowMobileFilter((v) => !v); }}
              title={'Pesquisa'}
              aria-label={'Pesquisa'}
              aria-expanded={showMobileFilter}
              aria-haspopup="true"
              className="inline-flex items-center justify-center gap-1.5 min-h-[33px] px-3 rounded-lg bg-brand-background hover:bg-hover text-brand-text-primary border border-border text-ui-sm font-medium"
            >
              <Search className="w-4 h-4" />
              <span>{'Pesquisa'}</span>
            </button>

            {/* Filter dropdown — opens UPWARD from the footer button (like the tab
                overflow dropdown). Anchored, click-outside to close, ZIndexManager z. */}
            {showMobileFilter && (
              <div
                ref={mobileFilterPanelRef}
                style={{ zIndex: mobileFilterZ }}
                className="absolute bottom-full left-0 mb-1 w-[min(92vw,360px)] max-h-[60vh] overflow-auto rounded-lg border border-border-light bg-brand-surface shadow-xl animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Close (icon-only) — top-right corner of the search panel */}
                <button
                  type="button"
                  onClick={() => setShowMobileFilter(false)}
                  title={'Fechar'}
                  aria-label={'Fechar'}
                  className="absolute top-1 right-1 z-10 min-h-touch min-w-touch flex items-center justify-center rounded-lg text-brand-text-muted hover:text-brand-text-primary hover:bg-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <XFilter
                  filter={application.dataView.filter}
                  values={state.filterValues}
                  onChange={handleFilterChange}
                  onSearch={() => { handleSearch(); setShowMobileFilter(false); }}
                  forceExpanded
                />
              </div>
            )}
          </div>
        )}

        {/* Action buttons — right-aligned */}
        <div className="ml-auto flex items-center gap-1">
          <XButtonBar
            buttonBar={buttonBarComFechar}
            selectedCount={state.selectedRows.length}
            dataCount={data.length}
            onAction={handleButtonAction}
            permissions={application.permissions}
            mode={XApplicationMode.List}
            selectedRowData={selectedRowData}
            hasStateControl={application.hasStateControl}
            stateCheckedCount={stateCheckedRows.length}
            stateCheckedStatus={stateCheckedStatus}
            embedded
            embeddedSide="left"
          />
          <XButtonBar
            buttonBar={buttonBarComFechar}
            selectedCount={state.selectedRows.length}
            dataCount={data.length}
            onAction={handleButtonAction}
            permissions={application.permissions}
            mode={XApplicationMode.List}
            selectedRowData={selectedRowData}
            hasStateControl={application.hasStateControl}
            stateCheckedCount={stateCheckedRows.length}
            stateCheckedStatus={stateCheckedStatus}
            embedded
            embeddedSide="right"
          />
        </div>
      </div>

      {/* Import: input fora da árvore visível, acionado pelo botão de ação Import. Um arquivo por
          requisição — é o que permite dizer qual entrou e qual falhou. */}
      {application.importEndpoint && (
        <>
          {/* Oculto, mas com testid: é por ele que o e2e entrega os arquivos (`setInputFiles`),
              já que o diálogo de arquivos do sistema operacional não é automatizável. */}
          <input
            ref={seletorImportacao.ref}
            type="file"
            multiple
            className="hidden"
            onChange={seletorImportacao.aoMudar}
            data-testid="import-file-input"
          />
          <XImportDialog
            isOpen={importFiles.length > 0}
            endpoint={application.importEndpoint}
            files={importFiles}
            onClose={() => setImportFiles([])}
            onFinished={() => { void refetch(); }}
          />
        </>
      )}

      {/* Visualizador ativo (a App declara N). Somente leitura: abas quando o modelo as traz. */}
      {activeViewer && (
        activeViewer.tabbedFormView ? (
          <XTabbedFormModal
            formView={activeViewer.tabbedFormView}
            mode={XApplicationMode.Detail}
            data={viewerData}
            isOpen
            isLoading={isViewerLoading}
            isSaving={false}
            onSave={fecharViewer}
            onCancel={fecharViewer}
            parentID={state.selectedRows.length === 1 ? state.selectedRows[0] : undefined}
          />
        ) : activeViewer.formView ? (
          <XFormModal
            formView={activeViewer.formView}
            mode={XApplicationMode.Detail}
            data={viewerData}
            isOpen
            isLoading={isViewerLoading}
            isSaving={false}
            onSave={fecharViewer}
            onCancel={fecharViewer}
            onExportPDF={
              activeViewer.exportEndpoint && state.selectedRows.length === 1
                ? () => { void exportarViewer(activeViewer, state.selectedRows[0]); }
                : undefined
            }
            isExportingPDF={isExportandoViewer}
          />
        ) : null
      )}

      {/* Export Dialog - Rendered within Tab scope */}
      {application.canExport && (
        <XExportDialog
          config={application.exportConfig}
          isOpen={isExportDialogOpen}
          isExporting={isExporting}
          totalRecords={totalCount}
          totalPages={totalPages}
          currentFilters={currentFilters}
          currentSort={currentSort}
          logicalOperator={XFilterLogicalOperator.And}
          pageSize={state.pageSize}
          onExport={handleExport}
          onCancel={handleExportCancel}
        />
      )}

      {/* Form Modal - Rendered within Tab scope */}
      {/* Uses TabbedFormModal if tabbedFormView is defined, otherwise standard FormModal */}
      {application.tabbedFormView ? (
        <XTabbedFormModal
          formView={application.tabbedFormView}
          mode={state.currentMode}
          data={formData}
          isOpen={isFormModalOpen}
          isLoading={isFormLoading}
          isSaving={isFormSaving}
          onSave={handleFormSave}
          onCancel={closeFormModal}
          serverErrors={serverErrors}
          parentID={state.selectedRows.length === 1 ? state.selectedRows[0] : undefined}
          // RELER O REGISTRO SEM FECHAR O MODAL (dono, 2026-09-17). Uma aba pode disparar operação
          // que o BACK usa para gravar campos de OUTRAS abas: subir o certificado faz a Secretaria da
          // Fazenda devolver a Inscrição Estadual, que é gravada na aba Empresa. Sem reler, o
          // formulário continuava com a inscrição VAZIA que carregou, e o Salvar a escrevia por cima
          // da correta — o dado certo era apagado pelo estado obsoleto da tela.
          //
          // É o mesmo gesto que a ação de grade embutida já usa (ver pRecarregarFormId acima).
          onReloadForm={state.selectedRows.length === 1
            ? () => loadFormData(state.selectedRows[0])
            : undefined}
        />
      ) : (
        <XFormModal
          formView={application.formView}
          mode={state.currentMode}
          data={formData}
          isOpen={isFormModalOpen}
          isLoading={isFormLoading}
          isSaving={isFormSaving}
          onSave={handleFormSave}
          onCancel={closeFormModal}
          serverErrors={serverErrors}
          onGridRowAction={handleGridRowAction}
          // O registro aberto resolve o `{id}` do recálculo do formulário; na inclusão não há registro.
          recordID={state.currentMode !== XApplicationMode.Create ? idDoFormulario : undefined}
        />
      )}

      {/* Custom button-bar action (e.g. create company from certificate) */}
      {(() => {
        const ActionComp = XButtonActionRegistry.resolve(customAction?.command);
        if (!ActionComp || !customAction)
          return null;
        return (
          <ActionComp
            // A chave inclui o nonce: reclicar o mesmo botão REMONTA a ação, em vez de reaproveitar
            // uma instância cujo efeito de montagem já correu. Ver o comentário do estado.
            key={`${customAction.command}#${customAction.nonce}`}
            application={application}
            selectedRow={selectedRowData}
            onComplete={(pInitialData) => {
              setCustomAction(null);
              // O que a ação trouxe MANDA sobre o padrão: ela já apurou o caso concreto, e o
              // padrão é só o ponto de partida de quem abre o formulário em branco.
              abrirCriacao({ ...valoresIniciaisDeCriacao(), ...pInitialData });
            }}
            onCancel={() => setCustomAction(null)}
            onDone={() => { setCustomAction(null); refetch(); }}
          />
        );
      })()}

      {/* Coleta da ação de linha: os campos que o back declarou (motivo, justificativa…). */}
      {rowActionForm && (
        <XRowActionFormModal
          action={rowActionForm.action}
          rowID={rowActionForm.rowID}
          rowData={rowActionForm.rowData ?? selectedRowData ?? undefined}
          onSubmit={handleRowActionFormSubmit}
          onCancel={() => setRowActionForm(null)}
        />
      )}

      {/* Confirmação da ação de linha (o modelo do back diz se ela é exigida e qual a mensagem). O
          AVISO, quando existe, é repetido aqui: é o último portão antes de um ato irreversível. */}
      {pendingRowAction && (
        <XConfirmModal
          // O título diz O QUE está em jogo ("Cancelamento de NFS-e"), não o rótulo curto do botão
          // ("Cancelar"). O botão de confirmar diz "Confirmar", e o de desistir, "Cancelar": com o
          // rótulo da ação nos dois, o diálogo teria dois botões escritos "Cancelar", com sentidos
          // opostos.
          title={pendingRowAction.action.formTitle || (pendingRowAction.action.title ?? '')}
          message={[
            (pendingRowAction.action.confirmMessage ?? ''),
            pendingRowAction.action.warningMessage
              ? (pendingRowAction.action.warningMessage ?? '')
              : '',
          ].filter(Boolean).join('\n\n')}
          confirmText={'Confirmar'}
          cancelText={'Cancelar'}
          onConfirm={() => {
            const pendente = pendingRowAction;
            setPendingRowAction(null);
            void executarRowAction(pendente.action, pendente.rowID, pendente.corpo);
          }}
          onCancel={() => setPendingRowAction(null)}
        />
      )}

      {/* Desfecho da ação: o que o back respondeu (nota autorizada, ou o motivo da recusa). */}
      {rowActionResult && (
        <XConfirmModal
          title={'Detalhes'}
          message={rowActionResult}
          confirmText={'Fechar'}
          onConfirm={() => setRowActionResult(null)}
        />
      )}
    </div>
  );
}
