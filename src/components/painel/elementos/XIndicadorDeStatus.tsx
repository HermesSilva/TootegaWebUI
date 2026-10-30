/**
 * Indicador de status por FORMA, não só por cor (dono, 2026-10-25 — WCAG 1.4.1: daltônicos reconhecem pela forma):
 *
 *   sucesso  check (o "v" inclinado)              — no rumo
 *   aviso    triângulo com "!"                    — atenção
 *   perigo   octógono (placa de pare) com "!"     — fora do rumo / risco
 *   info     círculo com "i"                      — informativo
 *   neutro   anel vazado                          — sem medida
 *
 * O MESMO tamanho em todo lugar (`TAMANHO_DO_INDICADOR`, 12 px): no gráfico (dentro do SVG, por `XFormaDeStatus`) e nas
 * listas, pastilhas, legendas e quadros (HTML, por `XIndicadorDeStatus`). As cores são os tokens de status do tema; o
 * miolo ("!", "i") usa a cor da superfície, e toda forma tem ao menos 3:1 contra a superfície (1.4.11).
 */

import type { JSX } from 'react';
import type { XTomDoPainel } from './tipos';

export const TAMANHO_DO_INDICADOR = 12;

/** O que cada status quer dizer, em palavras — para o leitor de tela e para a dica do mouse. */
export const ROTULO_DO_STATUS: Record<XTomDoPainel, string> = {
  neutro: 'sem medida',
  info: 'informativo',
  sucesso: 'no rumo',
  aviso: 'atenção',
  perigo: 'fora do rumo',
};

const COR: Record<XTomDoPainel, string> = {
  neutro: 'hsl(var(--text-muted))',
  info: 'hsl(var(--info))',
  sucesso: 'hsl(var(--success))',
  aviso: 'hsl(var(--warning))',
  perigo: 'hsl(var(--danger))',
};
const MIOLO = 'hsl(var(--brand-surface))';

/** A forma do status num quadro de 12 × 12, para usar DENTRO de um `<svg>` (o chamador posiciona o quadro). */
export function XFormaDeStatus({ tom }: { tom: XTomDoPainel }): JSX.Element {
  const cor = COR[tom];
  switch (tom) {
    case 'sucesso':
      return <path d="M1.8 6.4 L4.7 9.3 L10.2 2.9" fill="none" stroke={cor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
    case 'aviso':
      return (
        <g>
          <path d="M6 0.9 L11.4 10.8 H0.6 Z" fill={cor} stroke={cor} strokeWidth={0.8} strokeLinejoin="round" />
          <path d="M6 4.4 V7.3" stroke={MIOLO} strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={6} cy={9.1} r={0.8} fill={MIOLO} />
        </g>
      );
    case 'perigo':
      return (
        <g>
          <path d="M3.9 0.6 H8.1 L11.4 3.9 V8.1 L8.1 11.4 H3.9 L0.6 8.1 V3.9 Z" fill={cor} />
          <path d="M6 3.1 V6.6" stroke={MIOLO} strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={6} cy={8.6} r={0.8} fill={MIOLO} />
        </g>
      );
    case 'info':
      return (
        <g>
          <circle cx={6} cy={6} r={5.4} fill={cor} />
          <circle cx={6} cy={3.5} r={0.8} fill={MIOLO} />
          <path d="M6 5.4 V8.8" stroke={MIOLO} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      );
    default:
      return <circle cx={6} cy={6} r={4.3} fill="none" stroke={cor} strokeWidth={1.6} />;
  }
}

interface XIndicadorDeStatusProps {
  tom: XTomDoPainel;
  /** Texto para o leitor de tela e a dica do mouse; sem ele, o indicador é decorativo (o texto ao lado já diz). */
  rotulo?: string;
}

/** O indicador como ícone avulso (HTML), no mesmo tamanho do gráfico. */
export function XIndicadorDeStatus({ tom, rotulo }: XIndicadorDeStatusProps): JSX.Element {
  return (
    <svg
      width={TAMANHO_DO_INDICADOR}
      height={TAMANHO_DO_INDICADOR}
      viewBox="0 0 12 12"
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      className="inline-block shrink-0"
    >
      {rotulo && <title>{rotulo}</title>}
      <XFormaDeStatus tom={tom} />
    </svg>
  );
}
