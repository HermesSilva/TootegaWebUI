/**
 * AMBIENTES (`\begin{…}…\end{…}`): a família matrix, array, cases, aligned/align, gathered/gather, equation, split,
 * subarray, smallmatrix e CD. Todos viram um nó `arranjo`; o construtor de MathML desenha a `mtable`.
 */

import { grupo, simbolo, type AlinhamentoDeColuna, type Arranjo, type ColunaDoArranjo, type LinhaDoArranjo, type No } from '../ast';
import type { Parser } from './parser';

export interface ContextoDoAmbiente {
  parser: Parser;
  nome: string;
  argumentos: string[];
  opcional: string | null;
}

export interface Ambiente {
  /** Argumentos obrigatórios `{…}` depois do nome (`array{cols}`, `alignedat{n}`). */
  args?: number;
  /** Argumento opcional `[…]` depois do nome (`matrix*[r]`). */
  opcional?: boolean;
  /** Só faz sentido em display; na linha sai como este outro ambiente. */
  somenteDisplay?: string;
  tratador: (pContexto: ContextoDoAmbiente) => No;
}

export const AMBIENTES: Record<string, Ambiente> = {};

function coluna(pAlinhamento: AlinhamentoDeColuna, pColada = false): ColunaDoArranjo {
  const saida: ColunaDoArranjo = { alinhamento: pAlinhamento, linhasAntes: 0, tracejadasAntes: 0 };
  if (pColada)
    saida.colada = true;
  return saida;
}

/** `{c|c:r}` → colunas; devolve também as linhas depois da última coluna. */
export function lerEspecificacaoDeColunas(pTexto: string): { colunas: ColunaDoArranjo[]; linhasDepois: number; tracejadasDepois: number } {
  const colunas: ColunaDoArranjo[] = [];
  let linhas = 0;
  let tracejadas = 0;
  // `*{3}{c}` → `ccc`.
  const texto = pTexto.replace(/\*\{(\d+)\}\{([^}]*)\}/g, (pTudo, pN, pCols) => (pTudo ? pCols.repeat(Number(pN)) : ''));
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === 'l' || c === 'c' || c === 'r') {
      const nova = coluna(c === 'l' ? 'esquerda' : c === 'c' ? 'centro' : 'direita');
      nova.linhasAntes = linhas;
      nova.tracejadasAntes = tracejadas;
      colunas.push(nova);
      linhas = 0;
      tracejadas = 0;
    } else if (c === '|')
      linhas += 1;
    else if (c === ':')
      tracejadas += 1;
    else if (c === '@' || c === 'p' || c === 'm' || c === 'b') {
      // `@{…}`, `p{…}`: pula o grupo; `p` conta como coluna à esquerda.
      if (texto[i + 1] === '{') {
        const fecha = texto.indexOf('}', i + 2);
        i = fecha === -1 ? texto.length : fecha;
      }
      if (c !== '@') {
        const nova = coluna('esquerda');
        nova.linhasAntes = linhas;
        nova.tracejadasAntes = tracejadas;
        colunas.push(nova);
        linhas = 0;
        tracejadas = 0;
      }
    }
    // Espaços e o resto são ignorados.
  }
  return { colunas, linhasDepois: linhas, tracejadasDepois: tracejadas };
}

interface OpcoesDoArranjo {
  colunas: ColunaDoArranjo[];
  /** Quando as colunas acabam, repete este padrão (`matrix` centra tudo; `aligned` alterna r/l coladas). */
  padrao: (pIndice: number) => ColunaDoArranjo;
  linhasDepois?: number;
  tracejadasDepois?: number;
  numerado?: boolean;
  /** Máximo de células por linha (`cases` = 2); a mais vira erro. */
  maximoDeColunas?: number;
  /** Colunas declaradas que nenhuma linha usou saem (`cases` com uma coluna só). */
  cortarColunas?: boolean;
}

