/**
 * XEditorAsciiDoc — o editor AsciiDoc completo: barra de ferramentas, três modos (Visual, Código, Dividido),
 * painel de estrutura, diálogos contidos, barra de status e histórico. Entra texto AsciiDoc, sai texto AsciiDoc.
 *
 * Quem guarda o estado é este componente: o documento (modelo) no modo visual, o texto no modo código; a troca de
 * modo converte um no outro. As transações do modo visual passam por aqui (`aplicar`), que registra o histórico e
 * emite o texto serializado (com um pequeno atraso, para a digitação não pagar a serialização a cada tecla).
 *
 * Modo DIVIDIDO (dono, 2026-10-31): código à esquerda e o WYSIWYG EDITÁVEL à direita, sobre o mesmo documento. Quem
 * editou por último manda: uma transação no visual serializa e atualiza o código; digitar no código reanalisa (com
 * atraso) e atualiza o visual. `origemDaMudanca` diz de que lado veio o texto corrente, para o texto serializado pelo
 * próprio visual não ser reanalisado (o que apagaria a seleção).
 *
 * Hospedeiro fora da web (2026-10-31): o modo pode ser CONTROLADO (`modo` + `aoMudarModo`), os textos vêm por
 * `textos`, imagens passam por `resolverRecurso`, include/referência/link saem por `aoAcionarReferencia`, a
 * preferência de leiaute vai para `armazenamento` (padrão: `localStorage`) e o `ref` dá um punhado de comandos
 * (`XEditorAsciiDocHandle`) para atalhos vindos de fora.
 */

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as PointerEventDoReact, type Ref } from 'react';
import './asciidoc.css';
import { XBarraDoEditor, type ComandoDaBarra, type EstadoDaBarra, type ModoDoEditor } from './XBarraDoEditor';
import { XDialogoDoEditor } from './XDialogoDoEditor';
import { XExplicacaoDoModelo } from './XExplicacaoDoModelo';
import { avaliarModelo, garantirEspacoDasSecoes, secoesTravadas, violacaoDoModelo, type ModeloDeDocumento } from './modelo/modeloDeDocumento';
import { XEditorDeCodigo, type PosicaoNoCodigo, type XEditorDeCodigoHandle } from './codigo/XEditorDeCodigo';
import * as codigo from './codigo/edicaoDeTexto';
import { XVistaWYSIWYG, type CursorVirtual, type PedidoDeDialogo } from './wysiwyg/XVistaWYSIWYG';
import { carimbarLinhas } from './editor/linhas';
import type { AcionadorDeReferencia, ResolvedorDeRecurso } from './wysiwyg/contexto';
import { analisarAsciiDoc, documentoVazio } from './parser/blocos';
import { serializarDocumento } from './serializador/serializar';
import { comprimentoInline, folhaPorID, marcasNaPosicao, novoID, textoDoDocumento, textoPuro } from './modelo/documento';
import type { AvisoDoParser, Bloco, Documento, EspecieDeAdmonicao, EstiloDeLista, Inline, Marca, Tabela, TipoDeMarca } from './modelo/tipos';
import { Historico } from './editor/historico';
import { ajustarSelecao, estaColapsada, selecaoColapsada, type Selecao } from './editor/selecao';
import {
  alinharColunaDaTabela,
  alternarLista,
  alternarMarca,
  blocoDaFolha,
  definirTipoDeBloco,
  elevarItemAParagrafo,
  embrulharEmContainer,
  inserirAtomo,
  inserirBlocosNaSelecao,
  inserirColunaNaTabela,
  inserirLinhaNaTabela,
  limparMarcas,
  paragrafoVazio,
  recuarItem,
  removerBloco,
  removerColunaDaTabela,
  removerLinhaDaTabela,
  selecaoTemMarca,
  substituirBloco,
  type Resultado,
  type TipoDeBlocoDeTexto,
} from './editor/transacoes';
import { atomo } from './modelo/documento';
import { MARCAS_SIMPLES } from './modelo/tipos';
import { ContextoDeTextos, f, fundirTextos, type TextosParciais } from './textos';

// ============================================================================
// Tipos
// ============================================================================

/** Onde o editor guarda preferências de leiaute (a proporção do modo dividido). Padrão: `localStorage`. */
export interface ArmazenamentoDoEditor {
  ler: (pChave: string) => string | null;
  gravar: (pChave: string, pValor: string) => void;
}

/** Comandos que um hospedeiro dispara por fora (atalhos do VS Code, por exemplo). */
export interface XEditorAsciiDocHandle {
  executar: (pComando: ComandoDaBarra) => void;
  desfazer: () => void;
  refazer: () => void;
  mudarModo: (pModo: ModoDoEditor) => void;
  alternarEstrutura: () => void;
  /** Leva o cursor à linha do código (modo código/dividido) ou ao bloco daquela linha (modo visual). */
  irParaLinha: (pLinha: number) => void;
}

export interface XEditorAsciiDocProps {
  valor: string;
  aoMudar: (pValor: string) => void;
  modoInicial?: ModoDoEditor;
  /** Modo CONTROLADO: quando informado, o editor mostra este modo e avisa a troca por `aoMudarModo`. */
  modo?: ModoDoEditor;
  aoMudarModo?: (pModo: ModoDoEditor) => void;
  somenteLeitura?: boolean;
  /** `preencher` ocupa a altura do pai (o pai precisa ter altura); número = altura fixa em px. */
  altura?: 'preencher' | number;
  rotuloAcessivel?: string;
  className?: string;
  /** Mostra o painel de estrutura aberto de início. */
  estruturaAberta?: boolean;
  aoMudarEstrutura?: (pAberta: boolean) => void;
  /** O modelo a que o documento está sujeito: explicação não editável no topo e pendências na barra de status. */
  modelo?: ModeloDeDocumento;
  /** Catálogo de textos por cima do padrão pt-BR (qualquer nível, parcial). */
  textos?: TextosParciais;
  resolverRecurso?: ResolvedorDeRecurso;
  aoAcionarReferencia?: AcionadorDeReferencia;
  armazenamento?: ArmazenamentoDoEditor;
  ref?: Ref<XEditorAsciiDocHandle>;
}

const ATRASO_DE_EMISSAO_MS = 150;
const CHAVE_DA_PROPORCAO = 'tootega.editorAsciiDoc.proporcao';
const PROPORCAO_MINIMA = 0.15;
const PASSO_DO_TECLADO = 0.05;
/** Largura do painel de estrutura (a mesma do CSS `.adc-estrutura`), descontada no cálculo do arrasto. */
const LARGURA_DA_ESTRUTURA = 256;

const ARMAZENAMENTO_PADRAO: ArmazenamentoDoEditor = {
  ler: (pChave) => {
    try {
      return window.localStorage.getItem(pChave);
    } catch {
      return null;
    }
  },
  gravar: (pChave, pValor) => {
    try {
      window.localStorage.setItem(pChave, pValor);
    } catch {
      /* sem armazenamento (iframe restrito): a preferência vale só nesta sessão */
    }
  },
};

