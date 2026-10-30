import { errorEmitter, type ErrorCategory, type FieldError } from './errorEmitter';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Identidade/autenticação/biometria trafegam por Front → SYS → ID (D47): o SYS é a ÚNICA porta
// pública; o Tootega.ID vive em rede privada e o front NUNCA o toca diretamente. O SYS reexpõe a
// superfície de identidade do usuário sob "/sys/identity/*" (proxy fiel — relaia o envelope do ID).
// Por isso NÃO há segunda base: tudo sai por API_BASE_URL (o SYS).
const IDENTITY_BASE = `${API_BASE_URL}/sys/identity`;

// Session invalidation handler - redirects to login
let sessionInvalidationHandler: (() => void) | null = null;

export function setSessionInvalidationHandler(pHandler: (() => void) | null): void {
  sessionInvalidationHandler = pHandler;
}

export class ApiError extends Error {
  statusCode: number;
  url?: string;
  method?: string;
  // Código de negócio do backend (body.messages[0].code), ex.: "id.login.email_nao_confirmado".
  // É o MARCADOR de máquina (ex.: UNHANDLED_EXCEPTION): a UI reage ao caso específico por ele,
  // sem depender do texto. O usuário nunca o lê.
  code?: string;
  /**
   * Os erros POR CAMPO que o back devolveu (`details` de cada mensagem, campo → textos). É o que o
   * formulário usa para MARCAR o campo errado (dono, 2026-10-12): o diálogo mostra a lista, e o
   * campo fica vermelho com a mesma frase embaixo — o operador corrige tudo numa passada.
   */
  fieldErrors: FieldError[] = [];

  constructor(pMessage: string, pStatusCode: number, pUrl?: string, pMethod?: string, pCode?: string) {
    super(pMessage);
    this.name = 'ApiError';
    this.statusCode = pStatusCode;
    this.url = pUrl;
    this.method = pMethod;
    this.code = pCode;
  }
}

/**
 * Wraps native fetch() to catch network errors (server unreachable, DNS failure,
 * connection refused) and convert them into an ApiError + errorEmitter event that NAMES the call.
 */
async function safeFetch(pUrl: string, pOptions?: RequestInit): Promise<Response> {
  try {
    return await fetch(pUrl, pOptions);
  } catch (err) {
    // AbortError is expected when TanStack Query cancels requests (e.g. React StrictMode re-renders).
    // Re-throw silently without emitting a user-visible error.
    if (err instanceof DOMException && err.name === 'AbortError')
      throw err;

    const method = pOptions?.method || 'GET';
    // Diz QUAL chamada não saiu e por quê: sem isso, "não foi possível conectar" some no meio de
    // várias requisições simultâneas e ninguém sabe o que ficou por fazer.
    const message = `A operação **${method} ${pUrl}** não chegou ao servidor: a conexão falhou (rede indisponível, servidor fora do ar ou endereço inacessível).\n\n**O que fazer:** verifique sua conexão e repita a operação.`;
    const error = new ApiError(message, 0, pUrl, method);

    errorEmitter.emit({
      category: 'exception',
      title: 'Falha de Conexão',
      message,
      statusCode: 0,
      url: pUrl,
      method,
      stack: error.stack,
    });

    throw error;
  }
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

let accessToken: string | null = null;
let refreshTokenFn: (() => Promise<boolean>) | null = null;

const TOKEN_STORAGE_KEY = 'Tootega_tokens';

export function setAccessToken(pToken: string | null): void {
  accessToken = pToken;
}

/**
 * Canonical access-token getter. Reads from the in-memory token first; falls back
 * to the persisted tokens JSON ('Tootega_tokens') so callers outside the auth
 * provider lifecycle (e.g. theme persistence) resolve the token correctly.
 */
export function getAccessToken(): string | null {
  if (accessToken)
    return accessToken;

  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored)
      return null;
    return (JSON.parse(stored) as { accessToken?: string }).accessToken ?? null;
  } catch {
    return null;
  }
}

