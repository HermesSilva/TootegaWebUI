/**
 * Controle segmentado: escolha exclusiva entre poucas visões da mesma coisa ("Previsto | Realizado | Projeção").
 */

import type { JSX } from 'react';

interface XControleSegmentadoProps<T extends string> {
  rotuloAcessivel: string;
  opcoes: { id: T; rotulo: string }[];
  valor: T;
  aoMudar: (pValor: T) => void;
}

export function XControleSegmentado<T extends string>({
  rotuloAcessivel,
  opcoes,
  valor,
  aoMudar,
}: XControleSegmentadoProps<T>): JSX.Element {
  return (
    <div role="radiogroup" aria-label={rotuloAcessivel} className="inline-flex p-0.5 rounded-md bg-muted-bg">
      {opcoes.map((pOpcao) => {
        const marcada = pOpcao.id === valor;
        return (
          <button
            key={pOpcao.id}
            type="button"
            role="radio"
            aria-checked={marcada}
            onClick={() => aoMudar(pOpcao.id)}
            className={`px-2.5 py-1 rounded text-ui-xs font-medium transition-all duration-150
              ${marcada ? 'bg-brand-surface text-brand-text-primary shadow-sm' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
          >
            {pOpcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
