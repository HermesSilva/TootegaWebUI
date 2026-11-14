/**
 * useAbrirAppPeloEndereco — abre a tela pedida no endereço (`/home?abrir=<Nome da App>`), dono 2026-11-09.
 *
 * É o que dá ao manual o botão **Abrir a tela**: a página da tela no manual aponta para `/home?abrir=STQxProdutos`
 * e a casca, ao entrar com o usuário autenticado e o menu carregado, abre a aba daquela App (ou foca a que já
 * está aberta). O nome é o `XApplication.Name`, nunca um endereço, e quem decide se vira aba é o MENU do próprio
 * usuário — App que ele não tem (sem direito, sem a empresa que ela exige, ou nome que mudou) não abre, e a casca
 * diz por quê, em vez de ficar muda.
 *
 * O parâmetro sai do endereço assim que é atendido: recarregar a página não reabre a tela.
 */

import { useEffect, useRef } from 'react';

import { useUserMenu } from './useMenu';
import { useTabs } from './useTabs';
import { useError } from './useError';

/** O parâmetro de consulta que pede uma tela: o mesmo que o gerador do manual escreve. */
export const PARAMETRO_ABRIR_APP = 'abrir';

/** O nome da App pedida na query string, ou `null` quando ninguém pediu nada. */
export function lerAppPedidaNoEndereco(pQueryString: string): string | null {
  const nome = new URLSearchParams(pQueryString).get(PARAMETRO_ABRIR_APP);
  return nome && nome.trim().length > 0 ? nome.trim() : null;
}

/** O endereço sem o parâmetro, para o `replaceState` depois de atendê-lo. */
export function enderecoSemOPedido(pPathname: string, pQueryString: string, pHash: string): string {
  const parametros = new URLSearchParams(pQueryString);
  parametros.delete(PARAMETRO_ABRIR_APP);
  const resto = parametros.toString();
  return `${pPathname}${resto ? `?${resto}` : ''}${pHash}`;
}

export function useAbrirAppPeloEndereco(pHabilitado: boolean): void {
  const { data: menu } = useUserMenu();
  const { openTab, setActiveTab, getTabsByMenuItemID } = useTabs();
  const { showError } = useError();
  // O pedido atendido nesta sessão: o efeito roda de novo quando o menu muda, e não pode reabrir a tela.
  const atendido = useRef<string | null>(null);

  useEffect(() => {
    if (!pHabilitado || !menu)
      return;
    const nome = lerAppPedidaNoEndereco(window.location.search);
    if (!nome || atendido.current === nome)
      return;
    atendido.current = nome;
    window.history.replaceState(window.history.state, '', enderecoSemOPedido(window.location.pathname, window.location.search, window.location.hash));

    const item = menu.groups
      .flatMap((pGrupo) => pGrupo.items)
      .find((pItem) => pItem.name.toLowerCase() === nome.toLowerCase());

    if (!item) {
      showError({
        category: 'warning',
        title: 'Tela não disponível',
        message: `A tela pedida pelo endereço não está no seu menu. Ou o seu perfil de acesso não a inclui, ou ela exige uma empresa selecionada no alto da tela, ou ela mudou de nome. Abra a tela pelo menu; se ela não estiver lá, peça o acesso ao administrador do assinante.`,
      });
      return;
    }

    const abertas = getTabsByMenuItemID(item.id);
    if (abertas.length > 0)
      setActiveTab(abertas[0].id);
    else
      openTab(item);
  }, [pHabilitado, menu, openTab, setActiveTab, getTabsByMenuItemID, showError]);
}
