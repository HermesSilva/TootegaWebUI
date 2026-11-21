// O log de uma execução. Enquanto ela roda, a tela pergunta a cada 2 segundos pelas linhas depois da última que já tem
// (o launcher grava o log em lotes de um segundo); terminada, uma última leitura fecha o log e a pergunta para. A
// pergunta é silenciosa: a falha aparece aqui, com o motivo, e não num diálogo a cada volta.

import { useEffect, useRef, useState, type JSX } from 'react';
import { Ban } from 'lucide-react';

import { api } from '@core/lib/api';
import { formatTime } from '@core/lib/formatting';
import { execucaoEmCurso, juntarLinhas, ultimaOrdem } from '@core/lib/tarefas/logDaExecucao';
import { ROTA_DAS_TAREFAS, SITUACAO_EM_EXECUCAO, type ExecucaoTarefa, type LinhaExecucaoTarefa } from '@core/lib/tarefas/tipos';
import { useAcaoDaGerencia } from './useAcaoDaGerencia';
import { INTERVALO_DO_LOG_MS } from './useConsultaDaGerencia';

interface Props {
  execucao: ExecucaoTarefa;
}

export function XLogDaExecucao({ execucao }: Props): JSX.Element {
  const [linhas, setLinhas] = useState<LinhaExecucaoTarefa[]>([]);
  const [falha, setFalha] = useState<string | null>(null);
  const linhasRef = useRef<LinhaExecucaoTarefa[]>([]);
  const fimRef = useRef<HTMLDivElement>(null);
  const acao = useAcaoDaGerencia();
  const emCurso = execucaoEmCurso(execucao.situacaoID);

  // Troca de execução: começa do zero.
  useEffect(() => {
    linhasRef.current = [];
    setLinhas([]);
    setFalha(null);
  }, [execucao.id]);

  useEffect(() => {
    const controle = new AbortController();
    let relogio: ReturnType<typeof setTimeout> | undefined;

    const buscar = async (): Promise<void> => {
      try {
        const novas = await api.get<LinhaExecucaoTarefa[]>(
          `${ROTA_DAS_TAREFAS}/execucoes/${execucao.id}/linhas?depois=${ultimaOrdem(linhasRef.current)}`, controle.signal, true);
        linhasRef.current = juntarLinhas(linhasRef.current, novas);
        setLinhas(linhasRef.current);
        setFalha(null);
        if (emCurso)
          relogio = setTimeout(() => void buscar(), INTERVALO_DO_LOG_MS);
      } catch (pErro) {
        if (controle.signal.aborted)
          return;
        setFalha(pErro instanceof Error && pErro.message
          ? pErro.message
          : 'O servidor não respondeu à leitura do log desta execução, e não devolveu explicação.');
      }
    };

    void buscar();

    return () => {
      controle.abort();
      clearTimeout(relogio);
    };
  }, [execucao.id, emCurso]);

  // Acompanha o fim do log enquanto ele cresce.
  useEffect(() => {
    if (emCurso)
      fimRef.current?.scrollIntoView({ block: 'nearest' });
  }, [linhas.length, emCurso]);

  return (
    <div className="flex flex-col min-h-0 h-full border border-border-light rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light bg-muted-bg/60">
        <span className="text-ui-sm font-semibold text-brand-text-primary truncate">{`Log · ${execucao.tarefa}`}</span>
        <span className="text-ui-xs text-brand-text-secondary">{emCurso ? 'ao vivo' : `${execucao.situacao}`}</span>
        {execucao.situacaoID === SITUACAO_EM_EXECUCAO && (
          <button type="button" disabled={execucao.cancelamentoPedido || acao.emAndamento !== null}
            title="Pede que a execução pare. A tarefa para no próximo ponto em que confere o pedido."
            onClick={() => void acao.executar(`cancelar:${execucao.id}`, () => api.post(`${ROTA_DAS_TAREFAS}/execucoes/${execucao.id}/cancelar`))}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-danger/40 text-danger hover:bg-danger/10 text-ui-xs font-medium disabled:opacity-50">
            <Ban className="w-3.5 h-3.5" aria-hidden />
            {execucao.cancelamentoPedido ? 'Cancelamento pedido' : 'Cancelar'}
          </button>
        )}
      </div>

      {execucao.falha && (
        <div className="px-3 py-2 border-b border-border-light bg-danger-bg text-ui-xs text-danger whitespace-pre-wrap">{execucao.falha}</div>
      )}

      <div className="flex-1 min-h-0 overflow-auto font-mono text-ui-xs p-2 space-y-0.5" aria-live={emCurso ? 'polite' : 'off'}>
        {linhas.length === 0 && !falha && (
          <p className="text-brand-text-secondary font-sans">{emCurso ? 'Aguardando a primeira linha…' : 'Esta execução não escreveu nada no log.'}</p>
        )}
        {linhas.map((pL) => (
          <div key={pL.ordem} className={`flex gap-2 ${pL.erro ? 'text-danger' : 'text-brand-text-primary'}`}>
            <span className="text-brand-text-secondary shrink-0 tabular-nums">{formatTime(pL.momento, 'HH:mm:ss')}</span>
            {pL.erro && <span className="shrink-0 font-semibold">{'ERRO'}</span>}
            <span className="whitespace-pre-wrap break-words">{pL.texto}</span>
          </div>
        ))}
        {falha && (
          <p role="alert" className="text-danger font-sans whitespace-pre-wrap">{`O log parou de atualizar: ${falha}`}</p>
        )}
        <div ref={fimRef} />
      </div>
    </div>
  );
}
