/**
 * PARSER INLINE — o texto de um parágrafo vira a sequência plana de trechos com marcas e átomos.
 *
 * Um scanner só, com recursão para o interior de cada par de formatação. Pares CONSTRAINED (`*x*`) só abrem depois
 * de um caractere que não é de palavra e fecham antes de outro; pares UNCONSTRAINED (`**x**`) valem em qualquer
 * lugar. É a regra da especificação do AsciiDoc; os pares aninham, não se cruzam.
 *
 * O que não é formatação é texto. A quebra de linha interna ao parágrafo fica no texto como `\n` — assim o
 * round-trip devolve as linhas como o autor as quebrou.
 */

import { atomo, normalizarInline, texto } from '../modelo/documento';
import type { Inline, Marca, TipoDeMarca } from '../modelo/tipos';
import { lerAtributos } from './atributos';

const PALAVRA = /[\p{L}\p{N}_]/u;

function ehPalavra(pC: string | undefined): boolean {
  return pC !== undefined && PALAVRA.test(pC);
}

function ehEspaco(pC: string | undefined): boolean {
  return pC === undefined || /\s/.test(pC);
}

const MARCA_DO_DELIMITADOR: Record<string, TipoDeMarca> = {
  '*': 'negrito',
  '_': 'italico',
  '`': 'mono',
  '#': 'realce',
};

