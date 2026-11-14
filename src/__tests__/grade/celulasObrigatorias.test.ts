/**
 * CÉLULAS OBRIGATÓRIAS POR LINHA da grade de itens (dono, 2026-11-09) — a regra que a grade usa para travar e marcar a
 * célula e o modal de coleta para segurar o Confirmar: a coluna se edita só nas linhas que o campo da própria linha
 * libera (`editableWhenRowField`) e, onde se edita, tem de estar preenchida (`isRequired`).
 */
import { describe, expect, it } from 'vitest';

import type { XUIGridColumn } from '@core/types';
import { celulaEditavelNaLinha, celulaObrigatoriaVazia, pendenciasDaGrade } from '@core/lib/celulasObrigatorias';

const produto: XUIGridColumn = {
  fieldName: 'Produto', title: 'Produto', editorType: 'picker', width: 26,
  editableWhenRowField: 'PrecisaEscolher', isRequired: true,
};

const descricao: XUIGridColumn = { fieldName: 'Descricao', title: 'Descrição', editorType: 'text', width: 20, readOnly: true };

describe('celulasObrigatorias', () => {
  it('a linha decide se a célula se edita; sem o campo declarado, a linha não decide nada', () => {
    expect(celulaEditavelNaLinha(produto, { precisaEscolher: true })).toBe(true);
    expect(celulaEditavelNaLinha(produto, { precisaEscolher: false })).toBe(false);
    expect(celulaEditavelNaLinha(produto, {})).toBe(false);
    expect(celulaEditavelNaLinha(descricao, {})).toBe(true);
  });

  it('só cobra a célula obrigatória, editável na linha e vazia (nulo, texto em branco ou zero)', () => {
    expect(celulaObrigatoriaVazia(produto, { precisaEscolher: true, produto: '' })).toBe(true);
    expect(celulaObrigatoriaVazia(produto, { precisaEscolher: true, produto: null })).toBe(true);
    expect(celulaObrigatoriaVazia(produto, { precisaEscolher: true, produto: 0 })).toBe(true);
    expect(celulaObrigatoriaVazia(produto, { precisaEscolher: true, produto: 'Arruela' })).toBe(false);
    expect(celulaObrigatoriaVazia(produto, { precisaEscolher: false, produto: '' })).toBe(false);
    expect(celulaObrigatoriaVazia(descricao, { descricao: '' })).toBe(false);
  });

  it('a frase nomeia a coluna e as linhas pela posição, e some quando nada falta', () => {
    const linhas = [
      { precisaEscolher: false, produto: 'Será cadastrado com este GTIN' },
      { precisaEscolher: true, produto: '' },
      { precisaEscolher: true, produto: 'Arruela' },
      { precisaEscolher: true, produto: null },
      { precisaEscolher: true },
    ];

    expect(pendenciasDaGrade([descricao, produto], linhas)).toBe('Preencha Produto nas linhas 2, 4 e 5.');
    expect(pendenciasDaGrade([produto], [linhas[1]])).toBe('Preencha Produto na linha 1.');
    expect(pendenciasDaGrade([produto], [linhas[0], linhas[2]])).toBeNull();
    expect(pendenciasDaGrade([produto], 'não é lista')).toBeNull();
    expect(pendenciasDaGrade(undefined, linhas)).toBeNull();
  });
});
