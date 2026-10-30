/**
 * O que fazer com o registro escolhido numa LUPA — a regra, num lugar só.
 *
 * Escolher um registro faz duas coisas: põe um campo dele no editor (`pickerValueField`) e espalha
 * os demais pelo formulário (`fieldBindings`). Isso vivia escrito dentro do editor de documento, e
 * qualquer editor novo que ganhasse lupa reescreveria a mesma regra — com a chance de esquecer o
 * `clearWhenAbsent`, que é o detalhe que impede o formulário de ficar exibindo o nome do registro
 * anterior depois de trocar por um que não tem nome.
 */

import type { XUIEditorModel } from '@core/types';

export interface SelecaoDoPicker {
  /** O valor que vai para o campo do editor. */
  valor: string;
  /** Os demais campos do formulário, pelos `fieldBindings`. Vazio ⇒ nada a espalhar. */
  bindings: Record<string, unknown>;
}

/**
 * Traduz o item escolhido no que o formulário deve passar a valer.
 *
 * `pickerValueField` não declarado cai em `value`, que é o campo do contrato de lookup do produto
 * (`{ value, text, group }`) — o caso mais comum.
 */
export function selecaoDoPicker(
  pItem: Record<string, unknown>,
  pEditorModel: XUIEditorModel
): SelecaoDoPicker {
  const campoValor = pEditorModel.pickerValueField || 'value';
  const valor = String(pItem[campoValor] ?? '');

  const bindings: Record<string, unknown> = {};

  for (const binding of pEditorModel.fieldBindings ?? []) {
    const valorDaOrigem = pItem[binding.sourceField];

    if (valorDaOrigem != null && valorDaOrigem !== '')
      bindings[binding.targetField] = valorDaOrigem;
    else if (binding.clearWhenAbsent)
      bindings[binding.targetField] = '';
  }

  return { valor, bindings };
}
