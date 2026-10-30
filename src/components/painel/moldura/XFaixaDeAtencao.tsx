/**
 * "Precisa de você": a faixa só existe quando há algo a fazer (carga inversa — fluxo saudável, tela silenciosa).
 * Cada motivo é um botão que leva ao lugar; dispensar (o "x") só existe quando quem usa a faixa o pede. Sem
 * motivos, nada é desenhado.
 *
 * `compacta` é a versão da fileira das abas (dono, 2026-10-25): o mesmo destaque, na altura da linha, rolando na
 * horizontal se os motivos não couberem. Cada motivo aparece inteiro, numa linha, sem reticências.
 */

import type { JSX } from 'react';
import { BellRing, X } from 'lucide-react';
import type { XItemDeAtencao } from '../elementos/tipos';
import { XIndicadorDeStatus } from '../elementos/XIndicadorDeStatus';

interface XFaixaDeAtencaoProps {
  titulo: string;
  itens: XItemDeAtencao[];
  aoAbrir: (pID: string) => void;
  /** Sem ele, o motivo não tem o botão de dispensar (o "x"). */
  aoDispensar?: (pID: string) => void;
  compacta?: boolean;
}

export function XFaixaDeAtencao({ titulo, itens, aoAbrir, aoDispensar, compacta = false }: XFaixaDeAtencaoProps): JSX.Element | null {
  if (itens.length === 0)
    return null;

  return (
    <section
      aria-label={titulo}
      className={compacta
        ? 'flex items-center gap-2.5 pl-2.5 pr-1 py-1 rounded-lg bg-warning-bg border border-warning/30 overflow-x-auto scrollbar-thin animate-in fade-in duration-200'
        : 'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 rounded-lg bg-warning-bg border border-warning/30 animate-in fade-in duration-200'}
    >
      <span className={`flex items-center gap-2 shrink-0 font-semibold text-brand-text-primary ${compacta ? 'text-ui-xs' : 'text-ui-sm'}`}>
        <BellRing size={compacta ? 14 : 16} className="text-warning" />
        <span className={compacta ? 'hidden md:inline whitespace-nowrap' : ''}>{titulo}</span>
      </span>
      <ul className={`flex items-center gap-2 ${compacta ? 'flex-nowrap' : 'flex-wrap'}`}>
        {itens.map((pItem) => (
          <li key={pItem.id} className="shrink-0 flex items-center rounded-full bg-brand-surface border border-border-light shadow-sm">
            <button
              type="button"
              onClick={() => aoAbrir(pItem.id)}
              className={`flex items-center gap-2 pl-3 ${aoDispensar ? 'pr-2' : 'pr-3'} whitespace-nowrap text-brand-text-primary hover:text-brand-primary transition-colors duration-150
                ${compacta ? 'py-0.5 text-ui-xs' : 'py-1 text-ui-sm'}`}
            >
              <XIndicadorDeStatus tom={pItem.tom} />
              <span className="font-semibold tabular-nums">{pItem.quantidade}</span>
              <span>{pItem.rotulo}</span>
            </button>
            {aoDispensar && (
              <button
                type="button"
                aria-label={`Dispensar: ${pItem.quantidade} ${pItem.rotulo}`}
                onClick={() => aoDispensar(pItem.id)}
                className="mr-1 p-1 rounded-full text-brand-text-muted hover:bg-hover hover:text-brand-text-primary transition-colors duration-150"
              >
                <X size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
