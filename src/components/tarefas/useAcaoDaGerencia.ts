// Um pedido do operador à gerência (rodar agora, pausar, trocar a agenda, cancelar, parar o servidor). Recusa e falha
// já chegam ao operador pelo cliente HTTP, com o texto do servidor, dentro da área da App; aqui só se marca o que está
// em andamento (para o botão não ser apertado duas vezes) e, dando certo, se atualizam as listas na hora, sem esperar a
// próxima volta da atualização automática.

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface AcaoDaGerencia {
  /** A chave da ação em andamento (ex.: "pausar:<id>"), ou nula. */
  emAndamento: string | null;
  executar: (pChave: string, pPedido: () => Promise<unknown>) => Promise<boolean>;
}

export function useAcaoDaGerencia(): AcaoDaGerencia {
  const cliente = useQueryClient();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);

  const executar = useCallback(async (pChave: string, pPedido: () => Promise<unknown>): Promise<boolean> => {
    setEmAndamento(pChave);
    try {
      await pPedido();
      await cliente.invalidateQueries({ queryKey: ['tarefas-agendadas'] });
      return true;
    } catch {
      // O cliente HTTP já mostrou a recusa (aviso laranja) ou a falha, com o motivo; nada a repetir aqui.
      return false;
    } finally {
      setEmAndamento(null);
    }
  }, [cliente]);

  return { emAndamento, executar };
}
