// Regras puras da tela das tarefas agendadas: juntar o log que chega aos pedaços, dizer se a execução ainda
// pode mudar e escrever a duração como gente lê.

import { SITUACAO_AGENDADA, SITUACAO_EM_EXECUCAO, type LinhaExecucaoTarefa } from './tipos';

/**
 * Junta as linhas novas às que a tela já tem, na ordem, sem repetir. A tela pergunta "depois da linha N" a cada
 * poucos segundos; uma resposta atrasada que traga de novo uma linha já mostrada não pode duplicá-la.
 */
export function juntarLinhas(pAtuais: LinhaExecucaoTarefa[], pNovas: LinhaExecucaoTarefa[]): LinhaExecucaoTarefa[] {
  if (pNovas.length === 0)
    return pAtuais;

  const porOrdem = new Map<number, LinhaExecucaoTarefa>();
  for (const linha of pAtuais)
    porOrdem.set(linha.ordem, linha);
  for (const linha of pNovas)
    porOrdem.set(linha.ordem, linha);

  return [...porOrdem.values()].sort((pA, pB) => pA.ordem - pB.ordem);
}

/** A maior ordem que a tela já tem: é o "depois de" da próxima pergunta. Sem linha, zero. */
export function ultimaOrdem(pLinhas: LinhaExecucaoTarefa[]): number {
  return pLinhas.reduce((pMaior, pLinha) => Math.max(pMaior, pLinha.ordem), 0);
}

/** A execução ainda pode mudar (e o log, crescer): agendada ou em execução. */
export function execucaoEmCurso(pSituacaoID: number): boolean {
  return pSituacaoID === SITUACAO_AGENDADA || pSituacaoID === SITUACAO_EM_EXECUCAO;
}

/** "350 ms", "4,2 s", "3 min 05 s", "1 h 02 min". Sem duração (não começou ou não terminou), traço. */
export function formatarDuracao(pMilissegundos: number | null | undefined): string {
  if (pMilissegundos === null || pMilissegundos === undefined || pMilissegundos < 0)
    return '—';

  if (pMilissegundos < 1000)
    return `${Math.round(pMilissegundos)} ms`;

  const segundos = pMilissegundos / 1000;
  if (segundos < 60)
    return `${segundos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;

  const inteiros = Math.floor(segundos);
  const horas = Math.floor(inteiros / 3600);
  const minutos = Math.floor((inteiros % 3600) / 60);
  const resto = inteiros % 60;

  return horas > 0
    ? `${horas} h ${String(minutos).padStart(2, '0')} min`
    : `${minutos} min ${String(resto).padStart(2, '0')} s`;
}