export function setRefreshTokenHandler(pHandler: (() => Promise<boolean>) | null): void {
  refreshTokenFn = pHandler;
}

// Empresa corrente (SYSxPessoa) sobre a qual o usuário trabalha. Viaja em TODA requisição no
// cabeçalho X-Company-ID; o backend a trata como DECLARAÇÃO do cliente e valida o acesso do
// usuário antes de usá-la (GET /sys/companies/current). Zero/nulo = nenhuma empresa escolhida.
let currentCompanyID: number | null = null;

export function setCurrentCompanyID(pCompanyID: number | null): void {
  currentCompanyID = pCompanyID;
}

/**
 * Empresa corrente, para quem precisa DISTINGUIR requisições por empresa — hoje, as chaves de cache
 * do React Query (`applicationKeys`).
 *
 * Sem ela na chave, a resposta de uma empresa era servida sob outra: a `queryKey` só tinha endpoint e
 * requisição, e com `staleTime` de 30s + `keepPreviousData` a grade reexibia as linhas da empresa
 * anterior — sem sequer ir ao servidor, então nem o filtro do backend salvava.
 */
export function getCurrentCompanyID(): number | null {
  return currentCompanyID;
}

interface XApiMessage {
  /**
   * Marcador de MÁQUINA (`UNHANDLED_EXCEPTION`, `BUSINESS_WARNING`…), para o front ramificar.
   * Nunca é texto e nunca é exibido — o usuário lê o `message`.
   */
  code: string;
  /** O texto pt-BR que o back escreveu, pronto para exibir. É ele que aparece na tela. */
  message: string;
  details: Record<string, string[]>;
}

/**
 * Maps 1:1 with backend XResponseStatus enum (serialized as string).
 */
type XResponseStatus = 'None' | 'Information' | 'Warning' | 'ValidationError' | 'Error' | 'Exception';

interface ApiWrapper<T> {
  data: T;
  messages: XApiMessage[];
  status: XResponseStatus;
}

/** Título do erro por código HTTP. Texto pt-BR, num lugar só (dono, 2026-08-03). */
const TITULO_POR_STATUS: Record<number, string> = {
  400: 'Requisição Inválida',
  401: 'Não Autorizado',
  403: 'Acesso Negado',
  404: 'Não Encontrado',
  409: 'Conflito',
  422: 'Dados Inválidos',
  500: 'Erro Interno do Servidor',
  502: 'Bad Gateway',
  503: 'Serviço Indisponível',
};

function getErrorTitle(pStatusCode: number): string {
  return TITULO_POR_STATUS[pStatusCode] ?? 'Erro';
}

/**
 * Maps backend XResponseStatus to frontend ErrorCategory.
 * The backend now sends the semantic status directly, so
 * HTTP status code is only used as fallback when response is not JSON.
 */
function mapStatusToCategory(pStatus: XResponseStatus, pHttpStatus: number): ErrorCategory {
  switch (pStatus) {
    case 'ValidationError':
      return 'validation';
    case 'Error':
      return 'error';
    case 'Exception':
      return 'exception';
    case 'Warning':
      return 'warning';
    case 'Information':
      return 'message';
    default:
      // Fallback based on HTTP status for edge cases
      if (pHttpStatus >= 500) return 'exception';
      return 'error';
  }
}

/**
 * Fallback classification when response is not JSON (no XResponseStatus available).
 */
function classifyByHttpStatus(pStatusCode: number): ErrorCategory {
  if (pStatusCode >= 500) return 'exception';
  if (pStatusCode === 499) return 'message';
  return 'error';
}

/**
 * Extracts per-field errors from XApiMessage.details.
 * Backend sends: { "Password": ["Senha deve ter entre 8 e 100 caracteres"], "PhoneNumber": ["Telefone inválido"] }
 */
