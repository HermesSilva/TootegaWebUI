/**
 * XVistaWYSIWYG — a vista visual do documento: UM `contenteditable` para o documento inteiro, com a edição
 * interceptada em `beforeinput` e transformada em transações sobre o modelo (técnica do ProseMirror/Lexical).
 *
 * O navegador dá cursor, seleção, teclado, IME e leitor de tela; nós decidimos o que cada entrada significa. A
 * composição (IME) e o que chega sem intenção declarada são lidos DE VOLTA do DOM da folha (`lerConteudoDoDOM`), e
 * a folha remonta com chave nova para o React voltar a ser dono do DOM.
 *
 * Controlada: recebe `documento` e `selecao`, devolve transações por `aoAplicar`; quem guarda estado e histórico é
 * o `XEditorAsciiDoc`.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type JSX, type KeyboardEvent } from 'react';
import { analisarInline } from '../parser/inline';
import { analisarAsciiDoc } from '../parser/blocos';
import { serializarDocumento, serializarInline } from '../serializador/serializar';
import { atributoDoCabecalho, comprimentoInline, fatiarInline, folhaPorID, folhasDoDocumento, textoPuro } from '../modelo/documento';
import type { Bloco, Documento, Lista, Marca, TipoDeMarca } from '../modelo/tipos';
import type { SecaoDoModelo } from '../modelo/modeloDeDocumento';
import { estaColapsada, ordenarSelecao, posicao, selecaoColapsada, selecoesIguais, type Selecao } from '../editor/selecao';
import {
  alternarLista,
  alternarTarefa,
  apagarIntervalo,
  apagarParaFrente,
  apagarParaTras,
  atomoNaPosicao,
  atualizarBloco,
  colarBlocos,
  definirTipoDeBloco,
  dividirBloco,
  inserirAtomo,
  inserirTexto,
  recuarItem,
  removerBloco,
  substituirConteudo,
  type Resultado,
} from '../editor/transacoes';
import { atomo } from '../modelo/documento';
import { ContextoDaVista, type AcionadorDeReferencia, type AcoesDaVista, type ResolvedorDeRecurso } from './contexto';
import { RenderizarBloco } from './blocos';
import { useTextos } from '../textos';
import { deslocamentoNoDOM, elementoDaFolha, elementoDaFolhaPorID, lerConteudoDoDOM, pontoDoModelo } from './mapeamentoDOM';

// ============================================================================
// Tipos
// ============================================================================

export type PedidoDeDialogo = { tipo: 'link' | 'imagem' | 'tabela' | 'referencia' | 'notaDeRodape' | 'atributo' | 'tecla' | 'ancora' | 'formula'; blocoID?: string };

/**
 * Cursor VIRTUAL (modo dividido, 2026-10-31): onde o cursor do código cai no documento. Com `folha` e `deslocamento`
 * a vista desenha um cursor fantasma na posição; só com `bloco`, destaca o bloco. Nunca mexe na seleção real — o foco
 * continua no código.
 */
export type CursorVirtual = { bloco: string; folha?: string; deslocamento?: number };

export interface XVistaWYSIWYGProps {
  documento: Documento;
  selecao: Selecao | null;
  somenteLeitura?: boolean;
  /** Marcas a aplicar ao próximo texto digitado (ligadas com a seleção colapsada). */
  marcasPendentes: Marca[] | null;
  aoAplicar: (pResultado: Resultado, pGrupo: string | null) => void;
  aoMudarSelecao: (pSelecao: Selecao | null) => void;
  aoDesfazer: () => void;
  aoRefazer: () => void;
  aoAlternarMarca: (pTipo: TipoDeMarca) => void;
  aoPedirDialogo: (pPedido: PedidoDeDialogo) => void;
  blocoSelecionado: string | null;
  aoSelecionarBloco: (pID: string | null) => void;
  /** Folhas fixas do modelo de documento (id do título → a seção), que não se editam. */
  folhasTravadas?: ReadonlyMap<string, SecaoDoModelo>;
  className?: string;
  /** Converte o alvo de imagem/mídia no endereço que o navegador carrega (padrão: o alvo como está). */
  resolverRecurso?: ResolvedorDeRecurso;
  /** Abre include, referência ou link quando o usuário pede (botão do include, Ctrl+clique). */
  aoAcionarReferencia?: AcionadorDeReferencia;
  /** Posição do cursor do código a espelhar na vista (modo dividido); `null` apaga. */
  cursorVirtual?: CursorVirtual | null;
}

