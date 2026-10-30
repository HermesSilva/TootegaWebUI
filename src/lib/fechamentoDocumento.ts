/**
 * Fechamento de documento comercial ao centavo — gêmeo em TypeScript do helper C#
 * `Tootega.Core.Comercial.XFechamentoDocumento`. O front calcula ENQUANTO o usuário digita (feedback
 * imediato); o back REVALIDA antes de gravar — o front nunca é fonte de verdade.
 *
 * O validador acha TODOS os erros antes de lançar (diretiva do dono, 2026-07-11): `validarDocumento`
 * devolve a lista inteira, para a tela marcar todos os campos de uma vez; `fecharDocumento` é o atalho
 * que lança `FechamentoInvalidoError` — carregando todos os erros, não o primeiro.
 *
 * Invariante, sem tolerância: `Σ item.valorTotal === valorTotal` do documento, exato.
 *
 * O fechamento é POR VALOR, não por preço unitário: `quantidade × preçoFinalUnitário` não fecha em
 * duas casas quando o preço é fracionado (3 × 0,333333 = 0,999999). O preço final unitário é
 * derivado e informativo; quem fecha é o valor total do item. É por isso que a NF-e transporta
 * desconto por item (`vDesc`) em vez de reescrever o preço.
 *
 * Todo o cálculo de moeda corre em CENTAVOS INTEIROS: em JavaScript, 0.1 + 0.2 !== 0.3, e um
 * invariante "exato" sobre `number` fracionário seria mentira.
 */

import { ratearDesconto } from './rateioDesconto';

export interface FechamentoItemEntrada {
  numeroItem: number;
  quantidade: number;
  precoUnitario: number;
  valorDesconto?: number;
}

export interface FechamentoItemResultado {
  numeroItem: number;
  valorBruto: number;
  valorDesconto: number;
  valorDescontoRateado: number;
  valorTotal: number;
  /** Derivado e informativo (total ÷ quantidade). Quem fecha o documento é `valorTotal`. */
  precoFinalUnitario: number;
}

export type OrigemDesconto = 'NENHUM' | 'DESCONTO_GERAL' | 'VALOR_FINAL';

/** O que pode estar errado num fechamento. O slug é o mesmo do enum C# `XFechamentoErroCodigo`. */
export type FechamentoErroCodigo =
  | 'SEM_ITENS'
  | 'QUANTIDADE_INVALIDA'
  | 'PRECO_NEGATIVO'
  | 'DESCONTO_ITEM_NEGATIVO'
  | 'DESCONTO_ITEM_EXCEDE_BRUTO'
  | 'DESCONTO_GERAL_NEGATIVO'
  | 'DESCONTO_GERAL_EXCEDE_LIQUIDO'
  | 'VALOR_FINAL_NEGATIVO'
  | 'VALOR_FINAL_ACRESCIMO'
  | 'SEM_BASE_PARA_DESCONTO'
  | 'NUMERO_ITEM_REPETIDO'
  | 'RESIDUO_NAO_ABSORVIDO'
  | 'DOCUMENTO_NAO_FECHA';

/**
 * Um erro do fechamento. `numeroItem === 0` quando o erro é do cabeçalho, não de um item.
 * `texto` é o que vai ao usuário; `diagnostico` é para log.
 */
export interface FechamentoErro {
  codigo: FechamentoErroCodigo;
  numeroItem: number;
  texto: string;
  diagnostico: string;
}

export interface FechamentoResultado {
  itens: FechamentoItemResultado[];
  valorBruto: number;
  valorDescontoItens: number;
  valorDescontoGeral: number;
  valorTotal: number;
  origemDesconto: OrigemDesconto;
}

/** Validação: TODOS os erros de uma vez. `fechamento` só vem preenchido quando não há erro algum. */
export interface FechamentoValidacao {
  valido: boolean;
  erros: FechamentoErro[];
  fechamento?: FechamentoResultado;
}