function extractFieldErrors(pDetails?: Record<string, string[]>): FieldError[] {
  if (!pDetails || typeof pDetails !== 'object')
    return [];

  const fields: FieldError[] = [];
  for (const [field, messages] of Object.entries(pDetails)) {
    if (Array.isArray(messages) && messages.length > 0)
      fields.push({ field, messages });
  }
  return fields;
}

/** Une os erros por campo de várias mensagens: o mesmo campo acusado duas vezes acumula os textos. */
function unirErrosDeCampo(pListas: FieldError[][]): FieldError[] {
  const porCampo = new Map<string, string[]>();
  for (const lista of pListas)
    for (const fe of lista)
      porCampo.set(fe.field, [...(porCampo.get(fe.field) ?? []), ...fe.messages]);
  return [...porCampo.entries()].map(([field, messages]) => ({ field, messages }));
}

/**
 * ERRO MUDO É DEFEITO (dono, 2026-08-07, binária). Nenhuma falha chega ao usuário sem dizer O QUE
 * aconteceu e POR QUÊ. Frase genérica — "ocorreu um erro inesperado", "tente novamente" — está
 * proibida: ela não informa, não orienta e ainda esconde a causa de quem poderia consertar.
 *
 * O texto vem do back, escrito e formatado (CE-21). Aqui não se monta frase: o
 * produto fala pt-BR e o back já entrega a mensagem pronta.
 *
 * Quando o back não mandou texto — falha de infraestrutura, 502 do proxy, corpo vazio — a mensagem
 * ainda tem de dizer alguma coisa: qual chamada falhou e com que status. É pouco, mas é FATO, e
 * quem lê consegue relatar; "erro inesperado" não permite nem isso.
 */
function buildFriendlyMessage(pFirstError: XApiMessage, pContexto: OperacaoFalha): string {
  if (pFirstError.message)
    return pFirstError.message;

  return mensagemDaOperacao(pContexto);
}

/** A chamada que falhou: é o que sobra para dizer quando o servidor não mandou texto. */
interface OperacaoFalha {
  method: string;
  url: string;
  status: number;
  statusText?: string;
}

/**
 * A frase de última instância — e ainda assim CONCRETA: nomeia o método, a rota e o código HTTP.
 * Todo erro do produto identifica a operação que falhou; esta é a menor forma disso.
 */
function mensagemDaOperacao(pOperacao: OperacaoFalha): string {
  const situacao = pOperacao.statusText
    ? `${pOperacao.status} (${pOperacao.statusText})`
    : `${pOperacao.status}`;

  const chamada = `${pOperacao.method} ${pOperacao.url}`;

  return pOperacao.status === 0
    ? `A operação **${chamada}** não chegou ao servidor: a conexão falhou antes da resposta.\n\n**O que fazer:** verifique a rede e repita a operação.`
    : `A operação **${chamada}** falhou com **HTTP ${situacao}**, e o servidor não devolveu nenhuma explicação.\n\n**O que fazer:** repita a operação; persistindo, avise o suporte com esta mensagem — a falta de motivo é, ela própria, um defeito a corrigir.`;
}

/**
 * Recusa do FRAMEWORK, antes do controller (corpo vazio ou ilegível, rota com parâmetro inválido): o ASP.NET
 * responde com `ProblemDetails` (`title`, `detail`, `errors`), não com o envelope da casa. O motivo vem ali — e
 * ignorá-lo era erro mudo: o usuário via "o servidor não devolveu nenhuma explicação" quando ela estava no corpo
 * (2026-10-25). Devolve os motivos em texto, ou nulo quando o corpo não é um `ProblemDetails`.
 */
