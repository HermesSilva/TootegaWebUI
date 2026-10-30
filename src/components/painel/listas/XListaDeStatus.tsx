/**
 * LISTA DE STATUS: itens com um rótulo curto, um valor (monoespaçado quando é código ou versão), a situação em texto e
 * o indicador de status por FORMA — ambientes e suas versões, integrações, serviços. A situação vai na cor do tom
 * (salvo "no rumo", que fica discreta) e o indicador diz o estado sem depender da cor.
 */

import type { JSX } from 'react';
import type { XTomDoPainel } from '../elementos/tipos';
import { TEXTO_DO_TOM } from '../elementos/tons';
import { ROTULO_DO_STATUS, XIndicadorDeStatus } from '../elementos/XIndicadorDeStatus';

export interface XItemDeStatus {
  id: string;
  rotulo: string;
  valor?: string;
  /** O valor é código/versão: fonte monoespaçada. */
  valorMonoespacado?: boolean;
  situacao: string;
  tom: XTomDoPainel;
}

export function XListaDeStatus({ itens }: { itens: XItemDeStatus[] }): JSX.Element {
  return (
    <ul className="flex flex-col divide-y divide-border-light">
      {itens.map((pItem) => (
        <li key={pItem.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <span className="min-w-10 text-ui-sm font-semibold text-brand-text-primary">{pItem.rotulo}</span>
          {pItem.valor && (
            <span className={`text-ui-sm text-brand-text-secondary tabular-nums ${pItem.valorMonoespacado ? 'font-mono' : ''}`}>{pItem.valor}</span>
          )}
          <span className={`ml-auto flex items-center gap-2 text-ui-xs text-right ${pItem.tom === 'sucesso' ? 'text-brand-text-muted' : TEXTO_DO_TOM[pItem.tom]}`}>
            {pItem.situacao}
            <XIndicadorDeStatus tom={pItem.tom} rotulo={`${pItem.rotulo}: ${ROTULO_DO_STATUS[pItem.tom]}`} />
          </span>
        </li>
      ))}
    </ul>
  );
}
