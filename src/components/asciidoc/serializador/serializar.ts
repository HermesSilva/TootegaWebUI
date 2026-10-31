/**
 * SERIALIZADOR — modelo → AsciiDoc. O inverso do parser; o par é cobrado por teste de round-trip.
 *
 * Inline: as marcas abrem e fecham em ORDEM CANÔNICA (link, papel, sublinhado, tachado, negrito, itálico, mono,
 * realce, sobrescrito, subscrito); o delimitador é constrained (`*x*`) quando as bordas permitem e unconstrained
 * (`**x**`) quando não — a mesma regra que o parser aplica ao ler. É a técnica dos serializadores de Markdown.
 */

import type { Atomo, Bloco, Documento, Inline, Marca, TipoDeMarca, TrechoDeTexto } from '../modelo/tipos';

// ============================================================================
// Inline
// ============================================================================

const ORDEM: readonly TipoDeMarca[] = ['link', 'papel', 'sublinhado', 'tachado', 'negrito', 'italico', 'mono', 'realce', 'sobrescrito', 'subscrito'];

const DELIMITADOR: Partial<Record<TipoDeMarca, string>> = {
  negrito: '*',
  italico: '_',
  mono: '`',
  realce: '#',
  sobrescrito: '^',
  subscrito: '~',
};

const PALAVRA = /[\p{L}\p{N}_]/u;

function ehPalavra(pC: string | undefined): boolean {
  return pC !== undefined && PALAVRA.test(pC);
}

function ehEspaco(pC: string | undefined): boolean {
  return pC === undefined || /\s/.test(pC);
}

function ordenar(pMarcas: Marca[]): Marca[] {
  return [...pMarcas].sort((pA, pB) => ORDEM.indexOf(pA.tipo) - ORDEM.indexOf(pB.tipo));
}

function mesmaMarca(pA: Marca, pB: Marca): boolean {
  return pA.tipo === pB.tipo && pA.valor === pB.valor;
}

