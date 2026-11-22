import { getFieldValue } from './fieldAccess';
import { isTruthy } from './visibility';
import type { XDataField, XDataView, XExportConfig } from '@core/types';

/**
 * CONTEXTO DA CONSULTA na grade principal (CE-19): o back declara em cada coluna o campo do contexto que a liga
 * (`visibleWhenField`) e o endpoint que entrega esse contexto (`dataView.contextEndpoint`); aqui só se aplica a
 * regra. Nenhuma App é conhecida. É o par, na grade principal, da coluna condicional da grade de itens.
 */

/** A coluna existe sob este contexto? Sem campo declarado ⇒ sempre. Campo falso ou ausente ⇒ não. */
export function colunaLigadaPeloContexto(pColuna: XDataField, pContexto: Record<string, unknown>): boolean {
  if (!pColuna.visibleWhenField)
    return true;

  return isTruthy(getFieldValue(pContexto, pColuna.visibleWhenField));
}

/**
 * A grade sem as colunas que o contexto desliga — no cabeçalho e na linha, que são listas separadas no modelo.
 * Devolve o MESMO objeto quando nenhuma coluna depende de contexto: a App que não declara nada não ganha uma
 * referência nova a cada renderização.
 */
export function dataViewPeloContexto(pDataView: XDataView, pContexto: Record<string, unknown>): XDataView {
  const depende = (pColunas: XDataField[] | undefined): boolean =>
    (pColunas ?? []).some((pColuna) => Boolean(pColuna.visibleWhenField));

  if (!depende(pDataView.header.columns) && !depende(pDataView.row.columns))
    return pDataView;

  const ligadas = (pColunas: XDataField[]): XDataField[] =>
    pColunas.filter((pColuna) => colunaLigadaPeloContexto(pColuna, pContexto));

  return {
    ...pDataView,
    header: { ...pDataView.header, columns: ligadas(pDataView.header.columns) },
    row: { ...pDataView.row, columns: ligadas(pDataView.row.columns) },
  };
}

/**
 * A configuração de exportação sem as colunas dos campos que o contexto desligou na grade: o diálogo não oferece
 * no arquivo a coluna que a tela não mostra. As colunas do arquivo são casadas com as da grade pelo `fieldName`,
 * sem distinção de caixa. Devolve o MESMO objeto quando nada foi desligado.
 */
export function exportConfigPeloContexto(
  pConfig: XExportConfig,
  pDataView: XDataView,
  pContexto: Record<string, unknown>,
): XExportConfig {
  const desligados = new Set(
    (pDataView.header.columns ?? [])
      .filter((pColuna) => !colunaLigadaPeloContexto(pColuna, pContexto))
      .map((pColuna) => pColuna.fieldName.toLowerCase()));

  if (desligados.size === 0)
    return pConfig;

  return {
    ...pConfig,
    columns: (pConfig.columns ?? []).filter((pColuna) => !desligados.has(pColuna.fieldName.toLowerCase())),
  };
}