/** Lê o corpo de um ambiente de arranjo até `\end` (não consumido). */
function lerArranjo(pParser: Parser, pNome: string, pOpcoes: OpcoesDoArranjo): Arranjo {
  const linhas: LinhaDoArranjo[] = [];
  const colunas = [...pOpcoes.colunas];
  let linhaCorrente: LinhaDoArranjo = { celulas: [], linhasAntes: 0, tracejadasAntes: 0 };
  let celulaCorrente: No[] = [];
  let linhasNoFim = 0;
  let tracejadasNoFim = 0;
  let totalDeColunas = colunas.length;
  let colunasUsadas = 0;

  const lerHlines = (): void => {
    for (;;) {
      pParser.pularEspacos();
      const t = pParser.espiar();
      if (t.texto === '\\hline') {
        pParser.proximo();
        linhaCorrente.linhasAntes += 1;
      } else if (t.texto === '\\hdashline') {
        pParser.proximo();
        linhaCorrente.tracejadasAntes += 1;
      } else
        break;
    }
  };

  const fecharCelula = (): void => {
    linhaCorrente.celulas.push(celulaCorrente);
    celulaCorrente = [];
    totalDeColunas = Math.max(totalDeColunas, linhaCorrente.celulas.length);
    if (!(linhaCorrente.celulas.length === 1 && celulaCorrente.length === 0 && linhaCorrente.celulas[0].length === 0))
      colunasUsadas = Math.max(colunasUsadas, linhaCorrente.celulas.length);
  };

  const fecharLinha = (pUltima: boolean): void => {
    const etiqueta = pParser.etiquetaDaLinha;
    pParser.etiquetaDaLinha = undefined;
    // Última linha vazia (um `\\` antes do `\end`) não conta — regra do LaTeX.
    const vazia = linhaCorrente.celulas.length === 1 && linhaCorrente.celulas[0].length === 0;
    if (pUltima && vazia) {
      linhasNoFim = linhaCorrente.linhasAntes;
      tracejadasNoFim = linhaCorrente.tracejadasAntes;
      return;
    }
    if (pOpcoes.maximoDeColunas !== undefined && linhaCorrente.celulas.length > pOpcoes.maximoDeColunas) {
      pParser.aviso(`\`${pNome}\` aceita no máximo ${pOpcoes.maximoDeColunas} colunas por linha.`, pParser.espiar().posicao);
      linhaCorrente.celulas = linhaCorrente.celulas.slice(0, pOpcoes.maximoDeColunas);
    }
    if (etiqueta !== undefined && etiqueta !== null) {
      linhaCorrente.etiqueta = etiqueta.rotulo;
      if (etiqueta.crua)
        linhaCorrente.etiquetaCrua = true;
    } else if (pOpcoes.numerado && etiqueta === undefined)
      linhaCorrente.etiqueta = [];   // numeração automática: o construtor decide o número
    linhas.push(linhaCorrente);
  };

  pParser.etiquetaDaLinha = undefined;
  lerHlines();
  for (;;) {
    celulaCorrente.push(...pParser.parseExpressao(false));
    const t = pParser.espiar();
    if (t.tipo === 'fim') {
      fecharCelula();
      fecharLinha(true);
      pParser.aviso(`\`\\begin{${pNome}}\` sem \`\\end{${pNome}}\`.`, t.posicao);
      break;
    }
    if (t.texto === '&') {
      pParser.proximo();
      fecharCelula();
      continue;
    }
    if (t.texto === '\\\\' || t.texto === '\\cr') {
      pParser.proximo();
      fecharCelula();
      const espaco = pParser.parseMedidaOpcional();
      if (espaco)
        linhaCorrente.espacoDepois = espaco;
      fecharLinha(false);
      linhaCorrente = { celulas: [], linhasAntes: 0, tracejadasAntes: 0 };
      lerHlines();
      // `\end` logo depois de `\\`: a linha vazia é descartada ao fechar.
      if (pParser.espiar().texto === '\\end') {
        fecharCelula();
        fecharLinha(true);
        break;
      }
      continue;
    }
    if (t.texto === '\\end') {
      fecharCelula();
      fecharLinha(true);
      break;
    }
    // `}` ou `\right` perdidos: deixa para o chamador reclamar.
    fecharCelula();
    fecharLinha(true);
    break;
  }
  while (colunas.length < totalDeColunas)
    colunas.push(pOpcoes.padrao(colunas.length));
  if (pOpcoes.cortarColunas && colunas.length > Math.max(1, colunasUsadas))
    colunas.length = Math.max(1, colunasUsadas);
  const saida: Arranjo = {
    tipo: 'arranjo',
    ambiente: pNome,
    linhas,
    colunas,
    linhasDepois: pOpcoes.linhasDepois ?? 0,
    tracejadasDepois: pOpcoes.tracejadasDepois ?? 0,
    linhasNoFim,
    tracejadasNoFim,
  };
  if (pOpcoes.numerado)
    saida.numerado = true;
  return saida;
}

