// A falha de uma consulta da gerência, no lugar da lista que não veio: diz qual lista, o motivo que o servidor (ou a
// rede) deu, e oferece tentar de novo. Erro mudo é defeito: nunca "não foi possível carregar".

import { type JSX } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

import { MessageText } from '@core/components/ui/MessageText';

interface Props {
  oQue: string;
  erro: unknown;
  aoTentar: () => void;
}

export function XFalhaDaConsulta({ oQue, erro, aoTentar }: Props): JSX.Element {
  const motivo = erro instanceof Error && erro.message
    ? erro.message
    : `O servidor não respondeu à consulta de ${oQue}, e não devolveu explicação.`;

  return (
    <div role="alert" className="m-3 p-3 rounded-lg border border-danger/40 bg-danger-bg text-ui-sm text-brand-text-primary space-y-2">
      <div className="flex items-center gap-2 font-semibold text-danger">
        <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden />
        {`A lista de ${oQue} não foi atualizada`}
      </div>
      <MessageText text={motivo} />
      <p className="text-ui-xs text-brand-text-secondary">{'A atualização automática parou. Tente de novo quando o servidor voltar.'}</p>
      <button type="button" onClick={aoTentar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-light hover:bg-hover text-ui-xs font-medium">
        <RefreshCw className="w-3.5 h-3.5" aria-hidden />
        {'Tentar de novo'}
      </button>
    </div>
  );
}