const MACROS = /^(image|link|xref|mailto|footnote|kbd|btn|menu|pass|anchor|icon|indexterm|stem|latexmath|asciimath):([^[\s]*)\[/;
const URL = /^(https?|ftp|irc|file):\/\/[^\s[\]<>]+/;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Acha o `]` que fecha o colchete aberto em `pAbre`, respeitando aninhamento. -1 se não fecha. */
function fechamentoDoColchete(pTexto: string, pAbre: number): number {
  let nivel = 0;
  for (let i = pAbre; i < pTexto.length; i++) {
    const c = pTexto[i];
    if (c === '\\') {
      i += 1;
      continue;
    }
    if (c === '[')
      nivel += 1;
    else if (c === ']') {
      nivel -= 1;
      if (nivel === 0)
        return i;
    } else if (c === '\n')
      return -1;
  }
  return -1;
}

function marcaDePapel(pPapel: string): Marca {
  if (pPapel === 'underline')
    return { tipo: 'sublinhado' };
  if (pPapel === 'line-through')
    return { tipo: 'tachado' };
  return { tipo: 'papel', valor: pPapel };
}

function comMarca(pMarcas: Marca[], pMarca: Marca): Marca[] {
  return [...pMarcas.filter((pM) => pM.tipo !== pMarca.tipo), pMarca];
}

interface Resultado {
  partes: Inline[];
  fim: number;
}

class ScannerInline {
  private readonly texto: string;

  constructor(pTexto: string) {
    this.texto = pTexto;
  }

  analisar(pIni: number, pFim: number, pMarcas: Marca[]): Inline[] {
    const s = this.texto;
    const saida: Inline[] = [];
    let buffer = '';
    const despejar = (): void => {
      if (buffer.length > 0) {
        saida.push(texto(buffer, pMarcas));
        buffer = '';
      }
    };
    let i = pIni;
    while (i < pFim) {
      const c = s[i];

      // Escape: o próximo caractere é literal.
      if (c === '\\' && i + 1 < pFim) {
        buffer += s[i + 1];
        i += 2;
        continue;
      }

      // Quebra de linha forçada: ` +` no fim da linha.
      if (c === ' ' && s[i + 1] === '+' && (i + 2 >= pFim || s[i + 2] === '\n')) {
        despejar();
        saida.push(atomo('quebraDeLinha'));
        i += 2;
        if (s[i] === '\n' && i < pFim)
          i += 1;
        continue;
      }

      const especial = this.tentarEspecial(i, pFim, pMarcas);
      if (especial) {
        despejar();
        saida.push(...especial.partes);
        i = especial.fim;
        continue;
      }

      buffer += c;
      i += 1;
    }
    despejar();
    return normalizarInline(saida);
  }

  private tentarEspecial(pI: number, pFim: number, pMarcas: Marca[]): Resultado | null {
    const s = this.texto;
    const c = s[pI];
    const anterior = pI > 0 ? s[pI - 1] : undefined;

    // Macros `nome:alvo[atributos]`.
    if (PALAVRA.test(c) && !ehPalavra(anterior)) {
      const trecho = s.slice(pI, Math.min(pFim, pI + 400));
      const macro = MACROS.exec(trecho);
      if (macro) {
        const abre = pI + macro[0].length - 1;
        const fecha = fechamentoDoColchete(s, abre);
        if (fecha !== -1 && fecha < pFim) {
          const partes = this.macro(macro[1], macro[2], s.slice(abre + 1, fecha), pMarcas);
          if (partes)
            return { partes, fim: fecha + 1 };
        }
      }
      // URL automática, com ou sem `[texto]`.
      const url = URL.exec(trecho);
      if (url) {
        let alvo = url[0];
        // Pontuação final não faz parte do link.
        while (/[.,;:!?)]$/.test(alvo))
          alvo = alvo.slice(0, -1);
        let fim = pI + alvo.length;
        if (s[fim] === '[') {
          const fecha = fechamentoDoColchete(s, fim);
          if (fecha !== -1 && fecha < pFim) {
            const atributos = lerAtributos(s.slice(fim + 1, fecha));
            const rotulo = atributos.posicionais[0] ?? '';
            fim = fecha + 1;
            const marcas = comMarca(pMarcas, { tipo: 'link', valor: alvo });
            const interior = rotulo.length > 0 ? new ScannerInline(rotulo.replace(/\^$/, '')).analisar(0, rotulo.replace(/\^$/, '').length, marcas) : [texto(alvo, marcas)];
            return { partes: interior, fim };
          }
        }
        return { partes: [texto(alvo, comMarca(pMarcas, { tipo: 'link', valor: alvo }))], fim };
      }
      const email = EMAIL.exec(trecho);
      if (email && !ehPalavra(s[pI + email[0].length]))
        return { partes: [texto(email[0], comMarca(pMarcas, { tipo: 'link', valor: `mailto:${email[0]}` }))], fim: pI + email[0].length };
    }

    // `<<alvo,texto>>` referência cruzada.
    if (c === '<' && s[pI + 1] === '<') {
      const fecha = s.indexOf('>>', pI + 2);
      if (fecha !== -1 && fecha < pFim && !s.slice(pI + 2, fecha).includes('\n')) {
        const miolo = s.slice(pI + 2, fecha);
        const virgula = miolo.indexOf(',');
        const dados: Record<string, string> = virgula === -1 ? { alvo: miolo.trim() } : { alvo: miolo.slice(0, virgula).trim(), texto: miolo.slice(virgula + 1).trim() };
        return { partes: [atomo('referencia', dados)], fim: fecha + 2 };
      }
    }

    // `[[id]]` ou `[[id,rótulo]]` âncora.
    if (c === '[' && s[pI + 1] === '[') {
      const fecha = s.indexOf(']]', pI + 2);
      if (fecha !== -1 && fecha < pFim && /^[^\s\]]+(,[^\]]*)?$/.test(s.slice(pI + 2, fecha))) {
        const miolo = s.slice(pI + 2, fecha);
        const virgula = miolo.indexOf(',');
        const dados: Record<string, string> = virgula === -1 ? { id: miolo } : { id: miolo.slice(0, virgula), texto: miolo.slice(virgula + 1) };
        return { partes: [atomo('ancora', dados)], fim: fecha + 2 };
      }
    }

    // `[.papel]#texto#`, `[papel]#texto#`, `[#id]#texto#`.
    if (c === '[' && s[pI + 1] !== '[') {
      const fecha = fechamentoDoColchete(s, pI);
      if (fecha !== -1 && s[fecha + 1] === '#') {
        const atributos = lerAtributos(s.slice(pI + 1, fecha));
        const papeis = [...atributos.papeis, ...atributos.posicionais.filter((pP) => pP !== '')];
        const duplo = s[fecha + 2] === '#';
        const abreTexto = fecha + (duplo ? 3 : 2);
        const fechaTexto = duplo ? s.indexOf('##', abreTexto) : this.fechamentoConstrained(abreTexto, pFim, '#');
        if (fechaTexto !== -1 && fechaTexto < pFim) {
          let marcas = pMarcas;
          for (const papel of papeis)
            marcas = comMarca(marcas, marcaDePapel(papel));
          const partes: Inline[] = [];
          if (atributos.id)
            partes.push(atomo('ancora', { id: atributos.id }));
          partes.push(...this.analisar(abreTexto, fechaTexto, marcas));
          return { partes, fim: fechaTexto + (duplo ? 2 : 1) };
        }
      }
    }

    // `{nome}` referência de atributo.
    if (c === '{') {
      const m = /^\{([A-Za-z0-9_][A-Za-z0-9_-]*)\}/.exec(s.slice(pI, Math.min(pFim, pI + 80)));
      if (m)
        return { partes: [atomo('atributo', { nome: m[1] })], fim: pI + m[0].length };
    }

    // Passagem `+++texto+++` e `++texto++`.
    if (c === '+' && s[pI + 1] === '+') {
      const triplo = s[pI + 2] === '+';
      const marcador = triplo ? '+++' : '++';
      const fecha = s.indexOf(marcador, pI + marcador.length);
      if (fecha !== -1 && fecha < pFim)
        return { partes: [atomo('passagem', { texto: s.slice(pI + marcador.length, fecha), forma: marcador })], fim: fecha + marcador.length };
    }

    // Passagem constrained `+texto+`: literal, sem substituições, com as marcas vigentes.
    if (c === '+' && !ehPalavra(anterior) && !ehEspaco(s[pI + 1]) && s[pI + 1] !== '+') {
      const fecha = this.fechamentoConstrained(pI + 1, pFim, '+');
      if (fecha !== -1)
        return { partes: [texto(s.slice(pI + 1, fecha), pMarcas)], fim: fecha + 1 };
    }

    // Pares unconstrained: `**`, `__`, ``` `` ```, `##`.
    if (c in MARCA_DO_DELIMITADOR && s[pI + 1] === c) {
      const marcador = c + c;
      const fecha = s.indexOf(marcador, pI + 2);
      if (fecha !== -1 && fecha < pFim && fecha > pI + 2) {
        const marcas = comMarca(pMarcas, { tipo: MARCA_DO_DELIMITADOR[c] });
        return { partes: this.analisar(pI + 2, fecha, marcas), fim: fecha + 2 };
      }
    }

    // Pares constrained: `*`, `_`, `` ` ``, `#`.
    if (c in MARCA_DO_DELIMITADOR && !ehPalavra(anterior) && !ehEspaco(s[pI + 1]) && s[pI + 1] !== c) {
      const fecha = this.fechamentoConstrained(pI + 1, pFim, c);
      if (fecha !== -1) {
        const marcas = comMarca(pMarcas, { tipo: MARCA_DO_DELIMITADOR[c] });
        return { partes: this.analisar(pI + 1, fecha, marcas), fim: fecha + 1 };
      }
    }

    // Sobrescrito `^x^` e subscrito `~x~`: sem espaço por dentro.
    if ((c === '^' || c === '~') && !ehEspaco(s[pI + 1]) && s[pI + 1] !== c) {
      const fecha = s.indexOf(c, pI + 1);
      if (fecha !== -1 && fecha < pFim && !/\s/.test(s.slice(pI + 1, fecha))) {
        const marcas = comMarca(pMarcas, { tipo: c === '^' ? 'sobrescrito' : 'subscrito' });
        return { partes: this.analisar(pI + 1, fecha, marcas), fim: fecha + 1 };
      }
    }

    return null;
  }

  /** O índice do delimitador que fecha um par constrained aberto antes de `pDe`, ou -1. */
  private fechamentoConstrained(pDe: number, pFim: number, pDelimitador: string): number {
    const s = this.texto;
    for (let j = pDe; j < pFim; j++) {
      if (s[j] === '\\') {
        j += 1;
        continue;
      }
      if (s[j] !== pDelimitador)
        continue;
      if (j === pDe)
        return -1;
      if (ehEspaco(s[j - 1]))
        continue;
      const depois = j + 1 < pFim ? s[j + 1] : undefined;
      if (depois === pDelimitador)
        continue;
      if (!ehPalavra(depois))
        return j;
    }
    return -1;
  }

  private macro(pNome: string, pAlvo: string, pAtributos: string, pMarcas: Marca[]): Inline[] | null {
    const atributos = lerAtributos(pAtributos);
    const primeiro = atributos.posicionais[0] ?? '';
    switch (pNome) {
      case 'image':
        return [atomo('imagem', { alvo: pAlvo, alt: primeiro, atributos: pAtributos })];
      case 'link': {
        const marcas = comMarca(pMarcas, { tipo: 'link', valor: pAlvo });
        const rotulo = primeiro.length > 0 ? primeiro : pAlvo;
        return new ScannerInline(rotulo).analisar(0, rotulo.length, marcas);
      }
      case 'mailto': {
        const marcas = comMarca(pMarcas, { tipo: 'link', valor: `mailto:${pAlvo}` });
        const rotulo = primeiro.length > 0 ? primeiro : pAlvo;
        return [texto(rotulo, marcas)];
      }
      case 'xref':
        return [atomo('referencia', primeiro.length > 0 ? { alvo: pAlvo, texto: primeiro } : { alvo: pAlvo })];
      case 'footnote':
        return [atomo('notaDeRodape', pAlvo.length > 0 ? { id: pAlvo, texto: pAtributos } : { texto: pAtributos })];
      case 'kbd':
        return [atomo('tecla', { texto: pAtributos })];
      case 'btn':
        return [atomo('botao', { texto: pAtributos })];
      case 'menu':
        return [atomo('menu', { alvo: pAlvo, texto: pAtributos })];
      case 'pass':
        return [atomo('passagem', { texto: pAtributos, forma: 'pass' })];
      case 'stem':
      case 'latexmath':
      case 'asciimath':
        // A fonte da fórmula vai como veio: `pAtributos` não é lista de atributos aqui (2026-10-31).
        return [atomo('formula', { notacao: pNome, texto: pAtributos })];
      case 'anchor':
        return [atomo('ancora', primeiro.length > 0 ? { id: pAlvo, texto: primeiro } : { id: pAlvo })];
      default:
        return [atomo('bruto', { texto: `${pNome}:${pAlvo}[${pAtributos}]` })];
    }
  }
}

/** Analisa o texto inline de um parágrafo (ou célula, item, título). */
export function analisarInline(pTexto: string): Inline[] {
  if (pTexto.length === 0)
    return [];
  return new ScannerInline(pTexto).analisar(0, pTexto.length, []);
}
