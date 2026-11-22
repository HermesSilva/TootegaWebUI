/**
 * CONTEXTO DA CONSULTA na grade principal: a coluna que declara `visibleWhenField` só existe quando o contexto
 * (`dataView.contextEndpoint`) traz o campo verdadeiro — na grade (cabeçalho e linha) e no diálogo de exportação.
 */
import { describe, expect, it } from 'vitest';

import type { XDataField, XDataView, XExportConfig } from '@core/types';
import { colunaLigadaPeloContexto, dataViewPeloContexto, exportConfigPeloContexto } from '@core/lib/contextoDaConsulta';

const coluna = (pCampo: string, pQuando = ''): XDataField =>
  ({ fieldName: pCampo, title: pCampo, visibleWhenField: pQuando }) as unknown as XDataField;

const grade = (...pColunas: XDataField[]): XDataView =>
  ({ header: { columns: pColunas }, row: { columns: pColunas } }) as unknown as XDataView;

const exportacao = (...pCampos: string[]): XExportConfig =>
  ({ columns: pCampos.map((pCampo) => ({ fieldName: pCampo })) }) as unknown as XExportConfig;

const campos = (pColunas: { fieldName: string }[]): string[] => pColunas.map((pColuna) => pColuna.fieldName);

describe('contextoDaConsulta', () => {
  it('coluna sem campo declarado existe sempre; com campo, só quando o contexto o traz verdadeiro', () => {
    expect(colunaLigadaPeloContexto(coluna('SKU'), {})).toBe(true);
    expect(colunaLigadaPeloContexto(coluna('Lote', 'ControlaLote'), {})).toBe(false);
    expect(colunaLigadaPeloContexto(coluna('Lote', 'ControlaLote'), { controlaLote: false })).toBe(false);
    expect(colunaLigadaPeloContexto(coluna('Lote', 'ControlaLote'), { controlaLote: true })).toBe(true);
  });

  it('tira a coluna desligada do cabeçalho e da linha, e mantém a ordem das demais', () => {
    const original = grade(coluna('SKU'), coluna('Lote', 'ControlaLote'), coluna('Saldo'));

    const semLote = dataViewPeloContexto(original, { controlaLote: false });
    expect(campos(semLote.header.columns)).toEqual(['SKU', 'Saldo']);
    expect(campos(semLote.row.columns)).toEqual(['SKU', 'Saldo']);

    const comLote = dataViewPeloContexto(original, { controlaLote: true });
    expect(campos(comLote.header.columns)).toEqual(['SKU', 'Lote', 'Saldo']);
  });

  it('devolve a mesma grade quando nenhuma coluna depende de contexto', () => {
    const original = grade(coluna('SKU'), coluna('Saldo'));

    expect(dataViewPeloContexto(original, {})).toBe(original);
  });

  it('o diálogo de exportação perde a coluna desligada, casada pelo campo sem distinção de caixa', () => {
    const daGrade = grade(coluna('SKU'), coluna('Lote', 'ControlaLote'));
    const config = exportacao('SKU', 'lote', 'Serie');

    expect(campos(exportConfigPeloContexto(config, daGrade, {}).columns)).toEqual(['SKU', 'Serie']);
    expect(exportConfigPeloContexto(config, daGrade, { controlaLote: true })).toBe(config);
  });
});
