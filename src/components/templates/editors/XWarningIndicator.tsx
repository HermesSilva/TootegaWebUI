/**
 * XWarningIndicator — aviso discreto: uma interrogação VERMELHA que só existe quando há o que dizer.
 *
 * Editor GENÉRICO do motor (não é de nenhuma App): o campo carrega um texto de aviso; havendo texto,
 * aparece o sinal, e o texto vem no tooltip. Campo vazio ⇒ não ocupa espaço nenhum na tela.
 *
 * Serve ao caso "o município não publicou alíquota para este serviço": a mensagem importa, mas não
 * merece uma caixa larga permanente no formulário.
 */

import { useState, type JSX } from 'react';
import { HelpCircle } from 'lucide-react';
import type { XEditorProps } from './XEditor';

export function XWarningIndicator({ value }: XEditorProps): JSX.Element | null {
  const [aberto, setAberto] = useState(false);

  const texto = typeof value === 'string' ? value.trim() : '';
  if (texto.length === 0)
    return null;

  return (
    <div className="relative flex items-end h-full pb-2">
      <button
        type="button"
        onClick={() => setAberto((pAtual) => !pAtual)}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        title={texto}
        aria-label={texto}
        className="text-danger hover:opacity-80 transition-opacity"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {aberto && (
        <div
          role="tooltip"
          className="
            absolute bottom-full left-0 mb-1 z-50 w-64
            px-3 py-2 rounded-lg shadow-lg
            bg-brand-surface border border-danger/40
            text-ui-xs text-brand-text-secondary
          "
        >
          {texto}
        </div>
      )}
    </div>
  );
}
