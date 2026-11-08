import { describe, expect, it } from 'vitest';
import { AMBIENTES } from '@core/lib/formula/tex/ambientes';
import { FUNCOES, type Funcao, type TipoDeArgumento } from '@core/lib/formula/tex/funcoes';
import { MACROS_EMBUTIDAS } from '@core/lib/formula/tex/macros';
import { SIMBOLOS_MATH } from '@core/lib/formula/tex/simbolos';
import { problemas } from './apoio';

const ARGUMENTO: Record<TipoDeArgumento, string> = {
  math: '{a}', text: '{a}', resto: ' a', size: '{1em}', color: '{red}', raw: '{a}', url: '{http://x.y}', primitive: '(',
};

/** Funções que não cabem na chamada genérica: têm teste próprio em `tex.test.ts`. */
const CHAMADA_PROPRIA = new Set([
  '\\genfrac', '\\mkern', '\\mskip', '\\verb', '\\hline', '\\hdashline', '\\limits', '\\nolimits',
  '\\href', '\\url', '\\includegraphics', '\\htmlClass', '\\htmlId', '\\htmlStyle', '\\htmlData',
]);

function chamada(pNome: string, pFuncao: Funcao): string {
  const tipos = pFuncao.tipos ?? [];
  let fonte = pNome;
  for (let i = 0; i < pFuncao.args; i++)
    fonte += ARGUMENTO[tipos[i] ?? 'math'];
  return pFuncao.somenteTexto ? `\\text{${fonte}}` : fonte;
}

describe('o que está no catálogo renderiza sem erro', () => {
  it('todo símbolo de modo matemático', () => {
    expect(SIMBOLOS_MATH.size).toBeGreaterThan(500);
    expect(problemas(SIMBOLOS_MATH.keys())).toEqual([]);
  });

  it('toda função, com argumentos do tipo que ela declara', () => {
    const fontes = Object.entries(FUNCOES)
      .filter(([nome]) => !CHAMADA_PROPRIA.has(nome))
      .map(([nome, funcao]) => chamada(nome, funcao));
    expect(fontes.length).toBeGreaterThan(200);
    expect(problemas(fontes)).toEqual([]);
  });

  it('toda macro embutida', () => {
    const SO_EM_TEXTO = new Set(['\\aa', '\\AA']);
    const COM_MEDIDA = new Set(['\\hspace', '\\@hspace', '\\@hspacer']);
    const nomes = Object.keys(MACROS_EMBUTIDAS);
    expect(nomes.length).toBeGreaterThan(100);
    const fontes = nomes.map((pN) => {
      if (SO_EM_TEXTO.has(pN))
        return `\\text{${pN}}`;
      return COM_MEDIDA.has(pN) ? `${pN}{1em}` : `${pN}{a}{b}{c}`;
    });
    expect(problemas(fontes)).toEqual([]);
  });

  it('todo ambiente, na forma em bloco', () => {
    const UMA_COLUNA = ['gathered', 'gather', 'gather*'];
    const UMA_CELULA = ['equation', 'equation*'];
    const fontes = Object.keys(AMBIENTES)
      .filter((pN) => pN !== 'CD')
      .map((pN) => {
        const argumento = pN === 'subarray' ? '{c}' : ['array', 'darray'].includes(pN) ? '{cc}' : pN.startsWith('alignat') || pN === 'alignedat' ? '{1}' : '';
        const miolo = UMA_CELULA.includes(pN) ? 'a' : pN === 'subarray' || UMA_COLUNA.includes(pN) ? 'a\\\\c' : 'a&b\\\\c&d';
        return `\\begin{${pN}}${argumento}${miolo}\\end{${pN}}`;
      });
    expect(fontes.length).toBeGreaterThan(25);
    expect(problemas(fontes)).toEqual([]);
  });
});