/** Escapa o que o parser leria como formatação. Conservador: só os casos que de fato abririam algo. */
export function escaparTexto(pTexto: string, pAnterior: string | undefined): string {
  let saida = '';
  for (let i = 0; i < pTexto.length; i++) {
    const c = pTexto[i];
    const antes = i > 0 ? pTexto[i - 1] : pAnterior;
    const depois = pTexto[i + 1];
    if (c === '\\') {
      saida += '\\\\';
      continue;
    }
    if ((c === '*' || c === '_' || c === '`' || c === '#' || c === '+') && (depois === c || (!ehPalavra(antes) && !ehEspaco(depois)))) {
      saida += `\\${c}`;
      continue;
    }
    if ((c === '^' || c === '~') && !ehEspaco(depois) && pTexto.indexOf(c, i + 1) !== -1) {
      saida += `\\${c}`;
      continue;
    }
    if (c === '{' && /^\{[A-Za-z0-9_][A-Za-z0-9_-]*\}/.test(pTexto.slice(i))) {
      saida += '\\{';
      continue;
    }
    if (c === '<' && depois === '<') {
      saida += '\\<';
      continue;
    }
    if (c === '[' && depois === '[') {
      saida += '\\[';
      continue;
    }
    if (c === '[' && /^\[[^\]]+\]#/.test(pTexto.slice(i))) {
      saida += '\\[';
      continue;
    }
    if (!ehPalavra(antes) && /^(image|link|xref|mailto|footnote|kbd|btn|menu|pass|anchor|icon|indexterm):[^\s[]*\[/.test(pTexto.slice(i))) {
      saida += `\\${c}`;
      continue;
    }
    if (!ehPalavra(antes) && /^(https?|ftp|irc|file):\/\//.test(pTexto.slice(i))) {
      saida += `\\${c}`;
      continue;
    }
    if (c === ' ' && depois === '+' && (pTexto[i + 2] === undefined || pTexto[i + 2] === '\n')) {
      saida += ' \\+';
      i += 1;
      continue;
    }
    saida += c;
  }
  return saida;
}

function serializarAtomo(pAtomo: Atomo): string {
  const d = pAtomo.dados;
  switch (pAtomo.especie) {
    case 'imagem':
      return `image:${d.alvo}[${d.atributos ?? d.alt ?? ''}]`;
    case 'referencia':
      return d.texto ? `<<${d.alvo},${d.texto}>>` : `<<${d.alvo}>>`;
    case 'ancora':
      return d.texto ? `[[${d.id},${d.texto}]]` : `[[${d.id}]]`;
    case 'notaDeRodape':
      return `footnote:${d.id ?? ''}[${d.texto ?? ''}]`;
    case 'tecla':
      return `kbd:[${d.texto}]`;
    case 'botao':
      return `btn:[${d.texto}]`;
    case 'menu':
      return `menu:${d.alvo ?? ''}[${d.texto ?? ''}]`;
    case 'atributo':
      return `{${d.nome}}`;
    case 'quebraDeLinha':
      return ' +\n';
    case 'passagem':
      return d.forma === 'pass' ? `pass:[${d.texto}]` : `${d.forma ?? '+++'}${d.texto}${d.forma ?? '+++'}`;
    case 'bruto':
      return d.texto ?? '';
    default:
      return '';
  }
}

/** Até onde (índice do último trecho, inclusive) a marca segue aberta a partir de `pDe`, respeitando o que está abaixo dela. */
function fimDaMarca(pPartes: Inline[], pDe: number, pMarca: Marca, pAbaixo: Marca[]): number {
  let fim = pDe;
  for (let i = pDe + 1; i < pPartes.length; i++) {
    const parte = pPartes[i];
    if (parte.tipo !== 'texto')
      break;
    if (!parte.marcas.some((pM) => mesmaMarca(pM, pMarca)))
      break;
    if (!pAbaixo.every((pB) => parte.marcas.some((pM) => mesmaMarca(pM, pB))))
      break;
    fim = i;
  }
  return fim;
}

function abertura(pMarca: Marca, pConstrained: boolean): string {
  switch (pMarca.tipo) {
    case 'link':
      return /^((https?|ftp|irc|file):\/\/|mailto:)/.test(pMarca.valor ?? '') ? `${pMarca.valor}[` : `link:${pMarca.valor}[`;
    case 'papel':
      return `[.${pMarca.valor}]${pConstrained ? '#' : '##'}`;
    case 'sublinhado':
      return `[.underline]${pConstrained ? '#' : '##'}`;
    case 'tachado':
      return `[.line-through]${pConstrained ? '#' : '##'}`;
    case 'sobrescrito':
    case 'subscrito':
      return DELIMITADOR[pMarca.tipo] as string;
    default: {
      const d = DELIMITADOR[pMarca.tipo] as string;
      return pConstrained ? d : d + d;
    }
  }
}

function fechamento(pMarca: Marca, pConstrained: boolean): string {
  switch (pMarca.tipo) {
    case 'link':
      return ']';
    case 'papel':
    case 'sublinhado':
    case 'tachado':
      return pConstrained ? '#' : '##';
    case 'sobrescrito':
    case 'subscrito':
      return DELIMITADOR[pMarca.tipo] as string;
    default: {
      const d = DELIMITADOR[pMarca.tipo] as string;
      return pConstrained ? d : d + d;
    }
  }
}

export function serializarInline(pConteudo: Inline[]): string {
  let saida = '';
  const pilha: { marca: Marca; constrained: boolean; fim: number }[] = [];

  const fecharAte = (pNivel: number): void => {
    while (pilha.length > pNivel) {
      const topo = pilha.pop() as { marca: Marca; constrained: boolean };
      saida += fechamento(topo.marca, topo.constrained);
    }
  };

  for (let i = 0; i < pConteudo.length; i++) {
    const parte = pConteudo[i];
    if (parte.tipo === 'atomo') {
      fecharAte(0);
      saida += serializarAtomo(parte);
      continue;
    }
    const marcas = ordenar(parte.marcas);
    // URL cujo rótulo é a própria URL: sai nua, como o autor a escreveu.
    if (marcas.length === 1 && marcas[0].tipo === 'link' && marcas[0].valor === parte.texto && /^(https?|ftp|irc|file):\/\//.test(parte.texto)) {
      fecharAte(0);
      saida += parte.texto;
      continue;
    }
    if (marcas.length === 1 && marcas[0].tipo === 'link' && marcas[0].valor === `mailto:${parte.texto}`) {
      fecharAte(0);
      saida += parte.texto;
      continue;
    }
    // Mantém o prefixo comum da pilha; fecha o resto; abre o que falta.
    let comum = 0;
    while (comum < pilha.length && comum < marcas.length && mesmaMarca(pilha[comum].marca, marcas[comum]))
      comum += 1;
    fecharAte(comum);
    for (let k = comum; k < marcas.length; k++) {
      const marca = marcas[k];
      const abaixo = marcas.slice(0, k);
      const fim = fimDaMarca(pConteudo, i, marca, abaixo);
      const anterior = saida[saida.length - 1];
      const primeiro = parte.texto[0];
      const ultimoTrecho = pConteudo[fim] as TrechoDeTexto;
      const ultimo = ultimoTrecho.texto[ultimoTrecho.texto.length - 1];
      const seguinte = pConteudo[fim + 1];
      const proximo = seguinte === undefined ? undefined : seguinte.tipo === 'texto' ? seguinte.texto[0] : '￼';
      const constrained = !ehPalavra(anterior) && !ehEspaco(primeiro) && !ehEspaco(ultimo) && !ehPalavra(proximo) && primeiro !== DELIMITADOR[marca.tipo];
      saida += abertura(marca, constrained);
      pilha.push({ marca, constrained, fim });
    }
    const dentroDeLink = marcas.some((pM) => pM.tipo === 'link');
    saida += dentroDeLink ? parte.texto.replace(/\]/g, '\\]') : escaparTexto(parte.texto, saida[saida.length - 1]);
  }
  fecharAte(0);
  return saida;
}

