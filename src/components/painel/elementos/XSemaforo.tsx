/**
 * Semáforo de uma medida: o indicador de status por FORMA (`XIndicadorDeStatus`) com o nome do que mede ("Prazo",
 * "Esforço") para o leitor de tela, a dica do mouse e, opcionalmente, ao lado do indicador.
 */

import type { JSX } from 'react';
import type { XTomDoPainel } from './tipos';
import { ROTULO_DO_STATUS, XIndicadorDeStatus } from './XIndicadorDeStatus';

interface XSemaforoProps {
  /** O que o semáforo mede ("Prazo", "Esforço"). */
  medida: string;
  tom: XTomDoPainel;
  /** Mostra o nome da medida ao lado do indicador. */
  comRotulo?: boolean;
}

export function XSemaforo({ medida, tom, comRotulo = false }: XSemaforoProps): JSX.Element {
  const descricao = `${medida}: ${ROTULO_DO_STATUS[tom]}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={descricao}>
      <XIndicadorDeStatus tom={tom} rotulo={descricao} />
      {comRotulo && <span className="text-ui-xs text-brand-text-secondary">{medida}</span>}
    </span>
  );
}
