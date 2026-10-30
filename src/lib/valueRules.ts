import { getFieldValue } from './fieldAccess';
import { isTruthy, matchRules } from './visibility';
import type { XFormField } from '@core/types';

/**
 * Valores dirigidos por regra (CE-19): o back declara, no campo, que valor ele assume ao ENTRAR em
 * uma condição (`valueWhen`); aqui só se avalia. Nenhuma App é conhecida neste arquivo.
 *
 * É a terceira coisa que uma regra faz com um campo — `visibleWhen` esconde, `readOnlyWhen` trava,
 * `valueWhen` preenche —, e nasceu do "Tipo de Nota" do pedido de venda (dono, 2026-07-30):
 * destinatário CPF ou de balcão obriga NFC-e e o campo trava; destinatário CNPJ nasce em NF-e e o
 * operador escolhe.
 */

/**
 * Aplica as regras sobre `pAtual` (in-place). Os dois modos existem porque as perguntas são outras:
 *
 * - **Abertura** (`pAnterior` nulo): a regra vigente preenche o campo **somente se ele estiver
 *   vazio**. Formulário NOVO nasce com o valor certo; formulário em EDIÇÃO preserva o que foi
 *   gravado — um pedido de CNPJ salvo como NFC-e não pode virar NF-e só por ter sido reaberto.
 * - **Mudança** (`pAnterior` presente): aplica-se a regra que **passou a** valer — a borda. Enquanto
 *   a condição continua valendo, nada se reescreve, e é isso que preserva a escolha do usuário no
 *   campo livre. Reaplicar por estado desfaria a troca dele no clique seguinte.
 *
 * Duas regras verdadeiras ao mesmo tempo no mesmo campo: vence a última declarada. Regras de um
 * mesmo campo devem ser mutuamente exclusivas — quem as declara é o modelo do back.
 */
export function aplicarValoresDirigidos(
  pAnterior: Record<string, unknown> | null,
  pAtual: Record<string, unknown>,
  pCampos: XFormField[],
): void {
  for (const campo of pCampos) {
    const regras = campo.valueWhen;
    if (!regras || regras.length === 0)
      continue;

    const nomeDoCampo = campo.editor.fieldName;

    for (const regra of regras) {
      if (!matchRules(regra.when, pAtual))
        continue;

      if (pAnterior === null) {
        if (!isTruthy(getFieldValue(pAtual, nomeDoCampo)))
          pAtual[nomeDoCampo] = regra.value;
        continue;
      }

      // Borda de subida: valia antes ⇒ não é entrada na condição, e o valor corrente é do usuário.
      if (!matchRules(regra.when, pAnterior))
        pAtual[nomeDoCampo] = regra.value;
    }
  }
}
