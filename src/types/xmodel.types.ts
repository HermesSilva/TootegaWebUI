/**
 * Tootega XModel Types
 * 
 * Definições de tipos para o sistema de templates dinâmicos Model-Driven UI.
 * Estas interfaces espelham os modelos C# do backend em Tootega.Core.Model.
 */

import type { XWorkspaceView } from './workspace.types';
import type { XNavigatorView } from './navigator.types';

// ============================================================================
// Application Mode
// ============================================================================

export enum XApplicationMode {
  List = 1,
  Detail = 2,
  Edit = 3,
  Create = 4,
}

// ============================================================================
// View Template — controls which structural components are rendered
// ============================================================================

export enum XViewTemplate {
  /** Standard CRUD: ButtonBar + Filter + DataGrid + Pagination + FormModal + Export + Tour. */
  DataGrid = 1,
  /** Custom content: Filter + custom component (no ButtonBar, DataGrid, Pagination, FormModal, or Export). */
  Custom = 2,
  /** Dashboard: fully custom content area (no Filter, ButtonBar, DataGrid, or FormModal). */
  Dashboard = 3,
  /** SingleForm: um formulário genérico para UM registro (o do contexto — inquilino/empresa),
   *  sem grade, sem seleção e sem modal. Carrega do loadEndpoint (GET sem id) e grava no
   *  saveEndpoint (PUT). Usado em telas de configuração; segue dirigido por dados (CE-19). */
  SingleForm = 4,
  /** Painel de trabalho: cabeçalho do registro, uma aba por sub-App (podadas pelo back), a faixa "precisa de
   *  você" e, no corpo, a sub-App da aba ativa. Contrato em `workspace.types.ts` (dono, 2026-10-25). */
  Workspace = 5,
  /** Navegador: à esquerda, a lista do que se gerencia, em grupos; à direita, a App do elemento escolhido, dentro da
   *  área desta. Contrato em `navigator.types.ts` (dono, 2026-10-26). */
  Navigator = 6,
  /** Formulário de configuração: o registro do contexto como o formulário único, mas fluido — na largura declarada
   *  (`modalWidth`, % da área), com o Salvar logo abaixo dos campos, ativo só quando há alteração (dono, 2026-10-26). */
  SettingsForm = 7,
  /** Lista de cartões: cada registro da consulta num cartão, com o formulário da App editável no lugar e o Salvar só
   *  quando há alteração; a inclusão vem do "+" do elemento de navegador. Contrato em `XCardListView` (dono, 2026-10-26). */
  CardList = 8,
}

/**
 * A LISTA DE CARTÕES (`XViewTemplate.CardList` — dono, 2026-10-26): a consulta de sempre (`dataView.dataEndpoint`) dá as
 * linhas; cada linha vira um cartão que carrega o seu registro de `formView.loadEndpoint` (`{id}` pela
 * `dataView.keyField`) e grava com PUT em `formView.saveEndpoint`.
 */
export interface XCardListView {
  /** Campo da linha da consulta que dá o título do cartão (o nome). */
  titleField: string;
  /** Campo da linha que vem à frente do título, em destaque (o código). Vazio ⇒ só o título. */
  subtitleField: string;
  /** Quantos cartões a consulta traz por vez; havendo mais, a tela oferece "Mostrar mais". */
  pageSize: number;
}

// ============================================================================
// Data Types
// ============================================================================

export enum XDataType {
  String = 1,
  Integer = 2,
  Decimal = 3,
  Date = 4,
  DateTime = 5,
  Time = 6,
  Boolean = 7,
  Currency = 8,
  Percentage = 9,
  Email = 10,
  Phone = 11,
  URL = 12,
  CPF = 13,
  CNPJ = 14,
  CEP = 15,
  Custom = 99,
}

// ============================================================================
// Field Alignment
// ============================================================================

export enum XFieldAlignment {
  Left = 1,
  Center = 2,
  Right = 3,
}

// ============================================================================
// Sort Direction
// ============================================================================

export enum XSortDirection {
  None = 0,
  Ascending = 1,
  Descending = 2,
}

// ============================================================================
// Button Types
// ============================================================================

export enum XButtonType {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Warning = 5,
  Info = 6,
  Link = 7,
  Icon = 8,
}

// ============================================================================
// Button Color (paleta SEMÂNTICA)
// ============================================================================

/**
 * Papel SEMÂNTICO de cor do botão. O botão escolhe o papel; a cor concreta vive num lugar só,
 * no mapa `xButtonPalette.ts` do Core — assim o mesmo papel produz o mesmo tom em QUALQUER App
 * (dono, 2026-08-13). Espelha o enum `XButtonColor` do back. Botão canônico (por `action`) já
 * carrega o papel certo; só o botão `Custom` precisa declarar, e sem declaração cai em `Neutral`.
 */
export enum XButtonColor {
  Default = 0,
  Create = 1,
  Edit = 2,
  Read = 3,
  Export = 4,
  Neutral = 5,
  Close = 6,
  Danger = 7,
  Warning = 8,
  Highlight = 9,
  Document = 10,
}

// ============================================================================
// Button Actions
// ============================================================================

export enum XButtonAction {
  None = 0,
  Create = 1,
  Edit = 2,
  Delete = 3,
  Save = 4,
  Cancel = 5,
  Refresh = 6,
  Export = 7,
  Import = 8,
  Print = 9,
  Search = 10,
  Clear = 11,
  Close = 12,
  ToggleStatus = 13,
  Activate = 14,
  Deactivate = 15,
  View = 16,
  /** Remove (hard delete) the rows checked in the state-control column (batch). */
  RemoveChecked = 17,
  /**
   * Executa uma XRowAction sobre a LINHA SELECIONADA. O botão é SINTÉTICO: o motor o cria a partir da
   * ação declarada em `dataView.rowActions` — nenhuma App o declara. As ações da App vivem na BARRA,
   * não dentro da linha da grade (dono, 2026-07-13).
   */
  RowAction = 18,
  Custom = 99,
}

// ============================================================================
// Button Alignment
// ============================================================================

export enum XButtonAlignment {
  Left = 1,
  Right = 2,
}

// ============================================================================
// Button Bar Position
// ============================================================================

export enum XButtonBarPosition {
  Top = 1,
  Bottom = 2,
  Left = 3,
  Right = 4,
}

// ============================================================================
// Filter Layout
// ============================================================================

export enum XFilterLayout {
  Horizontal = 1,
  Vertical = 2,
  Grid = 3,
}

// ============================================================================
// Filter Logical Operator
// ============================================================================

export enum XFilterLogicalOperator {
  And = 1,
  Or = 2,
}

// ============================================================================
// Filter Operators
// ============================================================================

export enum XFilterOperator {
  Equal = 1,
  NotEqual = 2,
  Contains = 3,
  NotContains = 4,
  StartsWith = 5,
  EndsWith = 6,
  GreaterThan = 7,
  GreaterThanOrEqual = 8,
  LessThan = 9,
  LessThanOrEqual = 10,
  Between = 11,
  In = 12,
  NotIn = 13,
  IsNull = 14,
  IsNotNull = 15,
}

// ============================================================================
// Row Selection Mode
// ============================================================================

