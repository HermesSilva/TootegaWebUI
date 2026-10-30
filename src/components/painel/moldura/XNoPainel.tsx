/**
 * MINIPAINÉIS NAS LINHAS DO PAINEL (dono, 2026-10-25): a sub-App que está no corpo de um painel de trabalho pode pôr
 * um controle seu — o "Como estava em", um filtro, um botão de visão — na LINHA 1 (o cabeçalho, à direita) ou na
 * LINHA 2 (a das abas, à direita), em vez de gastar uma faixa do corpo.
 *
 *   <XNoPainel linha={2}><XMenuSuspenso … /></XNoPainel>
 *
 * O painel expõe os dois pontos de encaixe por contexto (`XEncaixesDoPainel`), e o `XNoPainel` leva o conteúdo para lá
 * por portal — continua sendo um componente da sub-App (estado, eventos, ciclo de vida): trocou de seção, ele some
 * junto. FORA de um painel (a mesma App aberta sozinha), desenha no lugar onde foi escrito, e a sub-App não precisa
 * saber onde está. Os encaixes ficam dentro da área da App (contenção, skill tootega-front §1).
 */

import { createContext, useContext, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A linha do painel: 1 = cabeçalho; 2 = abas. */
export type XLinhaDoPainel = 1 | 2;

interface ValorDosEncaixes {
  linha1: HTMLElement | null;
  linha2: HTMLElement | null;
}

const ContextoDosEncaixes = createContext<ValorDosEncaixes | null>(null);

interface XEncaixesDoPainelProps {
  linha1: HTMLElement | null;
  linha2: HTMLElement | null;
  children: ReactNode;
}

/** Quem desenha o painel envolve o corpo com isto, apontando os elementos das duas linhas. */
export function XEncaixesDoPainel({ linha1, linha2, children }: XEncaixesDoPainelProps): JSX.Element {
  return <ContextoDosEncaixes.Provider value={{ linha1, linha2 }}>{children}</ContextoDosEncaixes.Provider>;
}

interface XNoPainelProps {
  linha: XLinhaDoPainel;
  children: ReactNode;
}

/** Leva o conteúdo para a linha 1 ou 2 do painel; fora de um painel, desenha no lugar. */
export function XNoPainel({ linha, children }: XNoPainelProps): JSX.Element | null {
  const encaixes = useContext(ContextoDosEncaixes);
  if (!encaixes)
    return <>{children}</>;
  const alvo = linha === 1 ? encaixes.linha1 : encaixes.linha2;
  // Dentro do painel, o encaixe aparece um instante depois da primeira pintura: até lá, nada (sem piscar no corpo).
  return alvo ? createPortal(children, alvo) : null;
}

/** Verdadeiro dentro do corpo de um painel de trabalho (a sub-App pode ajustar o próprio leiaute). */
export function useDentroDoPainel(): boolean {
  return useContext(ContextoDosEncaixes) !== null;
}