function motivosDoProblemDetails(pCorpo: unknown): string | null {
  if (!pCorpo || typeof pCorpo !== 'object')
    return null;
  const problema = pCorpo as { title?: unknown; detail?: unknown; errors?: unknown };
  const motivos: string[] = [];
  if (problema.errors && typeof problema.errors === 'object')
    for (const [campo, textos] of Object.entries(problema.errors as Record<string, unknown>)) {
      const lista = (Array.isArray(textos) ? textos : [textos]).filter((pT): pT is string => typeof pT === 'string' && pT.trim() !== '');
      const prefixo = campo && campo !== '$' && campo !== '' ? `${campo}: ` : '';
      motivos.push(...lista.map((pT) => `${prefixo}${pT}`));
    }
  if (motivos.length === 0 && typeof problema.detail === 'string' && problema.detail.trim())
    motivos.push(problema.detail.trim());
  if (motivos.length === 0 && typeof problema.title === 'string' && problema.title.trim())
    motivos.push(problema.title.trim());
  return motivos.length > 0 ? motivos.join('; ') : null;
}

function mensagemDeRecusaDoFramework(pMotivos: string, pOperacao: OperacaoFalha): string {
  return `O servidor recusou a operação **${pOperacao.method} ${pOperacao.url}** (HTTP ${pOperacao.status}) antes de processá-la.\n\n**Motivo informado pelo servidor:** ${pMotivos}\n\n**O que fazer:** avise o suporte com esta mensagem — a tela enviou algo que o servidor não aceita, e isso é defeito a corrigir.`;
}

/**
 * Diagnóstico que o BACK envia em desenvolvimento (XExceptionMiddleware): `type`, `stackTrace` e
 * `innerExceptions`. Em produção o back não o manda, e esta função devolve nulo — o front não muda
 * de comportamento, apenas deixa de ter o que mostrar.
 */
function servidorDiagnostico(
  pDetails?: Record<string, string[]>
): { resumo: string; stack: string } | null {
  if (!pDetails?.stackTrace?.length && !pDetails?.type?.length)
    return null;

  const tipo = pDetails.type?.[0] ?? '';
  const internas = pDetails.innerExceptions ?? [];
  const rastro = (pDetails.stackTrace ?? []).join('\n');

  const resumo = [
    tipo && `Exceção no servidor: ${tipo}`,
    internas.length > 0 && `Causa: ${internas.join(' → ')}`,
  ].filter(Boolean).join('\n');

  return { resumo, stack: [tipo, rastro].filter(Boolean).join('\n') };
}

/**
 * Falha INESPERADA do servidor (o back a marca com este código). O texto dela é técnico — a mensagem
 * do Entity Framework sobre tradução de consulta, por exemplo. Ele NÃO substitui a explicação: a
 * mensagem nomeia a operação que falhou e diz que a falha é nossa, e o texto técnico vai junto,
 * porque é ele que permite relatar o defeito (dono, 2026-08-07 — antes saía só "Erro no servidor.
 * Tente novamente mais tarde", que nada informa).
 */
const CODIGO_EXCECAO_NAO_TRATADA = 'UNHANDLED_EXCEPTION';

/**
 * Falha inesperada, escrita para ser lida: o que falhou, de quem é a falha, e o detalhe técnico que
 * o servidor mandou (em produção ele é genérico por segurança — aí a operação é o que resta, e ela
 * já identifica o caso no log).
 */
function mensagemDeExcecao(pTecnico: string, pOperacao: OperacaoFalha): string {
  const cabeca = `A operação **${pOperacao.method} ${pOperacao.url}** falhou por um **erro interno do sistema** (HTTP ${pOperacao.status}) — não é problema no que você informou.`;
  const detalhe = pTecnico ? `\n\n**Detalhe técnico:** ${pTecnico}` : '';

  return `${cabeca}${detalhe}\n\n**O que fazer:** repita a operação. Se repetir, avise o suporte com esta mensagem — o defeito é nosso e precisa ser corrigido.`;
}

async function handleResponse<T>(pResponse: Response, pUrl: string, pMethod: string, pEmitError = true): Promise<T> {
  return handleResponseInternal<T>(pResponse, pUrl, pMethod, pEmitError);
}