export enum XRowSelectionMode {
  None = 0,
  Single = 1,
  Multiple = 2,
}

// ============================================================================
// Editor Types
// ============================================================================

export enum XUIEditorType {
  Text = 1,
  TextArea = 2,
  Number = 3,
  Date = 4,
  DateTime = 5,
  Time = 6,
  Boolean = 7,
  ComboBox = 8,
  RadioButton = 9,
  Checkbox = 10,
  FileUpload = 11,
  ColorPicker = 12,
  DataLookup = 13,
  AutoComplete = 14,
  Password = 15,
  Email = 16,
  Phone = 17,
  Currency = 18,
  CPF = 19,
  CNPJ = 20,
  CEP = 21,
  Slider = 22,
  Rating = 23,
  Hidden = 24,
  Percent = 25,
  URL = 26,
  MultiSelect = 27,
  /** Imagem com prévia: confere tipo/tamanho na escolha e permite remover (manda o sentinela `-`). */
  ImageUpload = 28,
  /** JSON formatado e colorido, ocupando a altura disponível. Só leitura (auditoria). */
  JSON = 29,
  /** Demonstrativo: conta em linhas tipadas (XLinhaDemonstrativo), rótulo à esquerda e valor à direita. Só leitura. */
  Statement = 30,
}

/** Como uma linha de demonstrativo se desenha (espelho de `XEstiloLinhaDemonstrativo`). */
export enum XEstiloLinhaDemonstrativo {
  Informacao = 0,
  Principal = 1,
  Deducao = 2,
  Resultado = 3,
  Nota = 4,
  Aviso = 5,
}

/** Uma linha do valor de um editor `Statement` (espelho de `XLinhaDemonstrativo`). */
export interface XLinhaDemonstrativo {
  rotulo: string;
  detalhe: string;
  valor?: number | null;
  estilo: XEstiloLinhaDemonstrativo;
  textoValor: string;
}

// ============================================================================
// Base Model
// ============================================================================

export interface XModel {
  id: string;
  name: string;
  title: string;
  description: string;
  isVisible: boolean;
  isEnabled: boolean;
  order: number;
  cssClass: string;
}

// ============================================================================
// Lookup Item (para ComboBox, DataLookup, RadioButton, etc.)
// Suporta múltiplas colunas e binding de múltiplos campos
// ============================================================================

export interface XLookupItem {
  value: string;
  text: string;
  /**
   * Sigla do item ("NF-e", "UN", "SP"), vinda do back separada do `text` porque cada uma tem o seu
   * uso: quem exibe compõe `SIGLA - texto` (ver `lookupLabel`), e quem filtra usa a sigla.
   * Vazia/ausente quando o item não tem sigla.
   */
  acronym?: string;
  group: string;
  isDisabled: boolean;
  columns?: Record<string, unknown>;
}

// ============================================================================
// Lookup Column (definição de coluna para ComboBox/Lookup multi-coluna)
// ============================================================================

export interface XLookupColumn {
  fieldName: string;
  title: string;
  width: number;
  alignment: XFieldAlignment;
  isVisible: boolean;
}

// ============================================================================
// Field Binding (mapeamento de campos ao selecionar item)
// ============================================================================

export interface XFieldBinding {
  sourceField: string;
  targetField: string;
  /**
   * A consulta não trouxe o valor ⇒ LIMPA o destino, em vez de deixar o que lá estava. Falso (padrão)
   * preenche o que veio e não apaga o resto — é o que quase todo vínculo quer. Verdadeiro é para o
   * campo que pertence à consulta, não ao usuário: senão, trocar um documento achado por um
   * não-achado deixaria na tela o nome do documento anterior.
   */
  clearWhenAbsent?: boolean;
}

// ============================================================================
// XButton
// ============================================================================

export interface XButton extends XModel {
  icon: string;
  tooltip: string;
  /** Papel semântico de cor (paleta). Resolvido pelo mapa do Core; ver `xButtonPalette.ts`. */
  color: XButtonColor;
  buttonType: XButtonType;
  action: XButtonAction;
  actionCommand: string;
  confirmMessage: string;
  requiresSelection: boolean;
  /**
   * Campo da LINHA SELECIONADA que condiciona a exibição do botão, com `visibleWhenValues`. Vazio ⇒
   * sempre visível. Esconde (não desabilita): no estado errado a ação não se aplica àquela linha, e
   * mostrá-la cinzenta ofereceria o que nunca funcionaria ali.
   */
  visibleWhenField?: string;
  /** Valores do `visibleWhenField` que fazem o botão aparecer. */
  visibleWhenValues?: string[];
  requiresConfirmation: boolean;
  /** A ação exige EMPRESA CORRENTE: sem empresa escolhida o botão é renderizado desabilitado. */
  requiresCompany: boolean;
  shortcut: string;
  permission: string;
  alignment: XButtonAlignment;
}

// ============================================================================
// XButtonBar
// ============================================================================

export interface XButtonBar extends XModel {
  buttons: XButton[];
  position: XButtonBarPosition;
  showLabels: boolean;
  showIcons: boolean;
  separator: string;
}

// ============================================================================
// XDataField
// ============================================================================

export interface XDataField extends XModel {
  fieldName: string;
  dataType: XDataType;
  alignment: XFieldAlignment;
  width: number;
  minWidth: number;
  maxWidth: number;
  format: string;
  mask: string;
  isSortable: boolean;
  sortDirection: XSortDirection;
  sortOrder: number;
  isResizable: boolean;
  isFixed: boolean;
  nullText: string;
}

// ============================================================================
// XUIEditorModel
// ============================================================================

/**
 * ÊNFASE de um campo de relatório (dono, 2026-10-13): a COR do valor pelo seu papel — o back declara
 * "este é o total", "isto favorece quem lê", "isto pede atenção"; o front pinta pela paleta. Espelha
 * o enum `XUIEmphasis` do back.
 */
export enum XUIEmphasis {
  None = 0,
  Primary = 1,
  Success = 2,
  Warning = 3,
  Danger = 4,
}

