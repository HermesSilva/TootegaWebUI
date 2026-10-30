/**
 * Abas do painel: uma fileira só, que rola na horizontal quando não cabe (no celular, nunca quebra em duas
 * linhas). A aba ativa é marcada pelo traço da cor da marca. Logo depois da última aba, um complemento opcional (o
 * painel de trabalho põe a faixa "precisa de você" no cabeçalho, linha 1 — dono, 2026-10-25).
 *
 * Teclado no padrão WAI-ARIA de abas: só a aba ativa entra no Tab; setas esquerda/direita andam entre as abas (com
 * volta), Home e End vão à primeira e à última, e a aba focada já se ativa. O contador tem texto para leitor de tela.
 */

import { useRef, type JSX, type KeyboardEvent, type ReactNode } from 'react';
import type { XAbaDoPainel } from '../elementos/tipos';

interface XAbasDoPainelProps {
  abas: XAbaDoPainel[];
  ativa: string;
  aoTrocar: (pID: string) => void;
  complemento?: ReactNode;
  /** Na ponta direita da linha: os minipainéis que a sub-App manda para cá (`XNoPainel linha={2}`). */
  extras?: ReactNode;
}

export function XAbasDoPainel({ abas, ativa, aoTrocar, complemento, extras }: XAbasDoPainelProps): JSX.Element {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  const aoTeclar = (pEvento: KeyboardEvent<HTMLDivElement>): void => {
    const atual = abas.findIndex((pA) => pA.id === ativa);
    const destino = {
      ArrowRight: (atual + 1) % abas.length,
      ArrowLeft: (atual - 1 + abas.length) % abas.length,
      Home: 0,
      End: abas.length - 1,
    }[pEvento.key];

    if (destino === undefined || abas.length === 0)
      return;

    pEvento.preventDefault();
    aoTrocar(abas[destino].id);
    botoes.current[destino]?.focus();
  };

  return (
    // A lista de abas ocupa só o próprio tamanho (encolhe e rola só quando falta espaço), e o complemento vem LOGO
    // DEPOIS da última aba (dono, 2026-10-25) — com `flex-1` na lista, ele ia parar na borda direita da linha. Uma
    // linha só, sem reticências nem quebra (dono, 2026-10-25): faltando espaço, quem cede primeiro é o complemento e
    // os extras (`shrink-[100]`, rolando dentro da própria caixa); as abas só encolhem — e rolam — depois deles.
    <div className="flex items-center gap-3 pr-2 sm:pr-4 bg-brand-surface border-b border-border-light">
      <div role="tablist" onKeyDown={aoTeclar} className="flex-initial min-w-0 flex gap-1 px-2 sm:px-4 overflow-x-auto scrollbar-thin">
        {abas.map((pAba, pIndice) => {
          const selecionada = pAba.id === ativa;
          const temContador = pAba.contador !== undefined && pAba.contador > 0;
          return (
            <button
              key={pAba.id}
              ref={(pBotao) => { botoes.current[pIndice] = pBotao; }}
              type="button"
              role="tab"
              id={`aba-do-painel-${pAba.id}`}
              aria-selected={selecionada}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => aoTrocar(pAba.id)}
              className={`relative shrink-0 h-row px-3 flex items-center gap-1.5 text-ui-sm whitespace-nowrap transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary rounded-sm
                ${selecionada ? 'text-brand-primary font-medium' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
            >
              {pAba.rotulo}
              {temContador && (
                <span
                  aria-label={`${pAba.contador} ${pAba.rotuloDoContador || (pAba.contador === 1 ? 'item' : 'itens')}`}
                  className="min-w-[18px] px-1 rounded-full bg-muted-bg text-ui-xs text-brand-text-secondary text-center"
                >
                  {pAba.contador}
                </span>
              )}
              <span
                aria-hidden="true"
                className={`absolute left-2 right-2 bottom-0 h-0.5 rounded-full transition-colors duration-150
                  ${selecionada ? 'bg-brand-primary' : 'bg-transparent'}`}
              />
            </button>
          );
        })}
      </div>
      {complemento && <div className="min-w-0 shrink-[100]">{complemento}</div>}
      {extras && <div className="ml-auto min-w-0 shrink-[100] flex items-center gap-2 overflow-x-auto scrollbar-hide">{extras}</div>}
    </div>
  );
}