export interface FechamentoOpcoes {
  /**
   * Desconto do PEDIDO, em moeda — a entrada. Quando vem, é ele que manda: o valor final é derivado
   * (`subtotal − descontoGeral`, com o subtotal sendo a soma do preço final dos itens).
   */
  descontoGeral?: number;
  /**
   * Valor que o documento deve fechar. Vale como forma de ENTRADA só quando `descontoGeral` não veio —
   * aí a diferença até o líquido dos itens vira o desconto do pedido. Os dois juntos não são erro
   * (dono, 2026-08-02): o formulário sempre envia ambos, e o desconto tem precedência.
   */
  valorFinal?: number;
}

/** O documento não fecha. Carrega TODOS os erros achados — o validador nunca para no primeiro. */
export class FechamentoInvalidoError extends Error {
  readonly erros: FechamentoErro[];

  constructor(erros: FechamentoErro[]) {
    super(`O fechamento tem ${erros.length} erro(s): ${erros.map((e) => e.diagnostico).join(' | ')}`);
    this.name = 'FechamentoInvalidoError';
    this.erros = erros;
  }
}

/**
 * O texto de cada erro — espelho das `[Description]` do `XFechamentoErroCodigo` no back
 * (`Tootega.Core/Vendas/XFechamentoItemEntrada.cs`). Os dois lados validam o mesmo pedido e têm de
 * dizer a mesma coisa: divergir aqui faria a tela contradizer o servidor.
 */
const TEXTO_DO_ERRO: Record<FechamentoErroCodigo, string> = {
  SEM_ITENS: 'O documento não tem itens',
  QUANTIDADE_INVALIDA: 'Quantidade deve ser maior que zero',
  PRECO_NEGATIVO: 'Preço unitário não pode ser negativo',
  DESCONTO_ITEM_NEGATIVO: 'Desconto do item não pode ser negativo',
  DESCONTO_ITEM_EXCEDE_BRUTO: 'Desconto do item excede o valor bruto',
  DESCONTO_GERAL_NEGATIVO: 'Desconto geral não pode ser negativo',
  DESCONTO_GERAL_EXCEDE_LIQUIDO: 'Desconto geral excede o líquido dos itens',
  VALOR_FINAL_NEGATIVO: 'Valor final não pode ser negativo',
  VALOR_FINAL_ACRESCIMO: 'Valor final maior que o líquido dos itens: seria acréscimo',
  SEM_BASE_PARA_DESCONTO: 'Não há valor sobre o qual aplicar o desconto geral',
  NUMERO_ITEM_REPETIDO: 'Número de item repetido',
  RESIDUO_NAO_ABSORVIDO: 'Resíduo de arredondamento que nenhum item comporta',
  DOCUMENTO_NAO_FECHA: 'A soma dos itens difere do total do documento',
};

/** Moeda → centavos inteiros, arredondando meio-para-longe-do-zero (0,005 → 0,01). */
const paraCentavos = (valor: number): number => {
  const sinal = valor < 0 ? -1 : 1;
  // O epsilon corrige o resíduo binário (1.115 * 100 = 111.49999999999999 em IEEE-754).
  return sinal * Math.round(Math.abs(valor) * 100 + 1e-9);
};

const paraMoeda = (centavos: number): number => centavos / 100;

const formatar = (centavos: number): string => paraMoeda(centavos).toFixed(2);

const erro = (codigo: FechamentoErroCodigo, numeroItem: number, diagnostico: string): FechamentoErro => ({
  codigo,
  numeroItem,
  texto: TEXTO_DO_ERRO[codigo],
  diagnostico,
});

/**
 * Valida e calcula. Percorre TUDO antes de decidir: um item com quantidade zero não impede que o
 * item seguinte, com desconto excessivo, também seja reportado.
 *
 * Os erros de cabeçalho são avaliados contra o líquido dos itens VÁLIDOS — assim aparecem na mesma
 * listagem, em vez de só surgirem depois que os itens forem corrigidos.
 */
