// O editor de horário e repetição de uma tarefa (dono, 2026-11-20): um DROPDOWN compacto, como um seletor de data. O
// campo mostra a agenda em português; aberto, o operador escolhe a forma (intervalo, diário, semanal, mensal) e
// preenche só com grades de botões e listas — nada se digita, então toda escolha é uma agenda válida. Embaixo, a frase
// do que vai acontecer; "Aplicar" manda ao servidor o texto montado, e o servidor confere de novo e recalcula a próxima
// execução. Esc ou clique fora fecham sem mudar nada.
//
// A agenda que não veio do editor (uma expressão escrita à mão, de antes) aparece como personalizada: o editor diz como
// ela roda hoje e só a troca se o operador escolher e aplicar.

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { CalendarClock, ChevronDown, RotateCcw } from 'lucide-react';

import { api } from '@core/lib/api';
import {
  DIAS_UTEIS, QUANTIDADES, ULTIMO_DIA_DO_MES, deTexto, descrever, paraTexto,
  type AgendaGuiada, type Horario, type UnidadeDoIntervalo,
} from '@core/lib/tarefas/agendaGuiada';
import { ROTA_DAS_TAREFAS, type TarefaAgendada } from '@core/lib/tarefas/tipos';
import { XSeletorDeHorario } from './XSeletorDeHorario';
import { XSeletorDeDias } from './XSeletorDeDias';
import type { AcaoDaGerencia } from './useAcaoDaGerencia';

interface Props {
  tarefa: TarefaAgendada;
  acao: AcaoDaGerencia;
}

type Forma = AgendaGuiada['forma'];

const FORMAS: { forma: Forma; rotulo: string }[] = [
  { forma: 'intervalo', rotulo: 'Intervalo' },
  { forma: 'diaria', rotulo: 'Diário' },
  { forma: 'semanal', rotulo: 'Semanal' },
  { forma: 'mensal', rotulo: 'Mensal' },
];

const DIAS_DO_MES = Array.from({ length: ULTIMO_DIA_DO_MES }, (_, pI) => pI + 1);
const HORARIO_PADRAO: Horario = { hora: 3, minuto: 0 };

/** Célula de grade (dia do mês, quantidade): o mesmo desenho de um calendário. */
const celula = (pEscolhida: boolean): string =>
  `h-8 rounded-md text-ui-xs font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 ${
    pEscolhida ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-text-primary hover:bg-hover'}`;

function horarioDe(pAgenda: AgendaGuiada): Horario {
  return pAgenda.forma !== 'intervalo' ? { hora: pAgenda.hora, minuto: pAgenda.minuto } : HORARIO_PADRAO;
}

/** Ao trocar de forma, o que já foi escolhido segue valendo onde faz sentido (o horário, sobretudo). */
function naForma(pForma: Forma, pAtual: AgendaGuiada): AgendaGuiada {
  const horario = horarioDe(pAtual);

  switch (pForma) {
    case 'intervalo':
      return pAtual.forma === 'intervalo' ? pAtual : { forma: 'intervalo', quantidade: 30, unidade: 'minutos' };
    case 'diaria':
      return { forma: 'diaria', ...horario };
    case 'semanal':
      return { forma: 'semanal', dias: pAtual.forma === 'semanal' ? pAtual.dias : DIAS_UTEIS, ...horario };
    case 'mensal':
      return { forma: 'mensal', dia: pAtual.forma === 'mensal' ? pAtual.dia : 1, ...horario };
  }
}

