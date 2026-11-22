/**
 * useToqueDeChamada — toca o toque de chamada, repetido, enquanto `pAtivo` for verdadeiro (dono, 2026-11-19: "até que
 * atenda ou caia"). Parou de valer (atendeu, dispensou, a chamada caiu) ou o componente saiu da tela ⇒ o toque para.
 */

import { useEffect } from 'react';

import { iniciarToqueDeChamada } from '@core/lib/suporte/toqueDeChamada';

export function useToqueDeChamada(pAtivo: boolean): void {
  useEffect(() => {
    if (!pAtivo)
      return;

    return iniciarToqueDeChamada();
  }, [pAtivo]);
}