export interface XUIEditorModel extends XModel {
  editorType: XUIEditorType;
  /** Optional: render this field with a registered custom editor component (XFieldEditorRegistry). */
  customEditorName?: string;
  placeholderText: string;
  validationPattern: string;
  validationMessage: string;
  defaultValue: string;
  hintText: string;
  isReadOnly: boolean;
  /** O botão ao lado do campo COPIA o valor e nunca o abre (o endereço de clone — dono, 2026-10-26). */
  copiavel?: boolean;
  // Travado enquanto TEM valor (editável quando vazio): o campo que outro preenche por ligação e não
  // se troca depois — a conta da baixa, vinda do boleto da parcela. Difere de isReadOnly (sempre travado).
  readOnlyWhenFilled?: boolean;
  isRequired: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  tabIndex: number;
  /**
   * Exceção à escala de largura (FE-8): o campo aceita ficar mais estreito que o mínimo do seu tipo
   * de editor — trunca em vez de exigir espaço. Sai do piso do modal (FE-9) e do teste da escala.
   */
  allowTruncate: boolean;
  /** Altura do TextArea em LINHAS. 0/ausente ⇒ o padrão (3). Só afeta o TextArea. */
  rows?: number;
  /**
   * O campo ABSORVE a sobra vertical do formulário: cresce e encolhe com a janela em vez de ter
   * altura fixa. Para o conteúdo sem tamanho previsível — o rastro de uma exceção, o corpo de uma
   * requisição —, que numa caixa de três linhas rola por dentro enquanto sobra meia tela em volta.
   * Declarado pelo back (CE-19), nunca inferido do tipo: uma observação curta é TextArea igual.
   * Quando presente, manda sobre o `rows` — quem se ajusta à janela não conta linhas.
   */
  fillsHeight?: boolean;
  /**
   * DOCUMENTO DE APOIO: botão à direita do rótulo que abre, numa janela arrastável contida na área do
   * App, o PDF devolvido por este endpoint (POST; `{id}` = registro-pai, `{rowId}` = linha).
   */
  documentEndpoint?: string;
  /** Rótulo do botão do documento de apoio. */
  documentButtonTitle?: string;
  /** Título da janela do documento de apoio. */
  documentWindowTitle?: string;
  /**
   * Largura mínima do editor em pixels (FE-8) — a máscara não encolhe. Vem da tabela única do back
   * (XEscalaFormulario); o front não mantém tabela própria. Zero = sem mínimo (o campo trunca), e é
   * também o que o back publica quando `allowTruncate` está ligado.
   */
  minWidth: number;

  // Lookup/ComboBox configuration
  lookupEndpoint: string;
  /**
   * Campo do FORMULÁRIO que guarda o TEXTO do valor escolhido (o lookup guarda a chave). Sem ele, ao
   * editar um registro a tela mostraria a chave crua ("9") em vez do nome.
   */
  displayValueField?: string;
  /**
   * Endpoint de DETALHE do item escolhido: `GET {detailEndpoint}/{valor}` após a seleção, com os
   * `fieldBindings` aplicados sobre a RESPOSTA. Serve ao dado que só se conhece depois da escolha —
   * a alíquota do ISSQN do serviço no município da empresa, por exemplo.
   */
  detailEndpoint?: string;
  lookupDisplayField: string;
  lookupValueField: string;
  lookupItems: XLookupItem[];
  lookupColumns: XLookupColumn[];
  lookupShowHeader: boolean;
  lookupMinSearchLength: number;
  lookupSearchDelay: number;
  // Ao abrir, se a busca vazia devolver UM único item, o editor o seleciona sozinho (e aplica os
  // fieldBindings). Serve à escolha que não é escolha — uma conta de cobrança só. Exige
  // lookupMinSearchLength = 0. Mais de um item ⇒ nada é pré-selecionado.
  lookupAutoSelectSingle?: boolean;
  isMultiSelect?: boolean;
  fieldBindings: XFieldBinding[];

  // Document (CPF/CNPJ) configuration
  documentAllowCPF: boolean;
  documentAllowCNPJ: boolean;
  /**
   * Campo do formulário que recebe o TIPO derivado do documento: o editor distingue CPF de CNPJ pelo
   * conteúdo e escreve ali `documentTypeCPFValue` ou `documentTypeCNPJValue`. Vazio ⇒ não deriva.
   */
  documentTypeField?: string;
  documentTypeCPFValue?: string;
  documentTypeCNPJValue?: string;
  /**
   * Valor escrito em `documentTypeField` quando o documento fica VAZIO. Vazio ⇒ apagar o documento
   * não mexe no campo derivado. Existe porque o tipo é derivado do documento: sem documento, o tipo
   * que sobrou é o do anterior, e tudo que dependa dele seguiria regido por um dado que saiu da tela.
   */
  documentTypeEmptyValue?: string;

  /**
   * Editor de CEP: campo do formulário que recebe o FOCO após a consulta preencher o endereço — o
   * NÚMERO, único dado que o CEP não traz. O editor acha o campo pelo atributo `name` e o foca. Vazio ⇒
   * não foca nada. Serve à diretiva "o sistema não deixa o usuário errar".
   */
  cepNumberField?: string;

  /** Ênfase (cor) do valor num campo de relatório — ver XUIEmphasis. Só o XReportFieldEditor a lê. */
  emphasis?: XUIEmphasis;
  /** Escala do corpo do valor no campo de relatório: 0 normal, 1 maior, 2 o maior. */
  emphasisScale?: number;

  // Number/Currency/Percent configuration
  decimalPlaces?: number;
  percentStoreAsDecimal?: boolean;

  // Boolean configuration
  booleanStyle?: 'checkbox' | 'toggle' | 'radio';
  booleanTrueLabel?: string;
  booleanFalseLabel?: string;

  // Editable items-grid configuration (XItemsGridEditor): the columns of each row. The field value
  // is an array of row objects; each column edits one property by fieldName. Generic (CE-19).
  gridColumns?: XUIGridColumn[];
  // Ações POR LINHA da grade embutida (botão "Baixar" na linha da parcela). O front renderiza uma
  // coluna de ação; ao clicar, delega ao pai (XApplicationView) para abrir o modal e recarregar o form.
  gridRowActions?: XRowAction[];
  /**
   * Cálculo comercial AO VIVO da grade (preço líquido de linha): declarado, o grid deriva a coluna
   * que falta e trava o inválido a cada digitação, tudo por nome de coluna (CE-19). Ver XUIGridPricing.
   */
  pricing?: XUIGridPricing;
  /**
   * Cálculo de DIFERENÇA ao vivo da grade (resultado = minuendo − subtraendo), por nome de coluna.
   * Nulo ⇒ a grade não calcula diferença. Ver `XUIGridDifference`.
   */
  difference?: XUIGridDifference;
  /**
   * Endpoint de SELEÇÃO da grade de itens: preenchido, "Novo" abre um diálogo de busca (grade +
   * pesquisa) que consulta este endpoint (contrato de lookup), e o item escolhido vira uma linha nova
   * — os `fieldBindings` copiam value/text/group para as colunas. Vazio ⇒ "Novo" adiciona linha vazia.
   */
  itemPickerEndpoint?: string;

  /**
   * PICKER DE REGISTRO do campo: declarado, o editor ganha uma lupa que abre um diálogo de busca
   * (vários critérios em cima, grade de resultados embaixo). O registro escolhido preenche o campo
   * (por `pickerValueField`) e os demais campos do formulário pelos `fieldBindings`.
   *
   * Difere do `lookupEndpoint` do editor de documento, que consulta UM documento já digitado: aqui o
   * usuário ainda não sabe o documento — é o que ele veio procurar. Vazio ⇒ o editor não tem lupa.
   */
  pickerEndpoint?: string;
  /** Título do diálogo, escrito no back. Vazio ⇒ o título padrão do front. */
  pickerTitle?: string;
  /** Campo do item escolhido que vira o VALOR do editor. Vazio ⇒ `value`, o do contrato de lookup. */
  pickerValueField?: string;
  /** Critérios de busca, na ordem em que aparecem. Vazio ⇒ um campo de pesquisa livre (`searchText`). */
  pickerSearchFields?: XUIPickerSearchField[];
  /** Texto-guia do campo de pesquisa livre: diz por ONDE ele procura. Vazio ⇒ o padrão do front. */
  pickerSearchPlaceholder?: string;
  /** Colunas da grade de resultados. Vazio ⇒ o formato do contrato de lookup (código/descrição/detalhe). */
  pickerColumns?: XUIGridColumn[];
  /**
   * O picker escolhe VÁRIOS registros de uma vez (dono, 2026-09-20): coluna de marcação, seleção que
   * sobrevive à filtragem, e um botão que confirma acrescentando todas as linhas marcadas.
   *
   * Falso por padrão, e quem decide é o BACK (CE-19): serve a quem monta uma LISTA (correção de
   * estoque), não a quem monta documento linha a linha, onde cada item ainda leva quantidade e preço.
   */
  pickerMultiSelect?: boolean;
  /**
   * O que o picker leva do FORMULÁRIO como filtro fixo (dono, 2026-10-17): cada vínculo copia o valor
   * corrente do campo `sourceField` do formulário para a chave `targetField` de `filters`, em toda
   * busca do diálogo e nas opções dos critérios combinados. Campo vazio não vira filtro. Nasceu na
   * devolução: o destinatário escolhido na primeira aba filtra as notas de origem na aba de itens.
   */
  pickerContextBindings?: XFieldBinding[];

