// O histórico das execuções, as mais recentes primeiro, de todas as tarefas ou de uma só. Escolher uma abre o log dela
// ao lado — ao vivo, se ainda estiver rodando.

import { useState, type JSX } from 'react';

import { formatDateTime } from '@core/lib/formatting';
import { formatarDuracao } from '@core/lib/tarefas/logDaExecucao';
import { ROTA_DAS_TAREFAS, SITUACAO_CONCLUIDA, SITUACAO_EM_EXECUCAO, SITUACAO_FALHOU, type ExecucaoTarefa, type TarefaAgendada } from '@core/lib/tarefas/tipos';
import { XFalhaDaConsulta } from './XFalhaDaConsulta';
import { XLogDaExecucao } from './XLogDaExecucao';
import { useConsultaDaGerencia } from './useConsultaDaGerencia';

interface Props {
  tarefa: TarefaAgendada | null;
  tarefas: TarefaAgendada[];
  aoEscolherTarefa: (pTarefa: TarefaAgendada | null) => void;
}

function corDaSituacao(pSituacaoID: number): string {
  switch (pSituacaoID) {
    case SITUACAO_CONCLUIDA: return 'text-success';
    case SITUACAO_FALHOU: return 'text-danger';
    case SITUACAO_EM_EXECUCAO: return 'text-brand-primary';
    default: return 'text-warning';
  }
}

export function XListaDeExecucoes({ tarefa, tarefas, aoEscolherTarefa }: Props): JSX.Element {
  const rota = `${ROTA_DAS_TAREFAS}/execucoes?limite=100${tarefa ? `&tarefa=${tarefa.id}` : ''}`;
  const consulta = useConsultaDaGerencia<ExecucaoTarefa[]>(['execucoes', tarefa?.id ?? 'todas'], rota);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const execucoes = consulta.data ?? [];
  const aberta = execucoes.find((pE) => pE.id === escolhida) ?? null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <label htmlFor="tarefas-filtro-execucoes" className="text-ui-sm text-brand-text-secondary">{'Tarefa'}</label>
        <select
          id="tarefas-filtro-execucoes"
          value={tarefa?.id ?? ''}
          onChange={(pE) => { setEscolhida(null); aoEscolherTarefa(tarefas.find((pT) => pT.id === pE.target.value) ?? null); }}
          className="px-2 py-1 rounded-md border border-border-light bg-brand-background text-ui-sm"
        >
          <option value="">{'Todas'}</option>
          {tarefas.map((pT) => <option key={pT.id} value={pT.id}>{pT.titulo}</option>)}
        </select>
      </div>

      {consulta.isError ? (
        <XFalhaDaConsulta oQue="execuções" erro={consulta.error} aoTentar={() => void consulta.refetch()} />
      ) : (
        <div className="flex-1 min-h-0 grid gap-3 px-3 pb-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-auto border border-border-light rounded-lg">
            {!consulta.data ? (
              <p className="p-3 text-ui-sm text-brand-text-secondary">{'Lendo o histórico…'}</p>
            ) : execucoes.length === 0 ? (
              <p className="p-3 text-ui-sm text-brand-text-secondary">
                {tarefa ? 'Esta tarefa ainda não rodou (ou o histórico dela já passou do prazo de guarda e foi expurgado).' : 'Nenhuma tarefa rodou ainda.'}
              </p>
            ) : (
              <ul className="divide-y divide-border-light">
                {execucoes.map((pE) => (
                  <li key={pE.id}>
                    <button type="button" onClick={() => setEscolhida(pE.id)} aria-pressed={pE.id === escolhida}
                      className={`w-full text-left px-3 py-2 hover:bg-hover ${pE.id === escolhida ? 'bg-brand-primary/10' : ''}`}>
                      <div className="flex items-center gap-2 text-ui-sm">
                        <span className="font-medium text-brand-text-primary truncate">{pE.tarefa}</span>
                        <span className={`ml-auto shrink-0 font-semibold ${corDaSituacao(pE.situacaoID)}`}>{pE.situacao}</span>
                      </div>
                      <div className="text-ui-xs text-brand-text-secondary">
                        {`${pE.origem} · ${formatDateTime(pE.inicio ?? pE.agendadaPara)} · ${formatarDuracao(pE.duracaoMs)}${pE.tentativa > 1 ? ` · tentativa ${pE.tentativa}` : ''}${pE.servidor ? ` · ${pE.servidor}` : ''}`}
                      </div>
                      {(pE.resultado || pE.falha) && (
                        <div className={`text-ui-xs truncate ${pE.falha ? 'text-danger' : 'text-brand-text-secondary'}`}>{pE.falha || pE.resultado}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-h-[16rem]">
            {aberta ? (
              <XLogDaExecucao execucao={aberta} />
            ) : (
              <p className="p-3 text-ui-sm text-brand-text-secondary border border-dashed border-border-light rounded-lg">
                {'Escolha uma execução para ver o log dela. A que está rodando mostra o log ao vivo.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
