/**
 * PARSER DE BLOCOS — AsciiDoc → modelo. Linha a linha, recursivo: o conteúdo de um container (exemplo, admonição,
 * item de lista, citação) passa por um parser filho sobre as linhas dele.
 *
 * LENIENTE DE PROPÓSITO: num editor, a linha `* item` logo abaixo de um parágrafo é uma lista que o autor começou a
 * digitar, não a continuação do parágrafo (o Asciidoctor só quebra parágrafo em linha vazia). O que o parser não
 * reconhece vira bloco BRUTO, com o texto intacto — nada se perde no round-trip.
 */

import { novoID } from '../modelo/documento';
import type {
  Admonicao,
  AtributoDoDocumento,
  AvisoDoParser,
  Bloco,
  CabecalhoDoDocumento,
  Celula,
  Codigo,
  Container,
  Documento,
  EspecieDeAdmonicao,
  EspecieDeContainer,
  EstiloDeLista,
  ItemDeChamada,
  ItemDeDescricao,
  ItemDeLista,
  LinhaDaTabela,
  Tabela,
  Titulo,
} from '../modelo/tipos';
import { lerAtributos, type AtributosLidos } from './atributos';
import { analisarInline } from './inline';

// ============================================================================
// Reconhecimento de linhas
// ============================================================================

