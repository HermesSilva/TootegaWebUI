// O horário da agenda em duas listas (hora e minuto): não se digita, então não há horário inválido. Os minutos vêm de
// 5 em 5; o minuto de uma agenda antiga que não caia nessa conta entra na lista, para não ser trocado sem o operador ver.

import { type JSX } from 'react';

import type { Horario } from '@core/lib/tarefas/agendaGuiada';

interface Props {
  valor: Horario;
  aoMudar: (pHorario: Horario) => void;
  idBase: string;
}

const LISTA = 'px-1.5 py-1 rounded-md border border-border-light bg-brand-background text-ui-xs font-semibold text-brand-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary/50';

const HORAS = Array.from({ length: 24 }, (_, pI) => pI);
const MINUTOS_DE_5_EM_5 = Array.from({ length: 12 }, (_, pI) => pI * 5);

const dois = (pN: number): string => String(pN).padStart(2, '0');

export function XSeletorDeHorario({ valor, aoMudar, idBase }: Props): JSX.Element {
  const minutos = MINUTOS_DE_5_EM_5.includes(valor.minuto)
    ? MINUTOS_DE_5_EM_5
    : [...MINUTOS_DE_5_EM_5, valor.minuto].sort((pA, pB) => pA - pB);

  return (
    <span className="inline-flex items-center gap-1">
      <select id={`${idBase}-hora`} aria-label="Hora" value={valor.hora} className={LISTA}
        onChange={(pE) => aoMudar({ ...valor, hora: Number(pE.target.value) })}>
        {HORAS.map((pH) => <option key={pH} value={pH}>{dois(pH)}</option>)}
      </select>
      <span aria-hidden className="text-brand-text-secondary font-semibold">{':'}</span>
      <select id={`${idBase}-minuto`} aria-label="Minuto" value={valor.minuto} className={LISTA}
        onChange={(pE) => aoMudar({ ...valor, minuto: Number(pE.target.value) })}>
        {minutos.map((pM) => <option key={pM} value={pM}>{dois(pM)}</option>)}
      </select>
    </span>
  );
}
