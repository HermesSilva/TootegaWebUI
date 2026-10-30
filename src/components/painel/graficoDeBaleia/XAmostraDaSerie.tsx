/**
 * A amostra visual de cada série do gráfico de baleia — a mesma na legenda e no quadro do mouse, para o olho
 * associar a palavra ao traço: previsto (linha oliva sobre fundo oliva translúcido), realizado (azul sólido),
 * projeção (azul tracejado) e "abaixo do previsto" (hachura oliva).
 */

import { useId, type JSX } from 'react';
import { COR_PREVISTO, COR_REALIZADO, FUNDO_PREVISTO, HACHURA_PREVISTO, PREENCHIMENTO_REALIZADO } from './coresDaBaleia';

export type XSerieDaBaleia = 'previsto' | 'realizado' | 'projecao' | 'abaixo';

const CORCOVA = 'M1 9 C5 9 6 2 9 2 C12 2 13 9 17 9 Z';

export function XAmostraDaSerie({ serie }: { serie: XSerieDaBaleia }): JSX.Element {
  const id = `amostra-hachura-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <svg width="18" height="10" aria-hidden="true" className="shrink-0">
      {serie === 'previsto' && (
        <path d={CORCOVA} style={{ fill: FUNDO_PREVISTO, stroke: COR_PREVISTO }} strokeWidth="1.75" />
      )}
      {serie === 'realizado' && <path d={CORCOVA} style={{ fill: PREENCHIMENTO_REALIZADO }} />}
      {serie === 'projecao' && (
        <path d="M1 7 L17 3" style={{ stroke: COR_REALIZADO }} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
      )}
      {serie === 'abaixo' && (
        <>
          <defs>
            <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" style={{ stroke: HACHURA_PREVISTO }} strokeWidth="1.4" />
            </pattern>
          </defs>
          <rect x="1" y="1" width="16" height="8" rx="2" fill={`url(#${id})`} style={{ stroke: COR_PREVISTO }} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
