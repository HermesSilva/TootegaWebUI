/**
 * Validação de uma célula da grade conforme outra coluna da mesma linha (dono, 2026-11-02): o tipo do
 * contato decide se o valor é e-mail, telefone ou página. As regras vêm do modelo (CE-19), e o motor não
 * sabe de que App elas são. Fonte única para a célula, que marca o erro, e para o formulário, que não grava.
 */

import type { XFormField, XUIGridColumn } from '@core/types';
import { getFieldValue } from './fieldAccess';
import { isTruthy } from './visibility';

type Linha = Record<string, unknown>;
type Regra = NonNullable<XUIGridColumn['rules']>[number];

/** A regra que vale para esta linha; nula quando a coluna não tem regra para o valor da coluna de referência. */
export function regraDaCelula(pColuna: XUIGridColumn, pLinha: Linha): Regra | null {
  if (!pColuna.ruleField || !pColuna.rules?.length)
    return null;

  const referencia = String(getFieldValue(pLinha, pColuna.ruleField) ?? '');
  return pColuna.rules.find((pR) => pR.value === referencia) ?? null;
}

/** A frase do erro da célula; nula quando ela está certa ou quando a linha está inativa. */
export function erroDaCelula(pColuna: XUIGridColumn, pLinha: Linha): string | null {
  const regra = regraDaCelula(pColuna, pLinha);
  if (!regra)
    return null;

  if (pColuna.ruleActiveField && !isTruthy(getFieldValue(pLinha, pColuna.ruleActiveField)))
    return null;

  const valor = String(getFieldValue(pLinha, pColuna.fieldName) ?? '').trim();
  return new RegExp(regra.pattern).test(valor) ? null : regra.message;
}

/** Os erros de todas as grades do formulário, por campo, com o número de cada linha: tudo de uma vez. */
export function errosDasRegrasDaGrade(
  pCampos: XFormField[],
  pValoresDoFormulario: Record<string, unknown>,
): Record<string, string> {
  const erros: Record<string, string> = {};

  for (const campo of pCampos) {
    const colunas = (campo.editor.editor.gridColumns ?? []).filter((pC) => pC.rules?.length);
    const linhas = getFieldValue(pValoresDoFormulario, campo.editor.fieldName);
    if (colunas.length === 0 || !Array.isArray(linhas))
      continue;

    const frases = (linhas as Linha[]).flatMap((pLinha, pIndice) =>
      colunas.flatMap((pColuna) => {
        const erro = erroDaCelula(pColuna, pLinha);
        return erro ? [`Linha ${pIndice + 1}: ${erro}`] : [];
      }));

    if (frases.length > 0)
      erros[campo.editor.fieldName] = frases.join(' ');
  }

  return erros;
}
