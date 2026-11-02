/**
 * EDIÇÃO DE TEXTO AsciiDoc para a barra de ferramentas no modo Código (dono, 2026-10-31: "a barra opera sem emenda
 * no código e no WYSIWYG"). Cada função recebe o texto e a seleção e devolve UMA substituição (`Edicao`) — pura, sem
 * DOM — que o editor de código aplica preservando o desfazer nativo. O que a barra faz no modelo, aqui se faz na
 * sintaxe: envolver com marcas, trocar o marcador de título ou de lista, recuar item, envolver linhas num bloco,
 * inserir um trecho. `estadoDaBarraDoCodigo` lê da seleção o que a barra acende.
 */

import type { EstadoDaBarra } from '../XBarraDoEditor';
import type { TipoDeMarca } from '../modelo/tipos';

export interface Intervalo {
  ini: number;
  fim: number;
}

/** Substitui `texto[ini, fim)` por `texto` e deixa a seleção em `selecao` (coordenadas absolutas, já no texto novo). */
export interface Edicao {
  ini: number;
  fim: number;
  texto: string;
  selecao: Intervalo;
}

const MARCADOR_DE_ITEM = /^(\s*)(\*{1,5}|-|\.{1,5}|\d+\.)(\s+)(\[[ x*]\]\s+)?/;
const TITULO = /^(={1,6}|#{1,6})\s+/;
const CARACTERES_DE_MARCA = /[*_`#^~]/g;
const PALAVRA = /[\p{L}\p{N}_]/u;

export function inicioDaLinha(pTexto: string, pPosicao: number): number {
  const anterior = pTexto.lastIndexOf('\n', pPosicao - 1);
  return anterior === -1 ? 0 : anterior + 1;
}

export function fimDaLinha(pTexto: string, pPosicao: number): number {
  const proximo = pTexto.indexOf('\n', pPosicao);
  return proximo === -1 ? pTexto.length : proximo;
}

/** As linhas inteiras que a seleção toca. */
export function limitesDeLinhas(pTexto: string, pSel: Intervalo): Intervalo {
  return { ini: inicioDaLinha(pTexto, pSel.ini), fim: fimDaLinha(pTexto, Math.max(pSel.ini, pSel.fim - (pSel.fim > pSel.ini && pTexto[pSel.fim - 1] === '\n' ? 1 : 0))) };
}

/** A palavra sob o cursor (seleção vazia), ou a própria seleção. */
export function palavraOuSelecao(pTexto: string, pSel: Intervalo): Intervalo {
  if (pSel.ini !== pSel.fim)
    return pSel;
  let ini = pSel.ini;
  let fim = pSel.ini;
  while (ini > 0 && PALAVRA.test(pTexto[ini - 1]))
    ini--;
  while (fim < pTexto.length && PALAVRA.test(pTexto[fim]))
    fim++;
  return { ini, fim };
}

export function marcaDoTipo(pTipo: TipoDeMarca): { abre: string; fecha: string } | null {
  switch (pTipo) {
    case 'negrito': return { abre: '*', fecha: '*' };
    case 'italico': return { abre: '_', fecha: '_' };
    case 'mono': return { abre: '`', fecha: '`' };
    case 'realce': return { abre: '#', fecha: '#' };
    case 'sobrescrito': return { abre: '^', fecha: '^' };
    case 'subscrito': return { abre: '~', fecha: '~' };
    case 'sublinhado': return { abre: '[.underline]#', fecha: '#' };
    case 'tachado': return { abre: '[.line-through]#', fecha: '#' };
    default: return null;
  }
}

/** Está a seleção (ou a palavra) envolvida pela marca — por dentro ou por fora? */
function envolvida(pTexto: string, pSel: Intervalo, pAbre: string, pFecha: string): 'dentro' | 'fora' | null {
  const trecho = pTexto.slice(pSel.ini, pSel.fim);
  if (trecho.length >= pAbre.length + pFecha.length && trecho.startsWith(pAbre) && trecho.endsWith(pFecha))
    return 'dentro';
  if (pTexto.slice(pSel.ini - pAbre.length, pSel.ini) === pAbre && pTexto.slice(pSel.fim, pSel.fim + pFecha.length) === pFecha)
    return 'fora';
  return null;
}

/** Envolve com a marca; se já envolvida, tira; sem seleção nem palavra, insere o par e põe o cursor no meio. */
export function alternarMarca(pTexto: string, pSel: Intervalo, pAbre: string, pFecha = pAbre): Edicao {
  const alvo = palavraOuSelecao(pTexto, pSel);
  if (alvo.ini === alvo.fim)
    return { ini: alvo.ini, fim: alvo.fim, texto: pAbre + pFecha, selecao: { ini: alvo.ini + pAbre.length, fim: alvo.ini + pAbre.length } };
  const trecho = pTexto.slice(alvo.ini, alvo.fim);
  const estado = envolvida(pTexto, alvo, pAbre, pFecha);
  if (estado === 'dentro') {
    const interno = trecho.slice(pAbre.length, trecho.length - pFecha.length);
    return { ini: alvo.ini, fim: alvo.fim, texto: interno, selecao: { ini: alvo.ini, fim: alvo.ini + interno.length } };
  }
  if (estado === 'fora')
    return { ini: alvo.ini - pAbre.length, fim: alvo.fim + pFecha.length, texto: trecho, selecao: { ini: alvo.ini - pAbre.length, fim: alvo.ini - pAbre.length + trecho.length } };
  return { ini: alvo.ini, fim: alvo.fim, texto: pAbre + trecho + pFecha, selecao: { ini: alvo.ini + pAbre.length, fim: alvo.ini + pAbre.length + trecho.length } };
}

/** Tira as marcas de formatação do trecho (ou da palavra). */
export function limparMarcas(pTexto: string, pSel: Intervalo): Edicao {
  const alvo = palavraOuSelecao(pTexto, pSel);
  const limpo = pTexto.slice(alvo.ini, alvo.fim).replace(/\[\.[a-z-]+\]#/g, '').replace(CARACTERES_DE_MARCA, '');
  return { ini: alvo.ini, fim: alvo.fim, texto: limpo, selecao: { ini: alvo.ini, fim: alvo.ini + limpo.length } };
}

/** Título de nível 1..5 (`==`…`======`) ou parágrafo (0) na linha do cursor. */
export function definirTitulo(pTexto: string, pSel: Intervalo, pNivel: number): Edicao {
  const ini = inicioDaLinha(pTexto, pSel.ini);
  const fim = fimDaLinha(pTexto, pSel.ini);
  const linha = pTexto.slice(ini, fim);
  const semMarcador = linha.replace(TITULO, '');
  const prefixo = pNivel > 0 ? `${'='.repeat(pNivel + 1)} ` : '';
  const nova = prefixo + semMarcador;
  const deslocamento = nova.length - linha.length;
  const cursor = Math.max(ini + prefixo.length, Math.min(fim + deslocamento, pSel.ini + deslocamento));
  return { ini, fim, texto: nova, selecao: { ini: cursor, fim: cursor } };
}

export type EstiloDeListaNoCodigo = 'marcadores' | 'numerada' | 'tarefas' | 'descricao';

function marcadorDoEstilo(pEstilo: EstiloDeListaNoCodigo): string {
  return pEstilo === 'numerada' ? '. ' : pEstilo === 'tarefas' ? '* [ ] ' : '* ';
}

function estiloDaLinha(pLinha: string): EstiloDeListaNoCodigo | null {
  const m = MARCADOR_DE_ITEM.exec(pLinha);
  if (m)
    return m[4] ? 'tarefas' : m[2].startsWith('.') || /\d/.test(m[2]) ? 'numerada' : 'marcadores';
  if (/^\S.*?::(\s|$)/.test(pLinha))
    return 'descricao';
  return null;
}

/** Aplica (ou, se todas as linhas já têm, tira) o estilo de lista nas linhas da seleção. */
export function alternarLista(pTexto: string, pSel: Intervalo, pEstilo: EstiloDeListaNoCodigo): Edicao {
  const { ini, fim } = limitesDeLinhas(pTexto, pSel);
  const linhas = pTexto.slice(ini, fim).split('\n');
  const todasJa = linhas.every((pL) => pL.trim() === '' || estiloDaLinha(pL) === pEstilo);
  const novas = linhas.map((pL) => {
    if (pL.trim() === '')
      return pL;
    if (pEstilo === 'descricao') {
      if (todasJa)
        return pL.replace(/::(\s|$)/, '$1').replace(/\s+$/, '');
      return estiloDaLinha(pL) === 'descricao' ? pL : `${pL.replace(MARCADOR_DE_ITEM, '').replace(/\s+$/, '')}:: `;
    }
    const semMarcador = pL.replace(MARCADOR_DE_ITEM, (_pTudo, pRecuo: string) => pRecuo).replace(/^(\S.*?)::(\s|$)/, '$1$2');
    return todasJa ? semMarcador : semMarcador.replace(/^(\s*)/, `$1${marcadorDoEstilo(pEstilo)}`);
  });
  const texto = novas.join('\n');
  return { ini, fim, texto, selecao: { ini, fim: ini + texto.length } };
}

/** Recua (+1) ou avança (−1) os itens das linhas selecionadas: `*` ↔ `**`, `.` ↔ `..`. */
export function recuarItem(pTexto: string, pSel: Intervalo, pDelta: 1 | -1): Edicao {
  const { ini, fim } = limitesDeLinhas(pTexto, pSel);
  const novas = pTexto.slice(ini, fim).split('\n').map((pL) =>
    pL.replace(MARCADOR_DE_ITEM, (pTudo, pRecuo: string, pMarcador: string, pEspaco: string, pTarefa: string | undefined) => {
      const base = pMarcador === '-' ? '*' : pMarcador[0];
      if (/\d/.test(pMarcador))
        return pTudo;
      const n = Math.max(1, Math.min(5, pMarcador.length + pDelta));
      return `${pRecuo}${base.repeat(n)}${pEspaco}${pTarefa ?? ''}`;
    }),
  );
  const texto = novas.join('\n');
  return { ini, fim, texto, selecao: { ini, fim: ini + texto.length } };
}

/** Envolve as linhas da seleção com as linhas de abertura e fechamento (`[quote]` + `____`…), com linhas vazias em volta. */
export function envolverLinhas(pTexto: string, pSel: Intervalo, pAbre: string[], pFecha: string[]): Edicao {
  const { ini, fim } = limitesDeLinhas(pTexto, pSel);
  const miolo = pTexto.slice(ini, fim);
  const antes = ini > 0 && pTexto[ini - 1] === '\n' && ini >= 2 && pTexto[ini - 2] !== '\n' ? '\n' : '';
  const depois = fim < pTexto.length && pTexto[fim] === '\n' && pTexto[fim + 1] !== undefined && pTexto[fim + 1] !== '\n' ? '\n' : '';
  const texto = `${antes}${pAbre.join('\n')}\n${miolo}\n${pFecha.join('\n')}${depois}`;
  const inicioDoMiolo = ini + antes.length + pAbre.join('\n').length + 1;
  return { ini, fim, texto, selecao: { ini: inicioDoMiolo, fim: inicioDoMiolo + miolo.length } };
}

/** Insere um trecho no lugar da seleção; `pSelecaoRelativa` (relativa ao trecho) diz onde o cursor fica. */
export function inserirInline(pTexto: string, pSel: Intervalo, pTrecho: string, pSelecaoRelativa?: Intervalo): Edicao {
  void pTexto;
  const sel = pSelecaoRelativa ? { ini: pSel.ini + pSelecaoRelativa.ini, fim: pSel.ini + pSelecaoRelativa.fim } : { ini: pSel.ini + pTrecho.length, fim: pSel.ini + pTrecho.length };
  return { ini: pSel.ini, fim: pSel.fim, texto: pTrecho, selecao: sel };
}

/** Insere um bloco (linhas próprias) depois da linha do cursor — ou nela, se estiver vazia —, com linhas vazias em volta. */
export function inserirBloco(pTexto: string, pSel: Intervalo, pTrecho: string, pSelecaoRelativa?: Intervalo): Edicao {
  const ini = inicioDaLinha(pTexto, pSel.ini);
  const fim = fimDaLinha(pTexto, pSel.ini);
  const linhaVazia = pTexto.slice(ini, fim).trim() === '';
  let ponto: number;
  let antes = '';
  let depois = '';
  if (linhaVazia) {
    ponto = ini;
    if (ini >= 2 && pTexto[ini - 2] !== '\n') antes = '';
    depois = fim < pTexto.length && pTexto[fim + 1] !== undefined && pTexto[fim + 1] !== '\n' ? '\n' : '';
  } else {
    ponto = fim;
    antes = '\n\n';
    depois = fim < pTexto.length && pTexto[fim + 1] !== undefined && pTexto[fim + 1] !== '\n' ? '\n' : '';
  }
  const texto = `${antes}${pTrecho}${depois}`;
  const base = ponto + antes.length;
  const sel = pSelecaoRelativa ? { ini: base + pSelecaoRelativa.ini, fim: base + pSelecaoRelativa.fim } : { ini: base + pTrecho.length, fim: base + pTrecho.length };
  return { ini: ponto, fim: linhaVazia ? fim : ponto, texto, selecao: sel };
}

/** O que a barra acende quando o foco está no código: marcas em volta da seleção, título e lista da linha. */
export function estadoDaBarraDoCodigo(pTexto: string, pSel: Intervalo): EstadoDaBarra {
  const marcas = new Set<TipoDeMarca>();
  const alvo = palavraOuSelecao(pTexto, pSel);
  if (alvo.ini !== alvo.fim)
    for (const tipo of ['negrito', 'italico', 'mono', 'realce', 'sobrescrito', 'subscrito', 'sublinhado', 'tachado'] as TipoDeMarca[]) {
      const marca = marcaDoTipo(tipo);
      if (marca && envolvida(pTexto, alvo, marca.abre, marca.fecha))
        marcas.add(tipo);
    }
  const linha = pTexto.slice(inicioDaLinha(pTexto, pSel.ini), fimDaLinha(pTexto, pSel.ini));
  const titulo = TITULO.exec(linha);
  const nivel = titulo ? titulo[1].length - (titulo[1].startsWith('=') ? 1 : 0) : 0;
  const estiloDeLista = estiloDaLinha(linha);
  let tipoDeBloco: EstadoDaBarra['tipoDeBloco'] = 'paragrafo';
  if (nivel >= 1 && nivel <= 5)
    tipoDeBloco = `titulo${nivel}` as EstadoDaBarra['tipoDeBloco'];
  else if (/^ +\S/.test(linha) && !estiloDeLista)
    tipoDeBloco = 'literal';
  return { marcas, tipoDeBloco, lista: estiloDeLista, emTabela: false, cabecalhoDaTabela: false, alinhamentoDaCelula: 'esquerda' };
}
