/**
 * Tootega Application Hooks
 * 
 * Hooks para carregar e gerenciar dados de aplicações dinâmicas.
 * Utiliza TanStack Query para caching e sincronização.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData, type UseQueryResult } from '@tanstack/react-query';
import { api, lerModeloApp, gravarModeloApp, getCurrentCompanyID } from '@core/lib';
import type {
  XApplication,
  XQueryRequest,
  XQueryResponse,
  XLookupSearchRequest,
  XLookupSearchResponse,
} from '@core/types';

// ============================================================================
// Query Keys Factory
// ============================================================================

export const applicationKeys = {
  all: ['applications'] as const,
  detail: (pID: string) => [...applicationKeys.all, 'detail', pID] as const,
  byName: (pName: string) => [...applicationKeys.all, 'name', pName] as const,
  // A EMPRESA CORRENTE entra na chave de tudo que o backend serve filtrado por ela (dono,
  // 2026-08-25). Sem isso, a resposta de uma empresa era servida sob outra: a chave só tinha
  // endpoint + requisição e, com staleTime de 30s e keepPreviousData, trocar de empresa reexibia as
  // linhas da anterior SEM ir ao servidor — o filtro do backend nem chegava a ser consultado.
  // A empresa vem DEPOIS do endpoint, nunca antes: a invalidação após gravar usa o prefixo
  // `['app-data', endpoint]` (linhas abaixo), e pôr a empresa na frente faria o prefixo deixar de
  // casar — a grade não se atualizaria mais ao salvar.
  data: (pEndpoint: string, pRequest: XQueryRequest) =>
    ['app-data', pEndpoint, JSON.stringify(pRequest), getCurrentCompanyID() ?? 0] as const,
  // Os FILTROS entram na chave (serializados) porque duas buscas no mesmo endpoint, com o mesmo
  // searchText vazio e critérios diferentes, são consultas diferentes — sem eles, a segunda leria a
  // resposta em cache da primeira. Sem filtros, a chave é a de sempre (mais a empresa).
  lookup: (pEndpoint: string, pSearchText: string, pFilters?: Record<string, string>): string[] =>
    pFilters && Object.keys(pFilters).length > 0
      ? ['lookup', pEndpoint, pSearchText, JSON.stringify(pFilters), String(getCurrentCompanyID() ?? 0)]
      : ['lookup', pEndpoint, pSearchText, String(getCurrentCompanyID() ?? 0)],
};

// ============================================================================
// useApplication - Carrega definição de XApplication por ID
// ============================================================================

export function useApplication(pApplicationID: string | null): UseQueryResult<XApplication> {
  return useQuery({
    queryKey: applicationKeys.detail(pApplicationID ?? ''),
    queryFn: async ({ signal }): Promise<XApplication> => {
      if (!pApplicationID)
        throw new Error('Application ID is required');

      const modelo = await api.get<XApplication>(`/sys/application/${pApplicationID}`, signal);
      gravarModeloApp(`id-${pApplicationID}`, modelo);
      return modelo;
    },
    // O modelo é código: só muda com uma versão nova (que recarrega a aba e limpa o cache). Por isso
    // ele hidrata SÍNCRONO do localStorage e nunca revalida — zero ida ao back até a versão mudar.
    initialData: pApplicationID
      ? () => lerModeloApp<XApplication>(`id-${pApplicationID}`) ?? undefined
      : undefined,
    enabled: !!pApplicationID,
    staleTime: Infinity,     // estável até a versão do build mudar (ver appModelCache)
    gcTime: 30 * 60 * 1000,  // 30 minutos no cache de memória do React Query
  });
}

// ============================================================================
// useApplicationByName - Carrega definição de XApplication por nome
// ============================================================================

export function useApplicationByName(pApplicationName: string | null): UseQueryResult<XApplication> {
  return useQuery({
    queryKey: applicationKeys.byName(pApplicationName ?? ''),
    queryFn: async ({ signal }): Promise<XApplication> => {
      if (!pApplicationName)
        throw new Error('Application name is required');

      const modelo = await api.get<XApplication>(`/sys/application/name/${encodeURIComponent(pApplicationName)}`, signal);
      gravarModeloApp(`name-${pApplicationName}`, modelo);
      return modelo;
    },
    // Ver useApplication: o modelo hidrata do localStorage e é estável até a versão mudar.
    initialData: pApplicationName
      ? () => lerModeloApp<XApplication>(`name-${pApplicationName}`) ?? undefined
      : undefined,
    enabled: !!pApplicationName,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
}

// ============================================================================
// useApplicationData - Carrega dados paginados de uma aplicação
// ============================================================================

interface UseApplicationDataOptions {
  endpoint: string;
  request: XQueryRequest;
  enabled?: boolean;
}

export function useApplicationData<T = Record<string, unknown>>(
  pOptions: UseApplicationDataOptions
): UseQueryResult<XQueryResponse<T>> {
  const { endpoint, request, enabled = true } = pOptions;

  return useQuery({
    queryKey: applicationKeys.data(endpoint, request),
    queryFn: async ({ signal }): Promise<XQueryResponse<T>> => {
      return api.post<XQueryResponse<T>>(endpoint, request, signal);
    },
    enabled: enabled && !!endpoint,
    staleTime: 30 * 1000,      // 30 segundos - dados mudam mais frequentemente
    gcTime: 5 * 60 * 1000,     // 5 minutos no cache
    placeholderData: keepPreviousData,  // Mantém dados anteriores quando queryKey muda
  });
}

// ============================================================================
// useLookupSearch - Busca assíncrona para XLookupEditor
// ============================================================================

interface UseLookupSearchOptions {
  endpoint: string;
  searchText: string;
  minLength?: number;
  enabled?: boolean;
  /**
   * Critérios NOMEADOS, para o buscador de vários campos (o picker de registro: documento E nome).
   * Vão em `filters` na requisição, com a chave que o modelo declarou. Ausente ⇒ busca de campo
   * único, por `searchText` — o comportamento de todo lookup que já existia.
   */
  filters?: Record<string, string>;
}