const MARCA_DO_ATALHO: Record<string, TipoDeMarca> = { b: 'negrito', i: 'italico', e: 'mono', h: 'realce', u: 'sublinhado' };

// ============================================================================
// Cabeçalho (ilha)
// ============================================================================

type Atributos = { nome: string; valor: string }[];

function textoDosAtributos(pAtributos: Atributos): string {
  return pAtributos.map((pA) => `:${pA.nome}:${pA.valor === '' ? '' : ` ${pA.valor}`}`).join('\n');
}

/** Só as linhas completas (`:nome: valor`) entram no modelo; o que está sendo digitado fica no texto local. */
function atributosDoTexto(pTexto: string): Atributos {
  const lidos: Atributos = [];
  for (const linha of pTexto.split('\n')) {
    const m = /^:([A-Za-z0-9_][A-Za-z0-9_-]*!?):\s*(.*)$/.exec(linha);
    if (m)
      lidos.push({ nome: m[1], valor: m[2] });
  }
  return lidos;
}

/**
 * O campo de atributos tem TEXTO PRÓPRIO: um controle controlado pelo modelo reescrevia o texto a cada tecla, e
 * `:` sozinho ou uma linha nova sumiam antes de o autor terminar (defeito observado em 2026-10-28). O texto local
 * só é substituído quando os atributos do modelo mudam por fora (outro modo, desfazer, valor novo).
 */
function CampoDeAtributos({ atributos, somenteLeitura, aoMudar }: { atributos: Atributos; somenteLeitura: boolean; aoMudar: (pAtributos: Atributos) => void }): JSX.Element {
  const tv = useTextos().vista;
  const doModelo = textoDosAtributos(atributos);
  const [texto, setTexto] = useState(doModelo);
  const ultimoEmitido = useRef(doModelo);
  useEffect(() => {
    if (doModelo !== ultimoEmitido.current) {
      ultimoEmitido.current = doModelo;
      setTexto(doModelo);
    }
  }, [doModelo]);
  return (
    <textarea
      className="adc-cabecalho-atributos"
      value={texto}
      placeholder={tv.atributosPlaceholder}
      aria-label={tv.atributosRotulo}
      rows={Math.max(2, Math.min(12, texto.split('\n').length + 1))}
      readOnly={somenteLeitura}
      spellCheck={false}
      onChange={(pE) => {
        setTexto(pE.target.value);
        const lidos = atributosDoTexto(pE.target.value);
        ultimoEmitido.current = textoDosAtributos(lidos);
        aoMudar(lidos);
      }}
    />
  );
}

function CabecalhoDoDocumento({ documento, somenteLeitura, aoMudar }: { documento: Documento; somenteLeitura: boolean; aoMudar: (pDocumento: Documento) => void }): JSX.Element | null {
  const tv = useTextos().vista;
  const cabecalho = documento.cabecalho;
  if (!cabecalho)
    return null;
  const mudar = (pParte: Partial<NonNullable<Documento['cabecalho']>>): void => aoMudar({ ...documento, cabecalho: { ...cabecalho, ...pParte } });
  return (
    <header className="adc-cabecalho" data-ilha="" data-linha={1} contentEditable={false}>
      <input className="adc-cabecalho-titulo" value={textoPuro(cabecalho.titulo ?? [])} placeholder={tv.tituloDoDocumento} aria-label={tv.tituloDoDocumento} readOnly={somenteLeitura} onChange={(pE) => mudar({ titulo: analisarInline(pE.target.value) })} />
      <div className="adc-cabecalho-linha">
        <input className="adc-cabecalho-campo" value={cabecalho.autores ?? ''} placeholder={tv.autores} aria-label={tv.autores} readOnly={somenteLeitura} onChange={(pE) => mudar({ autores: pE.target.value || undefined })} />
        <input className="adc-cabecalho-campo" value={cabecalho.revisao ?? ''} placeholder={tv.revisaoPlaceholder} aria-label={tv.revisao} readOnly={somenteLeitura} onChange={(pE) => mudar({ revisao: pE.target.value || undefined })} />
      </div>
      <CampoDeAtributos atributos={cabecalho.atributos} somenteLeitura={somenteLeitura} aoMudar={(pAtributos) => mudar({ atributos: pAtributos })} />
    </header>
  );
}

// ============================================================================
// A vista
// ============================================================================

