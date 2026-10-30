/**
 * usePaineisAoEntrar — abre sozinho, numa aba FIXA, cada painel de trabalho marcado para abrir ao entrar
 * (`XWorkspaceView.OpenOnStart`, dono 2026-10-25). Quem decide quais é o back (`GET /sys/painel/ao-entrar`): só os
 * que o usuário acessa, sob a empresa exigida e, no painel de contexto, com ao menos um registro para acompanhar
 * (o painel do projeto só abre para quem participa de algum projeto).
 *
 * A casca chama uma vez, com o usuário autenticado. Pergunta de novo quando a empresa corrente muda (o painel que não
 * abria sem projeto pode abrir na outra empresa) e nunca abre o mesmo painel duas vezes. A aba fixa não se fecha: sem
 * entrada no menu, fechá-la seria perdê-la.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@core/lib/api';
import type { XWorkspaceStartItem } from '@core/types/workspace.types';
import { useCompany } from './useCompany';
import { useTabs } from './useTabs';

/** Chave da consulta "o que abrir ao entrar", pela empresa corrente. */
export const chaveDosPaineisAoEntrar = (pEmpresa: number): readonly unknown[] => ['painel-ao-entrar', pEmpresa];

export function usePaineisAoEntrar(pHabilitado: boolean): void {
  const { company } = useCompany();
  const { tabs, openTab } = useTabs();
  const empresa = company?.sysxPessoaID ?? 0;

  const { data: paineis } = useQuery({
    queryKey: chaveDosPaineisAoEntrar(empresa),
    queryFn: ({ signal }) => api.get<XWorkspaceStartItem[]>('/sys/painel/ao-entrar', signal),
    // Sem empresa escolhida, o painel que exige empresa não abriria: espera a escolha.
    enabled: pHabilitado && empresa > 0,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    for (const painel of paineis ?? []) {
      if (tabs.some((pAba) => pAba.menuItem.applicationID === painel.applicationID))
        continue;
      openTab(
        { id: painel.applicationID, name: painel.name, title: painel.title, applicationID: painel.applicationID },
        undefined,
        undefined,
        { fixa: true, emSegundoPlano: true });
    }
  }, [paineis, tabs, openTab]);
}