// ============================================================================
// Blocos
// ============================================================================

function prefixoDoBloco(pBloco: Bloco, pLinhaDeEstilo?: string): string[] {
  const linhas: string[] = [];
  if (pBloco.ancora !== undefined)
    linhas.push(`[[${pBloco.ancora}]]`);
  if (pBloco.atributosBrutos)
    linhas.push(...pBloco.atributosBrutos);
  const papeis = pBloco.papeis && pBloco.papeis.length > 0 ? pBloco.papeis.map((pP) => `.${pP}`).join('') : '';
  if (pLinhaDeEstilo !== undefined) {
    const primeiro = pLinhaDeEstilo + papeis;
    linhas.push(`[${primeiro}]`);
  } else if (papeis !== '')
    linhas.push(`[${papeis}]`);
  if (pBloco.titulo !== undefined)
    linhas.push(`.${pBloco.titulo}`);
  return linhas;
}

/** O delimitador que não colide com o conteúdo (uma linha de código igual a `----` pede `-----`). */
function delimitadorSeguro(pBase: string, pConteudo: string): string {
  let delimitador = pBase;
  const linhas = pConteudo.split('\n');
  while (linhas.includes(delimitador))
    delimitador += pBase[0];
  return delimitador;
}

function marcadorDaLista(pEstilo: 'marcadores' | 'numerada' | 'tarefas', pProfundidade: number): string {
  return (pEstilo === 'numerada' ? '.' : '*').repeat(pProfundidade);
}

class Escritor {
  readonly linhas: string[] = [];

  blocos(pBlocos: Bloco[], pProfundidadeDeLista: number): void {
    pBlocos.forEach((pBloco, pIndice) => {
      if (pIndice > 0)
        this.linhas.push('');
      this.bloco(pBloco, pProfundidadeDeLista);
    });
  }