// ---------------------------------------------------------------- matrizes

const MATRIZES: Record<string, [string, string]> = {
  matrix: ['', ''],
  pmatrix: ['(', ')'],
  bmatrix: ['[', ']'],
  Bmatrix: ['{', '}'],
  vmatrix: ['|', '|'],
  Vmatrix: ['‖', '‖'],
};
for (const [nome, [esq, dir]] of Object.entries(MATRIZES)) {
  const tratador = (pC: ContextoDoAmbiente): No => {
    const alinhamento: AlinhamentoDeColuna = pC.opcional === 'l' ? 'esquerda' : pC.opcional === 'r' ? 'direita' : 'centro';
    const arranjo = lerArranjo(pC.parser, nome, { colunas: [], padrao: () => coluna(alinhamento) });
    if (esq)
      arranjo.delimitadorEsquerdo = esq;
    if (dir)
      arranjo.delimitadorDireito = dir;
    return arranjo;
  };
  AMBIENTES[nome] = { tratador };
  AMBIENTES[`${nome}*`] = { opcional: true, tratador };
}

AMBIENTES.smallmatrix = {
  tratador: (pC) => {
    const arranjo = lerArranjo(pC.parser, 'smallmatrix', { colunas: [], padrao: () => coluna('centro') });
    arranjo.compacto = true;
    arranjo.estilo = 'script';
    return arranjo;
  },
};

AMBIENTES.subarray = {
  args: 1,
  tratador: (pC) => {
    const especificacao = lerEspecificacaoDeColunas(pC.argumentos[0]);
    if (especificacao.colunas.length > 1)
      pC.parser.aviso('`subarray` tem uma coluna só.', pC.parser.espiar().posicao);
    const arranjo = lerArranjo(pC.parser, 'subarray', { colunas: especificacao.colunas.slice(0, 1), padrao: () => coluna('centro'), maximoDeColunas: 1 });
    arranjo.compacto = true;
    arranjo.estilo = 'script';
    return arranjo;
  },
};

// ---------------------------------------------------------------- array

for (const nome of ['array', 'darray'])
  AMBIENTES[nome] = {
    args: 1,
    tratador: (pC) => {
      const especificacao = lerEspecificacaoDeColunas(pC.argumentos[0]);
      if (especificacao.colunas.length === 0)
        throw new Error(`\`${nome}\` precisa da especificação das colunas ({c|r}…).`);
      const arranjo = lerArranjo(pC.parser, nome, { colunas: especificacao.colunas, padrao: () => coluna('centro'), linhasDepois: especificacao.linhasDepois, tracejadasDepois: especificacao.tracejadasDepois });
      if (nome === 'darray')
        arranjo.estilo = 'display';
      return arranjo;
    },
  };

// ---------------------------------------------------------------- cases

const CASOS: Record<string, [string, string, boolean]> = { cases: ['{', '', false], dcases: ['{', '', true], rcases: ['', '}', false], drcases: ['', '}', true] };
for (const [nome, [esq, dir, display]] of Object.entries(CASOS))
  AMBIENTES[nome] = {
    tratador: (pC) => {
      const arranjo = lerArranjo(pC.parser, nome, { colunas: [coluna('esquerda'), coluna('esquerda')], padrao: () => coluna('esquerda'), maximoDeColunas: 2, cortarColunas: true });
      // A segunda coluna de `cases` tem um espaço grande antes (`\quad` do LaTeX): marca com `colada: false` e o
      // construtor aplica o espaçamento de `cases`.
      if (esq)
        arranjo.delimitadorEsquerdo = esq;
      if (dir)
        arranjo.delimitadorDireito = dir;
      if (display)
        arranjo.estilo = 'display';
      return arranjo;
    },
  };