async function handleResponseInternal<T>(pResponse: Response, pUrl: string, pMethod: string, pEmitError: boolean): Promise<T> {
  // 204 No Content - success without body
  if (pResponse.status === 204)
    return undefined as T;
  
  // Other success responses without body (2xx)
  if (pResponse.ok && pResponse.headers.get('content-length') === '0')
    return undefined as T;

  let body: ApiWrapper<T>;
  
  try {
    body = await pResponse.json() as ApiWrapper<T>;
  } catch {
    // Resposta que não é JSON — só é erro quando não houve sucesso. O corpo veio ilegível (página de
    // erro do proxy, HTML de gateway): não há mensagem do back, e a operação é o que se pode dizer.
    if (!pResponse.ok) {
      const operacao: OperacaoFalha = {
        method: pMethod, url: pUrl, status: pResponse.status, statusText: pResponse.statusText,
      };
      const category = classifyByHttpStatus(pResponse.status);
      const mensagem = mensagemDaOperacao(operacao);
      const error = new ApiError(mensagem, pResponse.status, pUrl, pMethod);

      if (pEmitError) {
        errorEmitter.emit({
          category,
          title: getErrorTitle(pResponse.status),
          message: mensagem,
          statusCode: pResponse.status,
          url: pUrl,
          method: pMethod,
          stack: error.stack,
        });
      }

      throw error;
    }
    // Success without valid JSON
    return undefined as T;
  }
  
  if (!pResponse.ok || body.status !== 'None') {
    const firstMessage = body.messages?.[0];
    const errorCode = firstMessage?.code;
    const category = mapStatusToCategory(body.status, pResponse.status);
    const mensagens = body.messages ?? [];
    // Erros por campo de TODAS as mensagens, não só da primeira: a validação do pedido devolve uma
    // mensagem por erro, cada uma com o seu campo (dono, 2026-10-12).
    const fieldErrors = unirErrosDeCampo(mensagens.map(m => extractFieldErrors(m.details)));
    const dataMessage = (body.data as Record<string, unknown>)?.message as string | undefined;
    const operacao: OperacaoFalha = {
      method: pMethod, url: pUrl, status: pResponse.status, statusText: pResponse.statusText,
    };
    const textosDasMensagens = mensagens.map(m => buildFriendlyMessage(m, operacao));
    // TODAS as mensagens, não só a primeira (dono, 2026-10-12): um pedido inválido volta com uma por
    // erro, e mostrar só a primeira fazia o operador corrigir, gravar e descobrir a próxima — uma por
    // vez. Na validação, o texto do diálogo é a lista inteira; nas demais, a primeira é a que fala e
    // as outras vão ao detalhe.
    const motivosDoFramework = textosDasMensagens.length > 0 ? null : motivosDoProblemDetails(body);
    const friendlyMessage = textosDasMensagens.length > 0
      ? (category === 'validation' ? textosDasMensagens.join('\n\n') : textosDasMensagens[0])
      : (dataMessage
        || (motivosDoFramework && mensagemDeRecusaDoFramework(motivosDoFramework, operacao))
        || mensagemDaOperacao(operacao));
    const allDetails = textosDasMensagens.join('\n');
    const error = new ApiError(friendlyMessage, pResponse.status, pUrl, pMethod, errorCode);
    error.fieldErrors = fieldErrors;
    // A lista "Campos com problemas" do diálogo só mostra o que a mensagem ainda não disse: quando
    // o texto do campo É a própria mensagem, repeti-lo abaixo dela seria ruído.
    const textos = new Set(mensagens.map(m => m.message));
    const fieldErrorsDoDialogo = fieldErrors.filter(fe => !fe.messages.every(m => textos.has(m)));

    // Diagnóstico DO SERVIDOR (só chega em desenvolvimento): tipo, rastro de pilha e exceções
    // internas. Quando existe, ele é o rastro que vale — o do navegador só diz que a chamada saiu
    // daqui, e a causa está do outro lado.
    const diagnostico = servidorDiagnostico(firstMessage?.details);
    const naoTratada = errorCode === CODIGO_EXCECAO_NAO_TRATADA;

    // A falha INESPERADA fala em técnico ("The LINQ expression could not be translated…"): a mensagem
    // exibida nomeia a operação, assume a falha como nossa e LEVA o texto técnico junto — quem lê
    // precisa poder relatar o que aconteceu. Erro de NEGÓCIO é escrito para ser lido: sai como veio.
    const mensagemExibida = naoTratada ? mensagemDeExcecao(friendlyMessage, operacao) : friendlyMessage;
    const tecnico = naoTratada
      ? [friendlyMessage, diagnostico?.resumo].filter(Boolean).join('\n\n')
      : [allDetails, diagnostico?.resumo].filter(Boolean).join('\n\n');

    if (pEmitError) {
      errorEmitter.emit({
        category,
        title: getErrorTitle(pResponse.status),
        message: mensagemExibida,
        details: tecnico || undefined,
        fieldErrors: diagnostico ? [] : fieldErrorsDoDialogo,   // o diagnóstico não é erro de campo
        code: errorCode,
        statusCode: pResponse.status,
        url: pUrl,
        method: pMethod,
        stack: diagnostico?.stack ?? error.stack,
      });
    }
    
    throw error;
  }
  
  return body.data;
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (accessToken)
    headers['Authorization'] = `Bearer ${accessToken}`;

  if (currentCompanyID)
    headers['X-Company-ID'] = String(currentCompanyID);

  return headers;
}

