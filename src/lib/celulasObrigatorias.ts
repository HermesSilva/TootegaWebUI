/**
 * Células OBRIGATÓRIAS por linha da grade de itens (dono, 2026-11-09).
 *
 * Uma coluna pode ser editável só em algumas linhas (`editableWhenRowField`: um campo da própria linha diz se ela
 * se edita) e exigir preenchimento onde se edita (`isRequired`). É o que faz a importação de nota pedir o produto
 * só para o item sem GTIN válido, e não deixar importar enquanto faltar algum.
 *
 * Regra pura, sem React: a grade a usa para travar e marcar a célula, e o modal de coleta para dizer o que falta e
 * segurar o Confirmar. Uma fonte só — a grade não pode mostrar como pendente o que o modal aceita, nem o contrário.
 */

import type { XUIGridColumn } from '@core/types';
import { getFieldValue } from './fieldAccess';
import { isTruthy } from './visibility';

type Linha = Record<string, unknown>;

/** A célula desta coluna se edita NESTA linha? Sem `editableWhenRowField`, a linha não decide nada. */
export function celulaEditavelNaLinha(pColuna: XUIGridColumn, pLinha: Linha): boolean {
  if (!pColuna.editableWhenRowField)
    return true;

  return isTruthy(getFieldValue(pLinha, pColuna.editableWhenRowField));
}

/** Valor "preenchido"? Nulo, indefinido e texto em branco não são; zero conta como vazio numa chave de registro. */
function preenchida(pValor: unknown): boolean {
  if (pValor === null || pValor === undefined)
    return false;

  if (typeof pValor === 'string')
    return pValor.trim().length > 0 && pValor.trim() !== '0';

  if (typeof pValor === 'number')
    return pValor !== 0;

  return true;
}

/** A célula obrigatória desta linha está vazia? Só se cobra a coluna obrigatória e editável na linha. */
export function celulaObrigatoriaVazia(pColuna: XUIGridColumn, pLinha: Linha): boolean {
  if (!pColuna.isRequired || pColuna.readOnly)
    return false;

  if (!celulaEditavelNaLinha(pColuna, pLinha))
    return false;

  return !preenchida(getFieldValue(pLinha, pColuna.fieldName));
}

/**
 * A frase do que falta na grade, ou `null` quando nada falta. Nomeia a coluna e as linhas pela POSIÇÃO (1, 2, 3…),
 * que é o número que o usuário vê: "Escolha Produto nas linhas 2 e 5." — nunca uma frase genérica.
 */
export function pendenciasDaGrade(pColunas: XUIGridColumn[] | undefined, pLinhas: unknown): string | null {
  if (!Array.isArray(pLinhas) || !pColunas || pColunas.length === 0)
    return null;

  const frases: string[] = [];

  for (const coluna of pColunas) {
    if (!coluna.isRequired)
      continue;

    const posicoes = (pLinhas as Linha[])
      .map((pLinha, pIndice) => (celulaObrigatoriaVazia(coluna, pLinha) ? pIndice + 1 : 0))
      .filter((pPosicao) => pPosicao > 0);

    if (posicoes.length === 0)
      continue;

    const titulo = coluna.title || coluna.fieldName;
    frases.push(posicoes.length === 1
      ? `Preencha ${titulo} na linha ${posicoes[0]}.`
      : `Preencha ${titulo} nas linhas ${juntar(posicoes)}.`);
  }

  return frases.length === 0 ? null : frases.join(' ');
}

/** "2", "2 e 5", "2, 5 e 7". */
function juntar(pPosicoes: number[]): string {
  if (pPosicoes.length === 1)
    return String(pPosicoes[0]);

  return `${pPosicoes.slice(0, -1).join(', ')} e ${pPosicoes[pPosicoes.length - 1]}`;
}
