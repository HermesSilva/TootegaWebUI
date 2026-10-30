/**
 * Menu suspenso do painel: um botão que abre uma lista ancorada logo abaixo dele, DENTRO da área da App
 * (`absolute`, nunca portal para a página — contenção, skill tootega-front §1). Fecha ao escolher, ao clicar fora
 * e com Esc.
 */

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { XOpcaoDoMenu } from './tipos';

interface XMenuSuspensoProps {
  /** O conteúdo do botão que abre o menu. */
  gatilho: ReactNode;
  rotuloAcessivel: string;
  opcoes: XOpcaoDoMenu[];
  /** Opção marcada (seletor); sem ela, é um menu de comandos. */
  selecionada?: string;
  /** O que a lista diz quando não há opção nenhuma (dono, 2026-10-26). Ausente ⇒ a lista abre vazia. */
  vazio?: string;
  /** Lado em que a lista se alinha ao botão. */
  alinhar?: 'inicio' | 'fim';
  classeDoGatilho?: string;
  aoEscolher: (pID: string) => void;
}

export function XMenuSuspenso({
  gatilho,
  rotuloAcessivel,
  opcoes,
  selecionada,
  vazio,
  alinhar = 'inicio',
  classeDoGatilho = '',
  aoEscolher,
}: XMenuSuspensoProps): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto)
      return;
    function aoClicarFora(pEvento: MouseEvent): void {
      if (raiz.current && !raiz.current.contains(pEvento.target as Node))
        setAberto(false);
    }
    function aoTeclar(pEvento: KeyboardEvent): void {
      if (pEvento.key === 'Escape')
        setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-label={rotuloAcessivel}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((pAntes) => !pAntes)}
        className={classeDoGatilho}
      >
        {gatilho}
      </button>
      {aberto && (
        <div
          role="menu"
          className={`absolute top-full mt-1 ${alinhar === 'fim' ? 'right-0' : 'left-0'} z-10 w-max min-w-[240px] py-1
            bg-brand-surface border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-150`}
        >
          {opcoes.length === 0 && vazio && (
            <p role="note" className="px-3 py-2 text-ui-sm text-brand-text-secondary whitespace-nowrap">{vazio}</p>
          )}
          {opcoes.map((pOpcao) => {
            const Icone = pOpcao.icone;
            const marcada = pOpcao.id === selecionada;
            return (
              <button
                key={pOpcao.id}
                type="button"
                role={selecionada === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={selecionada === undefined ? undefined : marcada}
                onClick={() => { aoEscolher(pOpcao.id); setAberto(false); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-hover transition-colors duration-150
                  ${marcada ? 'text-brand-primary' : 'text-brand-text-primary'}`}
              >
                <span className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
                  {marcada ? <Check size={14} /> : Icone ? <Icone size={14} className="text-brand-text-muted" /> : null}
                </span>
                {/* Nome inteiro, numa linha (dono, 2026-10-25): a lista tem a largura do maior nome. */}
                <span className="flex flex-col whitespace-nowrap">
                  <span className="text-ui-sm font-medium">{pOpcao.rotulo}</span>
                  {pOpcao.detalhe && <span className="text-ui-xs text-brand-text-muted">{pOpcao.detalhe}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
