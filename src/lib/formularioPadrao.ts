/**
 * Valores iniciais do registro NOVO, resolvidos do que o back declarou (CE-19).
 *
 * O "Novo" abria com um objeto vazio, e todo campo obrigatório nascia em branco — inclusive aquele
 * cuja resposta é a mesma em quase toda operação. O operador de vendas escolhia "Saída" e "Normal"
 * a cada pedido para dizer o óbvio, e o que é óbvio não se digita: o sistema não deixa o usuário
 * errar, e também não o faz repetir o que já sabe (diretiva do dono).
 *
 * O padrão é do BACK, nunca daqui: quem sabe que uma venda nasce em Saída é a App que declara o
 * campo (`defaultValue`), e cravá-lo no front seria conhecimento de App em componente genérico.
 * Este módulo só varre o modelo e monta o registro — os tokens de data são os mesmos do filtro
 * (`resolverTokenDeFiltro`), para uma data padrão não envelhecer no cache do modelo.
 */

import type { XFormSection, XFormView, XTabbedFormView } from '@core/types';
import { XUIEditorType } from '@core/types';
import { resolverTokenDeFiltro } from './filtroPadrao';

/**
 * O `defaultValue` é TEXTO no modelo (é assim que o back o declara), mas o campo não é: um checkbox
 * guarda booleano e um inteiro guarda número. Mandar o texto "true" num campo booleano derrubava o
 * POST com 400 antes do controller — o binder não lê "true" como bool — e sem mensagem (2026-10-11,
 * App Veículos, campo Ativo). Aqui o padrão é TIPADO pelo editor; o que não é número nem booleano
 * segue como texto (com os tokens de data resolvidos).
 */
function tiparPadrao(pTipo: XUIEditorType | undefined, pDeclarado: string, pAgora: Date): unknown {
  switch (pTipo) {
    case XUIEditorType.Checkbox:
    case XUIEditorType.Boolean:
      return pDeclarado.trim().toLowerCase() === 'true' || pDeclarado.trim() === '1';
    case XUIEditorType.Number:
    case XUIEditorType.Currency:
    case XUIEditorType.Percent: {
      const numero = Number(pDeclarado.replace(',', '.'));
      return Number.isFinite(numero) ? numero : 0;
    }
    default:
      return resolverTokenDeFiltro(pDeclarado, pAgora);
  }
}

/** As seções de um formulário, seja ele simples ou em abas. */
function secoesDoFormulario(
  pFormulario?: XFormView,
  pEmAbas?: XTabbedFormView
): readonly XFormSection[] {
  if (pEmAbas?.tabs?.length)
    return pEmAbas.tabs.flatMap((pAba) => pAba.sections ?? []);

  return pFormulario?.sections ?? [];
}

/**
 * O registro com que o formulário de CRIAÇÃO abre: um valor por campo que declarou `defaultValue`.
 *
 * Chaveado pelo NOME DO CAMPO (`fieldName`), que é a chave do `formData` e a que viaja ao back —
 * diferente do filtro, que se chaveia pelo nome do editor porque dois editores (o "de" e o "até")
 * podem apontar o mesmo campo.
 */
export function valoresPadraoDeFormulario(
  pFormulario?: XFormView,
  pEmAbas?: XTabbedFormView,
  pAgora: Date = new Date()
): Record<string, unknown> {
  const valores: Record<string, unknown> = {};

  for (const secao of secoesDoFormulario(pFormulario, pEmAbas)) {
    for (const campo of secao.fields ?? []) {
      const declarado = campo.editor?.editor?.defaultValue ?? '';
      if (declarado === '')
        continue;

      valores[campo.editor.fieldName] = tiparPadrao(campo.editor.editor?.editorType, declarado, pAgora);
    }
  }

  return valores;
}
