/**
 * XWrapPanel — o painel que QUEBRA LINHA (dono, 2026-10-26): os itens fluem da esquerda para a direita, cada um no seu
 * próprio tamanho, e passam para a linha seguinte quando a largura acaba — o WrapPanel do WPF. É o comportamento PADRÃO
 * dos painéis de uma área SubAppX que listam coisas (os cartões de projeto da Gerência da Empresa, e os que vierem).
 *
 * Genérico: não conhece o item — quem dá o tamanho é o filho (largura declarada, piso dos editores, conteúdo). `as`
 * escolhe o elemento raiz: `ul` quando os itens são `li` (lista semântica, com `aria-label`); `div` nos demais casos.
 * Alinhado ao topo e ao início: a linha não estica os itens, e a sobra fica embaixo e à direita.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';

export interface XWrapPanelProps {
  children: ReactNode;
  /** Elemento raiz: `ul` para itens `li` (padrão `div`). */
  as?: 'div' | 'ul';
  /** Espaço entre os itens, em px, nas duas direções (padrão 12). */
  espaco?: number;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

export function XWrapPanel({ children, as: Raiz = 'div', espaco = 12, className = '', style, ...aria }: XWrapPanelProps): JSX.Element {
  return (
    <Raiz
      data-painel="wrap"
      aria-label={aria['aria-label']}
      className={`flex flex-wrap items-start content-start w-full ${className}`}
      style={{ gap: espaco, ...style }}
    >
      {children}
    </Raiz>
  );
}
