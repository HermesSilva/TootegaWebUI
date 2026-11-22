// A grade das tarefas: uma linha por tarefa, com o que ela faz, a agenda (em português; clicada, abre o editor em
// dropdown), a próxima execução, a situação de agora (ativa, pausada, rodando, execução pedida), como foi a última, as
// falhas das últimas 24 horas e as ações: rodar agora, pausar ou retomar e ver as execuções dela. O que antes eram
// números no alto da tela está na linha de cada tarefa (dono, 2026-11-20).

import { type JSX } from 'react';
import { History, Pause, Play, Zap } from 'lucide-react';

import { api } from '@core/lib/api';
import { formatDateTime } from '@core/lib/formatting';
import { ROTA_DAS_TAREFAS, type TarefaAgendada } from '@core/lib/tarefas/tipos';
import { XEditorDeAgenda } from './XEditorDeAgenda';
import { XFalhaDaConsulta } from './XFalhaDaConsulta';
import { useAcaoDaGerencia } from './useAcaoDaGerencia';
import { useConsultaDaGerencia } from './useConsultaDaGerencia';

interface Props {
  aoVerExecucoes: (pTarefa: TarefaAgendada) => void;
}

const BOTAO = 'inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-light hover:bg-hover text-ui-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed';
const SELO = 'inline-block px-1.5 py-0.5 rounded text-ui-xs font-semibold whitespace-nowrap';
const CELULA = 'px-3 py-2 align-top';

/** A situação de agora, como selos: rodando e pedida podem vir junto de pausada (o "rodar agora" vale até pausada). */
function Situacao({ tarefa }: { tarefa: TarefaAgendada }): JSX.Element {
  return (
    <div className="flex flex-col items-start gap-1">
      {tarefa.reservadaPor && <span className={`${SELO} bg-success/10 text-success`}>{`Rodando em ${tarefa.reservadaPor}`}</span>}
      {tarefa.rodarAgora && <span className={`${SELO} bg-brand-primary/10 text-brand-primary`}>{'Execução pedida'}</span>}
      {tarefa.pausada
        ? <span className={`${SELO} bg-warning-bg text-warning border border-warning/40`}>{'Pausada'}</span>
        : !tarefa.reservadaPor && <span className={`${SELO} text-brand-text-secondary`}>{'Ativa'}</span>}
    </div>
  );
}