export function useLookupSearch(
  pOptions: UseLookupSearchOptions
): UseQueryResult<XLookupSearchResponse> {
  const { endpoint, searchText, minLength = 3, enabled = true, filters } = pOptions;

  const shouldSearch = enabled && !!endpoint && searchText.length >= minLength;

  return useQuery({
    queryKey: applicationKeys.lookup(endpoint, searchText, filters),
    queryFn: async ({ signal }): Promise<XLookupSearchResponse> => {
      const request: XLookupSearchRequest = {
        searchText,
        maxResults: 50,
        ...(filters && Object.keys(filters).length > 0 ? { filters } : {}),
      };
      return api.post<XLookupSearchResponse>(endpoint, request, signal);
    },
    enabled: shouldSearch,
    staleTime: 60 * 1000,      // 1 minuto
    gcTime: 5 * 60 * 1000,     // 5 minutos
  });
}

// ============================================================================
// useApplicationMutation - Mutações CRUD para aplicações
// ============================================================================

interface MutationOptions<T> {
  endpoint: string;
  onSuccess?: (pData: T) => void;
  onError?: (pError: Error) => void;
}

export function useApplicationCreate<T = Record<string, unknown>>(pOptions: MutationOptions<T>) {
  const queryClient = useQueryClient();
  const { endpoint, onSuccess, onError } = pOptions;

  return useMutation({
    mutationFn: async (pData: Partial<T>): Promise<T> => {
      return api.post<T>(endpoint, pData);
    },
    onSuccess: (pData) => {
      // Invalida queries de dados para recarregar
      queryClient.invalidateQueries({ queryKey: ['app-data', endpoint] });
      onSuccess?.(pData);
    },
    onError,
  });
}

export function useApplicationUpdate<T = Record<string, unknown>>(pOptions: MutationOptions<T> & { idField?: string }) {
  const queryClient = useQueryClient();
  const { endpoint, idField = 'id', onSuccess, onError } = pOptions;

  return useMutation({
    mutationFn: async (pData: T): Promise<T> => {
      const id = (pData as Record<string, unknown>)[idField];
      return api.put<T>(`${endpoint}/${id}`, pData);
    },
    onSuccess: (pData) => {
      queryClient.invalidateQueries({ queryKey: ['app-data', endpoint] });
      onSuccess?.(pData);
    },
    onError,
  });
}

export function useApplicationDelete<T = Record<string, unknown>>(pOptions: MutationOptions<T>) {
  const queryClient = useQueryClient();
  const { endpoint, onSuccess, onError } = pOptions;

  return useMutation({
    mutationFn: async (pID: string): Promise<T> => {
      return api.delete<T>(`${endpoint}/${pID}`);
    },
    onSuccess: (pData) => {
      queryClient.invalidateQueries({ queryKey: ['app-data', endpoint] });
      onSuccess?.(pData);
    },
    onError,
  });
}