const DELIMITADOR = /^(-{4,}|={4,}|\*{4,}|_{4,}|\.{4,}|\+{4,}|\/{4,}|--)$/;
const CERCADO = /^```([\w+#-]*)\s*$/;
const SECAO = /^(={1,6})\s+(\S.*?)(?:\s+=+)?\s*$/;
const SECAO_MD = /^(#{1,6})\s+(\S.*?)(?:\s+#+)?\s*$/;
const LINHA_DE_ATRIBUTOS = /^\[([^\]]*)\]\s*$/;
const ANCORA = /^\[\[([^\]\s,]+)(?:,([^\]]*))?\]\]\s*$/;
const TITULO_DE_BLOCO = /^\.([^\s.].*)$/;
const ENTRADA_DE_ATRIBUTO = /^:([A-Za-z0-9_][A-Za-z0-9_-]*!?):(?:\s+(.*))?$/;
const COMENTARIO = /^\/\/(?!\/)(.*)$/;
const ADMONICAO = /^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\s+(.*)$/;
const MARCADOR = /^(\s*)(\*{1,5}|-|\.{1,5}|\d+\.)\s+(.*)$/;
const TAREFA = /^\[([ x*])\]\s+(.*)$/;
const DESCRICAO = /^(\s*)(\S.*?)(::{1,4})(?:\s+(.*)|\s*)$/;
const CHAMADA = /^<(\d+|\.)>\s+(.*)$/;
const TABELA = /^([|,:])===\s*$/;
const IMAGEM = /^image::([^[\s]+)\[(.*)\]\s*$/;
const MIDIA = /^(video|audio)::([^[\s]+)\[(.*)\]\s*$/;
const SUMARIO = /^toc::\[.*\]\s*$/;
const MACRO_DE_BLOCO = /^[a-z]+::[^[]*\[.*\]\s*$/;
const QUEBRA_DE_PAGINA = /^<<<\s*$/;
const QUEBRA_TEMATICA = /^('''|---|\*\*\*|- - -|\* \* \*)\s*$/;
const CITACAO_MD = /^>\s?(.*)$/;
const REVISAO = /^(v\d[^,:]*|\d{4}-\d{2}-\d{2})(?:,\s*([^:]*))?(?::\s*(.*))?$/;

const ADMONICOES: readonly EspecieDeAdmonicao[] = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];

function ehBranca(pLinha: string | undefined): boolean {
  return pLinha === undefined || pLinha.trim() === '';
}

interface Marcador {
  estilo: EstiloDeLista | 'descricao';
  profundidade: number;
}

function lerMarcador(pLinha: string): { marcador: Marcador; texto: string } | null {
  const m = MARCADOR.exec(pLinha);
  if (m) {
    const simbolo = m[2];
    const estilo: EstiloDeLista = simbolo.startsWith('*') || simbolo === '-' ? 'marcadores' : 'numerada';
    const profundidade = simbolo === '-' || /\d/.test(simbolo) ? 1 : simbolo.length;
    return { marcador: { estilo, profundidade }, texto: m[3] };
  }
  return null;
}

function lerDescricao(pLinha: string): { profundidade: number; termo: string; texto: string } | null {
  if (/^\s*(\*|-|\.)+\s/.test(pLinha) || /^\s*https?:/.test(pLinha))
    return null;
  const m = DESCRICAO.exec(pLinha);
  if (!m || m[2].includes('::'))
    return null;
  return { profundidade: m[3].length - 1, termo: m[2], texto: m[4] ?? '' };
}

/** Linha que interrompe um parágrafo (parser leniente — ver o cabeçalho do arquivo). */
function iniciaBloco(pLinha: string): boolean {
  return (
    DELIMITADOR.test(pLinha) ||
    CERCADO.test(pLinha) ||
    SECAO.test(pLinha) ||
    SECAO_MD.test(pLinha) ||
    LINHA_DE_ATRIBUTOS.test(pLinha) ||
    ANCORA.test(pLinha) ||
    COMENTARIO.test(pLinha) ||
    ADMONICAO.test(pLinha) ||
    lerMarcador(pLinha) !== null ||
    TABELA.test(pLinha) ||
    IMAGEM.test(pLinha) ||
    MIDIA.test(pLinha) ||
    QUEBRA_DE_PAGINA.test(pLinha) ||
    QUEBRA_TEMATICA.test(pLinha)
  );
}

// ============================================================================
// Pendências (título, âncora e atributos que precedem um bloco)
// ============================================================================

interface Pendentes {
  titulo?: string;
  ancora?: string;
  atributos?: AtributosLidos;
  linhasDeAtributos: string[];
}

function semPendentes(): Pendentes {
  return { linhasDeAtributos: [] };
}

// ============================================================================
// O parser
// ============================================================================

export interface ResultadoDaAnalise {
  documento: Documento;
  avisos: AvisoDoParser[];
}

class ParserDeBlocos {
  private readonly linhas: string[];
  private pos = 0;
  /** Deslocamento das linhas deste parser no documento (para os avisos apontarem a linha certa). */
  private readonly base: number;
  readonly avisos: AvisoDoParser[];

  constructor(pLinhas: string[], pBase: number, pAvisos: AvisoDoParser[]) {
    this.linhas = pLinhas;
    this.base = pBase;
    this.avisos = pAvisos;
  }

  private get linha(): string | undefined {
    return this.linhas[this.pos];
  }

  private avisar(pTexto: string, pLinha = this.pos): void {
    this.avisos.push({ linha: this.base + pLinha + 1, texto: pTexto });
  }

  // ---------------------------------------------------------------- documento

  documento(): Documento {
    const cabecalho = this.cabecalho();
    const blocos = this.blocos(() => false);
    return cabecalho ? { cabecalho, blocos } : { blocos };
  }

  private cabecalho(): CabecalhoDoDocumento | undefined {
    // Pula comentários e linhas vazias antes do título.
    let p = this.pos;
    const atributosAntes: { nome: string; valor: string }[] = [];
    while (p < this.linhas.length && (ehBranca(this.linhas[p]) || COMENTARIO.test(this.linhas[p]) || ENTRADA_DE_ATRIBUTO.test(this.linhas[p]))) {
      const entrada = ENTRADA_DE_ATRIBUTO.exec(this.linhas[p]);
      if (entrada)
        atributosAntes.push({ nome: entrada[1], valor: entrada[2] ?? '' });
      p += 1;
    }
    const m = /^=\s+(\S.*?)(?:\s+=)?\s*$/.exec(this.linhas[p] ?? '');
    if (!m) {
      if (atributosAntes.length === 0)
        return undefined;
      // Atributos sem título: ainda são cabeçalho (`:toc:` no topo é o caso típico).
      this.pos = p;
      return { atributos: atributosAntes };
    }
    const cabecalho: CabecalhoDoDocumento = { titulo: analisarInline(m[1]), atributos: atributosAntes };
    p += 1;
    if (!ehBranca(this.linhas[p]) && !ENTRADA_DE_ATRIBUTO.test(this.linhas[p]) && !COMENTARIO.test(this.linhas[p])) {
      cabecalho.autores = this.linhas[p].trim();
      p += 1;
      if (!ehBranca(this.linhas[p]) && REVISAO.test(this.linhas[p].trim())) {
        cabecalho.revisao = this.linhas[p].trim();
        p += 1;
      }
    }
    while (p < this.linhas.length && !ehBranca(this.linhas[p])) {
      const entrada = ENTRADA_DE_ATRIBUTO.exec(this.linhas[p]);
      if (entrada) {
        let valor = entrada[2] ?? '';
        while (valor.endsWith('\\') && p + 1 < this.linhas.length) {
          p += 1;
          valor = `${valor.slice(0, -1)}\n${this.linhas[p]}`;
        }
        cabecalho.atributos.push({ nome: entrada[1], valor });
        p += 1;
        continue;
      }
      if (COMENTARIO.test(this.linhas[p])) {
        p += 1;
        continue;
      }
      break;
    }
    this.pos = p;
    return cabecalho;
  }

  // ------------------------------------------------------------------- blocos

  /** Lê blocos até o fim ou até uma linha que `pPara` aceite (a linha não é consumida). */
  blocos(pPara: (pLinha: string) => boolean): Bloco[] {
    const saida: Bloco[] = [];
    let pendentes = semPendentes();
    while (this.pos < this.linhas.length) {
      const linha = this.linha as string;
      if (pPara(linha))
        break;
      if (ehBranca(linha)) {
        this.pos += 1;
        // Pendências órfãs (título/atributos seguidos de linha vazia) viram bloco bruto, para não sumir.
        if (pendentes.titulo !== undefined || pendentes.ancora !== undefined || pendentes.linhasDeAtributos.length > 0) {
          saida.push(this.brutoDasPendencias(pendentes));
          pendentes = semPendentes();
        }
        continue;
      }
      const pendente = this.lerPendente(linha, pendentes);
      if (pendente) {
        this.pos += 1;
        continue;
      }
      const bloco = this.umBloco(pendentes);
      if (bloco) {
        saida.push(bloco);
        pendentes = semPendentes();
      }
    }
    if (pendentes.titulo !== undefined || pendentes.ancora !== undefined || pendentes.linhasDeAtributos.length > 0)
      saida.push(this.brutoDasPendencias(pendentes));
    return saida;
  }

  private brutoDasPendencias(pPendentes: Pendentes): Bloco {
    const linhas: string[] = [];
    if (pPendentes.ancora !== undefined)
      linhas.push(`[[${pPendentes.ancora}]]`);
    linhas.push(...pPendentes.linhasDeAtributos);
    if (pPendentes.titulo !== undefined)
      linhas.push(`.${pPendentes.titulo}`);
    return { id: novoID(), tipo: 'bruto', texto: linhas.join('\n') };
  }

  private lerPendente(pLinha: string, pPendentes: Pendentes): boolean {
    const ancora = ANCORA.exec(pLinha);
    if (ancora) {
      pPendentes.ancora = ancora[1];
      return true;
    }
    const atributos = LINHA_DE_ATRIBUTOS.exec(pLinha);
    if (atributos) {
      const lidos = lerAtributos(atributos[1]);
      pPendentes.atributos = pPendentes.atributos ? fundirAtributos(pPendentes.atributos, lidos) : lidos;
      pPendentes.linhasDeAtributos.push(pLinha);
      return true;
    }
    const titulo = TITULO_DE_BLOCO.exec(pLinha);
    if (titulo && !lerMarcador(pLinha)) {
      pPendentes.titulo = titulo[1];
      return true;
    }
    return false;
  }

  /** Aplica título, âncora, papéis e a linha de atributos (quando não foi consumida) ao bloco. */
  private decorar<T extends Bloco>(pBloco: T, pPendentes: Pendentes, pAtributosConsumidos = false): T {
    const saida = pBloco;
    if (pPendentes.titulo !== undefined)
      saida.titulo = pPendentes.titulo;
    const id = pPendentes.ancora ?? pPendentes.atributos?.id;
    if (id !== undefined)
      saida.ancora = id;
    const papeis = pPendentes.atributos?.papeis ?? [];
    if (papeis.length > 0)
      saida.papeis = papeis;
    if (!pAtributosConsumidos && pPendentes.linhasDeAtributos.length > 0) {
      // Guarda só o que o modelo não absorveu: tira id e papéis, que já estão no bloco.
      const restantes = pPendentes.linhasDeAtributos
        .map((pL) => linhaDeAtributosSem(pL, { id: true, papeis: true, estilo: pBloco.tipo !== 'bruto' }))
        .filter((pL) => pL !== null) as string[];
      if (restantes.length > 0)
        saida.atributosBrutos = restantes;
    }
    return saida;
  }

  private umBloco(pPendentes: Pendentes): Bloco | null {
    const linha = this.linha as string;
    const estilo = pPendentes.atributos?.posicionais[0] ?? '';

    // Delimitados.
    const delimitador = DELIMITADOR.exec(linha);
    if (delimitador)
      return this.delimitado(delimitador[1], pPendentes);
    const cercado = CERCADO.exec(linha);
    if (cercado) {
      this.pos += 1;
      const corpo = this.ateFechar((pL) => /^```\s*$/.test(pL), '```');
      const codigo: Codigo = { id: novoID(), tipo: 'codigo', estilo: 'fonte', codigo: corpo.join('\n') };
      if (cercado[1])
        codigo.linguagem = cercado[1];
      return this.decorar(codigo, pPendentes);
    }

    // Seções.
    const secao = SECAO.exec(linha) ?? SECAO_MD.exec(linha);
    if (secao) {
      this.pos += 1;
      let nivel = secao[1].length - (secao[1].startsWith('=') ? 1 : 0);
      if (nivel < 1) {
        this.avisar('Título de nível 0 (`=`) fora do cabeçalho do documento: tratado como nível 1 (`==`).', this.pos - 1);
        nivel = 1;
      }
      if (nivel > 5) {
        this.avisar('Título além do nível 5: tratado como nível 5.', this.pos - 1);
        nivel = 5;
      }
      const novoTitulo: Titulo = { id: novoID(), tipo: 'titulo', nivel: nivel as 1 | 2 | 3 | 4 | 5, conteudo: analisarInline(secao[2]) };
      const titulo = this.decorar(novoTitulo, pPendentes, estilo === 'discrete' || estilo === 'float');
      if (estilo === 'discrete' || estilo === 'float')
        titulo.discreto = true;
      return titulo;
    }

    // Entrada de atributo no corpo.
    const entrada = ENTRADA_DE_ATRIBUTO.exec(linha);
    if (entrada) {
      this.pos += 1;
      let valor = entrada[2] ?? '';
      while (valor.endsWith('\\') && this.pos < this.linhas.length) {
        valor = `${valor.slice(0, -1)}\n${this.linha}`;
        this.pos += 1;
      }
      const atributo: AtributoDoDocumento = { id: novoID(), tipo: 'atributo', nome: entrada[1], valor };
      return this.decorar(atributo, pPendentes);
    }

    // Comentário de linha(s).
    if (COMENTARIO.test(linha)) {
      const textos: string[] = [];
      while (this.linha !== undefined && COMENTARIO.test(this.linha)) {
        textos.push((COMENTARIO.exec(this.linha) as RegExpExecArray)[1]);
        this.pos += 1;
      }
      return this.decorar({ id: novoID(), tipo: 'comentario', texto: textos.join('\n'), emBloco: false }, pPendentes);
    }

    // Macros de bloco.
    const imagem = IMAGEM.exec(linha);
    if (imagem) {
      this.pos += 1;
      return this.decorar(this.imagem(imagem[1], imagem[2]), pPendentes);
    }
    const midia = MIDIA.exec(linha);
    if (midia) {
      this.pos += 1;
      const bloco: Bloco = { id: novoID(), tipo: 'midia', especie: midia[1] as 'video' | 'audio', alvo: midia[2] };
      if (midia[3])
        bloco.atributos = midia[3];
      return this.decorar(bloco, pPendentes);
    }
    if (SUMARIO.test(linha)) {
      this.pos += 1;
      return this.decorar({ id: novoID(), tipo: 'sumario' }, pPendentes);
    }
    if (MACRO_DE_BLOCO.test(linha)) {
      this.pos += 1;
      return this.decorar({ id: novoID(), tipo: 'bruto', texto: linha }, pPendentes);
    }
    if (QUEBRA_DE_PAGINA.test(linha)) {
      this.pos += 1;
      return this.decorar({ id: novoID(), tipo: 'quebraDePagina' }, pPendentes);
    }
    if (QUEBRA_TEMATICA.test(linha)) {
      this.pos += 1;
      return this.decorar({ id: novoID(), tipo: 'quebraTematica' }, pPendentes);
    }

    // Tabela.
    const tabela = TABELA.exec(linha);
    if (tabela)
      return this.tabela(tabela[1], pPendentes);

    // Admonição em parágrafo.
    const admonicao = ADMONICAO.exec(linha);
    if (admonicao) {
      this.pos += 1;
      const resto = this.linhasDoParagrafo();
      const paragrafo: Bloco = { id: novoID(), tipo: 'paragrafo', conteudo: analisarInline([admonicao[2], ...resto].join('\n')) };
      const bloco: Admonicao = { id: novoID(), tipo: 'admonicao', especie: admonicao[1] as EspecieDeAdmonicao, filhos: [paragrafo] };
      return this.decorar(bloco, pPendentes);
    }

    // Lista de chamadas.
    if (CHAMADA.test(linha))
      return this.decorar(this.chamadas(), pPendentes);

    // Listas.
    const marcador = lerMarcador(linha);
    if (marcador)
      return this.decorar(this.lista(marcador.marcador, pPendentes), pPendentes, true);
    const descricao = lerDescricao(linha);
    if (descricao)
      return this.decorar(this.listaDeDescricao(descricao.profundidade), pPendentes);

    // Citação em estilo Markdown.
    if (CITACAO_MD.test(linha))
      return this.decorar(this.citacaoMarkdown(), pPendentes);

    // Parágrafo literal (indentado).
    if (/^\s+\S/.test(linha) && estilo === '') {
      const textos: string[] = [];
      while (this.linha !== undefined && !ehBranca(this.linha) && /^\s/.test(this.linha)) {
        textos.push(this.linha);
        this.pos += 1;
      }
      const recuo = Math.min(...textos.map((pT) => (/^\s*/.exec(pT) as RegExpExecArray)[0].length));
      return this.decorar({ id: novoID(), tipo: 'codigo', estilo: 'literal', codigo: textos.map((pT) => pT.slice(recuo)).join('\n') }, pPendentes);
    }

    // Parágrafo — com o estilo que a linha de atributos pediu.
    const textos = this.linhasDoParagrafo(true);
    const textoDoParagrafo = textos.join('\n');
    return this.paragrafoComEstilo(textoDoParagrafo, pPendentes);
  }

  /** As linhas de um parágrafo. `pPrimeiraLivre`: a primeira linha entra mesmo que pareça começar outro bloco. */
  private linhasDoParagrafo(pPrimeiraLivre = false): string[] {
    const textos: string[] = [];
    while (this.linha !== undefined && !ehBranca(this.linha) && ((pPrimeiraLivre && textos.length === 0) || !iniciaBloco(this.linha)) && this.linha !== '+') {
      textos.push(this.linha);
      this.pos += 1;
    }
    return textos;
  }

  private paragrafoComEstilo(pTexto: string, pPendentes: Pendentes): Bloco {
    const atributos = pPendentes.atributos;
    const estilo = atributos?.posicionais[0] ?? '';
    if (estilo === 'source' || estilo === 'listing' || estilo === 'literal') {
      const codigo: Codigo = { id: novoID(), tipo: 'codigo', estilo: estilo === 'source' ? 'fonte' : estilo === 'listing' ? 'listagem' : 'literal', codigo: pTexto };
      const linguagem = atributos?.posicionais[1] ?? atributos?.nomeados.language;
      if (linguagem)
        codigo.linguagem = linguagem;
      return this.decorar(codigo, pPendentes, true);
    }
    if ((ADMONICOES as readonly string[]).includes(estilo)) {
      const paragrafo: Bloco = { id: novoID(), tipo: 'paragrafo', conteudo: analisarInline(pTexto) };
      return this.decorar({ id: novoID(), tipo: 'admonicao', especie: estilo as EspecieDeAdmonicao, filhos: [paragrafo] }, pPendentes, true);
    }
    if (estilo === 'quote' || estilo === 'verse') {
      const paragrafo: Bloco = { id: novoID(), tipo: 'paragrafo', conteudo: analisarInline(pTexto) };
      const container: Container = { id: novoID(), tipo: 'container', especie: estilo === 'quote' ? 'citacao' : 'verso', filhos: [paragrafo] };
      if (atributos?.posicionais[1])
        container.autor = atributos.posicionais[1];
      if (atributos?.posicionais[2])
        container.fonte = atributos.posicionais[2];
      return this.decorar(container, pPendentes, true);
    }
    if (estilo === 'sidebar' || estilo === 'example') {
      const paragrafo: Bloco = { id: novoID(), tipo: 'paragrafo', conteudo: analisarInline(pTexto) };
      return this.decorar({ id: novoID(), tipo: 'container', especie: estilo === 'sidebar' ? 'barraLateral' : 'exemplo', filhos: [paragrafo] }, pPendentes, true);
    }
    if (estilo === 'comment')
      return this.decorar({ id: novoID(), tipo: 'comentario', texto: pTexto, emBloco: false }, pPendentes, true);
    if (estilo === 'pass')
      return this.decorar({ id: novoID(), tipo: 'passagem', texto: pTexto }, pPendentes, true);
    const paragrafo: Bloco = { id: novoID(), tipo: 'paragrafo', conteudo: analisarInline(pTexto) };
    const decorado = this.decorar(paragrafo, pPendentes);
    if (decorado.papeis?.includes('lead')) {
      decorado.estilo = 'lead';
      decorado.papeis = decorado.papeis.filter((pP) => pP !== 'lead');
      if (decorado.papeis.length === 0)
        delete decorado.papeis;
    }
    return decorado;
  }

  // -------------------------------------------------------------- delimitados

  /** Lê linhas até a que `pFecha` aceita (consumida). Sem fechamento ⇒ aviso e vai até o fim. */
  private ateFechar(pFecha: (pLinha: string) => boolean, pNome: string): string[] {
    const inicio = this.pos;
    const corpo: string[] = [];
    while (this.pos < this.linhas.length) {
      const linha = this.linha as string;
      if (pFecha(linha)) {
        this.pos += 1;
        return corpo;
      }
      corpo.push(linha);
      this.pos += 1;
    }
    this.avisar(`Bloco \`${pNome}\` aberto na linha ${this.base + inicio} não foi fechado: vai até o fim do documento.`, inicio - 1);
    return corpo;
  }

  private delimitado(pDelimitador: string, pPendentes: Pendentes): Bloco {
    const inicio = this.pos;
    this.pos += 1;
    const estilo = pPendentes.atributos?.posicionais[0] ?? '';
    const fecha = (pL: string): boolean => pL === pDelimitador;
    const tipo = pDelimitador[0];

    if (tipo === '-' && pDelimitador.length >= 4) {
      const corpo = this.ateFechar(fecha, pDelimitador);
      const codigo: Codigo = { id: novoID(), tipo: 'codigo', estilo: estilo === 'source' || Boolean(pPendentes.atributos?.posicionais[1]) ? 'fonte' : 'listagem', codigo: corpo.join('\n') };
      const linguagem = pPendentes.atributos?.posicionais[1] ?? pPendentes.atributos?.nomeados.language;
      if (linguagem)
        codigo.linguagem = linguagem;
      if (estilo === 'source' && !linguagem)
        codigo.estilo = 'fonte';
      return this.decorar(codigo, pPendentes, true);
    }
    if (tipo === '.') {
      const corpo = this.ateFechar(fecha, pDelimitador);
      return this.decorar({ id: novoID(), tipo: 'codigo', estilo: 'literal', codigo: corpo.join('\n') }, pPendentes, true);
    }
    if (tipo === '+') {
      const corpo = this.ateFechar(fecha, pDelimitador);
      return this.decorar({ id: novoID(), tipo: 'passagem', texto: corpo.join('\n') }, pPendentes, true);
    }
    if (tipo === '/') {
      const corpo = this.ateFechar(fecha, pDelimitador);
      return this.decorar({ id: novoID(), tipo: 'comentario', texto: corpo.join('\n'), emBloco: true }, pPendentes, true);
    }

    // Containers compostos: o conteúdo passa pelo parser filho.
    const corpo = this.ateFechar(fecha, pDelimitador);
    const filhos = new ParserDeBlocos(corpo, this.base + inicio + 1, this.avisos).blocos(() => false);

    if ((ADMONICOES as readonly string[]).includes(estilo))
      return this.decorar({ id: novoID(), tipo: 'admonicao', especie: estilo as EspecieDeAdmonicao, filhos }, pPendentes, true);
    if (estilo === 'source' && pDelimitador === '--') {
      const codigo: Codigo = { id: novoID(), tipo: 'codigo', estilo: 'fonte', codigo: corpo.join('\n') };
      const linguagem = pPendentes.atributos?.posicionais[1];
      if (linguagem)
        codigo.linguagem = linguagem;
      return this.decorar(codigo, pPendentes, true);
    }

    let especie: EspecieDeContainer;
    if (tipo === '=')
      especie = 'exemplo';
    else if (tipo === '*')
      especie = 'barraLateral';
    else if (tipo === '_')
      especie = estilo === 'verse' ? 'verso' : 'citacao';
    else
      especie = estilo === 'quote' ? 'citacao' : estilo === 'verse' ? 'verso' : estilo === 'sidebar' ? 'barraLateral' : estilo === 'example' ? 'exemplo' : 'aberto';

    const container: Container = { id: novoID(), tipo: 'container', especie, filhos };
    if (especie === 'citacao' || especie === 'verso') {
      if (pPendentes.atributos?.posicionais[1])
        container.autor = pPendentes.atributos.posicionais[1];
      if (pPendentes.atributos?.posicionais[2])
        container.fonte = pPendentes.atributos.posicionais[2];
    }
    return this.decorar(container, pPendentes, true);
  }

  private citacaoMarkdown(): Container {
    const inicio = this.pos;
    const internas: string[] = [];
    while (this.linha !== undefined && CITACAO_MD.test(this.linha)) {
      internas.push((CITACAO_MD.exec(this.linha) as RegExpExecArray)[1]);
      this.pos += 1;
    }
    const container: Container = { id: novoID(), tipo: 'container', especie: 'citacao', filhos: [] };
    const ultima = internas[internas.length - 1] ?? '';
    const atribuicao = /^--\s+(.*)$/.exec(ultima);
    if (atribuicao) {
      internas.pop();
      const partes = atribuicao[1].split(',');
      container.autor = partes[0].trim();
      if (partes.length > 1)
        container.fonte = partes.slice(1).join(',').trim();
    }
    container.filhos = new ParserDeBlocos(internas, this.base + inicio, this.avisos).blocos(() => false);
    return container;
  }

  // ------------------------------------------------------------------- listas

  private lista(pMarcador: Marcador, pPendentes: Pendentes): Bloco {
    const estiloPedido = pPendentes.atributos?.posicionais[0];
    const itens: ItemDeLista[] = [];
    let estilo: EstiloDeLista = pMarcador.estilo === 'descricao' ? 'marcadores' : pMarcador.estilo;
    while (this.linha !== undefined) {
      const lido = lerMarcador(this.linha);
      if (!lido || lido.marcador.estilo !== pMarcador.estilo || lido.marcador.profundidade !== pMarcador.profundidade)
        break;
      this.pos += 1;
      let textoDoItem = lido.texto;
      const item: ItemDeLista = { id: novoID(), conteudo: [], filhos: [] };
      const tarefa = TAREFA.exec(textoDoItem);
      if (tarefa) {
        estilo = 'tarefas';
        item.marcado = tarefa[1] !== ' ';
        textoDoItem = tarefa[2];
      }
      const continuacao = this.linhasDoParagrafo();
      item.conteudo = analisarInline([textoDoItem, ...continuacao].join('\n'));
      this.anexosDoItem(item.filhos, pMarcador);
      itens.push(item);
      if (!this.proximoItemDaLista(pMarcador))
        break;
    }
    if (estiloPedido === 'checklist' || estiloPedido === 'tarefas')
      estilo = 'tarefas';
    const lista: Bloco = { id: novoID(), tipo: 'lista', estilo, itens };
    return lista;
  }

  /** Sublistas e continuações (`+`) que pertencem ao item corrente. */
  private anexosDoItem(pFilhos: Bloco[], pMarcador: Marcador): void {
    for (;;) {
      const guardado = this.pos;
      while (ehBranca(this.linha) && this.pos < this.linhas.length)
        this.pos += 1;
      const linha = this.linha;
      if (linha === undefined) {
        this.pos = guardado;
        return;
      }
      if (linha === '+') {
        this.pos += 1;
        while (ehBranca(this.linha) && this.pos < this.linhas.length)
          this.pos += 1;
        const bloco = this.blocoAnexado();
        if (bloco)
          pFilhos.push(bloco);
        continue;
      }
      const marcador = lerMarcador(linha);
      if (marcador && (marcador.marcador.profundidade > pMarcador.profundidade || (marcador.marcador.estilo !== pMarcador.estilo && pMarcador.estilo !== 'descricao' && marcador.marcador.profundidade >= pMarcador.profundidade && marcador.marcador.profundidade > 1))) {
        pFilhos.push(this.lista(marcador.marcador, semPendentes()));
        continue;
      }
      if (marcador && marcador.marcador.estilo !== pMarcador.estilo && marcador.marcador.profundidade === 1 && pMarcador.estilo !== 'descricao' && pMarcador.profundidade === 1 && guardado === this.pos) {
        // `*` dentro de `.` (ou vice-versa) sem linha vazia: sublista de outro tipo.
        pFilhos.push(this.lista(marcador.marcador, semPendentes()));
        continue;
      }
      const descricao = lerDescricao(linha);
      if (descricao && (pMarcador.estilo !== 'descricao' ? true : descricao.profundidade > pMarcador.profundidade)) {
        if (pMarcador.estilo === 'descricao' || guardado === this.pos) {
          pFilhos.push(this.listaDeDescricao(descricao.profundidade));
          continue;
        }
      }
      this.pos = guardado;
      return;
    }
  }

  /** Um bloco só, anexado por `+` a um item: o parser de blocos para na primeira linha vazia. */
  private blocoAnexado(): Bloco | null {
    const pendentes = semPendentes();
    while (this.linha !== undefined && this.lerPendente(this.linha, pendentes))
      this.pos += 1;
    if (this.linha === undefined || ehBranca(this.linha))
      return null;
    return this.umBloco(pendentes);
  }

  private proximoItemDaLista(pMarcador: Marcador): boolean {
    const guardado = this.pos;
    while (ehBranca(this.linha) && this.pos < this.linhas.length)
      this.pos += 1;
    const linha = this.linha;
    if (linha !== undefined) {
      const lido = lerMarcador(linha);
      if (lido && lido.marcador.estilo === pMarcador.estilo && lido.marcador.profundidade === pMarcador.profundidade)
        return true;
    }
    this.pos = guardado;
    return false;
  }

  private listaDeDescricao(pProfundidade: number): Bloco {
    const itens: ItemDeDescricao[] = [];
    const marcador: Marcador = { estilo: 'descricao', profundidade: pProfundidade };
    while (this.linha !== undefined) {
      const lido = lerDescricao(this.linha);
      if (!lido || lido.profundidade !== pProfundidade)
        break;
      this.pos += 1;
      const item: ItemDeDescricao = { id: novoID(), conteudo: analisarInline(lido.termo), filhos: [] };
      const textos: string[] = lido.texto.length > 0 ? [lido.texto] : [];
      while (ehBranca(this.linha) && textos.length === 0 && this.pos < this.linhas.length && !ehBranca(this.linhas[this.pos + 1]) && !lerDescricao(this.linhas[this.pos + 1]) && !lerMarcador(this.linhas[this.pos + 1]))
        this.pos += 1;
      while (this.linha !== undefined && !ehBranca(this.linha) && !lerDescricao(this.linha) && !lerMarcador(this.linha) && this.linha !== '+' && !iniciaBloco(this.linha)) {
        textos.push(this.linha);
        this.pos += 1;
      }
      if (textos.length > 0)
        item.filhos.push({ id: novoID(), tipo: 'paragrafo', conteudo: analisarInline(textos.join('\n')) });
      this.anexosDoItem(item.filhos, marcador);
      itens.push(item);
      const guardado = this.pos;
      while (ehBranca(this.linha) && this.pos < this.linhas.length)
        this.pos += 1;
      const proximo = this.linha !== undefined ? lerDescricao(this.linha) : null;
      if (!proximo || proximo.profundidade !== pProfundidade) {
        this.pos = guardado;
        break;
      }
    }
    return { id: novoID(), tipo: 'descricao', itens };
  }

  private chamadas(): Bloco {
    const itens: ItemDeChamada[] = [];
    let automatico = 1;
    while (this.linha !== undefined) {
      const m = CHAMADA.exec(this.linha);
      if (!m)
        break;
      this.pos += 1;
      const numero = m[1] === '.' ? automatico : Number(m[1]);
      automatico = numero + 1;
      const continuacao = this.linhasDoParagrafo();
      itens.push({ id: novoID(), numero, conteudo: analisarInline([m[2], ...continuacao].join('\n')) });
    }
    return { id: novoID(), tipo: 'chamadas', itens };
  }

  // ------------------------------------------------------------------- tabela

  private tabela(pSeparador: string, pPendentes: Pendentes): Bloco {
    this.pos += 1;
    const delimitador = `${pSeparador}===`;
    const corpo = this.ateFechar((pL) => pL.trim() === delimitador, delimitador);
    const atributos = pPendentes.atributos;
    const formato = atributos?.nomeados.format ?? (pSeparador === ',' ? 'csv' : pSeparador === ':' ? 'dsv' : 'psv');
    const colunas = atributos?.nomeados.cols;
    const opcoes = atributos?.opcoes ?? [];
    let numeroDeColunas = colunas ? contarColunas(colunas) : 0;

    let celulas: Celula[];
    let cabecalhoImplicito = false;
    if (formato === 'csv' || formato === 'dsv' || formato === 'tsv') {
      const separador = formato === 'csv' ? ',' : formato === 'tsv' ? '\t' : atributos?.nomeados.separator ?? ':';
      const linhasUteis = corpo.filter((pL) => !ehBranca(pL));
      celulas = [];
      for (const linha of linhasUteis)
        for (const campo of dividirCSV(linha, separador))
          celulas.push({ id: novoID(), conteudo: analisarInline(campo.trim()) });
      if (numeroDeColunas === 0)
        numeroDeColunas = linhasUteis.length > 0 ? dividirCSV(linhasUteis[0], separador).length : 1;
      cabecalhoImplicito = linhasUteis.length > 1 && corpo.length > 1 && ehBranca(corpo[1]) && !ehBranca(corpo[0]);
    } else {
      const lidas = lerCelulasPSV(corpo);
      celulas = lidas.celulas;
      if (numeroDeColunas === 0)
        numeroDeColunas = lidas.naPrimeiraLinha || 1;
      cabecalhoImplicito = lidas.primeiraLinhaIsolada;
    }

    const linhas: LinhaDaTabela[] = [];
    let atual: Celula[] = [];
    let ocupado = 0;
    for (const celula of celulas) {
      atual.push(celula);
      ocupado += celula.colunas ?? 1;
      if (ocupado >= numeroDeColunas) {
        linhas.push({ id: novoID(), celulas: atual });
        atual = [];
        ocupado = 0;
      }
    }
    if (atual.length > 0)
      linhas.push({ id: novoID(), celulas: atual });

    const tabela: Tabela = {
      id: novoID(),
      tipo: 'tabela',
      numeroDeColunas,
      cabecalho: opcoes.includes('header') || (cabecalhoImplicito && !opcoes.includes('noheader')),
      rodape: opcoes.includes('footer'),
      linhas,
    };
    if (colunas)
      tabela.colunas = colunas;
    const outros = pPendentes.linhasDeAtributos.map((pL) => linhaDeAtributosSem(pL, { id: true, papeis: true, estilo: false, tabela: true })).filter((pL) => pL !== null) as string[];
    if (outros.length > 0)
      tabela.outrosAtributos = outros.join(' ');
    return this.decorar(tabela, pPendentes, true);
  }

  private imagem(pAlvo: string, pAtributos: string): Bloco {
    const lidos = lerAtributos(pAtributos);
    const bloco: Bloco = { id: novoID(), tipo: 'imagem', alvo: pAlvo };
    const alt = lidos.posicionais[0];
    if (alt)
      bloco.alt = alt;
    const largura = lidos.posicionais[1] ?? lidos.nomeados.width;
    const altura = lidos.posicionais[2] ?? lidos.nomeados.height;
    if (largura)
      bloco.largura = largura;
    if (altura)
      bloco.altura = altura;
    const outros = Object.entries(lidos.nomeados).filter(([pNome]) => pNome !== 'width' && pNome !== 'height' && pNome !== 'alt');
    if (outros.length > 0)
      bloco.outrosAtributos = outros.map(([pNome, pValor]) => (/[,"]/.test(pValor) ? `${pNome}="${pValor}"` : `${pNome}=${pValor}`)).join(',');
    return bloco;
  }
}

// ============================================================================
// Apoio
// ============================================================================

function fundirAtributos(pA: AtributosLidos, pB: AtributosLidos): AtributosLidos {
  return {
    posicionais: pB.posicionais.length > 0 && pB.posicionais[0] !== '' ? pB.posicionais : pA.posicionais,
    nomeados: { ...pA.nomeados, ...pB.nomeados },
    papeis: [...pA.papeis, ...pB.papeis],
    id: pB.id ?? pA.id,
    opcoes: [...pA.opcoes, ...pB.opcoes],
  };
}

/**
 * A linha `[...]` sem o que o modelo já guardou (id, papéis, e o estilo quando o bloco o interpretou). Devolve
 * `null` quando não sobra nada.
 */
function linhaDeAtributosSem(pLinha: string, pRemover: { id: boolean; papeis: boolean; estilo: boolean; tabela?: boolean }): string | null {
  const m = LINHA_DE_ATRIBUTOS.exec(pLinha);
  if (!m)
    return pLinha;
  const lidos = lerAtributos(m[1]);
  const posicionais = [...lidos.posicionais];
  if (pRemover.estilo && posicionais.length > 0)
    posicionais[0] = '';
  const nomeados: Record<string, string> = {};
  for (const [nome, valor] of Object.entries(lidos.nomeados)) {
    if (pRemover.id && nome === 'id')
      continue;
    if (pRemover.papeis && nome === 'role')
      continue;
    if (pRemover.tabela && (nome === 'cols' || nome === 'options' || nome === 'opts' || nome === 'format' || nome === 'separator'))
      continue;
    nomeados[nome] = valor;
  }
  const opcoes = pRemover.tabela ? [] : lidos.opcoes.filter(() => !lidos.nomeados.options && !lidos.nomeados.opts);
  const partes: string[] = [];
  const atalho = opcoes.map((pO) => `%${pO}`).join('');
  const primeiro = (posicionais[0] ?? '') + atalho;
  if (primeiro !== '' || posicionais.slice(1).some((pP) => pP !== ''))
    partes.push(primeiro, ...posicionais.slice(1));
  while (partes.length > 0 && partes[partes.length - 1] === '')
    partes.pop();
  for (const [nome, valor] of Object.entries(nomeados))
    partes.push(/[,"]/.test(valor) ? `${nome}="${valor}"` : `${nome}=${valor}`);
  if (partes.length === 0)
    return null;
  return `[${partes.join(',')}]`;
}

function contarColunas(pCols: string): number {
  const m = /^(\d+)\*/.exec(pCols.trim());
  if (m)
    return Number(m[1]);
  let total = 0;
  for (const parte of pCols.split(',')) {
    const repeticao = /^(\d+)\*/.exec(parte.trim());
    total += repeticao ? Number(repeticao[1]) : 1;
  }
  return total;
}

function dividirCSV(pLinha: string, pSeparador: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < pLinha.length; i++) {
    const c = pLinha[i];
    if (aspas) {
      if (c === '"' && pLinha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else if (c === '"')
        aspas = false;
      else
        atual += c;
      continue;
    }
    if (c === '"' && atual === '') {
      aspas = true;
      continue;
    }
    if (c === pSeparador) {
      campos.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  campos.push(atual);
  return campos;
}

const ESPECIFICACAO_DE_CELULA = /(?:^|(?<=\s))((?:\d+(?:\.\d+)?|\.\d+)\+)?([<^>])?(?:\.([<^>]))?([aehlmsdv])?$/;

interface CelulasPSV {
  celulas: Celula[];
  naPrimeiraLinha: number;
  primeiraLinhaIsolada: boolean;
}

/** Células de uma tabela `|` — a especificação (`2+^.>s`) vem colada ANTES do `|`. */
function lerCelulasPSV(pLinhas: string[]): CelulasPSV {
  const celulas: Celula[] = [];
  const texto = pLinhas.join('\n');
  // Segmentos entre `|` não escapados.
  const segmentos: string[] = [];
  let atual = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '\\' && texto[i + 1] === '|') {
      atual += '|';
      i += 1;
      continue;
    }
    if (c === '|') {
      segmentos.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  segmentos.push(atual);

  let naPrimeiraLinha = 0;
  const primeiraLinha = pLinhas[0] ?? '';
  for (let i = 0; i < primeiraLinha.length; i++)
    if (primeiraLinha[i] === '|' && primeiraLinha[i - 1] !== '\\')
      naPrimeiraLinha += 1;
  const primeiraLinhaIsolada = pLinhas.length > 2 && ehBranca(pLinhas[1]) && !ehBranca(pLinhas[0]);

  // O segmento 0 é o que vem antes do primeiro `|` (vazio ou a especificação da primeira célula).
  let especificacao = segmentos[0].trim();
  for (let i = 1; i < segmentos.length; i++) {
    const segmento = segmentos[i];
    const ultimo = i === segmentos.length - 1;
    let conteudo = segmento;
    let proximaEspecificacao = '';
    if (!ultimo) {
      const m = ESPECIFICACAO_DE_CELULA.exec(segmento);
      if (m && m[0].length > 0) {
        conteudo = segmento.slice(0, segmento.length - m[0].length);
        proximaEspecificacao = m[0];
      }
    }
    const celula: Celula = { id: novoID(), conteudo: analisarInline(conteudo.trim()) };
    aplicarEspecificacao(celula, especificacao);
    celulas.push(celula);
    especificacao = proximaEspecificacao.trim();
  }
  return { celulas, naPrimeiraLinha, primeiraLinhaIsolada };
}

function aplicarEspecificacao(pCelula: Celula, pEspecificacao: string): void {
  if (pEspecificacao === '')
    return;
  const m = /^(?:(\d+)?(?:\.(\d+))?\+)?([<^>])?(?:\.([<^>]))?([aehlmsdv])?$/.exec(pEspecificacao);
  if (!m)
    return;
  if (m[1])
    pCelula.colunas = Number(m[1]);
  if (m[2])
    pCelula.linhas = Number(m[2]);
  if (m[3])
    pCelula.alinhamento = m[3] === '<' ? 'esquerda' : m[3] === '^' ? 'centro' : 'direita';
  if (m[5])
    pCelula.estilo = m[5];
}

// ============================================================================
// Entrada
// ============================================================================

/** Analisa um texto AsciiDoc inteiro. Nunca lança: o que não entende vira bloco bruto, e o resto vira aviso. */
export function analisarAsciiDoc(pTexto: string): ResultadoDaAnalise {
  const avisos: AvisoDoParser[] = [];
  const linhas = pTexto.replace(/\r\n?/g, '\n').split('\n');
  const parser = new ParserDeBlocos(linhas, 0, avisos);
  const documento = parser.documento();
  return { documento, avisos };
}

/** Um documento mínimo: um parágrafo vazio, para o editor sempre ter onde escrever. */
export function documentoVazio(): Documento {
  return { blocos: [{ id: novoID(), tipo: 'paragrafo', conteudo: [] }] };
}
