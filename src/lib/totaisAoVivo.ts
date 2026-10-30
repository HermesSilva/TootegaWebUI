import type { XFormPricing } from '@core/types';
import { getFieldValue } from './fieldAccess';
import { ratearDesconto } from './rateioDesconto';

/**
 * Fechamento AO VIVO do documento (`pricing` do modelo, CE-19), recalculado sobre `pData` (in-place) a
 * cada digitação:
 *
 * - **Subtotal** = Σ do líquido de cada item (quantidade × preço unitário − desconto do item). É o
 *   valor dos itens ANTES do desconto do pedido.
 * - **Valor final** = subtotal − desconto do pedido.
 * - **Preço final de cada linha** = líquido da linha − a parcela do desconto do pedido que lhe coube
 *   no rateio. Logo Σ preço final das linhas == valor final, exato (dono, 2026-08-02): a grade FECHA
 *   com o rodapé, e o operador vê quanto cada item passou a valer de fato — que é o número que o back
 *   grava em cada item e o que a nota fiscal transporta.
 *
 * É genérico (dirigido por NOME de campo) e TOLERANTE: no meio da edição, uma linha com quantidade
 * zero apenas contribui zero, sem impedir a prévia. A fonte da verdade continua sendo o back
 * (`XFechamentoDocumento`), que revalida ao gravar — e cujo rateio dá exatamente estes centavos.
 *
 * Corre em CENTAVOS inteiros — em ponto flutuante, 0.1 + 0.2 ≠ 0.3, e o rodapé passaria a mostrar um
 * centavo que não existe.
 *
 * Vive aqui, e não dentro de um dos modais, porque os DOIS o usam: o formulário simples e o
 * formulário com abas (o pedido de venda migrou para abas em 2026-08-02, e o cálculo tinha de ir
 * junto — documento é documento, tenha ele abas ou não).
 */
export function aplicarTotaisAoVivo(pData: Record<string, unknown>, pPricing: XFormPricing): void {
  const emCentavos = (pValor: unknown): number => {
    const numero = Number(pValor) || 0;
    const sinal = numero < 0 ? -1 : 1;
    return sinal * Math.round(Math.abs(numero) * 100 + 1e-9);
  };

  // Leitura TOLERANTE A CAIXA: ao CRIAR, a chave vem do form em PascalCase ("Itens"); ao EDITAR, vem
  // do GET serializado em camelCase ("itens"). Acesso direto por colchete perderia o caso da carga de
  // edição — e o rodapé zerava.
  const itens = getFieldValue(pData, pPricing.itemsField);
  const linhas = Array.isArray(itens) ? (itens as Record<string, unknown>[]) : [];

  // Subtotal = Σ do líquido de cada linha (bruto − desconto do item). O desconto de item já está
  // DENTRO do subtotal; o rodapé "Desconto" é o do PEDIDO, que reduz por cima.
  const liquidos = linhas.map((linha, indice) => {
    const quantidade = Number(getFieldValue(linha, pPricing.itemQuantityField)) || 0;
    const unitario = Number(getFieldValue(linha, pPricing.itemUnitPriceField)) || 0;
    const bruto = emCentavos(quantidade * unitario);
    const desconto = Math.max(0, emCentavos(getFieldValue(linha, pPricing.itemDiscountField)));

    return {
      // O rateio desempata pelo MENOR número de item; na tela a ordem da grade é essa mesma, e uma
      // linha recém-incluída ainda não tem número — o índice serve, e é estável.
      numeroItem: indice + 1,
      liquido: Math.max(0, bruto - desconto),
    };
  });

  const subtotalCentavos = liquidos.reduce((soma, linha) => soma + linha.liquido, 0);

  const descontoPedidoCentavos = Math.max(0, emCentavos(getFieldValue(pData, pPricing.headerDiscountField)));

  // O desconto não pode comer mais do que os itens valem: no meio da digitação, um desconto grande
  // demais é estado transitório, não erro de tela — quem recusa é o back, com mensagem (CE-20).
  const descontoAplicavel = Math.min(descontoPedidoCentavos, subtotalCentavos);
  const finalCentavos = subtotalCentavos - descontoAplicavel;

  pData[pPricing.subtotalField] = subtotalCentavos / 100;
  pData[pPricing.finalValueField] = finalCentavos / 100;

  // O RATEIO na grade: só quando o modelo diz QUAL coluna da linha recebe o preço final. Sem isso, o
  // formulário não mexe nas linhas — é o que mantém o cálculo genérico para quem não rateia.
  if (!pPricing.itemNetTotalField)
    return;

  const { rateios } = ratearDesconto(liquidos, descontoAplicavel);

  // Preso numa const: dentro do callback abaixo o TypeScript já não sabe que o campo opcional
  // sobreviveu ao `return` acima.
  const campoDaLinha = pPricing.itemNetTotalField;
  const alvo = campoDaLinha.toLowerCase();

  const novasLinhas = linhas.map((linha, indice) => {
    // Escreve na MESMA chave que a linha já usa (a carga vem camelCase, o form em PascalCase): criar
    // uma segunda chave deixaria a grade lendo a antiga e mostrando o valor sem rateio.
    const chave = Object.keys(linha).find((pChave) => pChave.toLowerCase() === alvo) ?? campoDaLinha;

    // Linha NOVA a cada cálculo, em vez de escrever na existente: a grade repinta por referência, e
    // mutar o objeto no lugar deixaria o valor certo no estado e o antigo na tela.
    return { ...linha, [chave]: (liquidos[indice].liquido - rateios[indice]) / 100 };
  });

  // Idem para a lista: também pela chave que o dado já tem.
  const chaveDaLista = Object.keys(pData).find(
    (pChave) => pChave.toLowerCase() === pPricing.itemsField.toLowerCase(),
  ) ?? pPricing.itemsField;

  pData[chaveDaLista] = novasLinhas;
}
