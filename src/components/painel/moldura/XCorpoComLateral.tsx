/**
 * Corpo em duas colunas: o principal, largo, e a lateral de cartões estreitos. As duas colunas têm a MESMA altura
 * (dono, 2026-10-25): o principal estica até a lateral, e quem está nele pode preencher a sobra. No celular (ou
 * área estreita), a lateral desce para baixo do principal.
 *
 * O que abre EMBAIXO do principal (um detalhe, um painel de apoio) vai em `abaixoDoPrincipal` e não rouba altura
 * dele (dono, 2026-10-25): enquanto ele está fechado, o corpo mede a altura do principal; quando abre, o principal
 * fica travado nela e a coluna cresce para baixo. Sem isso, o gráfico que preenche a sobra compactava ao abrir.
 */

import { useEffect, useLayoutEffect, useRef, useState, type JSX, type ReactNode } from 'react';

interface XCorpoComLateralProps {
  principal: ReactNode;
  lateral: ReactNode;
  /** Conteúdo abaixo do principal que não encolhe o principal ao aparecer. Ausente (`null`/`false`) = fechado. */
  abaixoDoPrincipal?: ReactNode;
}

export function XCorpoComLateral({ principal, lateral, abaixoDoPrincipal }: XCorpoComLateralProps): JSX.Element {
  const temAbaixo = abaixoDoPrincipal !== undefined && abaixoDoPrincipal !== null && abaixoDoPrincipal !== false;
  const area = useRef<HTMLDivElement | null>(null);
  const aberto = useRef(temAbaixo);
  // Antes da medição do observador (que vem depois do leiaute): a altura com o "abaixo" aberto nunca é registrada.
  useLayoutEffect(() => {
    aberto.current = temAbaixo;
  }, [temAbaixo]);
  // A altura do principal com o "abaixo" fechado; só se mede enquanto ele está fechado.
  const [alturaLivre, setAlturaLivre] = useState<number | null>(null);

  useEffect(() => {
    const elemento = area.current;
    if (!elemento || typeof ResizeObserver === 'undefined')
      return;
    const observador = new ResizeObserver(([pEntrada]) => {
      if (!aberto.current && pEntrada.contentRect.height > 0)
        setAlturaLivre(pEntrada.contentRect.height);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const travado = temAbaixo && alturaLivre !== null;

  return (
    // `flex-1`: o corpo ocupa a primeira dobra inteira do painel, e a linha da grade estica junto.
    <div className="flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-stretch">
      <div className="min-w-0 flex flex-col">
        <div
          ref={area}
          className={`flex flex-col min-w-0 ${travado ? 'flex-none' : 'flex-1 min-h-0'}`}
          style={travado ? { height: alturaLivre } : undefined}
        >
          {principal}
        </div>
        {temAbaixo && abaixoDoPrincipal}
      </div>
      <aside className="flex flex-col gap-4 min-w-0">{lateral}</aside>
    </div>
  );
}
