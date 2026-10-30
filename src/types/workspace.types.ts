/**
 * Tipos do AppX — o painel de trabalho (`XViewTemplate.Workspace`) — espelho do contrato do back em
 * `Tootega.Core/Model/Workspace/` (dono, 2026-10-25). O modelo (níveis e SubAppX, já podados pelos direitos do ator)
 * vem com a App; o RESUMO de um nível (cabeçalho do registro, contadores, atenção) vem de
 * `GET /sys/painel/<app>/resumo?nivel=<chave>&registro=<id>`.
 */

/** Marcador dos endpoints dos SubAppX, trocado pela chave do registro do nível. */
export const TOKEN_CONTEXTO = '{contexto}';

/** Tom semântico (espelho de `XWorkspaceTone`). A cor e a forma do indicador saem dele. */
export enum XWorkspaceTone {
  Neutral = 1,
  Info = 2,
  Success = 3,
  Warning = 4,
  Danger = 5,
}

/** De onde vem o registro de um nível (espelho de `XWorkspaceContextSource`). */
export enum XWorkspaceContextSource {
  /** Nível sem registro: os SubAppX não usam o marcador. */
  None = 1,
  /** O registro vem da lista do módulo dono (`/contextos?nivel=`) e viaja na rota dos SubAppX. */
  Provider = 2,
  /** O registro é a empresa corrente da sessão: a seta troca a empresa corrente. */
  CurrentCompany = 3,
}

/** Um SubAppX: uma aba do nível, que abre a App `applicationName` dentro do AppX. */
export interface XWorkspaceSection {
  key: string;
  title: string;
  icon: string;
  applicationName: string;
  order: number;
  /** Complemento do contador para leitor de tela ("revisões abertas"). */
  counterLabel: string;
}

/** Um nível do AppX (um passo do cabeçalho) com os seus SubAppX. */
export interface XWorkspaceLevel {
  key: string;
  title: string;
  /** Nome do registro no singular ("projeto"), para as mensagens. */
  contextLabel: string;
  contextSource: XWorkspaceContextSource;
  /**
   * Só abre por navegação: o AppX nunca o escolhe sozinho nem lhe dá o primeiro registro — ele aparece quando o usuário
   * abre um registro dele (a ação de linha `openLevel`, a busca, o motivo de atenção). O Repositório, no ANVIL.
   */
  onlyByNavigation?: boolean;
  defaultSection: string;
  sections: XWorkspaceSection[];
}

/** O AppX declarado na App. */
export interface XWorkspaceView {
  attentionTitle: string;
  /** Rebusca do resumo com a aba à frente, em segundos (0 ⇒ só no foco e depois de gravar). */
  refreshSeconds: number;
  /** Abre sozinho quando o usuário entra, numa aba fixa (ver `usePaineisAoEntrar`). */
  openOnStart: boolean;
  /** Os níveis, do mais alto para o mais baixo. */
  levels: XWorkspaceLevel[];
}

/**
 * Um registro que o ator pode acompanhar num nível (`GET /sys/painel/<app>/contextos?nivel=`, com `&acima=<id>` quando
 * há nível do provedor acima — a lista é a do registro dele); o primeiro é o padrão.
 */
export interface XWorkspaceContextOption {
  id: string;
  label: string;
  detail: string;
}

/** Um AppX que a casca abre sozinho ao entrar (`GET /sys/painel/ao-entrar`). */
export interface XWorkspaceStartItem {
  applicationID: string;
  name: string;
  title: string;
}

/** Um passo da trilha, acima do registro do nível ativo. */
export interface XWorkspaceBreadcrumb {
  label: string;
  isCode: boolean;
  /** A chave do nível do passo: clicar no nome leva a ele. Vazio, ou nível fora do modelo, ⇒ texto. */
  level?: string;
  /** O passo é a empresa corrente: com mais de uma empresa acessível, a seta troca de empresa. */
  isCompany?: boolean;
}

export interface XWorkspaceStatus {
  label: string;
  detail: string;
  tone: XWorkspaceTone;
  /** 0..1; nulo ⇒ sem régua. */
  progress?: number | null;
}

export interface XWorkspaceHeader {
  breadcrumbs: XWorkspaceBreadcrumb[];
  /** O nome do registro do nível ativo. */
  title: string;
  badge: string;
  status?: XWorkspaceStatus | null;
}

export interface XWorkspaceAttentionItem {
  key: string;
  quantity: number;
  label: string;
  tone: XWorkspaceTone;
  /** O SubAppX que o clique abre — de qualquer nível do AppX (o "precisa de você" sobe pela hierarquia). */
  sectionKey: string;
  /** O registro do nível do SubAppX de destino, quando é outro (o projeto de onde veio o motivo). Vazio ⇒ o atual. */
  contextID?: string;
  /** Recorte com que o SubAppX abre, pelo nome do campo (o `filtroInicial`). */
  filter: Record<string, string>;
}

export interface XWorkspaceSummary {
  header: XWorkspaceHeader;
  counters: Record<string, number>;
  attention: XWorkspaceAttentionItem[];
  /** Avisos sobre o próprio resumo (SubAppX cujos sinais não puderam ser lidos). */
  notices: string[];
}
