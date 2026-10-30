import { getFieldValue } from './fieldAccess';
import type { XRowAction, XVisibilityRule } from '@core/types';

/**
 * Visibilidade condicional dirigida por dados (CE-19): o back declara as regras no modelo (aba ou
 * campo) e o front apenas as avalia contra o formulário corrente — nenhuma App é conhecida aqui.
 */

/**
 * "Tem valor de fato": trata o membro neutro de enum (0/"0"), o booleano falso e o vazio como
 * ausência. É a regra da aba condicional legada (visibleWhenField) e o padrão de uma regra sem
 * lista de valores.
 */
export function isTruthy(pValue: unknown): boolean {
  if (pValue === null || pValue === undefined) return false;
  if (typeof pValue === 'boolean') return pValue;
  if (typeof pValue === 'number') return pValue !== 0;
  const texto = String(pValue).trim().toLowerCase();
  return texto !== '' && texto !== '0' && texto !== 'false';
}

/**
 * Uma regra: sem valores, exige "tem valor"; com valores, exige que o corrente esteja entre eles.
 * `negate` inverte o veredito — é como se expressa "aparece quando o campo está vazio" (sem valores)
 * ou "aparece quando NÃO é nenhum destes" (com valores).
 */
function aprovaRegra(pRegra: XVisibilityRule, pDados: Record<string, unknown>): boolean {
  const valor = getFieldValue(pDados, pRegra.field);

  let aprovada: boolean;
  if (!pRegra.values || pRegra.values.length === 0) {
    aprovada = isTruthy(valor);
  } else if (pRegra.bitmask) {
    // Por BIT (2026-10-11): o campo é o bitmask do multi-seleção; vale quando ALGUM dos bits declarados
    // está ligado. É o que faz a aba "Motorista" aparecer ao marcar o papel, antes de salvar.
    const mascara = Number(valor ?? 0);
    aprovada = Number.isFinite(mascara)
      && pRegra.values.some((pBit: string) => {
        const bit = Number(pBit);
        return Number.isFinite(bit) && bit > 0 && (mascara & bit) !== 0;
      });
  } else {
    const corrente = valor === null || valor === undefined ? '' : String(valor);
    aprovada = pRegra.values.some((pValor: string) => String(pValor) === corrente);
  }

  return pRegra.negate ? !aprovada : aprovada;
}

/**
 * As regras CASAM com os dados? Todas precisam valer (conjunção). Lista vazia/ausente ⇒ **falso**:
 * sem condição declarada, não há o que casar.
 *
 * É a semântica de uma regra que LIGA um comportamento — travar o campo (`readOnlyWhen`). Distinta da
 * do `isVisible`, onde a ausência de regra LIBERA (o campo aparece). Duas omissões, dois defaults
 * opostos: por isso são funções separadas, e não uma com um sinalizador.
 */
export function matchRules(pRegras: XVisibilityRule[] | undefined, pDados: Record<string, unknown>): boolean {
  if (!pRegras || pRegras.length === 0)
    return false;

  return pRegras.every((regra) => aprovaRegra(regra, pDados));
}

/** Todas as regras precisam valer (conjunção). Lista vazia/ausente ⇒ visível. */
export function isVisible(pRegras: XVisibilityRule[] | undefined, pDados: Record<string, unknown>): boolean {
  if (!pRegras || pRegras.length === 0)
    return true;

  return matchRules(pRegras, pDados);
}

/**
 * Ações da App que valem para ESTA linha: a ação observa um campo (`visibleWhenField`) e existe quando o
 * valor dele está entre os declarados. Sem campo observado ⇒ vale para toda linha. É assim que
 * "Autorizar" só aparece na nota ainda não autorizada, "Baixar DANFSe" e "Cancelar" só na autorizada, e
 * a nota cancelada não oferece nenhuma.
 *
 * A grade não desenha botões: quem os desenha é a BARRA do App, sobre a linha SELECIONADA (dono,
 * 2026-07-13). Esta função é o que diz à barra quais botões existem para a linha escolhida.
 */
export function acoesVisiveisNaLinha(
  pAcoes: XRowAction[] | undefined,
  pLinha: Record<string, unknown>,
): XRowAction[] {
  if (!pAcoes || pAcoes.length === 0)
    return [];

  return pAcoes.filter((pAcao) => {
    if (!pAcao.visibleWhenField)
      return true;

    const valor = String(getFieldValue(pLinha, pAcao.visibleWhenField) ?? '');
    return (pAcao.visibleWhenValues ?? []).includes(valor);
  });
}

/**
 * A ação está DESABILITADA para esta linha? (aparece, mas não clica.) A ação observa
 * `disabledWhenField` e desabilita quando o valor está entre os `disabledWhenValues` — é o "Baixar" que
 * fica cinza na parcela já baixada. Sem campo observado ⇒ nunca desabilita. Leitura tolerante a caixa.
 */
export function acaoDesabilitadaNaLinha(
  pAcao: XRowAction,
  pLinha: Record<string, unknown>,
): boolean {
  if (!pAcao.disabledWhenField)
    return false;

  const valor = String(getFieldValue(pLinha, pAcao.disabledWhenField) ?? '');
  return (pAcao.disabledWhenValues ?? []).includes(valor);
}

/**
 * ESTA linha abre em LEITURA? Dois caminhos, e basta UM valer:
 *
 * 1. O campo `readOnly` que a PRÓPRIA linha carrega (contrato `XILinhaComEstado` do back): o servidor
 *    já decidiu que este registro é imutável para o ator — o caso do DADO LIVRE de plataforma
 *    (D51/ADR-0006), cuja linha pertence ao Inquilino Geral. Universal, sem a App declarar nada.
 * 2. As regras `dataView.readOnlyWhen` que a App declara (CE-19), que falam do ESTADO do registro —
 *    um pedido faturado não se edita; o do lado, em rascunho, se edita.
 *
 * Distinta de `canEdit`, que é permissão do USUÁRIO e vale para a App inteira: basta uma delas negar
 * para a linha abrir em leitura. Quem decide sobre a linha é esta função; quem a combina com a
 * capacidade é o motor (`XApplicationView`).
 *
 * Sem `readOnly`, sem regra, ou sem linha (nada selecionado), a resposta é NÃO — o padrão é o
 * comportamento de sempre, e nenhuma App que não declare nada muda.
 */
export function abreEmLeitura(
  pRegras: XVisibilityRule[] | undefined,
  pLinha: Record<string, unknown> | null | undefined,
): boolean {
  if (!pLinha)
    return false;

  return linhaMarcadaReadOnly(pLinha) || matchRules(pRegras, pLinha);
}

/**
 * A linha traz o sinal `readOnly` do back (contrato `XILinhaComEstado`)? É o sinal universal de
 * registro imutável para o ator — lido pelo motor genérico, nunca por código de App. Fonte única para
 * a decisão de abrir em leitura (`abreEmLeitura`) e para a marca visual da grade (esmaecer + cadeado).
 */
export function linhaMarcadaReadOnly(
  pLinha: Record<string, unknown> | null | undefined,
): boolean {
  return pLinha?.readOnly === true;
}
