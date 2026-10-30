/**
 * A legenda do gráfico de baleia: a amostra de cada série (a mesma do quadro do mouse), o marcador da data de leitura
 * e o significado das FORMAS dos semáforos. Uma `nota` opcional fecha a legenda (o método da projeção, por exemplo —
 * quem usa o gráfico diz como projeta).
 */

import type { JSX, ReactNode } from 'react';
import { ROTULO_DO_STATUS, XIndicadorDeStatus } from '../elementos/XIndicadorDeStatus';
import { XAmostraDaSerie } from './XAmostraDaSerie';

export interface XLegendaDaBaleiaProps {
  rotulos?: {
    previsto?: string;
    realizado?: string;
    /** Complemento discreto do realizado. */
    notaDoRealizado?: string;
    abaixo?: string;
    projecao?: string;
    marcador?: string;
  };
  /** Os nomes dos dois semáforos, na ordem em que aparecem no canto de cada região. */
  nomesDosSemaforos?: [string, string];
  nota?: ReactNode;
}

export function XLegendaDaBaleia({ rotulos, nomesDosSemaforos = ['Prazo', 'Esforço'], nota }: XLegendaDaBaleiaProps): JSX.Element {
  const [primeiro, segundo] = nomesDosSemaforos;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-ui-xs text-brand-text-secondary">
      <span className="inline-flex items-center gap-2"><XAmostraDaSerie serie="previsto" />{rotulos?.previsto ?? 'Previsto'}</span>
      <span className="inline-flex items-center gap-2">
        <XAmostraDaSerie serie="realizado" />{rotulos?.realizado ?? 'Realizado'}
        <span className="text-brand-text-muted">{rotulos?.notaDoRealizado ?? '(acima da linha = além do previsto)'}</span>
      </span>
      <span className="inline-flex items-center gap-2"><XAmostraDaSerie serie="abaixo" />{rotulos?.abaixo ?? 'Abaixo do previsto'}</span>
      <span className="inline-flex items-center gap-2"><XAmostraDaSerie serie="projecao" />{rotulos?.projecao ?? 'Projeção'}</span>
      <span className="inline-flex items-center gap-2"><span className="w-px h-3 bg-brand-text-primary" />{rotulos?.marcador ?? 'Hoje'}</span>
      {/* As formas dos semáforos: lidas sem depender da cor. */}
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-brand-text-muted">{`${primeiro} e ${segundo.toLowerCase()}, nesta ordem, no canto de cada região:`}</span>
        {(['sucesso', 'aviso', 'perigo', 'neutro'] as const).map((pTom) => (
          <span key={pTom} className="inline-flex items-center gap-1.5">
            <XIndicadorDeStatus tom={pTom} />
            {ROTULO_DO_STATUS[pTom]}
          </span>
        ))}
      </span>
      {nota && <span className="basis-full text-brand-text-muted">{nota}</span>}
    </div>
  );
}