  /**
   * Tipos aceitos pelos editores de arquivo/imagem (atributo `accept`, ex.: "image/png,image/jpeg").
   * Vem do MODELO DO BACK (CE-19) — quem sabe o que serve é ele; a tela só honra. Vazio = qualquer um.
   */
  accept?: string;
  /** Teto de bytes do arquivo. Zero = sem teto. O back revalida ao gravar — o limite aqui é conveniência. */
  maxSizeBytes?: number;
}

// ============================================================================
// XUIPickerSearchField — um critério de busca do diálogo de picker
// ============================================================================

/**
 * Um critério do diálogo de picker: vira um campo na tela e uma chave em `filters` na requisição,
 * com o MESMO `fieldName` dos dois lados — é o back quem declara e é o back quem lê.
 */
export interface XUIPickerSearchField {
  fieldName: string;
  /** Rótulo exibido, escrito no back. */
  title: string;
  /**
   * `text` (livre), `document` (mascara CPF/CNPJ e manda os caracteres crus) ou `combo` (lista de
   * opções carregada de `optionsEndpoint`; a escolhida viaja em `filters` pelo `fieldName`).
   */
  editorType?: string;
  /**
   * Critério COMBINADO (dono, 2026-10-17): endpoint de lookup das opções (`POST { searchText: "",
   * filters } → { items: [{ value, text }] }`), chamado com os filtros de contexto do formulário.
   * É a nota de origem da devolução: as saídas para o destinatário já escolhido.
   */
  optionsEndpoint?: string;
  /**
   * Texto-guia, escrito no back: `placeholder` do campo digitado; no combinado, o rótulo da opção
   * VAZIA ("Todas as notas do destinatário").
   */
  placeholder?: string;
}

// ============================================================================
// XUIGridColumn — one editable column of the items-grid editor
// ============================================================================

export interface XUIGridColumn {
  /** Property edited in each row object. */
  fieldName: string;
  /** Column header text, written by the backend. */
  title: string;
  /**
   * Como a célula é editada e exibida. `combo` rende as `options` do modelo; `document`, `phone`,
   * `cep` e `cnae` guardam o dado CRU e apenas o exibem com máscara.
   *
   * Numéricos: `currency` (moeda) e `number` (decimal) editam como o XCurrencyEditor — formatam,
   * alinham à direita e NÃO têm spin; só `integer` (inteiro) mantém o spin do <input type="number">.
   */
  editorType:
    | 'text' | 'number' | 'integer' | 'currency' | 'date' | 'checkbox' | 'combo'
    | 'document' | 'phone' | 'cep' | 'cnae' | 'citypicker'
    // `picker`: lupa genérica de registro (FK + exibição pelos vínculos); `plate`: placa de veículo
    // (7 posições cruas, hífen só na exibição do padrão antigo). Ambos de 2026-10-11.
    | 'picker' | 'plate';
  /** Largura percentual da coluna DENTRO da sua `row`. */
  width: number;
  /**
   * Linha em que a coluna aparece dentro de cada item (0 = primeira). Todas em zero ⇒ tabela comum;
   * havendo linha > 0, cada item ocupa várias fileiras (cadastro largo, como o endereço).
   */
  row?: number;
  /** Opções da célula quando `editorType` é `combo`: value = código; text = rótulo exibido. */
  options?: XLookupItem[];
  /**
   * Coluna SÓ-LEITURA: a célula é exibida mas não aceita digitação (o valor ainda entra por
   * vínculo/cálculo — número sequencial, descrição do produto, preço unitário). Difere do
   * `isReadOnly` do editor, que trava a grade inteira; aqui é por coluna.
   */
  readOnly?: boolean;
  /**
   * Campo do FORMULÁRIO (não da linha) que decide se a coluna EXISTE: verdadeiro ⇒ aparece; falso ou ausente ⇒
   * some, com cabeçalho e tudo. Vazio ⇒ sempre visível. Costuma ser um valor de contexto (`contextEndpoint`).
   */
  visibleWhenField?: string;
  /** Campo do FORMULÁRIO que torna a coluna só-leitura quando verdadeiro. Soma-se a `readOnly`. */
  readOnlyWhenField?: string;
  /**
   * Casas decimais da célula numérica (`currency`/`number`). Ausente ou 0 ⇒ o padrão da moeda, DUAS.
   * Existe porque nem toda quantidade é moeda: peça inteira se lê `25`, não `25,00`.
   */
  decimalPlaces?: number;
  /**
   * Coluna do NÚMERO DE ORDEM do item: a célula mostra a POSIÇÃO da linha (índice + 1), sempre
   * começando em 1, não um valor gravado. Só-leitura e independente do dado (CE-19).
   */
  isRowNumber?: boolean;
  /**
   * Célula `cep`: endpoint de CONSULTA. Preenchido, a célula BUSCA o endereço (`GET {lookupEndpoint}/{cep}`)
   * ao completar os oito dígitos e preenche as colunas-irmãs da mesma linha por `fieldBindings`. Vazio ⇒
   * a célula só mascara.
   */
  lookupEndpoint?: string;
  /**
   * Vínculos da consulta da célula `cep`: cada um copia um campo da RESPOSTA (`sourceField`) para outra
   * COLUNA da mesma linha (`targetField` = nome de coluna). Ex.: logradouro→Logradouro, cidade→Cidade.
   * Também usados pela célula `citypicker`: copiam value/columns do registro escolhido para as colunas.
   */
  fieldBindings?: XFieldBinding[];
  /**
   * Célula `citypicker`: endpoint de BUSCA de registro (a lupa da cidade). A célula abre o diálogo de
   * seleção (`POST {pickerEndpoint} { searchText } → { items }`) e, ao escolher, aplica os `fieldBindings`
   * gravando a FK (SYSxCidadeID) e os campos de exibição/resolução. Vazio ⇒ sem lupa.
   */
  pickerEndpoint?: string;
  /** Título do diálogo de busca da célula `citypicker`. */
  pickerTitle?: string;
  /** Colunas exibidas no diálogo de busca da célula `citypicker`. */
  pickerColumns?: XUIGridColumn[];
}

