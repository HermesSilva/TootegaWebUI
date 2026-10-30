/**
 * Prepara os dados de um formulário para a gravação (POST/PUT), num lugar só para toda tela que grava um
 * formulário do modelo — a grade com modal (`XApplicationView`), o formulário de configuração, a lista de cartões e a
 * inclusão pelo "+" do navegador (dono, 2026-10-26).
 *
 * O editor entrega texto onde o contrato espera número ou booleano: o combo de um enumerado liga ao campo o `value` do
 * item, que é string ("2"), e o campo numérico digitado é string até aqui. O back desserializa número de string, mas
 * NÃO enum de string: `Estado: "2"` seria recusado. Converte-se pelo TIPO do editor que o modelo declara para o campo,
 * e o que não tem editor passa intacto (o formulário carregou e devolve).
 *
 * E colapsa a chave duplicada: o registro chega do servidor em camelCase (`token`) e a edição grava sob o `fieldName`
 * do editor (`Token`) — fica a chave do editor, com o valor editado (`colapsarChavesDuplicadas`).
 */

import type { XFormView, XTabbedFormView, XUIEditorType } from '@core/types';
import { colapsarChavesDuplicadas } from './fieldAccess';

/** Editores que ligam um enumerado ou um booleano ao campo: o valor é o `value` do item, em texto. */
const COMBO: XUIEditorType = 8 as XUIEditorType;
/** Editores numéricos: Number, Currency e Percent. */
const NUMERICOS: ReadonlySet<number> = new Set([3, 18, 25]);

/** Chaves que o formulário só carrega e nunca grava. */
const SO_LEITURA: ReadonlySet<string> = new Set(['id', 'statusDescricao', 'dataCriacao']);

/** Os editores do formulário (seções e, havendo, abas), por nome de campo → tipo do editor. */
export function mapaDeEditores(pFormView: XFormView | undefined, pTabbed?: XTabbedFormView): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const secao of pFormView?.sections ?? [])
    for (const campo of secao.fields)
      mapa.set(campo.editor.fieldName, campo.editor.editor.editorType);

  for (const secao of pTabbed?.sections ?? [])
    for (const campo of secao.fields)
      mapa.set(campo.editor.fieldName, campo.editor.editor.editorType);

  for (const aba of pTabbed?.tabs ?? [])
    for (const secao of aba.sections)
      for (const campo of secao.fields)
        mapa.set(campo.editor.fieldName, campo.editor.editor.editorType);

  return mapa;
}

export function prepararDadosParaGravar(
  pDados: Record<string, unknown>,
  pFormView: XFormView | undefined,
  pTabbed?: XTabbedFormView,
): Record<string, unknown> {
  const editores = mapaDeEditores(pFormView, pTabbed);
  const preparado: Record<string, unknown> = {};

  for (const [chave, valor] of Object.entries(pDados)) {
    if (SO_LEITURA.has(chave))
      continue;

    const tipo = editores.get(chave);

    if (tipo === COMBO && typeof valor === 'string') {
      if (valor === 'true') {
        preparado[chave] = true;
        continue;
      }
      if (valor === 'false') {
        preparado[chave] = false;
        continue;
      }
      const numero = Number(valor);
      if (!Number.isNaN(numero) && valor !== '') {
        preparado[chave] = numero;
        continue;
      }
    }

    if (tipo !== undefined && NUMERICOS.has(tipo) && typeof valor === 'string') {
      const numero = Number(valor);
      if (!Number.isNaN(numero)) {
        preparado[chave] = numero;
        continue;
      }
    }

    preparado[chave] = valor;
  }

  return colapsarChavesDuplicadas(preparado, editores);
}