  bloco(pBloco: Bloco, pProfundidadeDeLista: number): void {
    switch (pBloco.tipo) {
      case 'paragrafo': {
        const estilo = pBloco.estilo === 'literal' ? 'literal' : undefined;
        const prefixo = prefixoDoBloco(pBloco, estilo);
        if (pBloco.estilo === 'lead')
          prefixo.push('[.lead]');
        this.linhas.push(...prefixo, serializarInline(pBloco.conteudo));
        break;
      }
      case 'titulo':
        this.linhas.push(...prefixoDoBloco(pBloco, pBloco.discreto ? 'discrete' : undefined), `${'='.repeat(pBloco.nivel + 1)} ${serializarInline(pBloco.conteudo)}`);
        break;
      case 'lista':
        this.lista(pBloco, pProfundidadeDeLista);
        break;
      case 'descricao':
        this.linhas.push(...prefixoDoBloco(pBloco));
        pBloco.itens.forEach((pItem) => {
          const termo = `${serializarInline(pItem.conteudo)}${'::'.repeat(1)}${':'.repeat(pProfundidadeDeLista)}`;
          const [primeiro, ...resto] = pItem.filhos;
          if (primeiro && primeiro.tipo === 'paragrafo' && !primeiro.titulo && !primeiro.ancora && !primeiro.atributosBrutos) {
            this.linhas.push(`${termo} ${serializarInline(primeiro.conteudo)}`);
          } else {
            this.linhas.push(termo);
            if (primeiro)
              this.anexo(primeiro, pProfundidadeDeLista + 1, true);
          }
          for (const filho of resto)
            this.anexo(filho, pProfundidadeDeLista + 1, false);
        });
        break;
      case 'chamadas':
        this.linhas.push(...prefixoDoBloco(pBloco));
        for (const item of pBloco.itens)
          this.linhas.push(`<${item.numero}> ${serializarInline(item.conteudo)}`);
        break;
      case 'codigo': {
        if (pBloco.estilo === 'literal') {
          const delimitador = delimitadorSeguro('....', pBloco.codigo);
          this.linhas.push(...prefixoDoBloco(pBloco), delimitador, ...pBloco.codigo.split('\n'), delimitador);
          break;
        }
        const estilo = pBloco.estilo === 'fonte' ? (pBloco.linguagem ? `source,${pBloco.linguagem}` : 'source') : undefined;
        const delimitador = delimitadorSeguro('----', pBloco.codigo);
        this.linhas.push(...prefixoDoBloco(pBloco, estilo), delimitador, ...pBloco.codigo.split('\n'), delimitador);
        break;
      }
      case 'admonicao': {
        const [unico] = pBloco.filhos;
        if (pBloco.filhos.length === 1 && unico.tipo === 'paragrafo' && !unico.titulo && !unico.ancora && !unico.atributosBrutos && !unico.estilo) {
          this.linhas.push(...prefixoDoBloco(pBloco), `${pBloco.especie}: ${serializarInline(unico.conteudo)}`);
          break;
        }
        this.container(pBloco, pBloco.especie, '====', pProfundidadeDeLista);
        break;
      }
      case 'container': {
        const estilo = pBloco.especie === 'citacao' ? 'quote' : pBloco.especie === 'verso' ? 'verse' : undefined;
        const atribuicao = estilo ? [estilo, pBloco.autor ?? '', pBloco.fonte ?? ''].filter((pP, pI, pA) => pP !== '' || pA.slice(pI + 1).some((pR) => pR !== '')).join(',') : undefined;
        const delimitador = pBloco.especie === 'exemplo' ? '====' : pBloco.especie === 'barraLateral' ? '****' : pBloco.especie === 'aberto' ? '--' : '____';
        this.container(pBloco, atribuicao, delimitador, pProfundidadeDeLista);
        break;
      }
      case 'tabela': {
        const posicionais: string[] = [];
        const nomeados: string[] = [];
        if (pBloco.colunas)
          nomeados.push(`cols="${pBloco.colunas}"`);
        const opcoes: string[] = [];
        if (pBloco.cabecalho)
          opcoes.push('header');
        if (pBloco.rodape)
          opcoes.push('footer');
        if (opcoes.length > 0)
          posicionais.push(opcoes.map((pO) => `%${pO}`).join(''));
        if (pBloco.outrosAtributos)
          nomeados.push(pBloco.outrosAtributos.replace(/^\[|\]$/g, ''));
        const atributos = [...posicionais, ...nomeados].join(',');
        const prefixo = prefixoDoBloco(pBloco);
        if (atributos !== '')
          prefixo.push(`[${atributos}]`);
        this.linhas.push(...prefixo, '|===');
        pBloco.linhas.forEach((pLinha, pIndice) => {
          this.linhas.push(pLinha.celulas.map((pCelula) => `${especificacaoDaCelula(pCelula)}|${serializarInline(pCelula.conteudo).replace(/\|/g, '\\|')}`).join(' '));
          if (pIndice === 0 && pBloco.cabecalho)
            this.linhas.push('');
        });
        this.linhas.push('|===');
        break;
      }
      case 'imagem': {
        const partes = [pBloco.alt ?? ''];
        if (pBloco.largura || pBloco.altura)
          partes.push(pBloco.largura ?? '');
        if (pBloco.altura)
          partes.push(pBloco.altura);
        while (partes.length > 1 && partes[partes.length - 1] === '')
          partes.pop();
        if (pBloco.outrosAtributos)
          partes.push(pBloco.outrosAtributos);
        const atributos = partes.join(',');
        this.linhas.push(...prefixoDoBloco(pBloco), `image::${pBloco.alvo}[${atributos === ',' ? '' : atributos}]`);
        break;
      }
      case 'midia':
        this.linhas.push(...prefixoDoBloco(pBloco), `${pBloco.especie}::${pBloco.alvo}[${pBloco.atributos ?? ''}]`);
        break;
      case 'quebraTematica':
        this.linhas.push(...prefixoDoBloco(pBloco), "'''");
        break;
      case 'quebraDePagina':
        this.linhas.push(...prefixoDoBloco(pBloco), '<<<');
        break;
      case 'sumario':
        this.linhas.push(...prefixoDoBloco(pBloco), 'toc::[]');
        break;
      case 'comentario':
        if (pBloco.emBloco) {
          const delimitador = delimitadorSeguro('////', pBloco.texto);
          this.linhas.push(...prefixoDoBloco(pBloco), delimitador, ...pBloco.texto.split('\n'), delimitador);
        } else
          this.linhas.push(...prefixoDoBloco(pBloco), ...pBloco.texto.split('\n').map((pL) => `//${pL}`));
        break;
      case 'passagem': {
        const delimitador = delimitadorSeguro('++++', pBloco.texto);
        this.linhas.push(...prefixoDoBloco(pBloco), delimitador, ...pBloco.texto.split('\n'), delimitador);
        break;
      }
      case 'atributo':
        this.linhas.push(...prefixoDoBloco(pBloco), `:${pBloco.nome}:${pBloco.valor === '' ? '' : ` ${pBloco.valor.replace(/\n/g, ' \\\n')}`}`);
        break;
      case 'bruto':
        this.linhas.push(...prefixoDoBloco(pBloco), ...pBloco.texto.split('\n'));
        break;
      default:
        break;
    }
  }

