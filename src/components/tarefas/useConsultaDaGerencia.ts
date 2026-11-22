// Consulta da gerência das tarefas que se atualiza sozinha. A tela acompanha trabalho que acontece em outro processo
// (o launcher de tarefas), então ela pergunta de novo a cada poucos segundos. A pergunta automática é SILENCIOSA: se o
// servidor cair, um diálogo a cada cinco segundos esconderia a tela; a falha aparece no lugar da lista, com o motivo,
// e a atualização para até o operador pedir de novo.

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@core/lib/api';

/** Intervalo das listas (tarefas, execuções, servidores, painel). */
export const INTERVALO_DAS_LISTAS_MS = 5000;

/** Intervalo do log ao vivo da execução em curso. */
export const INTERVALO_DO_LOG_MS = 2000;

export function useConsultaDaGerencia<T>(pChave: readonly unknown[], pRota: string, pLigada = true): UseQueryResult<T> {
  return useQuery<T>({
    queryKey: ['tarefas-agendadas', ...pChave],
    queryFn: ({ signal }) => api.get<T>(pRota, signal, true),
    enabled: pLigada,
    retry: false,
    refetchInterval: (pConsulta) => (pConsulta.state.status === 'error' ? false : INTERVALO_DAS_LISTAS_MS),
    refetchIntervalInBackground: false,
  });
}
