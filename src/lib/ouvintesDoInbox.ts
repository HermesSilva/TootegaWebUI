/**
 * ouvintesDoInbox — quem quer saber, na hora, da mensagem do inbox que acabou de chegar pelo tempo real.
 *
 * O inbox tem UMA conexão por aba (a do sino, `useInbox`). Um componente que precisa reagir a um tipo de aviso — o
 * retorno do suporte, que abre o diálogo para atender (dono, 2026-11-19) — se inscreve aqui e filtra pela
 * `referencia` da mensagem, em vez de abrir uma segunda conexão ao mesmo hub. Só o tempo real passa por aqui: a carga
 * inicial das não lidas não é "chegada".
 */

import type { MensagemInbox } from '@core/hooks/useInbox';

type Ouvinte = (pMensagem: MensagemInbox) => void;

const _Ouvintes = new Set<Ouvinte>();

/** Inscreve um ouvinte; devolve a função que o desinscreve. */
export function ouvirMensagens(pOuvinte: Ouvinte): () => void {
  _Ouvintes.add(pOuvinte);

  return () => { _Ouvintes.delete(pOuvinte); };
}

/** Avisa os ouvintes de uma mensagem que chegou. Ouvinte que lança não impede os outros. */
export function avisarMensagemRecebida(pMensagem: MensagemInbox): void {
  _Ouvintes.forEach((pOuvinte) => {
    try {
      pOuvinte(pMensagem);
    } catch {
      // Cada ouvinte cuida das próprias falhas; a mensagem já está no sino de qualquer jeito.
    }
  });
}