// ---------------------------------------------------------------- align e gather

/** Colunas de `aligned`: r, l coladas, depois espaço largo, r, l coladas… */
function colunaDeAlign(pIndice: number): ColunaDoArranjo {
  return coluna(pIndice % 2 === 0 ? 'direita' : 'esquerda', pIndice % 2 === 1);
}

for (const nome of ['aligned', 'align', 'align*'])
  AMBIENTES[nome] = {
    somenteDisplay: nome === 'aligned' ? undefined : 'aligned',
    tratador: (pC) => {
      const arranjo = lerArranjo(pC.parser, nome, { colunas: [], padrao: colunaDeAlign, numerado: nome === 'align' });
      return arranjo;
    },
  };
for (const nome of ['alignedat', 'alignat', 'alignat*'])
  AMBIENTES[nome] = {
    args: 1,
    somenteDisplay: nome === 'alignedat' ? undefined : 'alignedat',
    tratador: (pC) => {
      const pares = Number(pC.argumentos[0]);
      if (!Number.isInteger(pares) || pares < 1)
        throw new Error(`\`${nome}\` espera o número de pares de colunas.`);
      const colunas: ColunaDoArranjo[] = [];
      for (let i = 0; i < pares * 2; i++) {
        const c = colunaDeAlign(i);
        // Em `alignat` não há espaço largo entre os pares: todas coladas.
        c.colada = true;
        colunas.push(c);
      }
      return lerArranjo(pC.parser, nome, { colunas, padrao: colunaDeAlign, numerado: nome === 'alignat' });
    },
  };
for (const nome of ['gathered', 'gather', 'gather*'])
  AMBIENTES[nome] = {
    somenteDisplay: nome === 'gathered' ? undefined : 'gathered',
    tratador: (pC) => lerArranjo(pC.parser, nome, { colunas: [coluna('centro')], padrao: () => coluna('centro'), maximoDeColunas: 1, numerado: nome === 'gather' }),
  };
for (const nome of ['equation', 'equation*'])
  AMBIENTES[nome] = {
    somenteDisplay: 'gathered',
    tratador: (pC) => {
      const arranjo = lerArranjo(pC.parser, nome, { colunas: [coluna('centro')], padrao: () => coluna('centro'), maximoDeColunas: 1, numerado: nome === 'equation' });
      if (arranjo.linhas.length > 1)
        pC.parser.aviso('`equation` tem uma linha só; use `gather` ou `align` para várias.', pC.parser.espiar().posicao);
      return arranjo;
    },
  };
AMBIENTES.split = {
  tratador: (pC) => lerArranjo(pC.parser, 'split', { colunas: [coluna('direita'), coluna('esquerda', true)], padrao: colunaDeAlign, maximoDeColunas: 2, cortarColunas: true }),
};

// ---------------------------------------------------------------- CD (diagramas comutativos)

/**
 * `\begin{CD} A @>f>> B \\ @VgVV @VVhV \\ C @>>k> D \end{CD}`: as setas `@>>>`, `@<<<`, `@VVV`, `@AAA`, `@=`, `@|`
 * viram células com setas extensíveis e rótulos. Leitura textual, célula a célula.
 */
