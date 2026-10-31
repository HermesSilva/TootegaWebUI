/**
 * XTextoFormatado — um texto AsciiDoc INLINE renderizado com a formatação (negrito, itálico, mono, realce, link,
 * tecla…), fora de qualquer área editável. Serve às explicações do modelo de documento, na área de explicação e nas
 * dicas: quem declara o modelo escreve `*assim*` e o texto sai formatado.
 */

import { memo, useMemo, type JSX } from 'react';
import { analisarInline } from './parser/inline';
import { renderizarInline } from './wysiwyg/blocos';

interface XTextoFormatadoProps {
  texto: string;
  className?: string;
}

export const XTextoFormatado = memo(function XTextoFormatado({ texto, className }: XTextoFormatadoProps): JSX.Element {
  const partes = useMemo(() => renderizarInline(analisarInline(texto)), [texto]);
  return <span className={className}>{partes}</span>;
});
