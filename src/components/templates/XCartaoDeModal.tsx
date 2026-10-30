/**
 * XCartaoDeModal — o CARTÃO de um diálogo escrito à mão (conta, mensagem, importação…), já com a moldura
 * comum a todo diálogo (dono, 2026-10-25): borda de 2px um pouco mais clara que o fundo, brilho discreto e
 * redimensionar pelas arestas e cantos, em tempo real e contido na área do App.
 *
 * É o `useMolduraDeModal` empacotado num elemento: quem já tem o seu cartão troca o `<div>` por este e
 * mantém as classes de layout. Diálogo novo não escreve cartão — usa o `XModalShell`, que já o tem.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';

import { useMolduraDeModal } from '@core/hooks/useMolduraDeModal';

interface XCartaoDeModalProps {
  /** Classes de layout do cartão (largura, altura, flex, fundo, cantos). Borda e sombra vêm da moldura. */
  className?: string;
  style?: CSSProperties;
  role?: string;
  'aria-modal'?: boolean;
  'aria-labelledby'?: string;
  'data-testid'?: string;
  larguraMinima?: number;
  alturaMinima?: number;
  children: ReactNode;
}

export function XCartaoDeModal({
  className = '',
  style,
  larguraMinima,
  alturaMinima,
  children,
  ...atributos
}: XCartaoDeModalProps): JSX.Element {
  const moldura = useMolduraDeModal({ larguraMinima, alturaMinima });

  return (
    <div
      ref={moldura.ref}
      style={style}
      className={`x-moldura-modal relative transition-none will-change-transform ${className}`}
      {...atributos}
    >
      {moldura.alcasDeRedimensionar}
      {children}
    </div>
  );
}