export function XListaDeTarefas({ aoVerExecucoes }: Props): JSX.Element {
  const consulta = useConsultaDaGerencia<TarefaAgendada[]>(['lista'], ROTA_DAS_TAREFAS);
  const acao = useAcaoDaGerencia();

  if (consulta.isError)
    return <XFalhaDaConsulta oQue="tarefas" erro={consulta.error} aoTentar={() => void consulta.refetch()} />;

  if (!consulta.data)
    return <p className="p-4 text-ui-sm text-brand-text-secondary">{'Lendo o catálogo das tarefas…'}</p>;

  if (consulta.data.length === 0)
    return (
      <p className="p-4 text-ui-sm text-brand-text-secondary">
        {'O catálogo está vazio. Ele é montado pelo serviço de tarefas quando sobe, com as tarefas que conhece: sem o serviço no ar desde a instalação, não há tarefa a mostrar.'}
      </p>
    );

  // Sem rolagem própria: ela cortaria o dropdown da agenda. Quem rola é o painel da aba.
  return (
    <table className="w-full text-ui-sm border-collapse">
      <thead>
        <tr className="text-left text-ui-xs text-brand-text-secondary border-b border-border-light bg-muted-bg/60">
          <th scope="col" className="px-3 py-2 font-semibold">{'Tarefa'}</th>
          <th scope="col" className="px-3 py-2 font-semibold">{'Agenda'}</th>
          <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{'Próxima'}</th>
          <th scope="col" className="px-3 py-2 font-semibold">{'Situação'}</th>
          <th scope="col" className="px-3 py-2 font-semibold">{'Última execução'}</th>
          <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap text-right">{'Falhas em 24 h'}</th>
          <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">{'Ações'}</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-light">
        {consulta.data.map((pT) => {
          const ocupado = acao.emAndamento?.endsWith(pT.id) ?? false;

          return (
            <tr key={pT.id} className="hover:bg-hover/40">
              <td className={`${CELULA} min-w-[14rem]`}>
                <div className="font-semibold text-brand-text-primary">{pT.titulo}</div>
                <div className="text-ui-xs text-brand-text-secondary">{pT.descricao}</div>
              </td>

              <td className={`${CELULA} min-w-[12rem]`}>
                <XEditorDeAgenda tarefa={pT} acao={acao} />
              </td>

              <td className={`${CELULA} whitespace-nowrap`}>
                {pT.pausada
                  ? <span className="text-ui-xs text-brand-text-secondary" title="A agenda não dispara enquanto a tarefa estiver pausada.">{'—'}</span>
                  : pT.proximaExecucao ? formatDateTime(pT.proximaExecucao) : '—'}
              </td>

              <td className={CELULA}><Situacao tarefa={pT} /></td>

              <td className={`${CELULA} min-w-[10rem]`}>
                {pT.ultimaSituacao ? (
                  <>
                    <div className={pT.ultimaSituacao === 'Falhou' ? 'text-danger font-medium' : 'text-brand-text-primary'}>
                      {`${pT.ultimaSituacao}${pT.ultimoFim ? ` em ${formatDateTime(pT.ultimoFim)}` : ''}`}
                    </div>
                    {pT.ultimoResultado && <div className="text-ui-xs text-brand-text-secondary">{pT.ultimoResultado}</div>}
                  </>
                ) : (
                  <span className="text-ui-xs text-brand-text-secondary">{'Ainda não rodou.'}</span>
                )}
              </td>

              <td className={`${CELULA} text-right tabular-nums`}>
                <span className={pT.falhasUltimas24h > 0 ? 'font-semibold text-danger' : 'text-brand-text-secondary'}
                  title="Execuções desta tarefa que terminaram em falha nas últimas 24 horas.">
                  {pT.falhasUltimas24h}
                </span>
              </td>

              <td className={CELULA}>
                <div className="flex flex-wrap gap-1 justify-end">
                  <button type="button" className={BOTAO} disabled={ocupado || pT.rodarAgora}
                    title="Pede a execução já. O serviço a atende em segundos, mesmo com a tarefa pausada."
                    onClick={() => void acao.executar(`rodar:${pT.id}`, () => api.post(`${ROTA_DAS_TAREFAS}/${pT.id}/rodar-agora`))}>
                    <Zap className="w-3.5 h-3.5" aria-hidden />{'Rodar agora'}
                  </button>
                  {pT.pausada ? (
                    <button type="button" className={BOTAO} disabled={ocupado}
                      title="Volta a disparar pela agenda."
                      onClick={() => void acao.executar(`retomar:${pT.id}`, () => api.post(`${ROTA_DAS_TAREFAS}/${pT.id}/retomar`))}>
                      <Play className="w-3.5 h-3.5" aria-hidden />{'Retomar'}
                    </button>
                  ) : (
                    <button type="button" className={BOTAO} disabled={ocupado}
                      title="A agenda deixa de disparar. A execução em andamento não é interrompida: para isso, cancele-a nas execuções."
                      onClick={() => void acao.executar(`pausar:${pT.id}`, () => api.post(`${ROTA_DAS_TAREFAS}/${pT.id}/pausar`))}>
                      <Pause className="w-3.5 h-3.5" aria-hidden />{'Pausar'}
                    </button>
                  )}
                  <button type="button" className={BOTAO}
                    title="Mostra as execuções desta tarefa, com o log de cada uma."
                    onClick={() => aoVerExecucoes(pT)}>
                    <History className="w-3.5 h-3.5" aria-hidden />{'Execuções'}
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