export function XEditorDeAgenda({ tarefa, acao }: Props): JSX.Element {
  const atual = useMemo(() => deTexto(tarefa.agenda), [tarefa.agenda]);
  const padrao = useMemo(() => deTexto(tarefa.agendaPadrao), [tarefa.agendaPadrao]);
  const inicial = (): AgendaGuiada => atual ?? padrao ?? { forma: 'diaria', ...HORARIO_PADRAO };

  const [aberto, setAberto] = useState(false);
  const [agenda, setAgenda] = useState<AgendaGuiada>(inicial);
  const caixa = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);

  const chave = `agenda:${tarefa.id}`;
  const gravando = acao.emAndamento === chave;
  const idBase = `agenda-${tarefa.id}`;
  const texto = paraTexto(agenda);
  const mudou = texto !== tarefa.agenda.trim();
  const ehPadrao = tarefa.agenda.trim() === tarefa.agendaPadrao.trim();

  const fechar = (): void => {
    setAberto(false);
    gatilho.current?.focus();
  };

  // Clique fora fecha, como em todo dropdown.
  useEffect(() => {
    if (!aberto)
      return undefined;
    const aoClicar = (pE: MouseEvent): void => {
      if (caixa.current && !caixa.current.contains(pE.target as Node))
        setAberto(false);
    };
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  const abrir = (): void => {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAgenda(inicial());
    setAberto(true);
  };

  const gravar = async (pAgenda: string): Promise<void> => {
    if (await acao.executar(chave, () => api.put(`${ROTA_DAS_TAREFAS}/${tarefa.id}/agenda`, { agenda: pAgenda })))
      fechar();
  };

  const mudarHorario = (pH: Horario): void => {
    if (agenda.forma !== 'intervalo')
      setAgenda({ ...agenda, ...pH });
  };

  return (
    <div ref={caixa} className="relative inline-block" onKeyDown={(pE) => { if (pE.key === 'Escape' && aberto) { pE.stopPropagation(); fechar(); } }}>
      <button
        ref={gatilho}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Agenda de ${tarefa.titulo}: ${tarefa.agendaDescrita}. Abrir para trocar.`}
        onClick={abrir}
        className={`group inline-flex items-center gap-2 max-w-[16rem] pl-2 pr-1.5 py-1 rounded-md border text-left text-ui-sm transition-colors ${
          aberto ? 'border-brand-primary ring-2 ring-brand-primary/30' : 'border-transparent hover:border-border-light hover:bg-hover'}`}
      >
        <CalendarClock className="w-4 h-4 shrink-0 text-brand-primary" aria-hidden />
        <span className="text-brand-text-primary">{tarefa.agendaDescrita}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-brand-text-secondary transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label={`Agenda de ${tarefa.titulo}`}
          className="absolute left-0 top-full mt-1 z-30 w-80 rounded-xl border border-border-light bg-brand-surface shadow-xl p-3 space-y-3"
        >
          {atual === null && (
            <p className="text-ui-xs text-warning">
              {`Hoje: expressão personalizada (${tarefa.agendaDescrita}). Só muda se você escolher e aplicar.`}
            </p>
          )}

          <div role="radiogroup" aria-label="Forma da repetição" className="grid grid-cols-4 gap-0.5 p-0.5 rounded-lg bg-muted-bg/70">
            {FORMAS.map(({ forma, rotulo }) => (
              <button key={forma} type="button" role="radio" aria-checked={agenda.forma === forma}
                onClick={() => setAgenda(naForma(forma, agenda))}
                className={`py-1 rounded-md text-ui-xs font-semibold transition-colors ${
                  agenda.forma === forma ? 'bg-brand-surface text-brand-primary shadow-sm' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}>
                {rotulo}
              </button>
            ))}
          </div>

          {agenda.forma === 'intervalo' && (
            <div className="space-y-2">
              <div role="radiogroup" aria-label="Unidade" className="flex gap-1">
                {(['minutos', 'horas'] as UnidadeDoIntervalo[]).map((pU) => (
                  <button key={pU} type="button" role="radio" aria-checked={agenda.unidade === pU}
                    onClick={() => setAgenda({ forma: 'intervalo', unidade: pU, quantidade: QUANTIDADES[pU].includes(agenda.quantidade) ? agenda.quantidade : QUANTIDADES[pU][0] })}
                    className={`px-2.5 py-0.5 rounded-full text-ui-xs font-semibold border ${
                      agenda.unidade === pU ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : 'border-border-light text-brand-text-secondary hover:bg-hover'}`}>
                    {pU === 'minutos' ? 'Minutos' : 'Horas'}
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="A cada quantos" className="grid grid-cols-4 gap-1">
                {[...new Set([...QUANTIDADES[agenda.unidade], agenda.quantidade])].sort((pA, pB) => pA - pB).map((pQ) => (
                  <button key={pQ} type="button" role="radio" aria-checked={agenda.quantidade === pQ}
                    aria-label={`a cada ${pQ} ${agenda.unidade}`}
                    onClick={() => setAgenda({ ...agenda, quantidade: pQ })} className={celula(agenda.quantidade === pQ)}>
                    {pQ}
                  </button>
                ))}
              </div>
              <p className="text-ui-xs text-brand-text-secondary">{'Conta do fim da execução anterior: uma demorada não se sobrepõe à seguinte.'}</p>
            </div>
          )}

          {agenda.forma === 'semanal' && <XSeletorDeDias dias={agenda.dias} aoMudar={(pDias) => setAgenda({ ...agenda, dias: pDias })} />}

          {agenda.forma === 'mensal' && (
            <div className="space-y-1">
              <div role="radiogroup" aria-label="Dia do mês" className="grid grid-cols-7 gap-0.5">
                {DIAS_DO_MES.map((pD) => (
                  <button key={pD} type="button" role="radio" aria-checked={agenda.dia === pD} aria-label={`dia ${pD}`}
                    onClick={() => setAgenda({ ...agenda, dia: pD })} className={celula(agenda.dia === pD)}>
                    {pD}
                  </button>
                ))}
              </div>
              <p className="text-ui-xs text-brand-text-secondary">{`Até o dia ${ULTIMO_DIA_DO_MES}, que todo mês tem.`}</p>
            </div>
          )}

          {agenda.forma !== 'intervalo' && (
            <div className="flex items-center justify-between">
              <span className="text-ui-xs font-semibold text-brand-text-secondary">{'Horário'}</span>
              <XSeletorDeHorario idBase={idBase} valor={horarioDe(agenda)} aoMudar={mudarHorario} />
            </div>
          )}

          <div className="pt-2 border-t border-border-light space-y-2">
            <p className="text-ui-xs text-brand-text-secondary" aria-live="polite">
              {'Vai rodar '}<strong className="text-brand-text-primary">{descrever(agenda)}</strong>{' (horário de Brasília).'}
            </p>
            <div className="flex items-center gap-2">
              {!ehPadrao && (
                <button type="button" disabled={gravando} onClick={() => void gravar('')}
                  title={`Volta à agenda com que a tarefa nasceu: ${padrao ? descrever(padrao) : tarefa.agendaPadrao}.`}
                  aria-label={`Voltar à padrão (${padrao ? descrever(padrao) : tarefa.agendaPadrao})`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-ui-xs text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                  {'Padrão'}
                </button>
              )}
              <button type="button" disabled={!mudou || gravando} onClick={() => void gravar(texto)}
                title={mudou ? 'Grava a agenda e recalcula a próxima execução.' : 'É a agenda de hoje: mude algo para aplicar.'}
                className="ml-auto px-3 py-1.5 rounded-md bg-brand-primary text-white text-ui-xs font-semibold hover:bg-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                {gravando ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