// ============================================================================
// XUIGridPricing — cálculo comercial de linha (preço líquido) da grade de itens
// ============================================================================

/**
 * Capacidade GENÉRICA de cálculo comercial de linha, dirigida por nome de coluna (CE-19): serve
 * pedido, nota, compra, sem o front conhecer nenhuma App. Tudo em nível de LINHA — o desconto é o
 * TOTAL da linha (contrato ValorDesconto / vDesc da NF-e) e o preço final é o TOTAL LÍQUIDO da linha.
 * O grid aplica, a cada digitação: total(bruto) = quantidade × preço unitário; preçoFinal = total −
 * desconto; ao digitar o preço final, desconto = total − preçoFinal; e trava 0 ≤ preçoFinal ≤ total.
 */
export interface XUIGridPricing {
  /** Coluna do preço unitário (só-leitura): entra no total bruto (quantidade × preço unitário). */
  unitPriceField: string;
  /** Coluna da quantidade da linha. */
  quantityField: string;
  /** Coluna do desconto — TOTAL da linha (o primário, o que se grava). */
  discountField: string;
  /** Coluna do PREÇO FINAL da linha (TOTAL líquido = bruto − desconto; digitá-lo recalcula o desconto). */
  netTotalField: string;
  /**
   * Coluna do TOTAL BRUTO da linha (só-leitura, derivado): quantidade × preço unitário, sem desconto
   * (o vProd da NF-e). Recalcula quando a quantidade ou o preço unitário mudam. Vazio ⇒ sem total.
   */
  grossTotalField?: string;
  /**
   * Coluna do PREÇO DO ITEM — o preço unitário negociado (dono, 2026-10-27). Com `itemPriceActiveField` verdadeiro,
   * o desconto deixa de ser digitado: `desconto = (unitário − preçoItem) × quantidade`; vazio ⇒ sem desconto; igual ou
   * maior que o unitário ⇒ linha inválida (desconto 0, célula marcada, Salvar recusado). Só da tela: grava-se o desconto.
   */
  itemPriceField?: string;
  /** Campo do FORMULÁRIO que liga o modo preço-do-item. Falso ou ausente ⇒ o cálculo de sempre. */
  itemPriceActiveField?: string;
}

// ============================================================================
// XUIGridDifference — diferença de linha (resultado = minuendo − subtraendo)
// ============================================================================

/**
 * Cálculo de DIFERENÇA de linha, por nome de coluna (CE-19). Irmão do `XUIGridPricing`, e separado
 * dele de propósito: aquele é o cálculo COMERCIAL e trava o resultado em [0, bruto], enquanto aqui
 * o valor NEGATIVO é justamente a informação que importa — numa correção de estoque,
 * `contado − sistema = −8` quer dizer que faltam oito.
 */
export interface XUIGridDifference {
  /** Coluna de que se subtrai (na correção de estoque, o estoque correto/contado). */
  minuendField: string;
  /** Coluna que se subtrai (na correção de estoque, o estoque atual/do sistema). */
  subtrahendField: string;
  /** Coluna do resultado (só-leitura, derivada). */
  resultField: string;
}

// ============================================================================
// XDataEditor
// ============================================================================

export interface XDataEditor extends XDataField {
  dataFieldID: string;
  uiEditorID: string;
  editor: XUIEditorModel;
  defaultOperator: XFilterOperator;
  allowedOperators: XFilterOperator[];
  showOperatorSelector: boolean;
  colSpan: number;
  rowSpan: number;
}

// ============================================================================
// XFormField - Field positioning within a form section
// ============================================================================

export interface XFormField {
  editor: XDataEditor;
  row: number;
  colSpan: number;
  order: number;
  /** Condições de exibição do campo, TODAS obrigatórias (conjunção). Vazia ⇒ sempre visível. */
  visibleWhen?: XVisibilityRule[];
  /**
   * Condições que TRAVAM o campo (só-leitura), todas obrigatórias. Vazia ⇒ manda o `isReadOnly` do
   * editor. Par do `visibleWhen`: aquele esconde, este trava — para o campo cujo valor o sistema às
   * vezes deriva (e o usuário só confere) e às vezes não tem (e o usuário informa).
   */
  readOnlyWhen?: XVisibilityRule[];
  /**
   * Valores que o campo assume ao ENTRAR em uma condição. Terceira coisa que uma regra faz com um
   * campo: `visibleWhen` esconde, `readOnlyWhen` trava, `valueWhen` preenche.
   */
  valueWhen?: XValueRule[];
}

/**
 * Regra de VALOR (CE-19): quando o formulário PASSA A satisfazer `when`, o campo assume `value`.
 *
 * A semântica é de BORDA, não de estado: o valor entra na transição (e na abertura do formulário),
 * nunca a cada avaliação. É o que deixa a regra conviver com a escolha do usuário — num campo livre
 * ela só inicializa; num campo travado (`readOnlyWhen`) o valor forçado é o único possível.
 */
export interface XValueRule {
  value: string;
  when: XVisibilityRule[];
}

/**
 * Condição de exibição dirigida por dados (CE-19): observa `field` no formulário e aprova quando o
 * valor está entre `values`. Lista `values` VAZIA ⇒ a regra é "tem valor" (não-nulo, não-vazio,
 * diferente de 0/false). A comparação é textual — o enum viaja como número, então "2" casa o
 * membro de código 2.
 */
export interface XVisibilityRule {
  field: string;
  values: string[];
  /** Inverte a regra: `true` ⇒ aparece quando a condição NÃO vale (ex.: campo vazio). */
  negate?: boolean;
  /**
   * Compara por BIT, não por igualdade: o campo é um bitmask (o valor do MultiSelect) e a regra vale
   * quando ALGUM bit de `values` está ligado. Aba condicionada a um papel do multi-seleção.
   */
  bitmask?: boolean;
}

// ============================================================================
// XFormSection - A section that groups related fields
// ============================================================================

export enum XFormSectionLayout {
  Grid = 1,
  Horizontal = 2,
  Vertical = 3,
}

export interface XFormSection extends XModel {
  showHeader: boolean;
  isCollapsible: boolean;
  isCollapsed: boolean;
  icon: string;
  layout: XFormSectionLayout;
  fields: XFormField[];
}

// ============================================================================
// XFormView - Form configuration with 32-column grid layout
// ============================================================================

export interface XFormView extends XModel {
  isReadOnly: boolean;
  showHeader: boolean;
  /** Largura do modal em PERCENTUAL da área do App (1..90). 0 = padrão. FE-3. */
  modalWidth: number;
  maxHeight: number;
  /** Linhas de campo que o modal deve acomodar sem rolagem. 0 = altura pelo conteúdo. FE-4. */
  modalRows: number;
  fieldGap: number;
  sections: XFormSection[];
  loadEndpoint: string;
  /**
   * GET (sem `{id}`) do CONTEXTO do formulário, buscado a cada abertura (Novo, Editar, Visualizar) e juntado aos
   * valores — configuração da empresa que muda o comportamento da tela. O registro prevalece em nome repetido.
   */
  contextEndpoint?: string;
  saveEndpoint: string;
  createTitle: string;
  editTitle: string;
  viewTitle: string;
  /**
   * Fechamento comercial AO VIVO do rodapé: declarado, o formulário genérico recalcula subtotal e
   * valor final a cada edição dos itens ou do desconto, por nome de campo (CE-19). Ver XFormPricing.
   */
  pricing?: XFormPricing;
  /**
   * POST que RECALCULA campos enquanto se digita (aceita `{id}`, o registro aberto) — o mesmo contrato do
   * `XRowAction.recalcEndpoint`. Vazio ⇒ sem recálculo.
   */
  recalcEndpoint?: string;
  /** Campos cuja alteração dispara o recálculo. Vazio ⇒ qualquer campo editável. */
  recalcTriggerFields?: string[];
  /** Espera (ms) depois da última digitação antes de recalcular. */
  recalcDelay?: number;
}

