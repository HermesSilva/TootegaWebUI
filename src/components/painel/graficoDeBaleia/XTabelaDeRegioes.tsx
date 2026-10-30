/**
 * A visão em TABELA do gráfico de baleia: a mesma informação em texto — por região, o texto e o detalhe que quem usa
 * escreveu e os dois semáforos. Existe para quem não lê o gráfico (leitor de tela, impressão, daltonismo) e para quem
 * quer o número exato. Cada célula seleciona a região, como no gráfico.
 */

import type { JSX } from 'react';
import { XSemaforo } from '../elementos/XSemaforo';
import type { XFaseDaBaleia, XRegiaoSelecionada, XRegioesDaBaleia, XTrilhaDaBaleia } from './tipos';

export interface XTabelaDeRegioesProps {
  fases: XFaseDaBaleia[];
  trilhas: XTrilhaDaBaleia[];
  regioes: XRegioesDaBaleia;
  nomesDosSemaforos?: [string, string];
  /** Cabeçalho da coluna das trilhas. */
  rotuloDasTrilhas?: string;
  selecionada: XRegiaoSelecionada | null;
  aoSelecionar: (pRegiao: XRegiaoSelecionada | null) => void;
}

export function XTabelaDeRegioes({
  fases,
  trilhas,
  regioes,
  nomesDosSemaforos = ['Prazo', 'Esforço'],
  rotuloDasTrilhas = 'Trilha',
  selecionada,
  aoSelecionar,
}: XTabelaDeRegioesProps): JSX.Element {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-ui-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-brand-surface px-2 py-2 text-left text-ui-xs font-medium text-brand-text-muted">{rotuloDasTrilhas}</th>
            {fases.map((pFase) => (
              <th key={pFase.id} scope="col" className="px-2 py-2 text-left text-ui-xs font-medium text-brand-text-muted">
                <span className={pFase.estado === 'corrente' ? 'text-brand-primary' : ''}>{pFase.nome}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trilhas.map((pTrilha) => (
            <tr key={pTrilha.id}>
              <th scope="row" className="sticky left-0 bg-brand-surface px-2 py-1.5 text-left font-normal text-brand-text-secondary border-t border-border-light">
                {pTrilha.nome}
              </th>
              {fases.map((pFase) => {
                const dados = regioes[pTrilha.id]?.[pFase.id];
                const marcada = selecionada?.fase === pFase.id && selecionada.trilha === pTrilha.id;
                return (
                  <td key={pFase.id} className="px-1 py-1 border-t border-border-light">
                    {dados && (
                      <button
                        type="button"
                        aria-pressed={marcada}
                        aria-label={dados.descricao}
                        onClick={() => aoSelecionar(marcada ? null : { fase: pFase.id, trilha: pTrilha.id })}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left transition-colors duration-150
                          ${marcada ? 'bg-brand-primary/10 ring-1 ring-brand-primary/40' : 'hover:bg-hover'}`}
                      >
                        <span className="tabular-nums">
                          <span className="text-brand-text-primary">{dados.textoNaTabela}</span>
                          {dados.detalheNaTabela && <span className="block text-ui-xs text-brand-text-muted">{dados.detalheNaTabela}</span>}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <XSemaforo medida={nomesDosSemaforos[0]} tom={dados.semaforos[0]} />
                          <XSemaforo medida={nomesDosSemaforos[1]} tom={dados.semaforos[1]} />
                        </span>
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