AMBIENTES.CD = {
  somenteDisplay: 'CD',
  tratador: (pC) => {
    const parser = pC.parser;
    const linhas: LinhaDoArranjo[] = [];
    let celulas: No[][] = [];
    let celula: No[] = [];
    let totalDeColunas = 0;
    let ultimaFoiVertical = false;
    const fecharLinha = (): void => {
      // Depois de uma seta vertical a célula corrente é só o separador: não vira coluna.
      if (!(ultimaFoiVertical && celula.length === 0))
        celulas.push(celula);
      celula = [];
      ultimaFoiVertical = false;
      if (!(celulas.length === 1 && celulas[0].length === 0))
        linhas.push({ celulas, linhasAntes: 0, tracejadasAntes: 0 });
      totalDeColunas = Math.max(totalDeColunas, celulas.length);
      celulas = [];
    };
    for (;;) {
      celula.push(...parser.parseExpressao(false, '@'));
      const t = parser.espiar();
      if (t.tipo === 'fim' || t.texto === '\\end') {
        fecharLinha();
        break;
      }
      if (t.texto === '\\\\' || t.texto === '\\cr') {
        parser.proximo();
        fecharLinha();
        continue;
      }
      if (t.texto === '@') {
        parser.proximo();
        const seta = lerSetaDoCD(parser);
        if (seta.vertical) {
          // Seta vertical fica na coluna do objeto; a coluna de seta seguinte fica vazia.
          celula.push(...seta.nos);
          celulas.push(celula, []);
          celula = [];
          ultimaFoiVertical = true;
        } else {
          celulas.push(celula);
          celula = [];
          celulas.push(seta.nos);
          ultimaFoiVertical = false;
        }
        continue;
      }
      fecharLinha();
      break;
    }
    const colunas: ColunaDoArranjo[] = [];
    for (let i = 0; i < totalDeColunas; i++)
      colunas.push(coluna('centro'));
    return { tipo: 'arranjo', ambiente: 'CD', linhas, colunas, linhasDepois: 0, tracejadasDepois: 0, linhasNoFim: 0, tracejadasNoFim: 0 };
  },
};

function lerSetaDoCD(pParser: Parser): { nos: No[]; vertical: boolean } {
  const t = pParser.proximo();
  const tipo = t.texto;
  const vertical = tipo === 'V' || tipo === 'A' || tipo === '|';
  const lerRotuloAte = (pFim: string): No[] => {
    const saida = pParser.parseExpressao(false, pFim);
    if (pParser.espiar().texto === pFim)
      pParser.proximo();
    return saida;
  };
  const nos = ((): No[] => {
    switch (tipo) {
      case '>': {
        const acima = lerRotuloAte('>');
        const abaixo = lerRotuloAte('>');
        const seta: No = { tipo: 'seta', seta: '→', acima };
        if (abaixo.length > 0)
          seta.abaixo = abaixo;
        return [seta];
      }
      case '<': {
        const acima = lerRotuloAte('<');
        const abaixo = lerRotuloAte('<');
        const seta: No = { tipo: 'seta', seta: '←', acima };
        if (abaixo.length > 0)
          seta.abaixo = abaixo;
        return [seta];
      }
      case 'V': {
        const esquerda = lerRotuloAte('V');
        const direita = lerRotuloAte('V');
        return [setaVertical('↓', esquerda, direita)];
      }
      case 'A': {
        const esquerda = lerRotuloAte('A');
        const direita = lerRotuloAte('A');
        return [setaVertical('↑', esquerda, direita)];
      }
      case '=':
        return [{ tipo: 'seta', seta: '=', acima: [] }];
      case '|':
        return [simbolo('rel', '∥')];
      case '.':
        return [];
      default:
        pParser.aviso(`Seta de CD desconhecida: \`@${tipo}\`.`, t.posicao);
        return [grupo([])];
    }
  })();
  return { nos, vertical };
}

function setaVertical(pSeta: string, pEsquerda: No[], pDireita: No[]): No {
  // Seta vertical com rótulos ao lado: rótulo esquerdo em script, seta esticada, rótulo direito.
  const partes: No[] = [];
  if (pEsquerda.length > 0)
    partes.push({ tipo: 'estilo', estilo: 'script', filhos: pEsquerda });
  partes.push({ tipo: 'delimitado', esquerda: '', direita: pSeta, corpo: [{ tipo: 'fantasma', corpo: [simbolo('mathord', '|')], somente: 'vertical' }] });
  if (pDireita.length > 0)
    partes.push({ tipo: 'estilo', estilo: 'script', filhos: pDireita });
  return grupo(partes);
}