// ============================================================================
// XFormPricing — fechamento comercial ao vivo do rodapé do formulário
// ============================================================================

/**
 * Capacidade GENÉRICA de fechamento de documento no rodapé, dirigida por nome de campo (CE-19):
 * serve pedido, nota, compra, sem o front conhecer nenhuma App. A cada edição dos itens ou do
 * desconto, o formulário recalcula subtotal = Σ do líquido de cada item (quantidade × preço unitário −
 * desconto do item), valor final = subtotal − desconto geral e — quando `itemNetTotalField` é
 * declarado — o preço final de cada LINHA, já com o rateio do desconto do documento, de modo que a
 * soma das linhas bata com o valor final. É prévia; a fonte da verdade é o back (XFechamentoDocumento).
 */
export interface XFormPricing {
  /** Campo que guarda a LISTA de itens (a grade). */
  itemsField: string;
  /** Nome da coluna de quantidade DENTRO de cada item. */
  itemQuantityField: string;
  /** Nome da coluna de preço unitário DENTRO de cada item. */
  itemUnitPriceField: string;
  /** Nome da coluna de desconto (total da linha) DENTRO de cada item. */
  itemDiscountField: string;
  /**
   * Nome da coluna que recebe o PREÇO FINAL de cada linha (líquido do item já com o rateio do desconto
   * do documento). Declarado ⇒ a grade fecha com o valor final, e a coluna é calculada (a App a
   * declara só-leitura). Vazio/ausente ⇒ o formulário não toca nas linhas.
   */
  itemNetTotalField?: string;
  /** Campo de saída do SUBTOTAL: Σ (bruto − desconto de item), antes do desconto do documento. */
  subtotalField: string;
  /** Campo de entrada do desconto geral do documento (o operador digita). */
  headerDiscountField: string;
  /** Campo de saída do VALOR FINAL: subtotal − desconto geral. */
  finalValueField: string;
}

// ============================================================================
// XFilter
// ============================================================================

export interface XFilter extends XModel {
  editors: XDataEditor[];
  logicalOperator: XFilterLogicalOperator;
  layout: XFilterLayout;
  columnsCount: number;
  isCollapsible: boolean;
  isCollapsed: boolean;
  showSearchButton: boolean;
  showClearButton: boolean;
  autoSearch: boolean;
  autoSearchDelay: number;
}

// ============================================================================
// XPagination
// ============================================================================

export interface XPagination {
  id: string;
  isEnabled: boolean;
  pageSize: number;
  pageSizeOptions: number[];
  showPageSizeSelector: boolean;
  showPageInfo: boolean;
  showFirstLastButtons: boolean;
  showPrevNextButtons: boolean;
  maxVisiblePages: number;
  pageInfoTemplate: string;
}

// ============================================================================
// XDataViewHeader
// ============================================================================

export interface XDataViewHeader extends XModel {
  columns: XDataField[];
  isSticky: boolean;
  allowReorder: boolean;
  allowResize: boolean;
  showColumnMenu: boolean;
}

// ============================================================================
// XDataViewRow
// ============================================================================

export interface XDataViewRow extends XModel {
  columns: XDataField[];
  selectionMode: XRowSelectionMode;
  showCheckboxColumn: boolean;
  allowRowClick: boolean;
  allowDoubleClick: boolean;
  doubleClickAction: string;
  showRowNumber: boolean;
  alternateRowStyle: boolean;
  highlightOnHover: boolean;
}

// ============================================================================
// XDataView
// ============================================================================

export interface XDataView extends XModel {
  header: XDataViewHeader;
  row: XDataViewRow;
  filter: XFilter;
  pagination: XPagination;
  dataEndpoint: string;
  keyField: string;
  showHeader: boolean;
  showFooter: boolean;
  showBorder: boolean;
  isScrollable: boolean;
  height?: number;
  emptyMessage: string;
  loadingMessage: string;
  /** Ações sobre UMA linha, numa coluna fixa à direita. Vazio ⇒ a coluna não existe. */
  rowActions?: XRowAction[];
  /**
   * Regras avaliadas contra a LINHA: casaram todas ⇒ a linha abre em VISUALIZAÇÃO (modal em leitura),
   * ainda que a App seja editável (`canEdit`). O botão de abrir nasce "Visualizar" e o duplo clique
   * segue a mesma regra.
   *
   * `canEdit` é capacidade do USUÁRIO e vale para a App inteira; isto é estado do REGISTRO, e muda de
   * linha para linha. Basta uma das duas negar para a linha abrir em leitura.
   *
   * Ausente/vazio ⇒ nada muda (só a capacidade decide).
   */
  readOnlyWhen?: XVisibilityRule[];
}

/**
 * Ação sobre uma linha da grade (ex.: "Autorizar" uma nota). Vem do modelo do back (CE-19): o front
 * faz POST no `endpoint` com `{id}` trocado pela chave da linha e recarrega a grade.
 *
 * `visibleWhenField` + `visibleWhenValues` decidem em quais linhas o botão aparece — o valor daquele
 * campo, na linha, tem de estar na lista. Campo vazio ⇒ aparece em todas.
 */
export interface XRowAction extends XModel {
  title: string;
  icon: string;
  endpoint: string;
  /**
   * A ação LEVA O AppX ao nível com esta chave, com a linha como registro (o "Abrir" do repositório na aba Código).
   * Nada se posta; fora de um AppX, ou com o nível podado, o botão não aparece.
   */
  openLevel?: string;
  buttonType: XButtonType;
  /** Papel semântico de cor (paleta). Vazio/Default ⇒ neutro. Ver `xButtonPalette.ts`. */
  color?: XButtonColor;
  requiresConfirmation: boolean;
  confirmMessage: string;
  visibleWhenField: string;
  visibleWhenValues: string[];
  // Campo/valores da LINHA que DESABILITAM o botão (aparece, mas não clica) — o "Baixar" de uma parcela
  // já baixada. Distinto de visibleWhen (que esconde). Vazio ⇒ nunca desabilita.
  disabledWhenField?: string;
  disabledWhenValues?: string[];
  // Propriedade da LINHA usada como {id} do endpoint/lookups numa grade EMBUTIDA (a linha não é o
  // registro da App). Ex.: FINxTituloParcelaID. Vazio ⇒ usa a chave da linha selecionada da grade principal.
  endpointKeyField?: string;
  requiresCompany: boolean;
  /**
   * A ação devolve um ARQUIVO: o motor faz GET e baixa a resposta (nome pelo `Content-Disposition`),
   * sem recarregar a grade nem mostrar mensagem. Falso ⇒ POST + desfecho + recarga.
   */
  returnsFile?: boolean;

