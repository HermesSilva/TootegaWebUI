import { XDataType, XFieldAlignment } from '@core/types';

/**
 * Classe de alinhamento de uma coluna de grade.
 *
 * Número alinha à DIREITA por padrão: é assim que a vírgula decimal cai na mesma coluna em todas as
 * linhas e a grandeza se lê de relance — 1.400,00 acima de 168,00 mostra a diferença sem que ninguém
 * conte dígitos. Texto alinha à esquerda, onde o olho começa a leitura.
 *
 * O modelo publicado pelo back sobrepõe: um alinhamento explícito (centro ou direita) sempre vence.
 * Só o padrão — `Left`, que é o valor não-atribuído — é reinterpretado conforme o tipo do dado.
 */
export function gridAlignmentClass(
  pAlignment: XFieldAlignment,
  pDataType: XDataType,
): string {
  if (pAlignment === XFieldAlignment.Center)
    return 'text-center';

  if (pAlignment === XFieldAlignment.Right)
    return 'text-right';

  return isNumericDataType(pDataType) ? 'text-right' : 'text-left';
}

/** Tipos cujo valor é uma grandeza — os que se comparam por magnitude, não por ordem alfabética. */
export function isNumericDataType(pDataType: XDataType): boolean {
  return pDataType === XDataType.Integer
    || pDataType === XDataType.Decimal
    || pDataType === XDataType.Currency
    || pDataType === XDataType.Percentage;
}