// Single-flight refresh: concurrent 401s share one in-flight refresh promise
// instead of each calling refreshTokenFn() in parallel and racing token rotation.
let inFlightRefresh: Promise<boolean> | null = null;

function refreshTokenSingleFlight(): Promise<boolean> {
  if (inFlightRefresh)
    return inFlightRefresh;

  if (!refreshTokenFn)
    return Promise.resolve(false);

  inFlightRefresh = refreshTokenFn().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function fetchWithRefresh<T>(
  pUrl: string,
  pOptions: RequestInit,
  pSignal?: AbortSignal,
  pEmitError = true
): Promise<T> {
  const method = pOptions.method || 'GET';
  const options = pSignal ? { ...pOptions, signal: pSignal } : pOptions;
  const response = await safeFetch(pUrl, options);

  if (response.status === 401 && refreshTokenFn) {
    const refreshed = await refreshTokenSingleFlight();
    if (refreshed) {
      const newOptions = {
        ...pOptions,
        headers: getAuthHeaders(),
        signal: pSignal,
      };
      const retryResponse = await safeFetch(pUrl, newOptions);
      return handleResponse<T>(retryResponse, pUrl, method, pEmitError);
    }

    // Refresh failed - session is invalid, redirect to login
    if (sessionInvalidationHandler)
      sessionInvalidationHandler();

    throw new ApiError('Session expired', 401, pUrl, method);
  }

  return handleResponse<T>(response, pUrl, method, pEmitError);
}

/**
 * O corpo JSON da requisição: só se omite quando NÃO há corpo (`undefined`). `false`, `0`, `''` e `null` são
 * valores legítimos e vão serializados — o teste "verdadeiro" que havia aqui mandava corpo VAZIO para eles, e o
 * `[FromBody]` do back recusava com 400 sem motivo (desafixar a Jaci, contrair a área de trabalho — 2026-10-25).
 */
export function corpoJSON(pBody: unknown): string | undefined {
  return pBody === undefined ? undefined : JSON.stringify(pBody);
}

export const api = {
  get: async <T>(pEndpoint: string, pSignal?: AbortSignal, pSilent = false): Promise<T> => {
    const url = `${API_BASE_URL}${pEndpoint}`;
    return fetchWithRefresh<T>(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    }, pSignal, !pSilent);
  },

  post: async <T, B = unknown>(pEndpoint: string, pBody?: B, pSignal?: AbortSignal): Promise<T> => {
    const url = `${API_BASE_URL}${pEndpoint}`;
    return fetchWithRefresh<T>(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: corpoJSON(pBody),
    }, pSignal);
  },

  /**
   * Envia UM arquivo por requisição (multipart). O Content-Type NÃO é definido à mão: o navegador
   * o monta com o boundary do FormData. Usado pela importação dirigida por modelo (XApplication.importEndpoint).
   */
  postFile: async <T>(pEndpoint: string, pArquivo: File, pCampo = 'arquivo', pSignal?: AbortSignal): Promise<T> => {
    const url = `${API_BASE_URL}${pEndpoint}`;
    const corpo = new FormData();
    corpo.append(pCampo, pArquivo, pArquivo.name);

    // O navegador monta o Content-Type com o boundary do FormData; defini-lo à mão quebra o parse.
    const headers = getAuthHeaders() as Record<string, string>;
    delete headers['Content-Type'];

    return fetchWithRefresh<T>(url, {
      method: 'POST',
      headers,
      body: corpo,
    }, pSignal);
  },

  /**
   * Envia um FormData arbitrário (multipart) — vários arquivos + campos. O Content-Type NÃO é
   * definido à mão: o navegador o monta com o boundary. Para uploads compostos (ex.: PFX em lote
   * com metadados por arquivo).
   */
  postForm: async <T>(pEndpoint: string, pForm: FormData, pSignal?: AbortSignal): Promise<T> => {
    const url = `${API_BASE_URL}${pEndpoint}`;
    const headers = getAuthHeaders() as Record<string, string>;
    delete headers['Content-Type'];
    return fetchWithRefresh<T>(url, {
      method: 'POST',
      headers,
      body: pForm,
    }, pSignal);
  },

  put: async <T, B = unknown>(pEndpoint: string, pBody?: B, pSignal?: AbortSignal): Promise<T> => {
    const url = `${API_BASE_URL}${pEndpoint}`;
    return fetchWithRefresh<T>(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: corpoJSON(pBody),
    }, pSignal);
  },

  delete: async <T>(pEndpoint: string, pSignal?: AbortSignal): Promise<T> => {
    const url = `${API_BASE_URL}${pEndpoint}`;
    return fetchWithRefresh<T>(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }, pSignal);
  },

  /**
   * Baixa um arquivo como blob: exportação, documento auxiliar (DANFE/DANFSe), logo da empresa.
   *
   * O método é POST por padrão (é o das exportações e das ações de linha). GET serve ao que é apenas
   * LEITURA de um recurso — a logo da empresa, por exemplo, que o navegador guarda em cache.
   */
  downloadBlob: async <B = unknown>(
    pEndpoint: string,
    pBody?: B,
    pMethod: 'GET' | 'POST' = 'POST'
  ): Promise<{
    blob: Blob;
    filename: string;
    contentType: string;
  }> => {
    const url = `${API_BASE_URL}${pEndpoint}`;
    const headers = getAuthHeaders();

    const response = await safeFetch(url, {
      method: pMethod,
      headers,
      body: pMethod === 'GET' ? undefined : corpoJSON(pBody),
    });

    if (!response.ok) {
      // Falha: o corpo é o ENVELOPE de erro, não um arquivo. Reusa o tratamento padrão, que parseia o
      // envelope e EMITE o diálogo global com a categoria certa (aviso laranja para falha de negócio,
      // vermelho para erro/exceção) — e lança. Sem isto, a falha de um download ficaria muda.
      await handleResponseInternal<never>(response, url, pMethod, true);
      throw new ApiError(`Export failed: ${response.statusText}`, response.status, url, pMethod); // inalcançável
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    
    let filename = 'export';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1])
        filename = match[1].replace(/['"]/g, '');
    }

    return { blob, filename, contentType };
  },

  // Auth endpoints without refresh token logic (to avoid circular calls)
  auth: {
    login: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/login`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      // Silent handling - don't emit error toast for login failures
      // LoginPage handles error display inline
      return handleResponseInternal<T>(response, url, 'POST', false);
    },

    refresh: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/token`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      // Silent handling - don't emit error toast for refresh failures
      // The auth flow will handle the redirect to login
      return handleResponseInternal<T>(response, url, 'POST', false);
    },

    revoke: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/revoke`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(pBody),
      });
      // Silent handling - don't emit error toast for revoke failures
      // Token may already be invalidated (e.g., after password change)
      return handleResponseInternal<T>(response, url, 'POST', false);
    },

    forgotPassword: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/password/reset/request`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      // Silent handling - page handles error display inline
      return handleResponseInternal<T>(response, url, 'POST', false);
    },

    resetPassword: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/password/reset/confirm`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      // Silent handling - page handles error display inline
      return handleResponseInternal<T>(response, url, 'POST', false);
    },

    validateResetToken: async (pToken: string): Promise<boolean> => {
      // Via SYS (D47): a validação de token do ID é POST { token } (o proxy /sys/identity/* relaia).
      const url = `${IDENTITY_BASE}/password/reset/validate`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: pToken }),
      });
      // Silent handling - page handles error display inline
      return handleResponseInternal<boolean>(response, url, 'POST', false);
    },

    initiateEmailChange: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/email/change/initiate`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(pBody),
      });
      
      // Handle response without emitting to global error handler
      // The calling modal handles error display via showError
      if (response.status === 204)
        return undefined as T;
      
      const operacao: OperacaoFalha = {
        method: 'POST', url, status: response.status, statusText: response.statusText,
      };

      let body: ApiWrapper<T>;
      try {
        body = await response.json() as ApiWrapper<T>;
      } catch {
        if (!response.ok)
          throw new ApiError(mensagemDaOperacao(operacao), response.status, url, 'POST');
        return undefined as T;
      }

      if (!response.ok || body.status !== 'None') {
        const firstMessage = body.messages?.[0];
        const dataMessage = (body.data as Record<string, unknown>)?.message as string | undefined;
        const friendlyMessage = firstMessage
          ? buildFriendlyMessage(firstMessage, operacao)
          : (dataMessage || mensagemDaOperacao(operacao));
        throw new ApiError(friendlyMessage, response.status, url, 'POST', firstMessage?.code);
      }
      
      return body.data;
    },

    register: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/register`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      return handleResponse<T>(response, url, 'POST');
    },

    confirmEmail: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/email/verify`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      // Silent handling - page handles error display inline
      return handleResponseInternal<T>(response, url, 'POST', false);
    },

    resendConfirmation: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/email/verify/resend`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      // Silent handling - page handles error display inline
      return handleResponseInternal<T>(response, url, 'POST', false);
    },

    confirmEmailChange: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/email/change/confirm`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pBody),
      });
      return handleResponse<T>(response, url, 'POST');
    },

    changePassword: async <T, B = unknown>(pBody: B): Promise<T> => {
      const url = `${IDENTITY_BASE}/password/change`;
      const response = await safeFetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(pBody),
      });
      
      // Handle response without emitting to global error handler
      // The calling modal handles error display via showError
      if (response.status === 204)
        return undefined as T;
      
      const operacao: OperacaoFalha = {
        method: 'POST', url, status: response.status, statusText: response.statusText,
      };

      let body: ApiWrapper<T>;
      try {
        body = await response.json() as ApiWrapper<T>;
      } catch {
        if (!response.ok)
          throw new ApiError(mensagemDaOperacao(operacao), response.status, url, 'POST');
        return undefined as T;
      }

      if (!response.ok || body.status !== 'None') {
        const firstMessage = body.messages?.[0];
        const dataMessage = (body.data as Record<string, unknown>)?.message as string | undefined;
        const friendlyMessage = firstMessage
          ? buildFriendlyMessage(firstMessage, operacao)
          : (dataMessage || mensagemDaOperacao(operacao));
        throw new ApiError(friendlyMessage, response.status, url, 'POST', firstMessage?.code);
      }
      
      return body.data;
    },
  },

  menu: {
    incrementMRU: async (pMenuItemID: string): Promise<void> => {
      const url = `${API_BASE_URL}/sys/menu/${pMenuItemID}/mru`;
      await fetchWithRefresh<void>(url, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    },
  },
};