  /**
   * Campos que a ação COLETA antes de executar. Declarados, o motor abre um modal genérico com estes
   * editores e posta o que se preencheu como corpo da requisição. Vazio ⇒ executa direto.
   *
   * O que é obrigatório, e o tamanho mínimo de cada campo, vêm do próprio editor — o front não conhece
   * a regra, só a cumpre (CE-19).
   */
  fields?: XDataEditor[];

  /** Título do modal de coleta. Vazio ⇒ usa o `title` da ação. */
  formTitle?: string;

  /** Texto de um aviso destacado, mostrado na coleta e repetido na confirmação. */
  warningMessage?: string;

  /**
   * GET que traz os valores INICIAIS dos `fields` antes de abrir o modal (aceita `{id}` e `{rowId}`).
   * Vazio ⇒ os campos nascem do default e da linha. Hoje honrado pela grade de detalhe.
   */
  loadEndpoint?: string;

  /**
   * POST que RECALCULA campos do modal enquanto se digita (aceita `{id}` e `{rowId}`). O corpo são os
   * valores correntes; a resposta traz os campos a atualizar, menos os de `recalcTriggerFields`, que são
   * do usuário. Vazio ⇒ sem recálculo.
   */
  recalcEndpoint?: string;
  /** Campos cuja alteração dispara o recálculo. Vazio ⇒ qualquer campo. */
  recalcTriggerFields?: string[];
  /** Espera (ms) depois da última digitação antes de recalcular. */
  recalcDelay?: number;
  /** Rótulo do botão que desiste do modal de coleta. Vazio ⇒ "Fechar". */
  cancelTitle?: string;
  /**
   * O modal se contém na ÁREA DO APP (`[data-app-area]`), por cima do formulário que o abriu, e não
   * dentro dele. Falso ⇒ fica no quadro de quem chamou (a regra geral de contenção).
   */
  useAppArea?: boolean;
}

// ============================================================================
// XApplication
// ============================================================================

/**
 * Um visualizador somente-leitura da aplicação. Uma App declara N deles; o front desenha um botão
 * por visualizador e renderiza o formulário (simples ou com abas) que vier. O motor não sabe o que
 * cada visualizador mostra — isso é problema do modelo publicado pelo back (CE-19).
 */
export interface XApplicationViewer extends XModel {
  /** Identificador do visualizador dentro da App. O botão o referencia pelo seu `name`. */
  key: string;
  /** Rótulo exibido, escrito no back. */
  title: string;
  icon: string;
  order: number;
  /** Carga do visualizador; `{id}` é trocado pela chave da linha selecionada. */
  loadEndpoint: string;
  formView?: XFormView;
  tabbedFormView?: XTabbedFormView;
  /**
   * Endpoint que devolve ESTE visualizador em PDF (`{id}` como na carga). Preenchido ⇒ o modal ganha
   * o botão de exportar. Não se confunde com a exportação da GRADE: aquela baixa a lista da tela,
   * esta baixa o documento que está aberto.
   */
  exportEndpoint?: string;
}

export interface XApplication extends XModel {
  dataView: XDataView;
  formView: XFormView;
  tabbedFormView?: XTabbedFormView;
  /** Visualizadores somente-leitura. Vazio ⇒ a App abre o próprio formulário em leitura. */
  viewers: XApplicationViewer[];
  buttonBar: XButtonBar;
  exportConfig: XExportConfig;
  /** Recebe UM arquivo por requisição (multipart, campo `arquivo`). Vazio ⇒ a App não importa. */
  importEndpoint: string;
  currentMode: XApplicationMode;
  icon: string;
  apiBaseURL: string;
  /** UI rendering template. Defaults to DataGrid (standard CRUD). */
  viewTemplate: XViewTemplate;
  /** Custom React component name for Custom/Dashboard templates. Must be registered in XCustomComponentRegistry. */
  customComponentName?: string;
  /** O painel, quando o modelo é `Workspace` (já podado: só as seções que o ator acessa). */
  workspace?: XWorkspaceView;
  /** O navegador, quando o modelo é `Navigator` (já podado: só os elementos que o ator acessa). */
  navigator?: XNavigatorView;
  /** A lista de cartões, quando o modelo é `CardList`. */
  cardList?: XCardListView;
  /** Falso ⇒ a App não vai ao menu: é sub-App de um painel e só se abre por dentro dele. */
  showInMenu?: boolean;
  permissions: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canPrint: boolean;
  canActivate: boolean;
  canDeactivate: boolean;
  /** When true, the app supports record state control (Active/Inactive). */
  hasStateControl: boolean;
  detailEditor?: XDataEditor;
  moduleID: string;
  menuGroupID: string;
  menuItemID: string;
  route: string;
  menuOrder: number;
  isActive: boolean;
}

// ============================================================================
// API Types - Query Request/Response
// ============================================================================

export interface XQueryFilterItem {
  fieldName: string;
  operator: XFilterOperator;
  value: string;
}

export interface XQuerySort {
  fieldName: string;
  direction: XSortDirection;
  order?: number;
}

export interface XQueryRequest {
  filters: XQueryFilterItem[];
  sort?: XQuerySort[];
  page: number;
  pageSize: number;
}