export function XVistaWYSIWYG({
  documento,
  selecao,
  somenteLeitura = false,
  marcasPendentes,
  aoAplicar,
  aoMudarSelecao,
  aoDesfazer,
  aoRefazer,
  aoAlternarMarca,
  aoPedirDialogo,
  blocoSelecionado,
  aoSelecionarBloco,
  folhasTravadas,
  className = '',
  resolverRecurso,
  aoAcionarReferencia,
  cursorVirtual = null,
}: XVistaWYSIWYGProps): JSX.Element {
  const marcadorCursor = useRef<HTMLDivElement>(null);
  const envolucro = useRef<HTMLDivElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const compondo = useRef(false);
  const ultimaSelecaoDoDOM = useRef<Selecao | null>(null);
  const versoes = useRef(new Map<string, number>());
  const [, forcarRender] = useState(0);

  // As props mais recentes, para os ouvintes nativos (registrados uma vez).
  const atual = useRef({ documento, selecao, somenteLeitura, marcasPendentes, aoAplicar, aoMudarSelecao, aoDesfazer, aoRefazer, aoAlternarMarca, aoPedirDialogo, blocoSelecionado, aoSelecionarBloco });
  atual.current = { documento, selecao, somenteLeitura, marcasPendentes, aoAplicar, aoMudarSelecao, aoDesfazer, aoRefazer, aoAlternarMarca, aoPedirDialogo, blocoSelecionado, aoSelecionarBloco };

  // ----------------------------------------------------------------- seleção

  const lerSelecaoDoDOM = useCallback((): Selecao | null => {
    const r = raiz.current;
    const sel = window.getSelection();
    if (!r || !sel || sel.rangeCount === 0)
      return null;
    if (!r.contains(sel.anchorNode) || !r.contains(sel.focusNode))
      return null;
    if ((sel.anchorNode as HTMLElement | Text).parentElement?.closest('[data-ilha]') && (sel.anchorNode?.nodeType !== Node.ELEMENT_NODE || (sel.anchorNode as HTMLElement).closest('[data-ilha]')))
      return null;
    const folhaA = elementoDaFolha(sel.anchorNode);
    const folhaF = elementoDaFolha(sel.focusNode);
    if (!folhaA || !folhaF)
      return null;
    return {
      ancora: posicao(folhaA.getAttribute('data-folha') as string, deslocamentoNoDOM(folhaA, sel.anchorNode as Node, sel.anchorOffset)),
      foco: posicao(folhaF.getAttribute('data-folha') as string, deslocamentoNoDOM(folhaF, sel.focusNode as Node, sel.focusOffset)),
    };
  }, []);

  const pontoDoDOMDe = useCallback((pFolha: string, pDeslocamento: number) => {
    const r = raiz.current;
    if (!r)
      return null;
    const elemento = elementoDaFolhaPorID(r, pFolha);
    return elemento ? pontoDoModelo(elemento, pDeslocamento) : null;
  }, []);

  /** Leva a seleção do modelo ao DOM (depois de cada transação). */
  useLayoutEffect(() => {
    if (!selecao || !raiz.current)
      return;
    // Foco numa ILHA (cabeçalho, bloco de código, bloco bruto): a transação veio de lá, e a seleção do modelo é
    // só memória. Levá-la ao DOM roubaria o foco da ilha a cada tecla (defeito observado em 2026-10-28).
    const ativo = document.activeElement as HTMLElement | null;
    if (ativo && ativo !== raiz.current && ativo.closest('[data-ilha]'))
      return;
    const noDOM = lerSelecaoDoDOM();
    if (selecoesIguais(noDOM, selecao)) {
      ultimaSelecaoDoDOM.current = selecao;
      return;
    }
    const a = pontoDoDOMDe(selecao.ancora.folha, selecao.ancora.deslocamento);
    const f = pontoDoDOMDe(selecao.foco.folha, selecao.foco.deslocamento);
    if (!a || !f)
      return;
    const sel = window.getSelection();
    if (!sel)
      return;
    try {
      sel.setBaseAndExtent(a.no, a.deslocamento, f.no, f.deslocamento);
    } catch {
      return;
    }
    ultimaSelecaoDoDOM.current = selecao;
    if (document.activeElement !== raiz.current && !raiz.current.contains(document.activeElement))
      raiz.current.focus({ preventScroll: true });
    // Rola até o cursor quando ele saiu da vista.
    const folha = elementoDaFolhaPorID(raiz.current, selecao.foco.folha);
    if (folha) {
      const caixa = folha.getBoundingClientRect();
      const moldura = raiz.current.closest('.adc-rolagem') ?? raiz.current.parentElement;
      if (moldura) {
        const limite = moldura.getBoundingClientRect();
        if (caixa.bottom > limite.bottom || caixa.top < limite.top)
          folha.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [documento, selecao, lerSelecaoDoDOM, pontoDoDOMDe]);

  /** Cursor virtual: um traço na posição que o código aponta, e o bloco destacado; rola até lá quando sai da vista. */
  useLayoutEffect(() => {
    const r = raiz.current;
    const marcador = marcadorCursor.current;
    const env = envolucro.current;
    if (!r || !marcador || !env)
      return;
    for (const el of r.querySelectorAll('.adc-bloco-cursor-virtual'))
      el.classList.remove('adc-bloco-cursor-virtual');
    if (!cursorVirtual) {
      marcador.style.display = 'none';
      return;
    }
    const alvo = (cursorVirtual.folha ? elementoDaFolhaPorID(r, cursorVirtual.folha) : null) ?? (r.querySelector(`[data-bloco="${cursorVirtual.bloco}"]`) as HTMLElement | null) ?? elementoDaFolhaPorID(r, cursorVirtual.bloco);
    if (!alvo) {
      marcador.style.display = 'none';
      return;
    }
    alvo.classList.add('adc-bloco-cursor-virtual');
    let caixa: DOMRect | null = null;
    if (cursorVirtual.folha && cursorVirtual.deslocamento !== undefined && alvo.hasAttribute('data-folha')) {
      const ponto = pontoDoModelo(alvo, cursorVirtual.deslocamento);
      try {
        const intervalo = document.createRange();
        intervalo.setStart(ponto.no, ponto.deslocamento);
        intervalo.collapse(true);
        const rects = intervalo.getClientRects();
        caixa = rects.length > 0 ? rects[0] : intervalo.getBoundingClientRect();
        if (caixa.height === 0)
          caixa = null;
      } catch {
        caixa = null;
      }
    }
    const base = env.getBoundingClientRect();
    if (caixa) {
      marcador.style.display = 'block';
      marcador.style.top = `${caixa.top - base.top}px`;
      marcador.style.left = `${caixa.left - base.left}px`;
      marcador.style.height = `${caixa.height}px`;
    } else
      marcador.style.display = 'none';
    const moldura = r.closest('.adc-rolagem') ?? r.parentElement;
    if (moldura) {
      const limite = moldura.getBoundingClientRect();
      const ref = caixa ?? alvo.getBoundingClientRect();
      if (ref.bottom > limite.bottom || ref.top < limite.top)
        (caixa ? alvo : alvo).scrollIntoView({ block: 'center' });
    }
  }, [cursorVirtual, documento]);

  useEffect(() => {
    const aoMudarSelecaoNoDOM = (): void => {
      if (compondo.current)
        return;
      const r = raiz.current;
      if (!r)
        return;
      const sel = window.getSelection();
      if (!sel || !r.contains(sel.anchorNode))
        return;
      const lida = lerSelecaoDoDOM();
      if (lida === null)
        return;
      if (selecoesIguais(lida, ultimaSelecaoDoDOM.current))
        return;
      ultimaSelecaoDoDOM.current = lida;
      atual.current.aoMudarSelecao(lida);
      if (atual.current.blocoSelecionado !== null)
        atual.current.aoSelecionarBloco(null);
    };
    document.addEventListener('selectionchange', aoMudarSelecaoNoDOM);
    return () => document.removeEventListener('selectionchange', aoMudarSelecaoNoDOM);
  }, [lerSelecaoDoDOM]);

  // ------------------------------------------------------------- transações

  const selecaoCorrente = useCallback((): Selecao | null => {
    return lerSelecaoDoDOM() ?? atual.current.selecao;
  }, [lerSelecaoDoDOM]);

  const aplicar = useCallback((pResultado: Resultado, pGrupo: string | null): void => {
    atual.current.aoAplicar(pResultado, pGrupo);
  }, []);

  /** Relê a folha do DOM depois de uma mutação que o navegador fez por conta própria. */
  const relerFolhaDoDOM = useCallback((): void => {
    const r = raiz.current;
    const sel = window.getSelection();
    if (!r || !sel || !r.contains(sel.anchorNode))
      return;
    const elemento = elementoDaFolha(sel.anchorNode);
    if (!elemento)
      return;
    const id = elemento.getAttribute('data-folha') as string;
    const folha = folhaPorID(atual.current.documento, id);
    if (!folha)
      return;
    const conteudo = lerConteudoDoDOM(elemento, folha.folha.conteudo);
    const deslocamento = deslocamentoNoDOM(elemento, sel.focusNode as Node, sel.focusOffset);
    versoes.current.set(id, (versoes.current.get(id) ?? 0) + 1);
    aplicar(substituirConteudo(atual.current.documento, id, conteudo, deslocamento), 'digitar');
    forcarRender((pN) => pN + 1);
  }, [aplicar]);

  const selecaoDoIntervalo = useCallback((pIntervalo: StaticRange | Range): Selecao | null => {
    const folhaA = elementoDaFolha(pIntervalo.startContainer);
    const folhaF = elementoDaFolha(pIntervalo.endContainer);
    if (!folhaA || !folhaF)
      return null;
    return {
      ancora: posicao(folhaA.getAttribute('data-folha') as string, deslocamentoNoDOM(folhaA, pIntervalo.startContainer, pIntervalo.startOffset)),
      foco: posicao(folhaF.getAttribute('data-folha') as string, deslocamentoNoDOM(folhaF, pIntervalo.endContainer, pIntervalo.endOffset)),
    };
  }, []);

  // --------------------------------------------------------------- beforeinput

  useEffect(() => {
    const r = raiz.current;
    if (!r)
      return;
    const aoAntesDeEntrar = (pEvento: Event): void => {
      const e = pEvento as InputEvent;
      if ((e.target as HTMLElement | null)?.closest?.('[data-ilha]'))
        return;
      const { documento: doc, somenteLeitura: leitura, marcasPendentes: pendentes } = atual.current;
      if (leitura) {
        e.preventDefault();
        return;
      }
      const tipo = e.inputType;
      if (tipo === 'insertCompositionText' || compondo.current)
        return;
      const intervalo = typeof e.getTargetRanges === 'function' ? e.getTargetRanges()[0] : undefined;
      const sel = (intervalo ? selecaoDoIntervalo(intervalo) : null) ?? selecaoCorrente();
      if (!sel) {
        e.preventDefault();
        return;
      }
      switch (tipo) {
        case 'insertText': {
          e.preventDefault();
          const dado = e.data ?? '';
          if (dado === '')
            return;
          aplicar(inserirTexto(doc, sel, dado, pendentes ?? undefined), 'digitar');
          return;
        }
        case 'insertReplacementText': {
          e.preventDefault();
          const dado = e.dataTransfer?.getData('text/plain') ?? e.data ?? '';
          aplicar(inserirTexto(doc, sel, dado), null);
          return;
        }
        case 'insertParagraph':
          e.preventDefault();
          aplicar(dividirBloco(doc, sel), null);
          return;
        case 'insertLineBreak':
          e.preventDefault();
          aplicar(inserirAtomo(doc, sel, atomo('quebraDeLinha')), null);
          return;
        case 'deleteContentBackward':
          e.preventDefault();
          aplicar(estaColapsada(sel) ? apagarParaTras(doc, sel) : apagarIntervalo(doc, sel), 'apagar');
          return;
        case 'deleteContentForward':
          e.preventDefault();
          aplicar(estaColapsada(sel) ? apagarParaFrente(doc, sel) : apagarIntervalo(doc, sel), 'apagar');
          return;
        case 'deleteWordBackward':
        case 'deleteWordForward':
        case 'deleteSoftLineBackward':
        case 'deleteSoftLineForward':
        case 'deleteHardLineBackward':
        case 'deleteHardLineForward':
        case 'deleteByDrag':
        case 'deleteByCut':
        case 'deleteContent':
          e.preventDefault();
          aplicar(apagarIntervalo(doc, sel), null);
          return;
        case 'formatBold':
          e.preventDefault();
          atual.current.aoAlternarMarca('negrito');
          return;
        case 'formatItalic':
          e.preventDefault();
          atual.current.aoAlternarMarca('italico');
          return;
        case 'formatUnderline':
          e.preventDefault();
          atual.current.aoAlternarMarca('sublinhado');
          return;
        case 'historyUndo':
          e.preventDefault();
          atual.current.aoDesfazer();
          return;
        case 'historyRedo':
          e.preventDefault();
          atual.current.aoRefazer();
          return;
        case 'insertFromPaste':
        case 'insertFromDrop':
        case 'insertFromYank':
        case 'insertTranspose':
        case 'insertHorizontalRule':
        case 'insertOrderedList':
        case 'insertUnorderedList':
        case 'formatStrikeThrough':
        case 'formatIndent':
        case 'formatOutdent':
          // Colar e arrastar passam pelos manipuladores do React; o resto é a barra que faz.
          if (tipo === 'insertFromPaste' || tipo === 'insertFromDrop')
            return;
          e.preventDefault();
          return;
        default:
          if (e.cancelable)
            e.preventDefault();
          return;
      }
    };
    const aoEntrar = (pEvento: Event): void => {
      const e = pEvento as InputEvent;
      if ((e.target as HTMLElement | null)?.closest?.('[data-ilha]'))
        return;
      if (compondo.current || e.inputType === 'insertCompositionText')
        return;
      // Chegou aqui sem ser prevenido: o navegador mudou o DOM por conta própria. Relê a folha.
      if (!e.defaultPrevented)
        relerFolhaDoDOM();
    };
    const aoComecarComposicao = (): void => {
      compondo.current = true;
    };
    const aoTerminarComposicao = (): void => {
      compondo.current = false;
      relerFolhaDoDOM();
    };
    r.addEventListener('beforeinput', aoAntesDeEntrar);
    r.addEventListener('input', aoEntrar);
    r.addEventListener('compositionstart', aoComecarComposicao);
    r.addEventListener('compositionend', aoTerminarComposicao);
    return () => {
      r.removeEventListener('beforeinput', aoAntesDeEntrar);
      r.removeEventListener('input', aoEntrar);
      r.removeEventListener('compositionstart', aoComecarComposicao);
      r.removeEventListener('compositionend', aoTerminarComposicao);
    };
  }, [aplicar, relerFolhaDoDOM, selecaoCorrente, selecaoDoIntervalo]);

  // ----------------------------------------------------------------- teclado

  const aoTeclar = useCallback(
    (pEvento: KeyboardEvent<HTMLDivElement>) => {
      if ((pEvento.target as HTMLElement).closest('[data-ilha]'))
        return;
      const { documento: doc, somenteLeitura: leitura, blocoSelecionado: blocoSel } = atual.current;
      const ctrl = pEvento.ctrlKey || pEvento.metaKey;
      const tecla = pEvento.key.toLowerCase();

      if (ctrl && tecla === 'z' && !pEvento.shiftKey) {
        pEvento.preventDefault();
        atual.current.aoDesfazer();
        return;
      }
      if (ctrl && (tecla === 'y' || (tecla === 'z' && pEvento.shiftKey))) {
        pEvento.preventDefault();
        atual.current.aoRefazer();
        return;
      }
      if (leitura)
        return;

      if (blocoSel !== null && (pEvento.key === 'Backspace' || pEvento.key === 'Delete')) {
        pEvento.preventDefault();
        aplicar({ documento: removerBloco(doc, blocoSel), selecao: null }, null);
        atual.current.aoSelecionarBloco(null);
        return;
      }
      if (pEvento.key === 'Escape' && blocoSel !== null) {
        atual.current.aoSelecionarBloco(null);
        return;
      }

      if (ctrl && !pEvento.shiftKey && !pEvento.altKey && MARCA_DO_ATALHO[tecla]) {
        pEvento.preventDefault();
        atual.current.aoAlternarMarca(MARCA_DO_ATALHO[tecla]);
        return;
      }
      if (ctrl && pEvento.shiftKey && tecla === 'x') {
        pEvento.preventDefault();
        atual.current.aoAlternarMarca('tachado');
        return;
      }
      if (ctrl && tecla === 'k') {
        pEvento.preventDefault();
        atual.current.aoPedirDialogo({ tipo: 'link' });
        return;
      }
      const sel = selecaoCorrente();
      if (!sel)
        return;
      if (ctrl && pEvento.shiftKey && /^[0-9]$/.test(pEvento.key)) {
        pEvento.preventDefault();
        const n = Number(pEvento.key);
        if (n === 0)
          aplicar(definirTipoDeBloco(doc, sel, 'paragrafo'), null);
        else if (n <= 5)
          aplicar(definirTipoDeBloco(doc, sel, `titulo${n}` as 'titulo1'), null);
        else if (n === 7)
          aplicar(alternarLista(doc, sel, 'numerada'), null);
        else if (n === 8)
          aplicar(alternarLista(doc, sel, 'marcadores'), null);
        else if (n === 9)
          aplicar(alternarLista(doc, sel, 'tarefas'), null);
        return;
      }
      if (pEvento.key === 'Tab') {
        pEvento.preventDefault();
        const folha = folhaPorID(doc, sel.foco.folha);
        if (!folha)
          return;
        if (folha.especie === 'item') {
          aplicar(recuarItem(doc, folha, pEvento.shiftKey ? -1 : 1), null);
          return;
        }
        if (folha.especie === 'celula') {
          const folhas = folhasDoDocumento(doc);
          const indice = folhas.findIndex((pF) => pF.folha.id === folha.folha.id);
          const destino = folhas[indice + (pEvento.shiftKey ? -1 : 1)];
          if (destino && destino.especie === 'celula')
            aplicar({ documento: doc, selecao: { ancora: posicao(destino.folha.id, 0), foco: posicao(destino.folha.id, comprimentoInline(destino.folha.conteudo)) } }, null);
          return;
        }
        if (!pEvento.shiftKey)
          aplicar(inserirTexto(doc, sel, '\t'), 'digitar');
        return;
      }
      // Seta sobre átomo: o navegador já pula; nada a fazer. Backspace logo depois de um átomo apaga o átomo.
      if (pEvento.key === 'Backspace' && estaColapsada(sel)) {
        const folha = folhaPorID(doc, sel.foco.folha);
        if (folha && sel.foco.deslocamento > 0 && atomoNaPosicao(folha.folha.conteudo, sel.foco.deslocamento - 1)) {
          pEvento.preventDefault();
          aplicar(apagarParaTras(doc, sel), 'apagar');
        }
      }
    },
    [aplicar, selecaoCorrente],
  );

  // --------------------------------------------------- área de transferência

  const fragmentoDaSelecao = useCallback((pSelecao: Selecao): Bloco[] => {
    const doc = atual.current.documento;
    const { inicio, fim } = ordenarSelecao(doc, pSelecao);
    const folhas = folhasDoDocumento(doc);
    const de = folhas.findIndex((pF) => pF.folha.id === inicio.folha);
    const ate = folhas.findIndex((pF) => pF.folha.id === fim.folha);
    const blocos: Bloco[] = [];
    for (let i = de; i <= ate && i !== -1; i++) {
      const folha = folhas[i];
      const a = i === de ? inicio.deslocamento : 0;
      const b = i === ate ? fim.deslocamento : comprimentoInline(folha.folha.conteudo);
      const conteudo = fatiarInline(folha.folha.conteudo, a, b);
      const bloco = folha.cadeia[folha.cadeia.length - 1];
      if (folha.especie === 'titulo' && bloco.tipo === 'titulo')
        blocos.push({ ...bloco, conteudo });
      else if (folha.especie === 'item' && bloco.tipo === 'lista') {
        const anterior = blocos[blocos.length - 1];
        const item = { id: folha.folha.id, conteudo, filhos: [] };
        if (anterior && anterior.tipo === 'lista' && anterior.estilo === bloco.estilo)
          (anterior as Lista).itens.push(item);
        else
          blocos.push({ id: bloco.id, tipo: 'lista', estilo: bloco.estilo, itens: [item] });
      } else
        blocos.push({ id: folha.folha.id, tipo: 'paragrafo', conteudo });
    }
    return blocos;
  }, []);

  const aoCopiar = useCallback(
    (pEvento: ClipboardEvent<HTMLDivElement>) => {
      if ((pEvento.target as HTMLElement).closest('[data-ilha]'))
        return;
      const sel = selecaoCorrente();
      if (!sel || estaColapsada(sel))
        return;
      pEvento.preventDefault();
      const blocos = fragmentoDaSelecao(sel);
      const textoAsciiDoc = blocos.length === 1 && blocos[0].tipo === 'paragrafo' ? serializarInline(blocos[0].conteudo) : serializarDocumento({ blocos });
      pEvento.clipboardData.setData('text/plain', textoAsciiDoc);
      const dom = window.getSelection();
      if (dom && dom.rangeCount > 0) {
        const envelope = document.createElement('div');
        envelope.appendChild(dom.getRangeAt(0).cloneContents());
        pEvento.clipboardData.setData('text/html', envelope.innerHTML);
      }
    },
    [fragmentoDaSelecao, selecaoCorrente],
  );

  const aoRecortar = useCallback(
    (pEvento: ClipboardEvent<HTMLDivElement>) => {
      if ((pEvento.target as HTMLElement).closest('[data-ilha]') || atual.current.somenteLeitura)
        return;
      aoCopiar(pEvento);
      const sel = selecaoCorrente();
      if (sel && !estaColapsada(sel))
        aplicar(apagarIntervalo(atual.current.documento, sel), null);
    },
    [aoCopiar, aplicar, selecaoCorrente],
  );

  const colarTexto = useCallback(
    (pTexto: string, pSelecao: Selecao) => {
      const doc = atual.current.documento;
      const texto = pTexto.replace(/\r\n?/g, '\n');
      const { documento: colado } = analisarAsciiDoc(texto);
      const blocos = colado.blocos.length === 0 ? [] : colado.blocos;
      if (blocos.length === 0)
        return;
      aplicar(colarBlocos(doc, pSelecao, blocos), null);
    },
    [aplicar],
  );

  const aoColar = useCallback(
    (pEvento: ClipboardEvent<HTMLDivElement>) => {
      if ((pEvento.target as HTMLElement).closest('[data-ilha]'))
        return;
      pEvento.preventDefault();
      if (atual.current.somenteLeitura)
        return;
      const sel = selecaoCorrente();
      if (!sel)
        return;
      const texto = pEvento.clipboardData.getData('text/plain');
      if (texto)
        colarTexto(texto, sel);
    },
    [colarTexto, selecaoCorrente],
  );

  const aoSoltar = useCallback(
    (pEvento: DragEvent<HTMLDivElement>) => {
      pEvento.preventDefault();
      if (atual.current.somenteLeitura)
        return;
      const texto = pEvento.dataTransfer.getData('text/plain');
      if (!texto)
        return;
      const pontoDeQueda = document.caretPositionFromPoint?.(pEvento.clientX, pEvento.clientY);
      let sel = selecaoCorrente();
      if (pontoDeQueda) {
        const folha = elementoDaFolha(pontoDeQueda.offsetNode);
        if (folha)
          sel = selecaoColapsada(folha.getAttribute('data-folha') as string, deslocamentoNoDOM(folha, pontoDeQueda.offsetNode, pontoDeQueda.offset));
      }
      if (sel)
        colarTexto(texto, sel);
    },
    [colarTexto, selecaoCorrente],
  );

  // ----------------------------------------------------------------- contexto

  const atributoStem = atributoDoCabecalho(documento, 'stem');
  const acoes = useMemo<AcoesDaVista>(
    () => ({
      atualizarBloco: (pID, pMudanca) => aplicar({ documento: atualizarBloco(atual.current.documento, pID, pMudanca), selecao: atual.current.selecao }, `bloco:${pID}`),
      removerBloco: (pID) => aplicar({ documento: removerBloco(atual.current.documento, pID), selecao: null }, null),
      alternarTarefa: (pItemID) => aplicar({ documento: alternarTarefa(atual.current.documento, pItemID), selecao: atual.current.selecao }, null),
      selecionarBloco: (pID) => atual.current.aoSelecionarBloco(pID),
      editarBloco: (pID) => atual.current.aoPedirDialogo({ tipo: 'imagem', blocoID: pID }),
      somenteLeitura,
      blocoSelecionado,
      versaoDaFolha: (pID) => versoes.current.get(pID) ?? 0,
      folhaTravada: (pID) => folhasTravadas?.get(pID) ?? null,
      resolverRecurso: resolverRecurso ?? ((pAlvo) => pAlvo),
      acionarReferencia: aoAcionarReferencia,
      atributoStem,
    }),
    [aplicar, aoAcionarReferencia, atributoStem, blocoSelecionado, folhasTravadas, resolverRecurso, somenteLeitura],
  );
  const tv = useTextos().vista;

  return (
    <ContextoDaVista.Provider value={acoes}>
      <div ref={envolucro} className={`adc-documento ${className}`.trim()}>
        <div ref={marcadorCursor} className="adc-cursor-virtual" aria-hidden="true" style={{ display: 'none' }} />
        <CabecalhoDoDocumento documento={documento} somenteLeitura={somenteLeitura} aoMudar={(pDoc) => aplicar({ documento: pDoc, selecao: atual.current.selecao }, 'cabecalho')} />
        <div
          ref={raiz}
          className="adc-raiz"
          contentEditable={!somenteLeitura}
          suppressContentEditableWarning
          spellCheck
          role="textbox"
          aria-multiline="true"
          aria-label={tv.conteudoDoDocumento}
          aria-readonly={somenteLeitura}
          onKeyDown={aoTeclar}
          onCopy={aoCopiar}
          onCut={aoRecortar}
          onPaste={aoColar}
          onDrop={aoSoltar}
          onDragOver={(pE) => pE.preventDefault()}
        >
          {documento.blocos.map((pBloco) => (
            <RenderizarBloco key={pBloco.id} bloco={pBloco} />
          ))}
        </div>
      </div>
    </ContextoDaVista.Provider>
  );
}