function contarPalavras(pTexto: string): number {
  const m = pTexto.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

function contarBlocos(pBlocos: Bloco[]): number {
  let total = 0;
  for (const bloco of pBlocos) {
    total += 1;
    if (bloco.tipo === 'lista' || bloco.tipo === 'descricao')
      for (const item of bloco.itens)
        total += contarBlocos(item.filhos);
    if (bloco.tipo === 'admonicao' || bloco.tipo === 'container')
      total += contarBlocos(bloco.filhos);
  }
  return total;
}

interface Titulo {
  id: string;
  nivel: number;
  texto: string;
}

function titulosDoDocumento(pBlocos: Bloco[], pSemTexto: string, pSaida: Titulo[] = []): Titulo[] {
  for (const bloco of pBlocos) {
    if (bloco.tipo === 'titulo')
      pSaida.push({ id: bloco.id, nivel: bloco.nivel, texto: textoPuro(bloco.conteudo) || pSemTexto });
    if (bloco.tipo === 'lista' || bloco.tipo === 'descricao')
      for (const item of bloco.itens)
        titulosDoDocumento(item.filhos, pSemTexto, pSaida);
    if (bloco.tipo === 'admonicao' || bloco.tipo === 'container')
      titulosDoDocumento(bloco.filhos, pSemTexto, pSaida);
  }
  return pSaida;
}

const MARCADOR_DE_ITEM = /^\s*(\*{1,5}|-|\.{1,5}|\d+\.)\s+(\[[ x*]\]\s+)?/;
const TERMO_DE_DESCRICAO = /^\s*(\S.*?)(::{1,4})(?:\s+|$)/;

/** Aproxima o texto puro de um trecho de código AsciiDoc: tira marcas de formatação e o `+` de quebra. */
function textoAproximado(pCodigo: string): string {
  return pCodigo
    .replace(/^(={1,6}|#{1,6})\s+/, '')
    .replace(/(image|link|xref|kbd|btn|menu|footnote|anchor|icon|pass):[^\[]*\[/g, '')
    .replace(/\[\[[^\]]*\]\]|<<[^>]*>>/g, '')
    .replace(/[*_`#^~]/g, '')
    .replace(/\s\+$/gm, '')
    .replace(/\n/g, ' ');
}

/**
 * Onde o cursor do código (linha e coluna, 1-based) cai no documento: o bloco cuja linha de origem é a última antes
 * do cursor e, quando o bloco tem texto editável, a folha e o deslocamento aproximado — aproximado porque a marcação
 * do código não existe no texto da folha; serve para apontar, não para editar.
 */
function cursorVirtualDoCodigo(pBlocos: Bloco[], pTexto: string, pLinha: number, pColuna: number): CursorVirtual | null {
  const bloco = blocoDaLinha(pBlocos, pLinha);
  if (!bloco || bloco.linha === undefined)
    return null;
  const linhas = pTexto.split('\n');
  const trecho = linhas.slice(bloco.linha - 1, pLinha);
  if (trecho.length === 0)
    return { bloco: bloco.id };
  trecho[trecho.length - 1] = trecho[trecho.length - 1].slice(0, Math.max(0, pColuna - 1));
  if (bloco.tipo === 'paragrafo' || bloco.tipo === 'titulo') {
    const deslocamento = Math.min(textoAproximado(trecho.join('\n')).length, comprimentoInline(bloco.conteudo));
    return { bloco: bloco.id, folha: bloco.id, deslocamento };
  }
  if (bloco.tipo === 'lista' || bloco.tipo === 'chamadas' || bloco.tipo === 'descricao') {
    // O item é o último marcador (ou termo) antes do cursor; o deslocamento, o texto da linha depois dele.
    const ehInicio = (pL: string): boolean => (bloco.tipo === 'descricao' ? TERMO_DE_DESCRICAO.test(pL) : bloco.tipo === 'chamadas' ? /^<(\d+|\.)>\s/.test(pL) : MARCADOR_DE_ITEM.test(pL));
    let indice = -1;
    let inicioDoItem = 0;
    trecho.forEach((pL, pI) => {
      if (ehInicio(pL)) {
        indice += 1;
        inicioDoItem = pI;
      }
    });
    const itens: { id: string; conteudo: Inline[] }[] = bloco.itens;
    if (indice < 0 || indice >= itens.length)
      return { bloco: bloco.id };
    const item = itens[indice];
    const primeira = trecho[inicioDoItem].replace(bloco.tipo === 'descricao' ? TERMO_DE_DESCRICAO : bloco.tipo === 'chamadas' ? /^<(\d+|\.)>\s+/ : MARCADOR_DE_ITEM, '');
    const resto = trecho.slice(inicioDoItem + 1);
    const deslocamento = Math.min(textoAproximado([primeira, ...resto].join('\n')).length, comprimentoInline(item.conteudo));
    return { bloco: bloco.id, folha: item.id, deslocamento };
  }
  return { bloco: bloco.id };
}

/**
 * O inverso de `cursorVirtualDoCodigo`: onde, no texto, cai a posição do modelo (folha + deslocamento) — a linha de
 * origem do bloco, o início do item quando é lista, e a contagem de caracteres pulando as marcas de formatação.
 * Aproximado pelo mesmo motivo; serve para posicionar o cursor do código quando se clica no visual.
 */
function posicaoNoCodigo(pDocumento: Documento, pTexto: string, pFoco: { folha: string; deslocamento: number }): number | null {
  const f = folhaPorID(pDocumento, pFoco.folha);
  if (!f)
    return null;
  const bloco = blocoDaFolha(f);
  if (bloco.linha === undefined)
    return null;
  const linhas = pTexto.split('\n');
  let indice = bloco.linha - 1;
  if (indice >= linhas.length)
    return null;
  let prefixo: RegExp | null = null;
  if (f.especie === 'titulo')
    prefixo = /^(={1,6}|#{1,6})\s+/;
  else if (f.especie === 'item' || f.especie === 'termo' || f.especie === 'chamada') {
    const itens = (bloco as { itens?: { id: string }[] }).itens ?? [];
    const k = itens.findIndex((pI) => pI.id === f.folha.id);
    const ehInicio = (pL: string): boolean => (f.especie === 'termo' ? TERMO_DE_DESCRICAO.test(pL) : f.especie === 'chamada' ? /^<(\d+|\.)>\s/.test(pL) : MARCADOR_DE_ITEM.test(pL));
    let contados = -1;
    for (let i = indice; i < linhas.length && i < indice + 400; i++) {
      if (/^(={1,6}|#{1,6})\s+\S/.test(linhas[i]) && i > indice)
        break;
      if (ehInicio(linhas[i])) {
        contados += 1;
        if (contados === k) {
          indice = i;
          break;
        }
      }
    }
    if (contados !== k)
      return null;
    prefixo = f.especie === 'item' ? MARCADOR_DE_ITEM : f.especie === 'chamada' ? /^<(\d+|\.)>\s+/ : null;
  } else if (f.especie === 'celula')
    return null;
  let inicio = 0;
  for (let i = 0; i < indice; i++)
    inicio += linhas[i].length + 1;
  const m = prefixo ? prefixo.exec(linhas[indice]) : null;
  let i = inicio + (m ? m[0].length : 0);
  let contagem = 0;
  while (i < pTexto.length && contagem < pFoco.deslocamento) {
    const c = pTexto[i];
    if (c === '\n') {
      if (pTexto[i + 1] === '\n' || pTexto[i + 1] === undefined)
        break;
      contagem += 1;
      i += 1;
      continue;
    }
    if (/[*_`#^~]/.test(c)) {
      i += 1;
      continue;
    }
    contagem += 1;
    i += 1;
  }
  return i;
}

/** O bloco cuja linha de origem é a última ≤ `pLinha` (busca em profundidade). */
function blocoDaLinha(pBlocos: Bloco[], pLinha: number, pMelhor: Bloco | null = null): Bloco | null {
  let melhor = pMelhor;
  for (const bloco of pBlocos) {
    if (bloco.linha !== undefined && bloco.linha <= pLinha && (melhor === null || melhor.linha === undefined || bloco.linha >= melhor.linha))
      melhor = bloco;
    if (bloco.tipo === 'lista' || bloco.tipo === 'descricao')
      for (const item of bloco.itens)
        melhor = blocoDaLinha(item.filhos, pLinha, melhor);
    if (bloco.tipo === 'admonicao' || bloco.tipo === 'container')
      melhor = blocoDaLinha(bloco.filhos, pLinha, melhor);
  }
  return melhor;
}

// ============================================================================
// O editor
// ============================================================================

export function XEditorAsciiDoc({
  valor,
  aoMudar,
  modoInicial = 'visual',
  modo: modoControlado,
  aoMudarModo,
  somenteLeitura = false,
  altura = 'preencher',
  rotuloAcessivel,
  className = '',
  estruturaAberta: estruturaInicial = false,
  aoMudarEstrutura,
  modelo,
  textos: textosParciais,
  resolverRecurso,
  aoAcionarReferencia,
  armazenamento = ARMAZENAMENTO_PADRAO,
  ref,
}: XEditorAsciiDocProps): JSX.Element {
  const textos = useMemo(() => fundirTextos(textosParciais), [textosParciais]);
  const te = textos.editor;
  const [modoInterno, setModoInterno] = useState<ModoDoEditor>(modoControlado ?? modoInicial);
  const modo = modoControlado ?? modoInterno;
  const [texto, setTexto] = useState(valor);
  const analiseInicial = useMemo(() => analisarAsciiDoc(valor), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [documento, setDocumento] = useState<Documento>(() => (analiseInicial.documento.blocos.length === 0 ? { ...analiseInicial.documento, blocos: documentoVazio().blocos } : analiseInicial.documento));
  const [avisos, setAvisos] = useState<AvisoDoParser[]>(analiseInicial.avisos);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [marcasPendentes, setMarcasPendentes] = useState<Marca[] | null>(null);
  const [blocoSelecionado, setBlocoSelecionado] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<PedidoDeDialogo | null>(null);
  const [estruturaAberta, setEstruturaAberta] = useState(estruturaInicial);
  const [cursorNoCodigo, setCursorNoCodigo] = useState<PosicaoNoCodigo>({ linha: 1, coluna: 1, ini: 0, fim: 0 });
  const [codigoFocado, setCodigoFocado] = useState(false);
  /**
   * O lado em que o usuário trabalhou por último (modo dividido). Decide de que lado sai o cursor virtual (sempre do
   * outro) e sobre o que a barra age. Não cai com o blur (clicar na barra não apaga o cursor virtual).
   */
  const [ladoAtivo, setLadoAtivo] = useState<'codigo' | 'visual'>('visual');
  const editorDeCodigo = useRef<XEditorDeCodigoHandle>(null);
  /** Para quem o diálogo aberto trabalha — fixado ao abrir, porque abrir o diálogo tira o foco do código. */
  const [alvoDoDialogo, setAlvoDoDialogo] = useState<'visual' | 'codigo'>('visual');
  const [pedidoDeBusca, setPedidoDeBusca] = useState(0);
  const [irParaLinha, setIrParaLinha] = useState<{ linha: number; n: number } | undefined>(undefined);
  // Modo dividido: a fração do corpo que o código ocupa (o resto é a prévia). Lembrada entre sessões.
  const [proporcao, setProporcao] = useState<number>(() => {
    const guardada = Number(armazenamento.ler(CHAVE_DA_PROPORCAO));
    return Number.isFinite(guardada) && guardada >= PROPORCAO_MINIMA && guardada <= 1 - PROPORCAO_MINIMA ? guardada : 0.5;
  });
  const [arrastando, setArrastando] = useState(false);
  // A recusa mais recente do modelo (some sozinha). Não é erro mudo: nomeia a seção e o motivo.
  const [recusaDoModelo, setRecusaDoModelo] = useState<string | null>(null);
  const temporizadorDaRecusa = useRef<number | null>(null);
  const modeloRef = useRef(modelo);
  modeloRef.current = modelo;
  const corpo = useRef<HTMLDivElement>(null);
  const [, forcar] = useState(0);
  const historico = useRef(new Historico());
  const ultimoEmitido = useRef(valor);
  const temporizador = useRef<number | null>(null);
  const documentoRef = useRef(documento);
  documentoRef.current = documento;
  /** De que lado veio o `texto` corrente: serializado pelo visual, ou digitado no código. */
  const origemDaMudanca = useRef<'visual' | 'codigo'>('visual');

  /** Texto → documento (entrada no visual, ou digitação no código em modo dividido). Zera seleção e histórico. */
  const reanalisarTexto = useCallback((pTexto: string) => {
    const analise = analisarAsciiDoc(pTexto);
    const doc = analise.documento.blocos.length === 0 ? { ...analise.documento, blocos: documentoVazio().blocos } : analise.documento;
    documentoRef.current = doc;
    setDocumento(doc);
    setAvisos(analise.avisos);
    setSelecao(null);
    setMarcasPendentes(null);
    setBlocoSelecionado(null);
    historico.current.limpar();
  }, []);

  // O painel de estrutura segue a prop quando ela muda por fora (hospedeiro que o alterna por comando).
  useEffect(() => {
    setEstruturaAberta(estruturaInicial);
  }, [estruturaInicial]);

  const alternarEstrutura = useCallback(() => {
    setEstruturaAberta((pA) => {
      aoMudarEstrutura?.(!pA);
      return !pA;
    });
  }, [aoMudarEstrutura]);

  // ------------------------------------------------- sincronismo com o valor

  /** Emite o texto do documento (com atraso), guardando o que emitiu para não reanalisar o próprio eco. */
  const emitirDocumento = useCallback(
    (pDocumento: Documento, pImediato = false) => {
      const emitir = (): void => {
        const serializado = serializarDocumento(pDocumento);
        if (serializado === ultimoEmitido.current)
          return;
        ultimoEmitido.current = serializado;
        origemDaMudanca.current = 'visual';
        // As linhas de origem dos blocos acompanham o texto novo: o cursor virtual depende delas nos dois sentidos.
        carimbarLinhas(pDocumento, serializado);
        setTexto(serializado);
        aoMudar(serializado);
      };
      if (temporizador.current !== null) {
        window.clearTimeout(temporizador.current);
        temporizador.current = null;
      }
      if (pImediato)
        emitir();
      else
        temporizador.current = window.setTimeout(() => {
          temporizador.current = null;
          emitir();
        }, ATRASO_DE_EMISSAO_MS);
    },
    [aoMudar],
  );

  useEffect(() => () => {
    if (temporizador.current !== null)
      window.clearTimeout(temporizador.current);
  }, []);

  // Valor novo vindo de fora (não o nosso eco): reanalisa.
  useEffect(() => {
    if (valor === ultimoEmitido.current)
      return;
    ultimoEmitido.current = valor;
    origemDaMudanca.current = 'visual';   // já reanalisado aqui: o efeito do modo dividido não precisa repetir
    setTexto(valor);
    reanalisarTexto(valor);
  }, [valor, reanalisarTexto]);

  // ------------------------------------------------------------ transações

  const aplicar = useCallback(
    (pResultado: Resultado, pGrupo: string | null) => {
      const antes = documentoRef.current;
      if (pResultado.documento === antes && pResultado.selecao !== undefined) {
        setSelecao(ajustarSelecao(pResultado.documento, pResultado.selecao));
        return;
      }
      // O modelo manda: transação que mexe numa seção fixa é recusada inteira, com o motivo na barra de status.
      const modeloCorrente = modeloRef.current;
      if (modeloCorrente) {
        const violacao = violacaoDoModelo(antes, pResultado.documento, modeloCorrente);
        if (violacao) {
          setRecusaDoModelo(violacao);
          if (temporizadorDaRecusa.current !== null)
            window.clearTimeout(temporizadorDaRecusa.current);
          temporizadorDaRecusa.current = window.setTimeout(() => setRecusaDoModelo(null), 4000);
          // Reafirma a seleção corrente para o DOM voltar ao estado do modelo.
          setSelecao((pS) => (pS ? { ...pS } : pS));
          forcar((pN) => pN + 1);
          return;
        }
      }
      historico.current.registrar({ documento: antes, selecao }, pGrupo);
      const documentoFinal = modeloCorrente ? garantirEspacoDasSecoes(pResultado.documento, modeloCorrente) : pResultado.documento;
      documentoRef.current = documentoFinal;
      setDocumento(documentoFinal);
      setSelecao(ajustarSelecao(documentoFinal, pResultado.selecao));
      setMarcasPendentes(null);
      emitirDocumento(documentoFinal);
      forcar((pN) => pN + 1);
    },
    [emitirDocumento, selecao],
  );

  // Documento com modelo: toda seção fixa tem um lugar editável logo abaixo, também ao carregar.
  useEffect(() => {
    if (!modelo)
      return;
    const comEspaco = garantirEspacoDasSecoes(documentoRef.current, modelo);
    if (comEspaco !== documentoRef.current) {
      documentoRef.current = comEspaco;
      setDocumento(comEspaco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo, valor]);

  const desfazer = useCallback(() => {
    const anterior = historico.current.desfazer({ documento: documentoRef.current, selecao });
    if (!anterior)
      return;
    documentoRef.current = anterior.documento;
    setDocumento(anterior.documento);
    setSelecao(ajustarSelecao(anterior.documento, anterior.selecao));
    emitirDocumento(anterior.documento);
  }, [emitirDocumento, selecao]);

  const refazer = useCallback(() => {
    const proximo = historico.current.refazer({ documento: documentoRef.current, selecao });
    if (!proximo)
      return;
    documentoRef.current = proximo.documento;
    setDocumento(proximo.documento);
    setSelecao(ajustarSelecao(proximo.documento, proximo.selecao));
    emitirDocumento(proximo.documento);
  }, [emitirDocumento, selecao]);

  const alternarMarcaNaSelecao = useCallback(
    (pTipo: TipoDeMarca) => {
      if (!selecao || somenteLeitura)
        return;
      if (estaColapsada(selecao)) {
        const folha = folhaPorID(documento, selecao.foco.folha);
        const base = marcasPendentes ?? (folha ? marcasNaPosicao(folha.folha.conteudo, selecao.foco.deslocamento) : []);
        const tem = base.some((pM) => pM.tipo === pTipo);
        setMarcasPendentes(tem ? base.filter((pM) => pM.tipo !== pTipo) : [...base, { tipo: pTipo }]);
        return;
      }
      aplicar(alternarMarca(documento, selecao, { tipo: pTipo }), null);
    },
    [aplicar, documento, marcasPendentes, selecao, somenteLeitura],
  );

  // ------------------------------------------------------------------- modos

  const mudarModo = useCallback(
    (pModo: ModoDoEditor) => {
      if (pModo === modo)
        return;
      // Visual e dividido partilham o documento; só o código vive do texto.
      const eraVisual = modo !== 'codigo';
      const seraVisual = pModo !== 'codigo';
      if (eraVisual && !seraVisual)
        emitirDocumento(documentoRef.current, true);   // sai do documento: o texto passa a mandar
      else if (!eraVisual && seraVisual)
        reanalisarTexto(texto);                        // entra no documento: reanalisa o texto corrente
      setModoInterno(pModo);
      aoMudarModo?.(pModo);
      setBlocoSelecionado(null);
    },
    [aoMudarModo, emitirDocumento, modo, reanalisarTexto, texto],
  );

  // Modo controlado mudou por fora: faz a mesma conversão que a barra faria.
  const modoAnterior = useRef(modo);
  useEffect(() => {
    if (modoControlado === undefined || modoControlado === modoAnterior.current) {
      modoAnterior.current = modo;
      return;
    }
    const de = modoAnterior.current;
    modoAnterior.current = modoControlado;
    const eraVisual = de !== 'codigo';
    const seraVisual = modoControlado !== 'codigo';
    if (eraVisual && !seraVisual)
      emitirDocumento(documentoRef.current, true);
    else if (!eraVisual && seraVisual)
      reanalisarTexto(texto);
    setBlocoSelecionado(null);
  }, [emitirDocumento, modo, modoControlado, reanalisarTexto, texto]);

  const aoMudarTexto = useCallback(
    (pTexto: string) => {
      origemDaMudanca.current = 'codigo';
      setTexto(pTexto);
      ultimoEmitido.current = pTexto;
      aoMudar(pTexto);
    },
    [aoMudar],
  );

  // Modo código: reanalisa o texto com atraso só para a estrutura e a avaliação do modelo (`documentoDaPrevia`).
  // Modo dividido: o que se digita no código vira o documento do visual, com o mesmo atraso.
  const [documentoDaPrevia, setDocumentoDaPrevia] = useState<Documento>(documento);
  useEffect(() => {
    if (modo === 'visual')
      return;
    if (modo === 'dividido' && origemDaMudanca.current !== 'codigo')
      return;   // o texto veio do próprio visual: reanalisar só apagaria a seleção
    const temporizadorDaPrevia = window.setTimeout(() => {
      if (modo === 'dividido')
        reanalisarTexto(texto);
      else {
        const analise = analisarAsciiDoc(texto);
        setDocumentoDaPrevia(analise.documento);
        setAvisos(analise.avisos);
      }
    }, 200);
    return () => window.clearTimeout(temporizadorDaPrevia);
  }, [modo, texto, reanalisarTexto]);

  // ------------------------------------------------------------- comandos

  const folhaCorrente = selecao ? folhaPorID(documento, selecao.foco.folha) : undefined;
  const tabelaCorrente = folhaCorrente?.especie === 'celula' ? (blocoDaFolha(folhaCorrente) as Tabela) : null;

  /** A barra age sobre o TEXTO quando o código manda: modo código, ou dividido com o foco no código. */
  const noCodigo = modo === 'codigo' || (modo === 'dividido' && ladoAtivo === 'codigo');
  const codigoSomenteLeitura = somenteLeitura || Boolean(modelo);
  const selecaoDoCodigo = useMemo(() => ({ ini: cursorNoCodigo.ini ?? 0, fim: cursorNoCodigo.fim ?? cursorNoCodigo.ini ?? 0 }), [cursorNoCodigo]);

  const aplicarEdicao = useCallback((pEdicao: codigo.Edicao) => {
    editorDeCodigo.current?.substituir(pEdicao.ini, pEdicao.fim, pEdicao.texto, pEdicao.selecao);
  }, []);

  /** Os comandos da barra como edição de texto AsciiDoc (sem emenda com o visual — dono, 2026-10-31). */
  const executarNoCodigo = useCallback(
    (pComando: ComandoDaBarra) => {
      if (codigoSomenteLeitura)
        return;
      const sel = editorDeCodigo.current?.selecao() ?? selecaoDoCodigo;
      const t = texto;
      if (pComando.startsWith('marca:')) {
        const marca = codigo.marcaDoTipo(pComando.slice(6) as TipoDeMarca);
        if (marca)
          aplicarEdicao(codigo.alternarMarca(t, sel, marca.abre, marca.fecha));
        return;
      }
      if (pComando === 'limparMarcas') { aplicarEdicao(codigo.limparMarcas(t, sel)); return; }
      if (pComando.startsWith('bloco:')) {
        const tipo = pComando.slice(6) as TipoDeBlocoDeTexto;
        if (tipo === 'paragrafo') aplicarEdicao(codigo.definirTitulo(t, sel, 0));
        else if (tipo.startsWith('titulo')) aplicarEdicao(codigo.definirTitulo(t, sel, Number(tipo.slice(6))));
        else if (tipo === 'literal') aplicarEdicao(codigo.envolverLinhas(t, sel, ['....'], ['....']));
        else if (tipo === 'citacao') aplicarEdicao(codigo.envolverLinhas(t, sel, ['[quote]', '____'], ['____']));
        else if (tipo === 'codigo') aplicarEdicao(codigo.envolverLinhas(t, sel, ['[source]', '----'], ['----']));
        return;
      }
      if (pComando.startsWith('lista:')) { aplicarEdicao(codigo.alternarLista(t, sel, pComando.slice(6) as codigo.EstiloDeListaNoCodigo)); return; }
      if (pComando === 'recuar' || pComando === 'avancar') { aplicarEdicao(codigo.recuarItem(t, sel, pComando === 'recuar' ? 1 : -1)); return; }
      if (pComando.startsWith('inserir:admonicao:')) {
        const especie = pComando.slice(18);
        const multiplas = t.slice(sel.ini, sel.fim).includes('\n');
        if (multiplas) aplicarEdicao(codigo.envolverLinhas(t, sel, [`[${especie}]`, '===='], ['====']));
        else {
          const ini = codigo.inicioDaLinha(t, sel.ini);
          aplicarEdicao({ ini, fim: ini, texto: `${especie}: `, selecao: { ini: sel.ini + especie.length + 2, fim: sel.fim + especie.length + 2 } });
        }
        return;
      }
      switch (pComando) {
        case 'inserir:link':
        case 'inserir:imagem':
        case 'inserir:tabela':
        case 'inserir:referencia':
        case 'inserir:notaDeRodape':
        case 'inserir:atributo':
        case 'inserir:tecla':
        case 'inserir:ancora':
        case 'inserir:formula':
          setAlvoDoDialogo('codigo');
          setDialogo({ tipo: pComando.slice(8) as PedidoDeDialogo['tipo'] });
          return;
        case 'inserir:codigo': aplicarEdicao(codigo.inserirBloco(t, sel, '[source]\n----\n\n----', { ini: 14, fim: 14 })); return;
        case 'inserir:exemplo': aplicarEdicao(codigo.envolverLinhas(t, sel, ['===='], ['===='])); return;
        case 'inserir:barraLateral': aplicarEdicao(codigo.envolverLinhas(t, sel, ['****'], ['****'])); return;
        case 'inserir:citacao': aplicarEdicao(codigo.envolverLinhas(t, sel, ['[quote]', '____'], ['____'])); return;
        case 'inserir:quebraDeLinha': aplicarEdicao(codigo.inserirInline(t, { ini: sel.fim, fim: sel.fim }, ' +\n')); return;
        case 'inserir:quebraTematica': aplicarEdicao(codigo.inserirBloco(t, sel, "'''")); return;
        case 'inserir:quebraDePagina': aplicarEdicao(codigo.inserirBloco(t, sel, '<<<')); return;
        case 'inserir:sumario': aplicarEdicao(codigo.inserirBloco(t, sel, 'toc::[]')); return;
        case 'inserir:comentario': aplicarEdicao(codigo.inserirBloco(t, sel, '// ', { ini: 3, fim: 3 })); return;
        default: return;   /* tabela:* não tem edição textual segura — a barra não os mostra fora de célula */
      }
    },
    [aplicarEdicao, codigoSomenteLeitura, selecaoDoCodigo, texto],
  );

  /** Atalhos da barra dentro do textarea (Ctrl+H fica para substituir; Ctrl+F para localizar). */
  const teclasDaBarraNoCodigo = useCallback(
    (pEvento: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
      const ctrl = pEvento.ctrlKey || pEvento.metaKey;
      if (!ctrl || pEvento.altKey)
        return false;
      const k = pEvento.key.toLowerCase();
      let comando: ComandoDaBarra | null = null;
      if (!pEvento.shiftKey) {
        if (k === 'b') comando = 'marca:negrito';
        else if (k === 'i') comando = 'marca:italico';
        else if (k === 'e') comando = 'marca:mono';
        else if (k === 'u') comando = 'marca:sublinhado';
        else if (k === 'k') comando = 'inserir:link';
      } else {
        if (k === 'x') comando = 'marca:tachado';
        else if (pEvento.code === 'Digit7') comando = 'lista:numerada';
        else if (pEvento.code === 'Digit8') comando = 'lista:marcadores';
        else if (pEvento.code === 'Digit9') comando = 'lista:tarefas';
        else if (pEvento.code === 'Digit0') comando = 'bloco:paragrafo';
        else if (/^Digit[1-5]$/.test(pEvento.code)) comando = `bloco:titulo${pEvento.code.slice(5)}` as ComandoDaBarra;
      }
      if (!comando)
        return false;
      pEvento.preventDefault();
      executarNoCodigo(comando);
      return true;
    },
    [executarNoCodigo],
  );

  // Visual ativo (modo dividido): o código mostra um cursor virtual no ponto correspondente e já deixa a seleção real
  // lá (sem roubar o foco), para o próximo clique ou Tab no código cair no lugar certo.
  const cursorVirtualNoCodigo = useMemo<number | null>(
    () => (modo === 'dividido' && ladoAtivo === 'visual' && selecao ? posicaoNoCodigo(documento, texto, selecao.foco) : null),
    [documento, ladoAtivo, modo, selecao, texto],
  );
  useEffect(() => {
    if (cursorVirtualNoCodigo === null || codigoFocado)
      return;
    editorDeCodigo.current?.posicionarCursor(cursorVirtualNoCodigo, cursorVirtualNoCodigo, false);
  }, [codigoFocado, cursorVirtualNoCodigo]);

  const estadoDaBarra = useMemo<EstadoDaBarra>(() => {
    if (noCodigo)
      return codigo.estadoDaBarraDoCodigo(texto, selecaoDoCodigo);
    const marcas = new Set<TipoDeMarca>();
    if (selecao && folhaCorrente) {
      if (estaColapsada(selecao)) {
        for (const marca of marcasPendentes ?? marcasNaPosicao(folhaCorrente.folha.conteudo, selecao.foco.deslocamento))
          marcas.add(marca.tipo);
      } else
        for (const tipo of [...MARCAS_SIMPLES, 'link' as const])
          if (selecaoTemMarca(documento, selecao, tipo))
            marcas.add(tipo);
    }
    let tipoDeBloco: TipoDeBlocoDeTexto | null = null;
    let lista: EstiloDeLista | 'descricao' | null = null;
    if (folhaCorrente) {
      const bloco = blocoDaFolha(folhaCorrente);
      if (folhaCorrente.especie === 'paragrafo' && bloco.tipo === 'paragrafo')
        tipoDeBloco = bloco.estilo === 'literal' ? 'literal' : folhaCorrente.cadeia.some((pB) => pB.tipo === 'container' && pB.especie === 'citacao') ? 'citacao' : 'paragrafo';
      else if (folhaCorrente.especie === 'titulo' && bloco.tipo === 'titulo')
        tipoDeBloco = `titulo${bloco.nivel}` as TipoDeBlocoDeTexto;
      else if (folhaCorrente.especie === 'item' && bloco.tipo === 'lista') {
        tipoDeBloco = 'paragrafo';
        lista = bloco.estilo;
      } else if (folhaCorrente.especie === 'termo')
        lista = 'descricao';
    }
    const celula = folhaCorrente?.especie === 'celula' ? (folhaCorrente.item as { alinhamento?: 'esquerda' | 'centro' | 'direita' }) : undefined;
    return { marcas, tipoDeBloco, lista, emTabela: tabelaCorrente !== null, cabecalhoDaTabela: tabelaCorrente?.cabecalho ?? false, alinhamentoDaCelula: celula?.alinhamento ?? 'esquerda' };
  }, [documento, folhaCorrente, marcasPendentes, noCodigo, selecao, selecaoDoCodigo, tabelaCorrente, texto]);

  const executar = useCallback(
    (pComando: ComandoDaBarra) => {
      if (pComando === 'busca') {
        setPedidoDeBusca((pN) => pN + 1);
        return;
      }
      if (noCodigo) {
        executarNoCodigo(pComando);
        return;
      }
      if (somenteLeitura || !selecao)
        return;
      setAlvoDoDialogo('visual');
      const doc = documentoRef.current;
      if (pComando.startsWith('marca:')) {
        alternarMarcaNaSelecao(pComando.slice(6) as TipoDeMarca);
        return;
      }
      if (pComando === 'limparMarcas') {
        aplicar(limparMarcas(doc, selecao), null);
        setMarcasPendentes([]);
        return;
      }
      if (pComando.startsWith('bloco:')) {
        aplicar(definirTipoDeBloco(doc, selecao, pComando.slice(6) as TipoDeBlocoDeTexto), null);
        return;
      }
      if (pComando === 'lista:descricao') {
        const folha = folhaPorID(doc, selecao.foco.folha);
        if (!folha)
          return;
        if (folha.especie === 'termo') {
          // Volta a parágrafo: o termo vira parágrafo e a descrição o segue.
          const bloco = blocoDaFolha(folha);
          const item = folha.item as { id: string; filhos: Bloco[] };
          const resultado = substituirBloco(doc, bloco.id, (pB) => {
            const lista = pB as Bloco & { tipo: 'descricao' };
            const indice = lista.itens.findIndex((pI) => pI.id === item.id);
            const antes = lista.itens.slice(0, indice);
            const depois = lista.itens.slice(indice + 1);
            const saida: Bloco[] = [];
            if (antes.length > 0)
              saida.push({ ...lista, itens: antes });
            saida.push({ id: item.id, tipo: 'paragrafo', conteudo: folha.folha.conteudo }, ...item.filhos);
            if (depois.length > 0)
              saida.push({ ...lista, id: novoID(), itens: depois });
            return saida;
          });
          aplicar({ documento: resultado, selecao: selecaoColapsada(item.id, 0) }, null);
          return;
        }
        let base = doc;
        let alvo = folha;
        if (folha.especie === 'item') {
          const elevado = elevarItemAParagrafo(doc, folha);
          base = elevado.documento;
          const nova = elevado.selecao ? folhaPorID(base, elevado.selecao.foco.folha) : undefined;
          if (!nova)
            return;
          alvo = nova;
        }
        if (alvo.especie !== 'paragrafo' && alvo.especie !== 'titulo')
          return;
        const bloco = blocoDaFolha(alvo);
        const descricao = paragrafoVazio();
        const resultado = substituirBloco(base, bloco.id, () => ({ id: novoID(), tipo: 'descricao', itens: [{ id: alvo.folha.id, conteudo: alvo.folha.conteudo, filhos: [descricao] }] }));
        aplicar({ documento: resultado, selecao: selecaoColapsada(descricao.id, 0) }, null);
        return;
      }
      if (pComando.startsWith('lista:')) {
        aplicar(alternarLista(doc, selecao, pComando.slice(6) as EstiloDeLista), null);
        return;
      }
      if (pComando === 'recuar' || pComando === 'avancar') {
        const folha = folhaPorID(doc, selecao.foco.folha);
        if (folha)
          aplicar(recuarItem(doc, folha, pComando === 'recuar' ? 1 : -1), null);
        return;
      }
      if (pComando.startsWith('inserir:admonicao:')) {
        aplicar(embrulharEmContainer(doc, selecao, { tipo: 'admonicao', especie: pComando.slice(18) as EspecieDeAdmonicao }), null);
        return;
      }
      switch (pComando) {
        case 'inserir:link':
        case 'inserir:imagem':
        case 'inserir:tabela':
        case 'inserir:referencia':
        case 'inserir:notaDeRodape':
        case 'inserir:atributo':
        case 'inserir:tecla':
        case 'inserir:ancora':
        case 'inserir:formula':
          setDialogo({ tipo: pComando.slice(8) as PedidoDeDialogo['tipo'] });
          return;
        case 'inserir:codigo':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'codigo', estilo: 'fonte', codigo: '' }]), null);
          return;
        case 'inserir:exemplo':
          aplicar(embrulharEmContainer(doc, selecao, { tipo: 'container', especie: 'exemplo' }), null);
          return;
        case 'inserir:barraLateral':
          aplicar(embrulharEmContainer(doc, selecao, { tipo: 'container', especie: 'barraLateral' }), null);
          return;
        case 'inserir:citacao':
          aplicar(embrulharEmContainer(doc, selecao, { tipo: 'container', especie: 'citacao' }), null);
          return;
        case 'inserir:quebraDeLinha':
          aplicar(inserirAtomo(doc, selecao, atomo('quebraDeLinha')), null);
          return;
        case 'inserir:quebraTematica':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'quebraTematica' }, paragrafoVazio()]), null);
          return;
        case 'inserir:quebraDePagina':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'quebraDePagina' }, paragrafoVazio()]), null);
          return;
        case 'inserir:sumario':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'sumario' }, paragrafoVazio()]), null);
          return;
        case 'inserir:comentario':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'comentario', texto: '', emBloco: false }, paragrafoVazio()]), null);
          return;
        default:
          break;
      }
      if (pComando.startsWith('tabela:') && tabelaCorrente && folhaCorrente) {
        const linha = tabelaCorrente.linhas.findIndex((pL) => pL.celulas.some((pC) => pC.id === folhaCorrente.folha.id));
        const coluna = tabelaCorrente.linhas[linha]?.celulas.findIndex((pC) => pC.id === folhaCorrente.folha.id) ?? 0;
        switch (pComando) {
          case 'tabela:linhaAntes':
            aplicar(inserirLinhaNaTabela(doc, tabelaCorrente.id, linha), null);
            return;
          case 'tabela:linhaDepois':
            aplicar(inserirLinhaNaTabela(doc, tabelaCorrente.id, linha + 1), null);
            return;
          case 'tabela:colunaAntes':
            aplicar({ ...inserirColunaNaTabela(doc, tabelaCorrente.id, coluna), selecao }, null);
            return;
          case 'tabela:colunaDepois':
            aplicar({ ...inserirColunaNaTabela(doc, tabelaCorrente.id, coluna + 1), selecao }, null);
            return;
          case 'tabela:removerLinha':
            aplicar(removerLinhaDaTabela(doc, tabelaCorrente.id, linha), null);
            return;
          case 'tabela:removerColuna':
            aplicar(removerColunaDaTabela(doc, tabelaCorrente.id, coluna), null);
            return;
          case 'tabela:cabecalho':
            aplicar({ documento: substituirBloco(doc, tabelaCorrente.id, (pB) => ({ ...(pB as Tabela), cabecalho: !(pB as Tabela).cabecalho })), selecao }, null);
            return;
          case 'tabela:alinharEsquerda':
            aplicar({ documento: alinharColunaDaTabela(doc, tabelaCorrente.id, coluna, undefined), selecao }, null);
            return;
          case 'tabela:alinharCentro':
            aplicar({ documento: alinharColunaDaTabela(doc, tabelaCorrente.id, coluna, 'centro'), selecao }, null);
            return;
          case 'tabela:alinharDireita':
            aplicar({ documento: alinharColunaDaTabela(doc, tabelaCorrente.id, coluna, 'direita'), selecao }, null);
            return;
          case 'tabela:remover':
            aplicar({ documento: removerBloco(doc, tabelaCorrente.id), selecao: null }, null);
            return;
          default:
            return;
        }
      }
    },
    [alternarMarcaNaSelecao, aplicar, executarNoCodigo, folhaCorrente, noCodigo, selecao, somenteLeitura, tabelaCorrente],
  );

  // ------------------------------------------------------------------ divisor

  const definirProporcao = useCallback(
    (pProporcao: number) => {
      const limitada = Math.min(1 - PROPORCAO_MINIMA, Math.max(PROPORCAO_MINIMA, pProporcao));
      setProporcao(limitada);
      armazenamento.gravar(CHAVE_DA_PROPORCAO, String(limitada));
    },
    [armazenamento],
  );

  /** Arrasto com Pointer Events: captura o ponteiro no divisor, para o gesto continuar fora dele. */
  const iniciarArrasto = useCallback(
    (pEvento: PointerEventDoReact<HTMLDivElement>) => {
      if (pEvento.button !== 0)
        return;
      pEvento.preventDefault();
      const alvo = pEvento.currentTarget;
      alvo.setPointerCapture(pEvento.pointerId);
      setArrastando(true);
      const mover = (pMovimento: PointerEvent): void => {
        const caixa = corpo.current?.getBoundingClientRect();
        if (!caixa || caixa.width === 0)
          return;
        const esquerda = caixa.left + (estruturaAberta ? LARGURA_DA_ESTRUTURA : 0);
        definirProporcao((pMovimento.clientX - esquerda) / (caixa.right - esquerda));
      };
      const soltar = (): void => {
        setArrastando(false);
        alvo.removeEventListener('pointermove', mover);
        alvo.removeEventListener('pointerup', soltar);
        alvo.removeEventListener('pointercancel', soltar);
      };
      alvo.addEventListener('pointermove', mover);
      alvo.addEventListener('pointerup', soltar);
      alvo.addEventListener('pointercancel', soltar);
    },
    [definirProporcao, estruturaAberta],
  );

  // ----------------------------------------------------------------- estrutura

  const titulos = useMemo(() => titulosDoDocumento(modo === 'codigo' ? documentoDaPrevia.blocos : documento.blocos, te.semTexto), [documento, documentoDaPrevia, modo, te.semTexto]);

  const irParaTitulo = useCallback(
    (pTitulo: Titulo) => {
      if (modo !== 'codigo')
        setSelecao(selecaoColapsada(pTitulo.id, 0));
      if (modo === 'visual')
        return;
      const linhas = texto.split('\n');
      const indice = linhas.findIndex((pL) => /^(={2,6}|#{1,6})\s+/.test(pL) && pL.replace(/^(={2,6}|#{1,6})\s+/, '').replace(/\s+=+$/, '').trim() === pTitulo.texto);
      if (indice !== -1)
        setIrParaLinha({ linha: indice + 1, n: Date.now() });
    },
    [modo, texto],
  );

  // ------------------------------------------------------------------- handle

  useImperativeHandle(
    ref,
    () => ({
      executar,
      desfazer,
      refazer,
      mudarModo,
      alternarEstrutura,
      irParaLinha: (pLinha: number) => {
        if (modo !== 'codigo') {
          const bloco = blocoDaLinha(documentoRef.current.blocos, pLinha);
          if (bloco) {
            setBlocoSelecionado(bloco.id);
            if ('conteudo' in bloco)
              setSelecao(selecaoColapsada(bloco.id, 0));
          }
        }
        if (modo !== 'visual')
          setIrParaLinha({ linha: pLinha, n: Date.now() });
      },
    }),
    [alternarEstrutura, desfazer, executar, modo, mudarModo, refazer],
  );

  // ---------------------------------------------------------- cursor virtual

  // Modo dividido com o código ativo: a vista aponta onde o cursor do código está (e rola até lá).
  const cursorVirtual = useMemo<CursorVirtual | null>(
    () => (modo === 'dividido' && ladoAtivo === 'codigo' ? cursorVirtualDoCodigo(documento.blocos, texto, cursorNoCodigo.linha, cursorNoCodigo.coluna) : null),
    [cursorNoCodigo, documento, ladoAtivo, modo, texto],
  );

  // ------------------------------------------------------------------ status

  const textoCorrente = modo === 'visual' ? textoDoDocumento(documento) : texto;
  const palavras = useMemo(() => contarPalavras(textoCorrente), [textoCorrente]);
  const caracteres = textoCorrente.length;
  const blocos = useMemo(() => contarBlocos((modo === 'codigo' ? documentoDaPrevia : documento).blocos), [documento, documentoDaPrevia, modo]);
  const linhas = useMemo(() => (modo === 'visual' ? 0 : texto.split('\n').length), [modo, texto]);

  const documentoAvaliado = modo === 'codigo' ? documentoDaPrevia : documento;
  const avaliacao = useMemo(() => (modelo ? avaliarModelo(documentoAvaliado, modelo) : null), [documentoAvaliado, modelo]);
  const folhasTravadas = useMemo(() => (modelo ? secoesTravadas(documento, modelo) : undefined), [documento, modelo]);
  const explicacao = modelo && avaliacao ? <XExplicacaoDoModelo modelo={modelo} avaliacao={avaliacao} /> : null;
  const pendencias = avaliacao ? [...avaliacao.faltantes.map((pS) => f(te.falta, pS.titulo)), ...avaliacao.vazias.map((pS) => f(te.semTextoNaSecao, pS.titulo)), ...avaliacao.foraDeOrdem.map((pS) => f(te.foraDaOrdem, pS.titulo))] : [];

  const estilo = altura === 'preencher' ? undefined : { height: altura };
  const rotuloDoModo = modo === 'visual' ? te.visual : modo === 'codigo' ? te.codigo : te.dividido;

  return (
    <ContextoDeTextos.Provider value={textos}>
      <div className={`adc-editor ${className}`.trim()} style={estilo} aria-label={rotuloAcessivel ?? te.rotulo}>
        <XBarraDoEditor
          modo={modo}
          aoMudarModo={mudarModo}
          podeDesfazer={noCodigo ? !codigoSomenteLeitura : historico.current.podeDesfazer}
          podeRefazer={noCodigo ? !codigoSomenteLeitura : historico.current.podeRefazer}
          aoDesfazer={noCodigo ? () => editorDeCodigo.current?.desfazer() : desfazer}
          aoRefazer={noCodigo ? () => editorDeCodigo.current?.refazer() : refazer}
          estado={estadoDaBarra}
          aoComando={executar}
          somenteLeitura={noCodigo ? codigoSomenteLeitura : somenteLeitura}
          estruturaAberta={estruturaAberta}
          aoAlternarEstrutura={alternarEstrutura}
          formatacaoAtiva={noCodigo ? !codigoSomenteLeitura : selecao !== null}
        />
        <div ref={corpo} className={`adc-editor-corpo${arrastando ? ' adc-editor-corpo-arrastando' : ''}`}>
          {estruturaAberta && (
            <nav className="adc-estrutura" aria-label={te.estruturaDoDocumento}>
              <div className="adc-estrutura-titulo">{te.estrutura}</div>
              {titulos.length === 0 && <div className="adc-estrutura-vazia">{te.semTitulos}</div>}
              {titulos.map((pTitulo) => (
                <button key={pTitulo.id} type="button" className="adc-estrutura-item" style={{ paddingLeft: `${0.75 + (pTitulo.nivel - 1) * 0.75}rem` }} onClick={() => irParaTitulo(pTitulo)}>
                  {pTitulo.texto}
                </button>
              ))}
            </nav>
          )}
          {(modo === 'codigo' || modo === 'dividido') && (
            <div className="adc-editor-painel" style={modo === 'dividido' ? { flex: `0 0 calc(${(proporcao * 100).toFixed(2)}% - ${estruturaAberta ? LARGURA_DA_ESTRUTURA * proporcao : 0}px)` } : undefined}>
              {modo === 'codigo' && explicacao && <div className="adc-modelo-no-codigo">{explicacao}</div>}
              <XEditorDeCodigo
                ref={editorDeCodigo}
                valor={texto}
                aoMudar={aoMudarTexto}
                aoTeclar={teclasDaBarraNoCodigo}
                linguagem="asciidoc"
                somenteLeitura={codigoSomenteLeitura}
                altura="preencher"
                rotuloAcessivel={te.codigoDoDocumento}
                aoMoverCursor={setCursorNoCodigo}
                aoFocar={() => {
                  setCodigoFocado(true);
                  setLadoAtivo('codigo');
                }}
                aoDesfocar={() => setCodigoFocado(false)}
                cursorVirtual={modo === 'dividido' ? cursorVirtualNoCodigo : null}
                pedidoDeBusca={pedidoDeBusca}
                irParaLinha={irParaLinha}
                className="adc-editor-codigo"
              />
            </div>
          )}
          {modo === 'dividido' && (
            <div
              className="adc-divisor"
              role="separator"
              aria-orientation="vertical"
              aria-label={te.divisorRotulo}
              aria-valuemin={Math.round(PROPORCAO_MINIMA * 100)}
              aria-valuemax={Math.round((1 - PROPORCAO_MINIMA) * 100)}
              aria-valuenow={Math.round(proporcao * 100)}
              tabIndex={0}
              title={te.divisorDica}
              onPointerDown={iniciarArrasto}
              onDoubleClick={() => definirProporcao(0.5)}
              onKeyDown={(pE) => {
                if (pE.key === 'ArrowLeft')
                  definirProporcao(proporcao - PASSO_DO_TECLADO);
                else if (pE.key === 'ArrowRight')
                  definirProporcao(proporcao + PASSO_DO_TECLADO);
                else if (pE.key === 'Home')
                  definirProporcao(PROPORCAO_MINIMA);
                else if (pE.key === 'End')
                  definirProporcao(1 - PROPORCAO_MINIMA);
                else
                  return;
                pE.preventDefault();
              }}
            >
              <span className="adc-divisor-alca" aria-hidden="true" />
            </div>
          )}
          {(modo === 'visual' || modo === 'dividido') && (
            <div className="adc-editor-painel">
              <div className="adc-rolagem">
                {explicacao && <div className="adc-modelo-no-documento">{explicacao}</div>}
                {/* visual e dividido: o MESMO documento, editável nos dois */}
                <XVistaWYSIWYG
                  documento={documento}
                  selecao={selecao}
                  somenteLeitura={somenteLeitura}
                  marcasPendentes={marcasPendentes}
                  aoAplicar={aplicar}
                  aoMudarSelecao={(pSel) => {
                    setSelecao(pSel);
                    setMarcasPendentes(null);
                    if (pSel && !codigoFocado)
                      setLadoAtivo('visual');
                  }}
                  aoDesfazer={desfazer}
                  aoRefazer={refazer}
                  aoAlternarMarca={alternarMarcaNaSelecao}
                  aoPedirDialogo={setDialogo}
                  blocoSelecionado={blocoSelecionado}
                  aoSelecionarBloco={setBlocoSelecionado}
                  folhasTravadas={folhasTravadas}
                  resolverRecurso={resolverRecurso}
                  aoAcionarReferencia={aoAcionarReferencia}
                  cursorVirtual={cursorVirtual}
                />
              </div>
            </div>
          )}
          {dialogo && (alvoDoDialogo === 'codigo' || modo !== 'codigo') && (
            <XDialogoDoEditor
              pedido={dialogo}
              documento={documento}
              selecao={selecao}
              aoFechar={() => {
                setDialogo(null);
                if (alvoDoDialogo === 'codigo')
                  editorDeCodigo.current?.focar();
              }}
              aoAplicar={(pResultado) => aplicar(pResultado, null)}
              aoInserirTexto={
                alvoDoDialogo === 'codigo'
                  ? (pTexto, pEmBloco) => {
                      const sel = editorDeCodigo.current?.selecao() ?? selecaoDoCodigo;
                      aplicarEdicao(pEmBloco ? codigo.inserirBloco(texto, sel, pTexto) : codigo.inserirInline(texto, sel, pTexto));
                    }
                  : undefined
              }
              textoInicial={alvoDoDialogo === 'codigo' ? texto.slice(selecaoDoCodigo.ini, selecaoDoCodigo.fim) : undefined}
            />
          )}
        </div>
        <div className="adc-status" role="status">
          <span>{rotuloDoModo}</span>
          <span>{f(te.palavras, palavras)}</span>
          <span>{f(te.caracteres, caracteres)}</span>
          <span>{f(te.blocos, blocos)}</span>
          {modo !== 'visual' && <span>{f(te.linhaColuna, cursorNoCodigo.linha, cursorNoCodigo.coluna, linhas)}</span>}
          {recusaDoModelo && (
            <span className="adc-status-recusa" role="alert">
              {recusaDoModelo}
            </span>
          )}
          {modelo && modo !== 'visual' && <span>{te.codigoSomenteLeituraModelo}</span>}
          {modelo && avaliacao && !recusaDoModelo && (
            <span className={avaliacao.completo ? 'adc-status-ok' : 'adc-status-aviso'} title={pendencias.join('\n')}>
              {avaliacao.completo ? f(te.modeloCompleto, modelo.rotulo) : f(te.modeloPendencias, modelo.rotulo, pendencias.length === 1 ? pendencias[0] : f(te.pendenciasN, pendencias.length, pendencias[0]))}
            </span>
          )}
          {avisos.length > 0 && (
            <span className="adc-status-aviso" title={avisos.map((pA) => f(te.linhaN, pA.linha, pA.texto)).join('\n')}>
              {avisos.length === 1 ? f(te.avisoNaLinha, avisos[0].linha, avisos[0].texto) : f(te.avisosDoParser, avisos.length, avisos[0].linha, avisos[0].texto)}
            </span>
          )}
          {somenteLeitura && <span>{te.somenteLeitura}</span>}
        </div>
      </div>
    </ContextoDeTextos.Provider>
  );
}
