import type { XFormField, XUIGridPricing } from '@core/types';
import { getFieldValue } from './fieldAccess';
import { isTruthy } from './visibility';

/**
 * O modo PREÇO-DO-ITEM da grade de itens (dono, 2026-10-27): o vendedor digita o preço negociado da linha, e o
 * desconto sai dele — `desconto = (preço unitário − preço item) × quantidade`. Genérico, dirigido pelo modelo
 * (`XUIGridPricing.itemPriceField` + `itemPriceActiveField`, CE-19): nenhuma App aqui dentro.
 *
 * As regras, numa fonte só, que a grade (cálculo ao vivo e marcação da célula) e os modais (recusa do Salvar)
 * consultam igual:
 * - preço do item VAZIO (ou zero) ⇒ venda sem desconto;
 * - preço do item MENOR que o unitário ⇒ o desconto é a diferença vezes a quantidade, ao centavo;
 * - preço do item IGUAL OU MAIOR que o unitário ⇒ a linha é INVÁLIDA: desconto zero, célula marcada e o formulário
 *   não grava.
 *
 * O preço do item é da TELA: o que se grava continua sendo o desconto. A linha que veio do banco não o traz, então
 * ele é DERIVADO do desconto gravado para exibição (`precoDoItemExibido`).
 */

type Linha = Record<string, unknown>;

/** Centavos inteiros: em ponto flutuante, 459,13 − 450 não dá 9,13 exatos. */
const emCentavos = (pValor: number): number => Math.round(pValor * 100 + (pValor < 0 ? -1e-9 : 1e-9));

const numero = (pLinha: Linha, pCampo: string): number => Number(getFieldValue(pLinha, pCampo)) || 0;

/** O modo está declarado no modelo E ligado pelo formulário (normalmente, pela configuração da empresa)? */
export function precoDoItemAtivo(
  pPricing: XUIGridPricing | undefined | null,
  pValoresDoFormulario: Record<string, unknown>,
): boolean {
  if (!pPricing?.itemPriceField || !pPricing.itemPriceActiveField)
    return false;

  return isTruthy(getFieldValue(pValoresDoFormulario, pPricing.itemPriceActiveField));
}

/** O preço do item foi informado na linha? Vazio, nulo e zero são "sem desconto". */
export function precoDoItemInformado(pLinha: Linha, pPricing: XUIGridPricing): boolean {
  const cru = getFieldValue(pLinha, pPricing.itemPriceField ?? '');
  return cru !== undefined && cru !== null && cru !== '' && Number(cru) !== 0;
}

/** A linha respeita a regra? Sem preço informado, sempre; informado, só abaixo do unitário (e acima de zero). */
export function precoDoItemValido(pLinha: Linha, pPricing: XUIGridPricing): boolean {
  if (!precoDoItemInformado(pLinha, pPricing))
    return true;

  const preco = emCentavos(numero(pLinha, pPricing.itemPriceField ?? ''));
  return preco > 0 && preco < emCentavos(numero(pLinha, pPricing.unitPriceField));
}

/**
 * O desconto da linha no modo preço-do-item: `(unitário − preço item) × quantidade`, ao centavo. Zero quando o preço
 * não foi informado ou quando a linha é inválida — o desconto nunca nasce de um preço que a regra recusa.
 */
export function descontoDoPrecoDoItem(pLinha: Linha, pPricing: XUIGridPricing): number {
  if (!precoDoItemInformado(pLinha, pPricing) || !precoDoItemValido(pLinha, pPricing))
    return 0;

  const diferenca = emCentavos(numero(pLinha, pPricing.unitPriceField)) - emCentavos(numero(pLinha, pPricing.itemPriceField ?? ''));
  const quantidade = numero(pLinha, pPricing.quantityField);

  return Math.max(Math.round(diferenca * quantidade), 0) / 100;
}

/**
 * O preço do item que a célula MOSTRA. Informado na linha ⇒ ele mesmo. Linha vinda do banco (ou de antes de a
 * empresa ligar o modo), sem preço mas com desconto ⇒ o preço DERIVADO, `unitário − desconto ÷ quantidade`, ao
 * centavo: o vendedor vê o preço que aquele desconto representa, e o desconto gravado não muda só por abrir o
 * pedido. Sem desconto ⇒ vazio (`null`).
 */
export function precoDoItemExibido(pLinha: Linha, pPricing: XUIGridPricing): number | null {
  if (precoDoItemInformado(pLinha, pPricing))
    return numero(pLinha, pPricing.itemPriceField ?? '');

  const desconto = numero(pLinha, pPricing.discountField);
  const quantidade = numero(pLinha, pPricing.quantityField);
  if (desconto <= 0 || quantidade <= 0)
    return null;

  const derivado = Math.round(emCentavos(numero(pLinha, pPricing.unitPriceField)) - emCentavos(desconto) / quantidade);
  return derivado > 0 ? derivado / 100 : null;
}

/** A frase da célula inválida: o que está errado, o limite e o que fazer (CE-21-quater). */
export function mensagemDoPrecoDoItem(pLinha: Linha, pPricing: XUIGridPricing): string {
  const unitario = numero(pLinha, pPricing.unitPriceField)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return `O preço do item tem de ser menor que o preço unitário (${unitario}). Deixe-o vazio para vender sem desconto.`;
}

/** "1", "1 e 3", "1, 2 e 5" — a lista dos números de item, como se lê. */
function listaDeItens(pNumeros: number[]): string {
  if (pNumeros.length === 1)
    return String(pNumeros[0]);

  return `${pNumeros.slice(0, -1).join(', ')} e ${pNumeros[pNumeros.length - 1]}`;
}

/**
 * Os erros do Salvar: para cada grade de itens do formulário com o modo LIGADO, a frase que nomeia TODOS os itens
 * inválidos de uma vez (a validação é completa, nunca um erro por gravação), pelo nome do campo da grade — o
 * formulário marca a grade e abre a aba dela. Vazio ⇒ nada a recusar.
 */
export function errosDoPrecoDoItem(
  pCampos: XFormField[],
  pValoresDoFormulario: Record<string, unknown>,
): Record<string, string> {
  const erros: Record<string, string> = {};

  for (const campo of pCampos) {
    const pricing = campo.editor.editor.pricing;
    if (!pricing || !precoDoItemAtivo(pricing, pValoresDoFormulario))
      continue;

    const linhas = getFieldValue(pValoresDoFormulario, campo.editor.fieldName);
    if (!Array.isArray(linhas))
      continue;

    const invalidos = (linhas as Linha[])
      .map((pLinha, pIndice) => (precoDoItemValido(pLinha, pricing) ? 0 : pIndice + 1))
      .filter((pNumero) => pNumero > 0);

    if (invalidos.length === 0)
      continue;

    const sujeito = invalidos.length === 1 ? `No item ${listaDeItens(invalidos)}` : `Nos itens ${listaDeItens(invalidos)}`;
    erros[campo.editor.fieldName] =
      `${sujeito}, o preço do item tem de ser menor que o preço unitário. ` +
      'Corrija o preço ou deixe-o vazio para vender sem desconto.';
  }

  return erros;
}