  private container(pBloco: Bloco & { filhos: Bloco[] }, pEstilo: string | undefined, pDelimitador: string, pProfundidadeDeLista: number): void {
    const interno = new Escritor();
    interno.blocos(pBloco.filhos, pProfundidadeDeLista);
    const delimitador = delimitadorSeguro(pDelimitador, interno.linhas.join('\n'));
    this.linhas.push(...prefixoDoBloco(pBloco, pEstilo), delimitador, ...interno.linhas, delimitador);
  }

  private lista(pLista: Bloco & { tipo: 'lista' }, pProfundidadeDeLista: number): void {
    const profundidade = pProfundidadeDeLista + 1;
    const marcador = marcadorDaLista(pLista.estilo, profundidade);
    this.linhas.push(...prefixoDoBloco(pLista));
    for (const item of pLista.itens) {
      const tarefa = pLista.estilo === 'tarefas' ? `[${item.marcado ? 'x' : ' '}] ` : '';
      this.linhas.push(`${marcador} ${tarefa}${serializarInline(item.conteudo)}`);
      item.filhos.forEach((pFilho) => this.anexo(pFilho, profundidade, false));
    }
  }

  /** Bloco anexado a um item: sublista vai direto; o resto vai por `+`. */
  private anexo(pFilho: Bloco, pProfundidade: number, pPrimeiroDaDescricao: boolean): void {
    if (pFilho.tipo === 'lista' || pFilho.tipo === 'descricao') {
      this.bloco(pFilho, pProfundidade);
      return;
    }
    if (pPrimeiroDaDescricao && pFilho.tipo === 'paragrafo') {
      this.bloco(pFilho, pProfundidade);
      return;
    }
    this.linhas.push('+');
    this.bloco(pFilho, pProfundidade);
  }
}

function especificacaoDaCelula(pCelula: { colunas?: number; linhas?: number; alinhamento?: 'esquerda' | 'centro' | 'direita'; estilo?: string }): string {
  let saida = '';
  if (pCelula.colunas || pCelula.linhas)
    saida += `${pCelula.colunas ?? ''}${pCelula.linhas ? `.${pCelula.linhas}` : ''}+`;
  if (pCelula.alinhamento)
    saida += pCelula.alinhamento === 'esquerda' ? '<' : pCelula.alinhamento === 'centro' ? '^' : '>';
  if (pCelula.estilo)
    saida += pCelula.estilo;
  return saida;
}

// ============================================================================
// Documento
// ============================================================================

export function serializarDocumento(pDocumento: Documento): string {
  const escritor = new Escritor();
  const cabecalho = pDocumento.cabecalho;
  if (cabecalho) {
    if (cabecalho.titulo)
      escritor.linhas.push(`= ${serializarInline(cabecalho.titulo)}`);
    if (cabecalho.autores)
      escritor.linhas.push(cabecalho.autores);
    if (cabecalho.revisao)
      escritor.linhas.push(cabecalho.revisao);
    for (const atributo of cabecalho.atributos)
      escritor.linhas.push(`:${atributo.nome}:${atributo.valor === '' ? '' : ` ${atributo.valor.replace(/\n/g, ' \\\n')}`}`);
    if (pDocumento.blocos.length > 0)
      escritor.linhas.push('');
  }
  escritor.blocos(pDocumento.blocos, 0);
  return escritor.linhas.join('\n');
}
