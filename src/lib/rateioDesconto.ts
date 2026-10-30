/**
 * Rateio do desconto de CABEÇALHO pelos itens — proporcional ao líquido de cada linha, com o resíduo
 * (uns centavos, com sinal) indo INTEIRO para quem o comporta.
 *
 * Vive num arquivo só porque DOIS pontos do front precisam do mesmo resultado, ao centavo: o
 * validador `fechamentoDocumento` (que fecha o documento) e o cálculo ao vivo `totaisAoVivo` (que pinta
 * a grade enquanto o operador digita). Duas cópias do algoritmo dariam, mais cedo ou mais tarde, dois
 * centavos diferentes na mesma tela.
 *
 * É gêmeo do C# `XFechamentoDocumento.DistribuirResiduo` — mesma ordem, mesmo desempate, logo mesmo
 * resultado: maior líquido primeiro, empate resolvido pelo menor número de item. Determinístico de
 * propósito: o que a tela mostra tem de ser o que o back grava.
 *
 * Trabalha em CENTAVOS INTEIROS — em ponto flutuante, 0.1 + 0.2 ≠ 0.3, e o rateio inventaria centavo.
 */

/** Uma linha, pelo que o rateio precisa saber dela. */
export interface LinhaRateavel {
  numeroItem: number;
  /** Líquido da linha em CENTAVOS (bruto − desconto do próprio item). */
  liquido: number;
}

export interface RateioResultado {
  /** Quanto do desconto coube a cada linha, em centavos, na ordem em que as linhas entraram. */
  rateios: number[];
  /** O que não coube em ninguém (zero no caso são). */
  sobra: number;
}

/**
 * Rateia `pDescontoCentavos` entre `pLinhas`, proporcionalmente ao líquido de cada uma.
 *
 * O rateio de uma linha nunca fica negativo, e nenhuma linha fica com total negativo: o que passar
 * desses limites transborda para a próxima — e o que nem assim couber volta em `sobra`, para quem
 * chamou decidir (o validador reporta erro; a prévia da tela apenas mostra o que coube).
 */
export function ratearDesconto(pLinhas: readonly LinhaRateavel[], pDescontoCentavos: number): RateioResultado {
  const rateios = new Array<number>(pLinhas.length).fill(0);

  const somaLiquida = pLinhas.reduce((soma, linha) => soma + linha.liquido, 0);

  // Sem desconto, ou sem base sobre a qual aplicá-lo, ninguém rateia nada — e o desconto inteiro é o
  // que sobra (quem chamou decide se isso é erro).
  if (pDescontoCentavos === 0 || somaLiquida <= 0)
    return { rateios, sobra: pDescontoCentavos };

  let somaRateada = 0;

  for (let i = 0; i < pLinhas.length; i++) {
    rateios[i] = Math.round((pDescontoCentavos * pLinhas[i].liquido) / somaLiquida);
    somaRateada += rateios[i];
  }

  let restante = pDescontoCentavos - somaRateada;

  if (restante !== 0) {
    const ordem = pLinhas
      .map((linha, indice) => ({ indice, liquido: linha.liquido, numeroItem: linha.numeroItem }))
      .sort((a, b) => b.liquido - a.liquido || a.numeroItem - b.numeroItem);

    for (const { indice } of ordem) {
      if (restante === 0) break;

      const minimo = -rateios[indice]; // o rateio nunca fica negativo
      const maximo = pLinhas[indice].liquido - rateios[indice]; // a linha nunca fica com total negativo
      const absorve = Math.min(Math.max(restante, minimo), maximo);

      rateios[indice] += absorve;
      restante -= absorve;
    }
  }

  return { rateios, sobra: restante };
}
