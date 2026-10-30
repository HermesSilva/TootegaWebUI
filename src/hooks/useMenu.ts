import { useQuery } from '@tanstack/react-query';
import { api } from '@core/lib';
import type { UserMenu } from '@core/types';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';

export const menuKeys = {
  all: ['menu'] as const,
  /**
   * A EMPRESA CORRENTE entra na chave (dono, 2026-08-28). O menu passou a depender dela — as Apps
   * marcadas com `RequiresCompany` só aparecem havendo empresa selecionada —, e uma chave que a
   * ignorasse serviria, da cache, o menu da empresa anterior (ou o menu sem empresa) depois da troca.
   */
  user: (pCompanyID: number | null) => [...menuKeys.all, 'user', pCompanyID ?? 0] as const,
};

interface UseUserMenuOptions {
  enabled?: boolean;
}

/**
 * O menu de navegação da casca, já podado pelo back conforme o ator (RBAC) e a empresa corrente.
 *
 * <p>
 * **Espera a empresa ser resolvida antes de perguntar.** No boot há uma corrida: o `CompanyProvider`
 * zera o `X-Company-ID` e só o define depois que `/sys/companies` responde e confirma a empresa
 * salva. Disparando junto com a autenticação, esta consulta chegava ao servidor SEM empresa — e
 * voltava sem as Apps que exigem empresa (Emissão, Documentos, Estoque, Financeiro, Contribuintes…),
 * que então não apareciam no menu até um recarregamento manual. Por isso o `enabled` também exige
 * `!isLoading`: perguntar cedo demais é perguntar a pergunta errada.
 * </p>
 */
export function useUserMenu(pOptions?: UseUserMenuOptions) {
  const { isAuthenticated } = useAuth();
  const { company, isLoading: empresaCarregando } = useCompany();
  const externalEnabled = pOptions?.enabled ?? true;

  const empresaID = company?.sysxPessoaID ?? null;

  return useQuery({
    queryKey: menuKeys.user(empresaID),
    queryFn: ({ signal }) => api.get<UserMenu>('/sys/menu', signal),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: isAuthenticated && externalEnabled && !empresaCarregando,
  });
}
