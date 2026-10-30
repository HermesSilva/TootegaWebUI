/**
 * Cartão do painel: título com ícone, um complemento à direita (filtro, link "ver tudo") e o corpo. O estado vazio
 * é parte do cartão — vazio é informação ("calmo"), não buraco na tela.
 */

import type { JSX, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface XCartaoDoPainelProps {
  titulo: string;
  icone?: LucideIcon;
  /** Uma linha de apoio sob o título. */
  subtitulo?: string;
  complemento?: ReactNode;
  /** Quando verdadeiro, mostra `vazio` no lugar do corpo. */
  estaVazio?: boolean;
  vazio?: ReactNode;
  /** Corpo sem o recuo padrão (grade que vai de borda a borda). */
  semRecuo?: boolean;
  /** O cartão ocupa a altura toda do pai e o corpo estica — para um gráfico que preenche a sobra. */
  preencher?: boolean;
  className?: string;
  children?: ReactNode;
}

export function XCartaoDoPainel({
  titulo,
  icone: Icone,
  subtitulo,
  complemento,
  estaVazio = false,
  vazio,
  semRecuo = false,
  preencher = false,
  className = '',
  children,
}: XCartaoDoPainelProps): JSX.Element {
  return (
    <section className={`flex flex-col bg-brand-surface rounded-lg border border-border-light shadow-sm ${preencher ? 'flex-1 min-h-0' : ''} ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        {/* O título vem inteiro, numa linha (dono, 2026-10-25); faltando espaço, quem cede é o complemento. */}
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 whitespace-nowrap text-ui font-semibold text-brand-text-primary">
            {Icone && <Icone size={16} className="text-brand-primary shrink-0" />}
            <span>{titulo}</span>
          </h2>
          {subtitulo && <p className="mt-0.5 text-ui-xs text-brand-text-muted">{subtitulo}</p>}
        </div>
        {complemento && <div className="min-w-0">{complemento}</div>}
      </div>
      <div className={`${semRecuo ? 'pb-2' : 'px-4 pb-4'} ${preencher ? 'flex-1 min-h-0 flex flex-col' : ''}`}>{estaVazio ? vazio : children}</div>
    </section>
  );
}
