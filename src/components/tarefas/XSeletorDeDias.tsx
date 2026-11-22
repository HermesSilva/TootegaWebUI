// Os dias da semana como uma linha de calendário (Seg … Dom), que se ligam e desligam, com atalhos para os casos comuns.
// Sempre fica ao menos um dia ligado: o último não se desliga (a dica diz por quê), porque agenda semanal sem dia nunca
// rodaria.

import { type JSX } from 'react';

import { DIAS_NA_TELA, DIAS_UTEIS, FIM_DE_SEMANA, SIGLAS, nomeDoDia, type DiaDaSemana } from '@core/lib/tarefas/agendaGuiada';

interface Props {
  dias: DiaDaSemana[];
  aoMudar: (pDias: DiaDaSemana[]) => void;
}

const ATALHOS: { rotulo: string; dias: DiaDaSemana[] }[] = [
  { rotulo: 'Dias úteis', dias: DIAS_UTEIS },
  { rotulo: 'Fim de semana', dias: FIM_DE_SEMANA },
  { rotulo: 'Todos', dias: [0, 1, 2, 3, 4, 5, 6] },
];

const iguais = (pA: DiaDaSemana[], pB: DiaDaSemana[]): boolean =>
  pA.length === pB.length && pA.every((pD) => pB.includes(pD));

export function XSeletorDeDias({ dias, aoMudar }: Props): JSX.Element {
  const alternar = (pDia: DiaDaSemana): void =>
    aoMudar(dias.includes(pDia) ? dias.filter((pD) => pD !== pDia) : [...dias, pDia]);

  return (
    <div className="space-y-1.5">
      <div role="group" aria-label="Dias da semana" className="grid grid-cols-7 gap-0.5">
        {DIAS_NA_TELA.map((pDia) => {
          const ligado = dias.includes(pDia);
          const ultimo = ligado && dias.length === 1;

          return (
            <button
              key={pDia}
              type="button"
              aria-pressed={ligado}
              aria-label={nomeDoDia(pDia)}
              disabled={ultimo}
              title={ultimo ? 'É o único dia escolhido: ligue outro antes de desligar este.' : nomeDoDia(pDia)}
              onClick={() => alternar(pDia)}
              className={`h-8 rounded-md text-ui-xs font-semibold transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 ${
                ligado ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-text-secondary hover:bg-hover'}`}
            >
              {SIGLAS[pDia]}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        {ATALHOS.map((pA) => (
          <button key={pA.rotulo} type="button" disabled={iguais(dias, pA.dias)} onClick={() => aoMudar(pA.dias)}
            className="px-1.5 py-0.5 rounded text-ui-xs text-brand-primary hover:bg-brand-primary/10 disabled:text-brand-text-secondary disabled:hover:bg-transparent disabled:cursor-default">
            {pA.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
