/**
 * XTarefasAgendadas — a tela da App "Tarefas agendadas" (plataforma, grupo Serviços), registrada como ScheduledTasks.
 *
 * Duas vistas: a grade das tarefas (o estado de cada uma na linha dela, com rodar agora, pausar, retomar e trocar a
 * agenda) e as execuções (com o log de cada uma, ao vivo enquanto roda). Tudo o que a tela
 * faz é gravar um pedido que o launcher lê em segundos; ela nunca executa nada. As listas se atualizam sozinhas.
 */

import { useState, type JSX } from 'react';
import { CalendarClock, History } from 'lucide-react';

import { ROTA_DAS_TAREFAS, type TarefaAgendada } from '@core/lib/tarefas/tipos';
import type { XCustomComponentProps } from '@core/components/templates/XCustomComponentRegistry';
import { XAvisoDoServico } from './XAvisoDoServico';
import { XListaDeExecucoes } from './XListaDeExecucoes';
import { XListaDeTarefas } from './XListaDeTarefas';
import { useConsultaDaGerencia } from './useConsultaDaGerencia';

type Vista = 'tarefas' | 'execucoes';

// Sem vista de servidores (dono, 2026-11-20): há um serviço de tarefas só; sem sinal, o aviso no alto diz.
const VISTAS: { id: Vista; titulo: string; Icone: typeof CalendarClock }[] = [
  { id: 'tarefas', titulo: 'Tarefas', Icone: CalendarClock },
  { id: 'execucoes', titulo: 'Execuções', Icone: History },
];

export function XTarefasAgendadas({ tabID }: XCustomComponentProps): JSX.Element {
  const [vista, setVista] = useState<Vista>('tarefas');
  const [tarefaDasExecucoes, setTarefaDasExecucoes] = useState<TarefaAgendada | null>(null);
  // O filtro das execuções usa o mesmo catálogo da vista de tarefas (mesma chave: uma pergunta só ao servidor).
  const catalogo = useConsultaDaGerencia<TarefaAgendada[]>(['lista'], ROTA_DAS_TAREFAS);

  const verExecucoes = (pTarefa: TarefaAgendada): void => {
    setTarefaDasExecucoes(pTarefa);
    setVista('execucoes');
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-tab-id={tabID}>
      <XAvisoDoServico />

      <div role="tablist" aria-label="Vistas das tarefas agendadas" className="flex gap-1 px-3 border-b border-border-light">
        {VISTAS.map(({ id, titulo, Icone }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={vista === id}
            onClick={() => setVista(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-ui-sm font-medium ${
              vista === id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-text-secondary hover:text-brand-text-primary'}`}
          >
            <Icone className="w-4 h-4" aria-hidden />
            {titulo}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex-1 min-h-0 overflow-auto">
        {vista === 'tarefas' && <XListaDeTarefas aoVerExecucoes={verExecucoes} />}
        {vista === 'execucoes' && (
          <XListaDeExecucoes tarefa={tarefaDasExecucoes} tarefas={catalogo.data ?? []} aoEscolherTarefa={setTarefaDasExecucoes} />
        )}
      </div>
    </div>
  );
}