export function validarDocumento(
  itens: readonly FechamentoItemEntrada[],
  opcoes: FechamentoOpcoes = {},
): FechamentoValidacao {
  const erros: FechamentoErro[] = [];

  if (!itens || itens.length === 0) {
    erros.push(erro('SEM_ITENS', 0, 'O documento não tem itens.'));
    return { valido: false, erros };
  }

  // 1-2. Bruto e líquido de cada item, em centavos. Todo item é percorrido, mesmo que o anterior
  // tenha errado: só assim a lista de erros sai completa.
  interface Linha {
    numeroItem: number;
    quantidade: number;
    bruto: number;
    desconto: number;
    liquido: number;
  }

  const linhas: Linha[] = [];
  const numerosVistos = new Set<number>();

  for (const item of itens) {
    let itemValido = true;

    if (numerosVistos.has(item.numeroItem)) {
      erros.push(erro('NUMERO_ITEM_REPETIDO', item.numeroItem, `Item ${item.numeroItem}: número de item repetido.`));
      itemValido = false;
    }
    numerosVistos.add(item.numeroItem);

    if (item.quantidade <= 0) {
      erros.push(
        erro('QUANTIDADE_INVALIDA', item.numeroItem, `Item ${item.numeroItem}: a quantidade deve ser maior que zero.`),
      );
      itemValido = false;
    }

    if (item.precoUnitario < 0) {
      erros.push(
        erro('PRECO_NEGATIVO', item.numeroItem, `Item ${item.numeroItem}: o preço unitário não pode ser negativo.`),
      );
      itemValido = false;
    }

    const desconto = paraCentavos(item.valorDesconto ?? 0);

    if (desconto < 0) {
      erros.push(
        erro('DESCONTO_ITEM_NEGATIVO', item.numeroItem, `Item ${item.numeroItem}: o desconto não pode ser negativo.`),
      );
      itemValido = false;
    }

    // O bruto só é comparável ao desconto quando quantidade e preço são sãos.
    const base = item.quantidade > 0 && item.precoUnitario >= 0;
    const bruto = base ? paraCentavos(item.quantidade * item.precoUnitario) : 0;

    if (base && desconto > bruto) {
      erros.push(
        erro(
          'DESCONTO_ITEM_EXCEDE_BRUTO',
          item.numeroItem,
          `Item ${item.numeroItem}: o desconto (${formatar(desconto)}) excede o valor bruto (${formatar(bruto)}).`,
        ),
      );
      itemValido = false;
    }

    // Item errado não entra no cálculo — mas o cálculo do CABEÇALHO segue sobre os válidos, para que
    // os erros de cabeçalho também apareçam nesta mesma listagem.
    if (itemValido)
      linhas.push({
        numeroItem: item.numeroItem,
        quantidade: item.quantidade,
        bruto,
        desconto,
        liquido: bruto - desconto,
      });
  }

  const somaLiquida = linhas.reduce((soma, linha) => soma + linha.liquido, 0);

  // 3-4. De onde vem o desconto do pedido: DIGITADO (o caso normal — é o campo do formulário), ou, só
  // quando ele não veio, deduzido de um valor final informado. A ordem é esta desde 2026-08-02: o valor
  // final é DERIVADO do desconto, e como o formulário envia os dois campos sempre, dar precedência ao
  // valor final faria o número calculado pela tela mandar no que o operador digitou.
  let descontoGeral = 0;
  let origemDesconto: OrigemDesconto = 'NENHUM';

  if (opcoes.descontoGeral !== undefined) {
    descontoGeral = paraCentavos(opcoes.descontoGeral);

    if (descontoGeral < 0) erros.push(erro('DESCONTO_GERAL_NEGATIVO', 0, 'O desconto geral não pode ser negativo.'));

    if (descontoGeral > somaLiquida)
      erros.push(
        erro(
          'DESCONTO_GERAL_EXCEDE_LIQUIDO',
          0,
          `O desconto geral (${formatar(descontoGeral)}) excede o líquido dos itens (${formatar(somaLiquida)}).`,
        ),
      );

    origemDesconto = descontoGeral > 0 ? 'DESCONTO_GERAL' : 'NENHUM';
  } else if (opcoes.valorFinal !== undefined) {
    const valorFinal = paraCentavos(opcoes.valorFinal);

    if (valorFinal < 0) erros.push(erro('VALOR_FINAL_NEGATIVO', 0, 'O valor final não pode ser negativo.'));

    const diferenca = somaLiquida - valorFinal;

    if (diferenca < 0)
      erros.push(
        erro(
          'VALOR_FINAL_ACRESCIMO',
          0,
          `O valor final (${formatar(valorFinal)}) é maior que o líquido dos itens (${formatar(somaLiquida)}): ` +
            'isso seria acréscimo, não desconto.',
        ),
      );

    descontoGeral = diferenca > 0 ? diferenca : 0;
    origemDesconto = descontoGeral > 0 ? 'VALOR_FINAL' : 'NENHUM';
  }

  if (somaLiquida === 0 && descontoGeral > 0)
    erros.push(erro('SEM_BASE_PARA_DESCONTO', 0, 'Não há valor sobre o qual aplicar o desconto geral.'));

  // Com erro na entrada, o rateio não tem sentido: os números-base estão errados. A lista de erros,
  // porém, já está completa — é o que o chamador precisa.
  if (erros.length > 0) return { valido: false, erros };

  // 5-6. Rateio proporcional ao líquido de cada item, com o resíduo indo INTEIRO para quem o comporta.
  // O algoritmo vive em `rateioDesconto` porque o cálculo AO VIVO da grade usa exatamente o mesmo —
  // duas cópias dariam, um dia, dois centavos diferentes na mesma tela.
  const { rateios, sobra } = ratearDesconto(linhas, descontoGeral);

  if (sobra !== 0)
    erros.push(erro('RESIDUO_NAO_ABSORVIDO', 0, `Sobrou resíduo de ${formatar(sobra)} que nenhum item comporta.`));

  // 7. Totais por item.
  const total = somaLiquida - descontoGeral;

  const itensResultado: FechamentoItemResultado[] = linhas.map((linha, indice) => {
    const totalItem = linha.liquido - rateios[indice];

    return {
      numeroItem: linha.numeroItem,
      valorBruto: paraMoeda(linha.bruto),
      valorDesconto: paraMoeda(linha.desconto),
      valorDescontoRateado: paraMoeda(rateios[indice]),
      valorTotal: paraMoeda(totalItem),
      precoFinalUnitario: Number((paraMoeda(totalItem) / linha.quantidade).toFixed(6)),
    };
  });

  // 8. A rede de segurança: ou fecha exato, ou não grava.
  const somaTotais = linhas.reduce((soma, linha, indice) => soma + (linha.liquido - rateios[indice]), 0);

  if (somaTotais !== total)
    erros.push(
      erro(
        'DOCUMENTO_NAO_FECHA',
        0,
        `O documento não fecha: a soma dos itens (${formatar(somaTotais)}) difere do total (${formatar(total)}).`,
      ),
    );

  if (erros.length > 0) return { valido: false, erros };

  return {
    valido: true,
    erros: [],
    fechamento: {
      itens: itensResultado,
      valorBruto: paraMoeda(linhas.reduce((soma, linha) => soma + linha.bruto, 0)),
      valorDescontoItens: paraMoeda(linhas.reduce((soma, linha) => soma + linha.desconto, 0)),
      valorDescontoGeral: paraMoeda(descontoGeral),
      valorTotal: paraMoeda(total),
      origemDesconto,
    },
  };
}

/**
 * Fecha o documento e LANÇA se houver erro — com TODOS os erros dentro da exceção.
 * Quem precisa dos erros sem exceção usa `validarDocumento`.
 */
export function fecharDocumento(
  itens: readonly FechamentoItemEntrada[],
  opcoes: FechamentoOpcoes = {},
): FechamentoResultado {
  const validacao = validarDocumento(itens, opcoes);

  if (!validacao.valido || !validacao.fechamento) throw new FechamentoInvalidoError(validacao.erros);

  return validacao.fechamento;
}
