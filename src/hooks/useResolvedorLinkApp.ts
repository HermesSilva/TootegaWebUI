/**
 * useResolvedorLinkApp — resolve o `[[app:Nome|Rótulo]]` das mensagens do back contra o MENU DO
 * PRÓPRIO USUÁRIO, devolvendo a ação que abre a App (ou `null` quando ele não a tem).
 *
 * O back manda um NOME de App, nunca um endereço (CE-21): quem decide se aquilo vira link é o front,
 * olhando o menu de quem está na tela. App que o usuário não tem — sem permissão, ou nome que não
 * existe mais — não vira link; o rótulo fica em negrito e não clicável, porque um link que abre nada
 * gasta a confiança antes de falhar.
 *
 * <b>Por que um hook, e não uma terceira cópia.</b> A mesma resolução já vivia recortada e repetida
 * no `ErrorModal` e no `SinoMensagens`. Quando o relatório de conferência passou a mostrar mensagem
 * com link (dono, 2026-09-17), copiar pela terceira vez garantiria que as três divergissem no dia em
 * que uma delas mudasse — e a que abre a tela do erro não pode divergir de nada.
 *
 * <b>Com RECORTE ou REGISTRO, abre aba NOVA</b> mesmo já havendo uma: focar a existente entregaria a
 * tela no estado em que ela estava, e não a linha que a mensagem cita — o link pareceria não
 * funcionar.
 *
 * <b>Dentro de um AppX, a regra é outra</b> (dono, 2026-10-25; RX-1): só abre SubAppX do próprio AppX, e
 * link para App do menu fica texto — de um AppX nunca se abre uma App do menu (`AppXContext`).
 */

import { useCallback, useContext } from 'react';

import { useTabs } from '@core/hooks/useTabs';
import { useUserMenu } from '@core/hooks/useMenu';
import { AppXContext } from '@core/contexts/AppXContext';
import type { AppLinkResolver } from '@core/components/ui/MessageText';

/**
 * @param pAoAbrir Executado DEPOIS de abrir/focar a aba — é onde cada hospedeiro sai da frente
 *                 (o diálogo de erro se fecha, o painel do sino se recolhe). Omitido ⇒ nada além
 *                 de navegar, que é o caso de quem já está dentro da tela de destino.
 */
export function useResolvedorLinkApp(pAoAbrir?: () => void): AppLinkResolver {
  const { data: menu } = useUserMenu();
  const { openTab, setActiveTab, getTabsByMenuItemID } = useTabs();
  const doAppX = useContext(AppXContext);

  return useCallback((
    pNomeApp: string,
    pRecorte?: Record<string, string>,
    pRegistroID?: string
  ): (() => void) | null => {
    if (doAppX) {
      const abrir = doAppX.resolverLink(pNomeApp, pRecorte, pRegistroID);
      return abrir ? () => { abrir(); pAoAbrir?.(); } : null;
    }

    const item = menu?.groups
      .flatMap((pGrupo) => pGrupo.items)
      .find((pItem) => pItem.name.toLowerCase() === pNomeApp.toLowerCase());

    if (!item)
      return null;

    return () => {
      const abertas = getTabsByMenuItemID(item.id);

      if (abertas.length > 0 && !pRecorte && !pRegistroID)
        setActiveTab(abertas[0].id);
      else
        openTab(item, pRecorte, pRegistroID);

      pAoAbrir?.();
    };
  }, [menu, openTab, setActiveTab, getTabsByMenuItemID, pAoAbrir, doAppX]);
}
