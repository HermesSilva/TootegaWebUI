// Contrato da gerência das tarefas agendadas (api/sys/tarefas). Os nomes casam com os DTOs do SYS
// (Tootega.SYS.Common/Contratos/Tarefas), em camelCase como o back serializa.

/** Rota base da gerência (sem o /api, que o cliente HTTP põe). */
export const ROTA_DAS_TAREFAS = '/sys/tarefas';

/** Situação da execução que ainda pode mudar (o log ainda cresce). Casa com SYSxSituacaoExecucaoTarefa. */
export const SITUACAO_AGENDADA = 1;
export const SITUACAO_EM_EXECUCAO = 2;
export const SITUACAO_CONCLUIDA = 3;
export const SITUACAO_FALHOU = 4;

export interface TarefaAgendada {
  id: string;
  nome: string;
  titulo: string;
  descricao: string;
  alcance: string;
  agenda: string;
  agendaDescrita: string;
  agendaPadrao: string;
  pausada: boolean;
  rodarAgora: boolean;
  proximaExecucao: string | null;
  reservadaPor: string;
  tentativas: number;
  ultimaSituacao: string;
  ultimoFim: string | null;
  ultimoResultado: string;
  falhasUltimas24h: number;
}

export interface ExecucaoTarefa {
  id: string;
  tarefaID: string;
  tarefa: string;
  situacaoID: number;
  situacao: string;
  origem: string;
  agendadaPara: string;
  inicio: string | null;
  fim: string | null;
  duracaoMs: number | null;
  tentativa: number;
  servidor: string;
  resultado: string;
  falha: string;
  cancelamentoPedido: boolean;
  linhas: number;
}

export interface LinhaExecucaoTarefa {
  ordem: number;
  momento: string;
  texto: string;
  erro: boolean;
}

export interface PainelTarefas {
  tarefas: number;
  pausadas: number;
  emExecucao: number;
  falhasUltimas24h: number;
  servidoresVivos: number;
}