export interface XQueryResponse<T> {
  /** Linhas da página. Fica em `records` (não `data`) para não colidir com o `data` do envelope. */
  records: T[];
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// Filter and Sort Info (used in requests)
// ============================================================================

export interface XFilterInfo {
  fieldName: string;
  operator: XFilterOperator;
  value: string;
  value2?: string;
}

export interface XSortInfo {
  fieldName: string;
  direction: XSortDirection;
  order?: number;
}

// ============================================================================
// Lookup Search Types
// ============================================================================

export interface XLookupSearchRequest {
  searchText: string;
  maxResults?: number;
  /**
   * Critérios NOMEADOS do picker de vários campos (documento, nome…). A chave é o `fieldName` do
   * critério declarado no modelo. Ausente ⇒ busca de campo único, por `searchText`.
   */
  filters?: Record<string, string>;
}

export interface XLookupSearchResponse {
  items: Record<string, unknown>[];
}

// ============================================================================
// Application State Types
// ============================================================================

export interface XApplicationState {
  currentMode: XApplicationMode;
  selectedRows: string[];
  /** O que o usuário está digitando nos filtros. Não dispara consulta. */
  filterValues: Record<string, unknown>;
  /** O que a consulta usa de fato. Só muda quando se pesquisa (debounce ou botão). */
  appliedFilters: Record<string, unknown>;
  sortConfig: { field: string; direction: XSortDirection } | null;
  currentPage: number;
  pageSize: number;
}

// ============================================================================
// Field Definition - Centralized field dictionary
// ============================================================================
// Used to ensure consistency between DataFields, Editors, and Columns.
// All components reference the same field ID for:
// - DataView header columns
// - DataView row columns
// - Filter editors (via dataFieldID)
// - Form editors (via dataFieldID)
// Performance: Guid-based lookups are faster than string comparisons.
// ============================================================================

export interface XFieldDefinition {
  id: string;
  fieldName: string;
  title: string;
  dataType: XDataType;
  defaultAlignment: XFieldAlignment;
  defaultWidth: number;
  format: string;
  mask: string;
  nullText: string;
  isSortable: boolean;
}

// ============================================================================
// Export Types
// ============================================================================

export enum XExportFormat {
  Excel = 1,
  PDF = 2,
  CSV = 3,
  /** Markdown (.md): o relatório em TEXTO, para colar em chamado, incidente ou revisão de código. */
  Markdown = 4,
}

export enum XExportOrientation {
  Portrait = 1,
  Landscape = 2,
}

export enum XExportPaperSize {
  A4 = 1,
  Letter = 2,
  Legal = 3,
  A3 = 4,
}

export interface XExportColumn {
  id: string;
  name: string;
  title: string;
  fieldName: string;
  dataType: XDataType;
  alignment: XFieldAlignment;
  width: number;
  format: string;
  order: number;
  isVisible: boolean;
  includeInExport: boolean;
}

export interface XExportConfig extends XModel {
  availableFormats: XExportFormat[];
  defaultFormat: XExportFormat;
  documentTitle: string;
  documentSubtitle: string;
  includeTimestamp: boolean;
  includeFilterInfo: boolean;
  includePageNumbers: boolean;
  includeTotalCount: boolean;
  orientation: XExportOrientation;
  paperSize: XExportPaperSize;
  maxRecords: number;
  columns: XExportColumn[];
  fileName: string;
}

export interface XExportRequest {
  format: XExportFormat;
  fromPage: number;
  toPage: number;
  pageSize: number;
  filters: XFilterInfo[];
  logicalOperator: XFilterLogicalOperator;
  sort: XSortInfo[];
  selectedColumns: string[];
  orientation?: XExportOrientation;
}

// ============================================================================
// Tabbed Form View - Tab Control for Forms with Multiple Tabs
// ============================================================================

/**
 * Defines a tab in a tabbed form modal.
 * Tabs can contain either a form (sections with fields) or a detail grid.
 */
export interface XFormTab extends XModel {
  /** Icon name for the tab header */
  icon: string;
  /**
   * Nome de um campo do formulário que condiciona a EXIBIÇÃO desta aba (CE-19). Vazio/ausente ⇒
   * sempre visível. Preenchido ⇒ a aba só aparece quando `formData[visibleWhenField]` for
   * "verdadeiro" (não-nulo, não-vazio, ≠ 0/"0"/"false"). Reage à seleção corrente do formulário.
   */
  visibleWhenField?: string;
  /** Condições de exibição da aba, TODAS obrigatórias (conjunção). Vazia ⇒ sem condição. */
  visibleWhen?: XVisibilityRule[];
  /** Whether this tab contains a detail grid instead of form sections */
  hasDetailGrid: boolean;
  /** Name of a custom frontend component to render for this tab */
  customComponentName?: string;
  /** API endpoint for loading custom component data */
  dataEndpoint?: string;
  /** Secondary lookup/search endpoint for a custom component that first selects a parent */
  lookupEndpoint?: string;
  /** Form sections to render (when hasDetailGrid is false) */
  sections: XFormSection[];
  /** Detail grid configuration (when hasDetailGrid is true) */
  detailGrid?: XDetailGrid;
}

/**
 * Detail grid configuration for master-detail relationships.
 * Used inside form tabs to show related records.
 */
export interface XDetailGrid extends XModel {
  /** Column definitions for the grid */
  columns: XDetailGridColumn[];
  /** API endpoint to fetch detail records */
  dataEndpoint: string;
  /** API endpoint to add new detail record */
  addEndpoint: string;
  /** API endpoint to remove detail record (use {id} placeholder) */
  removeEndpoint: string;
  /** Endpoint to get available items for adding */
  lookupEndpoint: string;
  /** Field name to use as key */
  keyField: string;
  /**
   * Grade filha, carregada ao selecionar uma linha desta. O `dataEndpoint` dela aceita `{id}`
   * (a chave do registro-pai) e `{rowId}` (o `keyField` da linha selecionada aqui).
   * Ausente ⇒ as linhas não são selecionáveis.
   */
  childGrid?: XDetailGrid;
  /** Título da grade filha. */
  childTitle?: string;
  /**
   * Painel de DETALHE da linha: campos do próprio item selecionado, mostrados abaixo da grade por
   * extenso (sem truncar). Vazio ⇒ sem painel. Junto com `childGrid`, torna a linha selecionável.
   */
  detailFields?: XDetailGridColumn[];
  /** Título do painel de detalhe. */
  detailTitle?: string;
  /**
   * Painel de EDIÇÃO da linha: campos editáveis mostrados abaixo da grade (master-detail editável).
   * Preenchido ⇒ selecionar uma linha carrega o item no formulário de baixo, "Novo" abre um item
   * em branco e "Salvar" grava por `saveEndpoint`. Vazio ⇒ comportamento antigo (só leitura).
   */
  editFields?: XDataEditor[];
  /** Endpoint de gravação do painel de edição: POST `{saveEndpoint}` cria, PUT `{saveEndpoint}/{itemId}` edita. */
  saveEndpoint?: string;
  /** Título do painel de edição. */
  editTitle?: string;
  /** Display field for the lookup */
  displayField: string;
  /** Empty state message */
  emptyMessage: string;
  /** Whether to show the add button */
  canAdd: boolean;
  /** Whether to show remove buttons on rows */
  canRemove: boolean;
  /** Confirmation message for removal */
  removeConfirmMessage: string;
  /** Label of the remove action; empty ⇒ default "Remover". Ex.: "Invalidar" when it closes, not deletes. */
  removeLabel?: string;
  /**
   * Ações POR LINHA (botões na própria linha — a grade de detalhe não tem barra). Cada uma observa a
   * linha por `visibleWhenField`. Com `fields` abre o modal de coleta (sem `endpoint` = só leitura);
   * sem campos faz POST (ou baixa, com `returnsFile`). Endpoints aceitam `{id}` e `{rowId}`.
   */
  rowActions?: XRowAction[];
  /** O botão de incluir como AÇÃO em modal (campos, valores iniciais por `loadEndpoint`, POST no `endpoint`). */
  addAction?: XRowAction | null;
  /** Regras que ESCONDEM o botão de incluir quando alguma linha as satisfaz. */
  addHiddenWhen?: XVisibilityRule[];
  /** A grade opera mesmo com o formulário em leitura (num visualizador): ela grava pelos seus endpoints. */
  activeInReadOnly?: boolean;
}

/**
 * Column definition for detail grid.
 */
export interface XDetailGridColumn extends XModel {
  /** Field name in the data */
  fieldName: string;
  /** Data type for formatting */
  dataType: XDataType;
  /** Column alignment */
  alignment: XFieldAlignment;
  /** Column width (flex or fixed) */
  width: number;
  /** Whether width is flexible */
  flexWidth: boolean;
}

/**
 * Extended form view with tab support.
 * When tabs are defined, sections in the base XFormView are ignored.
 */
export interface XTabbedFormView extends XFormView {
  /** Tabs for the tabbed form */
  tabs: XFormTab[];
  /** Whether tabs are visible */
  showTabs: boolean;
  /** Default active tab index */
  defaultTabIndex: number;
}

