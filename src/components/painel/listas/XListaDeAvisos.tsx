/**
 * LISTA DE AVISOS: pendências, riscos, dependências — o que pede ação —, ordenados pelo PESO (a exposição: quanto custa
 * se nada for feito). Cada aviso mostra o título, o peso já formatado, a natureza numa pastilha no tom do aviso, quem
 * responde, há quantos dias está aberto e uma barra proporcional ao peso. A lista se distribui pela altura do pai (num
 * cartão que preenche a coluna, os itens se espaçam). Vazio é o estado bom: a lista diz que nada pede ação.
 */

import type { JSX, ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import type { XTomDoPainel } from '../elementos/tipos';
import { PASTILHA_DO_TOM, PONTO_DO_TOM } from '../elementos/tons';

export interface XAvisoDaLista {
  id: string;
  titulo: string;
  /** A natureza do aviso, na pastilha ("Risco", "Pendência"). */
  natureza: string;
  tom: XTomDoPainel;
  /** Quem responde pelo aviso (um papel, nunca uma pessoa ranqueada). */
  responsavel?: string;
  /** Há quantos dias o aviso está aberto. */
  dias?: number;
  /** O peso que ordena a lista e dimensiona a barra. */
  peso: number;
  /** O peso já formatado, para exibir ("24 h·h"). */
  rotuloDoPeso: string;
}

export interface XListaDeAvisosProps {
  itens: XAvisoDaLista[];
  /** O que mostrar sem avisos; sem ele, uma mensagem padrão de "nada pede ação". */
  vazio?: ReactNode;
}

export function XListaDeAvisos({ itens, vazio }: XListaDeAvisosProps): JSX.Element {
  if (itens.length === 0)
    return (
      <>
        {vazio ?? (
          <div className="flex items-center gap-3 px-3 py-3 rounded-md bg-success-bg">
            <CircleCheck size={18} className="text-success shrink-0" />
            <p className="text-ui-sm font-medium text-brand-text-primary">{'Nenhum aviso pede ação agora.'}</p>
          </div>
        )}
      </>
    );

  const ordenados = [...itens].sort((pA, pB) => pB.peso - pA.peso);
  const maior = Math.max(1, ...ordenados.map((pA) => pA.peso));

  return (
    <ul className="flex-1 flex flex-col justify-around gap-5 py-1">
      {ordenados.map((pAviso) => (
        <li key={pAviso.id} className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <span className="text-ui font-medium text-brand-text-primary leading-snug">{pAviso.titulo}</span>
            <span className="shrink-0 text-ui-sm font-semibold tabular-nums text-brand-text-secondary">{pAviso.rotuloDoPeso}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-ui-xs font-medium ${PASTILHA_DO_TOM[pAviso.tom]}`}>{pAviso.natureza}</span>
            {(pAviso.responsavel || pAviso.dias !== undefined) && (
              <span className="whitespace-nowrap text-ui-sm text-brand-text-muted">
                {pAviso.responsavel}
                {/* Há quanto tempo o aviso está aberto: outra cor e fonte menor, para não competir com o responsável. */}
                {pAviso.dias !== undefined && (
                  <span
                    className="ml-1.5 text-ui-xs font-medium text-brand-primary tabular-nums"
                    title={`Aberto há ${pAviso.dias} ${pAviso.dias === 1 ? 'dia' : 'dias'}`}
                  >
                    {`(${pAviso.dias}d)`}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted-bg overflow-hidden" aria-hidden="true">
            <div className={`h-full rounded-full ${PONTO_DO_TOM[pAviso.tom]}`} style={{ width: `${(pAviso.peso / maior) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
