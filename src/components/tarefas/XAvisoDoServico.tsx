// O aviso de que o serviço que executa as tarefas (o launcher de tarefas, um só) está sem sinal. No ar, não aparece
// nada: o estado de cada tarefa está na linha dela. Sem sinal, nenhuma tarefa roda, e a tela diz isso no alto, porque
// sem o aviso a agenda e o "rodar agora" pareceriam ignorados.

import { type JSX } from 'react';
import { ServerOff } from 'lucide-react';

import { ROTA_DAS_TAREFAS, type PainelTarefas } from '@core/lib/tarefas/tipos';
import { useConsultaDaGerencia } from './useConsultaDaGerencia';

export function XAvisoDoServico(): JSX.Element | null {
  const { data } = useConsultaDaGerencia<PainelTarefas>(['painel'], `${ROTA_DAS_TAREFAS}/painel`);

  if (data === undefined || data.servidoresVivos > 0)
    return null;

  return (
    <div role="alert" className="mx-3 mt-3 flex items-start gap-2 p-3 rounded-lg border border-danger/50 bg-danger-bg text-ui-sm text-brand-text-primary">
      <ServerOff className="w-4 h-4 mt-0.5 shrink-0 text-danger" aria-hidden />
      <div>
        <div className="font-semibold text-danger">{'O serviço de tarefas está sem sinal'}</div>
        <div className="text-ui-xs text-brand-text-secondary">
          {'Ele avisa a cada poucos segundos que está no ar, e o último aviso ficou para trás. Enquanto não voltar, nenhuma tarefa roda: a agenda e os pedidos de "rodar agora" ficam esperando.'}
        </div>
      </div>
    </div>
  );
}
