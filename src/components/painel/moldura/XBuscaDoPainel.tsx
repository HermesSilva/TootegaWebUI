/**
 * Busca de comando do AppX (dono, 2026-10-25 — ADR-ANVIL-0006, RI-5): Ctrl+K abre uma caixa (o botão do cabeçalho saiu —
 * dono, 2026-10-26)
 * para ir, pelo teclado, a um nível, a uma aba ou a um registro do AppX. Contida na área do AppX — nunca cobre a casca
 * nem as abas (skill tootega-front §1). Combobox no padrão WAI-ARIA: setas andam na lista, Enter escolhe, Esc fecha.
 */

import { useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';

/** Uma opção da busca: o que aparece, o grupo dela ("Abas", "Projetos") e o que acontece ao escolher. */
export interface XOpcaoDaBusca {
  id: string;
  rotulo: string;
  grupo: string;
  detalhe?: string;
  aoEscolher: () => void;
}

interface XBuscaDoPainelProps {
  opcoes: XOpcaoDaBusca[];
  aoFechar: () => void;
}

/** Sem acento e sem caixa: quem busca "gerencia" acha "Gerência". */
function normalizar(pTexto: string): string {
  return pTexto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function XBuscaDoPainel({ opcoes, aoFechar }: XBuscaDoPainelProps): JSX.Element {
  const [termo, setTermo] = useState('');
  const [indice, setIndice] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => campo.current?.focus(), []);

  const achadas = useMemo(() => {
    const busca = normalizar(termo.trim());
    return busca.length === 0
      ? opcoes
      : opcoes.filter((pO) => normalizar(`${pO.rotulo} ${pO.detalhe ?? ''} ${pO.grupo}`).includes(busca));
  }, [opcoes, termo]);

  const escolher = (pOpcao: XOpcaoDaBusca | undefined): void => {
    if (!pOpcao)
      return;
    aoFechar();
    pOpcao.aoEscolher();
  };

  const aoTeclar = (pEvento: KeyboardEvent<HTMLInputElement>): void => {
    if (pEvento.key === 'Escape') {
      pEvento.preventDefault();
      aoFechar();
    } else if (pEvento.key === 'ArrowDown') {
      pEvento.preventDefault();
      setIndice((pI) => Math.min(pI + 1, Math.max(achadas.length - 1, 0)));
    } else if (pEvento.key === 'ArrowUp') {
      pEvento.preventDefault();
      setIndice((pI) => Math.max(pI - 1, 0));
    } else if (pEvento.key === 'Enter') {
      pEvento.preventDefault();
      escolher(achadas[indice]);
    }
  };

  return (
    // Contida no AppX (absolute sobre o painel, que é o pai posicionado): a casca e as abas ficam livres.
    <div className="absolute inset-0 z-20 flex items-start justify-center pt-16 px-4 bg-black/30" onMouseDown={aoFechar}>
      <div
        role="dialog"
        aria-label="Ir para"
        className="w-full max-w-[560px] rounded-lg bg-brand-surface border border-border shadow-lg overflow-hidden"
        onMouseDown={(pE) => pE.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b border-border-light">
          <Search size={16} className="shrink-0 text-brand-text-secondary" aria-hidden="true" />
          <input
            ref={campo}
            role="combobox"
            aria-expanded="true"
            aria-controls="busca-do-painel-lista"
            aria-activedescendant={achadas[indice] ? `busca-do-painel-${achadas[indice].id}` : undefined}
            aria-label="Ir para um nível, uma aba ou um registro"
            placeholder="Ir para…"
            value={termo}
            onChange={(pE) => { setTermo(pE.target.value); setIndice(0); }}
            onKeyDown={aoTeclar}
            className="flex-1 h-11 bg-transparent text-ui text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none"
          />
          <kbd className="shrink-0 px-1.5 py-0.5 rounded border border-border text-ui-xs text-brand-text-secondary">Esc</kbd>
        </div>
        <ul id="busca-do-painel-lista" role="listbox" aria-label="Destinos" className="max-h-[320px] overflow-y-auto py-1">
          {achadas.length === 0 && (
            <li className="px-4 py-3 text-ui-sm text-brand-text-secondary">{`Nada encontrado para "${termo.trim()}".`}</li>
          )}
          {achadas.map((pO, pI) => (
            <li
              key={pO.id}
              id={`busca-do-painel-${pO.id}`}
              role="option"
              aria-selected={pI === indice}
              onMouseEnter={() => setIndice(pI)}
              onClick={() => escolher(pO)}
              className={`flex items-baseline justify-between gap-3 px-4 py-2 cursor-pointer whitespace-nowrap ${pI === indice ? 'bg-hover' : ''}`}
            >
              <span className="text-ui-sm text-brand-text-primary">{pO.rotulo}</span>
              <span className="text-ui-xs text-brand-text-secondary">{pO.detalhe ? `${pO.grupo} · ${pO.detalhe}` : pO.grupo}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
