/**
 * XEditorDeCodigo — editor de código com realce, todo nosso.
 *
 * TÉCNICA: um `<textarea>` TRANSPARENTE por cima da camada de realce. O textarea nativo cuida de cursor, seleção,
 * IME, desfazer/refazer, leitor de tela e rolagem de texto; nós só pintamos as cores por baixo, com a mesma fonte
 * e o mesmo espaçamento, para cada caractere cair exatamente sobre o seu colorido.
 *
 * PERFORMANCE: a camada de realce só renderiza as LINHAS VISÍVEIS (altura fixa por linha ⇒ posição absoluta por
 * índice), e a tokenização é incremental com estado por linha (`CacheDeTokens`). O textarea tem a altura total do
 * texto, para a rolagem ser uma só — a do contêiner. Alvo: 100 mil linhas sem perder a fluidez ao digitar.
 *
 * Edições programáticas (Tab, comentário, fechamento automático, substituir) entram por `execCommand('insertText')`
 * quando o navegador o oferece, para o Ctrl+Z nativo continuar funcionando; sem ele, cai no setter nativo + evento.
 *
 * Com `quebrarLinhas`, a virtualização sai (as linhas fluem e quebram) — é a forma para trechos curtos dentro do
 * documento visual.
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowDown, ArrowUp, CaseSensitive, Regex, Replace, WholeWord, X } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { CacheDeTokens } from './cache';
import { linguagemPorNome } from './linguagens';
import type { Linguagem, Token } from './tokens';

// ============================================================================
// Tipos
// ============================================================================

export interface PosicaoNoCodigo {
  linha: number;
  coluna: number;
}

export interface XEditorDeCodigoProps {
  valor: string;
  aoMudar: (pValor: string) => void;
  /** Nome ou apelido da linguagem (`typescript`, `cs`, `sql`…); desconhecida ⇒ texto puro. */
  linguagem?: string;
  somenteLeitura?: boolean;
  /** `preencher` ocupa a altura do pai; número = altura fixa em px; `auto` = cresce com o conteúdo (até `alturaMaxima`). */
  altura?: 'preencher' | 'auto' | number;
  alturaMaxima?: number;
  /** Linhas quebram em vez de rolar horizontalmente (desliga a virtualização). */
  quebrarLinhas?: boolean;
  numerosDeLinha?: boolean;
  /** Espaços por nível de recuo (Tab). */
  recuo?: number;
  rotuloAcessivel: string;
  placeholder?: string;
  /** Informa a posição do cursor (linha e coluna, 1-based) a quem exibe a barra de status. */
  aoMoverCursor?: (pPosicao: PosicaoNoCodigo) => void;
  /** Abre o painel de busca por fora (Ctrl+F da barra do editor). */
  pedidoDeBusca?: number;
  /** Leva o cursor à linha (1-based) por fora; `n` muda a cada pedido. */
  irParaLinha?: { linha: number; n: number };
  className?: string;
  aoFocar?: () => void;
  aoDesfocar?: () => void;
  /** Teclas que o pai quer interceptar antes (devolve `true` se tratou). */
  aoTeclar?: (pEvento: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

interface Metricas {
  alturaDaLinha: number;
  larguraDoCaractere: number;
}

interface Ocorrencia {
  ini: number;
  fim: number;
}

const SOBRA_DE_LINHAS = 12;
const LARGURA_MINIMA_DA_GUTTER = 3;
const PARES: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
const FECHAMENTOS = new Set(Object.values(PARES));
const ABERTURAS = new Set(['(', '[', '{']);

// ============================================================================
// Apoio
// ============================================================================

/** Insere texto na seleção preservando o desfazer nativo quando possível. */
export function inserirNoTextarea(pArea: HTMLTextAreaElement, pTexto: string, pIni?: number, pFim?: number): void {
  pArea.focus();
  if (pIni !== undefined)
    pArea.setSelectionRange(pIni, pFim ?? pIni);
  let feito = false;
  try {
    feito = document.execCommand('insertText', false, pTexto);
  } catch {
    feito = false;
  }
  if (feito)
    return;
  const ini = pArea.selectionStart;
  const fim = pArea.selectionEnd;
  const novo = pArea.value.slice(0, ini) + pTexto + pArea.value.slice(fim);
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter)
    setter.call(pArea, novo);
  else
    pArea.value = novo;
  pArea.setSelectionRange(ini + pTexto.length, ini + pTexto.length);
  pArea.dispatchEvent(new Event('input', { bubbles: true }));
}

function linhaDaPosicao(pTexto: string, pPosicao: number): number {
  let linha = 0;
  for (let i = 0; i < pPosicao && i < pTexto.length; i++)
    if (pTexto.charCodeAt(i) === 10)
      linha += 1;
  return linha;
}

function inicioDaLinha(pTexto: string, pPosicao: number): number {
  const anterior = pTexto.lastIndexOf('\n', pPosicao - 1);
  return anterior === -1 ? 0 : anterior + 1;
}

function fimDaLinha(pTexto: string, pPosicao: number): number {
  const proximo = pTexto.indexOf('\n', pPosicao);
  return proximo === -1 ? pTexto.length : proximo;
}

/** A coluna visual (tabs expandidos) de um deslocamento dentro da linha. */
function colunaVisual(pLinha: string, pColuna: number, pTab: number): number {
  let visual = 0;
  for (let i = 0; i < pColuna && i < pLinha.length; i++)
    visual = pLinha[i] === '\t' ? visual + pTab - (visual % pTab) : visual + 1;
  return visual;
}

function larguraVisual(pLinha: string, pTab: number): number {
  return colunaVisual(pLinha, pLinha.length, pTab);
}

function escaparRegex(pTexto: string): string {
  return pTexto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parBalanceado(pTexto: string, pPosicao: number): { abre: number; fecha: number } | null {
  const candidatos = [pPosicao - 1, pPosicao];
  for (const indice of candidatos) {
    const c = pTexto[indice];
    if (c === undefined)
      continue;
    if (ABERTURAS.has(c)) {
      const fecha = PARES[c];
      let nivel = 0;
      for (let i = indice; i < pTexto.length && i < indice + 200000; i++) {
        if (pTexto[i] === c)
          nivel += 1;
        else if (pTexto[i] === fecha) {
          nivel -= 1;
          if (nivel === 0)
            return { abre: indice, fecha: i };
        }
      }
      return null;
    }
    if (FECHAMENTOS.has(c) && (c === ')' || c === ']' || c === '}')) {
      const abre = Object.keys(PARES).find((pK) => PARES[pK] === c) as string;
      let nivel = 0;
      for (let i = indice; i >= 0 && i > indice - 200000; i--) {
        if (pTexto[i] === c)
          nivel += 1;
        else if (pTexto[i] === abre) {
          nivel -= 1;
          if (nivel === 0)
            return { abre: i, fecha: indice };
        }
      }
      return null;
    }
  }
  return null;
}

// ============================================================================
// Linha realçada
// ============================================================================

interface LinhaRealcadaProps {
  texto: string;
  tokens: Token[];
  numero: number | null;
  larguraDaGutter: number;
  top?: number;
  ativa: boolean;
}

const LinhaRealcada = memo(function LinhaRealcada({ texto, tokens, numero, larguraDaGutter, top, ativa }: LinhaRealcadaProps): JSX.Element {
  const pedacos: ReactNode[] = [];
  let pos = 0;
  for (const token of tokens) {
    if (token.ini > pos)
      pedacos.push(texto.slice(pos, token.ini));
    if (token.tipo !== 'normal')
      pedacos.push(
        <span key={token.ini} className={`adc-tk-${token.tipo}`}>
          {texto.slice(token.ini, token.fim)}
        </span>,
      );
    else
      pedacos.push(texto.slice(token.ini, token.fim));
    pos = token.fim;
  }
  if (pos < texto.length)
    pedacos.push(texto.slice(pos));
  return (
    <div className={`adc-codigo-linha${ativa ? ' adc-codigo-linha-ativa' : ''}`} style={top === undefined ? undefined : { top }}>
      {numero !== null && (
        <span className="adc-codigo-numero" style={{ width: larguraDaGutter }} aria-hidden="true">
          {numero}
        </span>
      )}
      <span className="adc-codigo-texto">{pedacos.length > 0 ? pedacos : '​'}</span>
    </div>
  );
});

// ============================================================================
// O editor
// ============================================================================

export function XEditorDeCodigo({
  valor,
  aoMudar,
  linguagem,
  somenteLeitura = false,
  altura = 'preencher',
  alturaMaxima,
  quebrarLinhas = false,
  numerosDeLinha = true,
  recuo = 2,
  rotuloAcessivel,
  placeholder,
  aoMoverCursor,
  pedidoDeBusca,
  irParaLinha,
  className = '',
  aoFocar,
  aoDesfocar,
  aoTeclar,
}: XEditorDeCodigoProps): JSX.Element {
  const id = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const sonda = useRef<HTMLSpanElement>(null);
  const [metricas, setMetricas] = useState<Metricas>({ alturaDaLinha: 22, larguraDoCaractere: 7.8 });
  const [rolagem, setRolagem] = useState({ top: 0, left: 0 });
  const [alturaVisivel, setAlturaVisivel] = useState(400);
  const [cursor, setCursor] = useState<{ ini: number; fim: number }>({ ini: 0, fim: 0 });
  const [busca, setBusca] = useState({ aberta: false, termo: '', substituicao: '', caixa: false, palavra: false, regex: false, atual: 0, comSubstituir: false });
  const [irPara, setIrPara] = useState<string | null>(null);
  const campoDeBusca = useRef<HTMLInputElement>(null);
  const campoIrPara = useRef<HTMLInputElement>(null);
  const quadroDeRolagem = useRef<number | null>(null);

  const definicao: Linguagem = useMemo(() => linguagemPorNome(linguagem), [linguagem]);
  const cache = useRef<CacheDeTokens>(new CacheDeTokens(definicao));
  cache.current.definirLinguagem(definicao);

  const linhas = useMemo(() => valor.split('\n'), [valor]);
  cache.current.definirLinhas(linhas);

  const tab = 4;
  const larguraDaGutter = numerosDeLinha ? (Math.max(LARGURA_MINIMA_DA_GUTTER, String(linhas.length).length) + 1) * metricas.larguraDoCaractere + 12 : 8;

  // ---------------------------------------------------------------- métricas

  useLayoutEffect(() => {
    const s = sonda.current;
    if (!s)
      return;
    const caixa = s.getBoundingClientRect();
    const larguraDoCaractere = caixa.width / 100;
    const alturaDaLinha = Math.round(caixa.height);
    if (larguraDoCaractere > 0 && alturaDaLinha > 0)
      setMetricas((pM) => (pM.alturaDaLinha === alturaDaLinha && Math.abs(pM.larguraDoCaractere - larguraDoCaractere) < 0.001 ? pM : { alturaDaLinha, larguraDoCaractere }));
  }, []);

  useEffect(() => {
    const c = contenedor.current;
    if (!c)
      return;
    const observador = new ResizeObserver(() => setAlturaVisivel(c.clientHeight));
    observador.observe(c);
    setAlturaVisivel(c.clientHeight);
    return () => observador.disconnect();
  }, []);

  // ----------------------------------------------------------------- rolagem

  const aoRolar = useCallback(() => {
    if (quadroDeRolagem.current !== null)
      return;
    quadroDeRolagem.current = requestAnimationFrame(() => {
      quadroDeRolagem.current = null;
      const c = contenedor.current;
      if (c)
        setRolagem({ top: c.scrollTop, left: c.scrollLeft });
    });
  }, []);

  const larguraMaxima = useMemo(() => {
    if (quebrarLinhas)
      return 0;
    let maior = 0;
    for (const linha of linhas) {
      const largura = linha.includes('\t') ? larguraVisual(linha, tab) : linha.length;
      if (largura > maior)
        maior = largura;
    }
    return maior;
  }, [linhas, quebrarLinhas]);

  const alturaTotal = linhas.length * metricas.alturaDaLinha;
  const primeiraVisivel = quebrarLinhas ? 0 : Math.max(0, Math.floor(rolagem.top / metricas.alturaDaLinha) - SOBRA_DE_LINHAS);
  const ultimaVisivel = quebrarLinhas ? linhas.length - 1 : Math.min(linhas.length - 1, Math.ceil((rolagem.top + alturaVisivel) / metricas.alturaDaLinha) + SOBRA_DE_LINHAS);

  // ------------------------------------------------------------------ cursor

  const linhaDoCursor = useMemo(() => linhaDaPosicao(valor, cursor.ini), [valor, cursor.ini]);

  const atualizarCursor = useCallback(() => {
    const a = area.current;
    if (!a)
      return;
    const ini = a.selectionStart;
    const fim = a.selectionEnd;
    setCursor((pC) => (pC.ini === ini && pC.fim === fim ? pC : { ini, fim }));
    if (aoMoverCursor) {
      const linha = linhaDaPosicao(a.value, ini);
      const coluna = ini - inicioDaLinha(a.value, ini);
      aoMoverCursor({ linha: linha + 1, coluna: coluna + 1 });
    }
  }, [aoMoverCursor]);

  /** Rola o contêiner até o cursor ficar visível (o textarea não rola por si: tem a altura toda). */
  const revelarCursor = useCallback(() => {
    const a = area.current;
    const c = contenedor.current;
    if (!a || !c || quebrarLinhas)
      return;
    const pos = a.selectionEnd;
    const linha = linhaDaPosicao(a.value, pos);
    const inicio = inicioDaLinha(a.value, pos);
    const coluna = colunaVisual(a.value.slice(inicio, fimDaLinha(a.value, pos)), pos - inicio, tab);
    const topo = linha * metricas.alturaDaLinha;
    const base = topo + metricas.alturaDaLinha;
    if (topo < c.scrollTop)
      c.scrollTop = topo;
    else if (base > c.scrollTop + c.clientHeight)
      c.scrollTop = base - c.clientHeight;
    const x = larguraDaGutter + coluna * metricas.larguraDoCaractere;
    if (x - larguraDaGutter < c.scrollLeft)
      c.scrollLeft = Math.max(0, x - larguraDaGutter - metricas.larguraDoCaractere * 4);
    else if (x + metricas.larguraDoCaractere * 2 > c.scrollLeft + c.clientWidth)
      c.scrollLeft = x + metricas.larguraDoCaractere * 4 - c.clientWidth;
  }, [larguraDaGutter, metricas, quebrarLinhas]);

  // ------------------------------------------------------------------- edição

  const aoMudarTexto = useCallback(
    (pEvento: ChangeEvent<HTMLTextAreaElement>) => {
      aoMudar(pEvento.target.value);
      requestAnimationFrame(() => {
        atualizarCursor();
        revelarCursor();
      });
    },
    [aoMudar, atualizarCursor, revelarCursor],
  );

  const recuoDaLinha = (pLinha: string): string => (/^[ \t]*/.exec(pLinha) as RegExpExecArray)[0];

  const aoTeclarNoTexto = useCallback(
    (pEvento: KeyboardEvent<HTMLTextAreaElement>) => {
      if (aoTeclar && aoTeclar(pEvento))
        return;
      const a = pEvento.currentTarget;
      const texto = a.value;
      const ini = a.selectionStart;
      const fim = a.selectionEnd;
      const ctrl = pEvento.ctrlKey || pEvento.metaKey;
      const unidade = ' '.repeat(recuo);

      if (ctrl && (pEvento.key === 'f' || pEvento.key === 'F') && !pEvento.shiftKey) {
        pEvento.preventDefault();
        const selecionado = ini !== fim && !texto.slice(ini, fim).includes('\n') ? texto.slice(ini, fim) : '';
        setBusca((pB) => ({ ...pB, aberta: true, termo: selecionado || pB.termo, comSubstituir: false }));
        requestAnimationFrame(() => campoDeBusca.current?.select());
        return;
      }
      if (ctrl && (pEvento.key === 'h' || pEvento.key === 'H')) {
        pEvento.preventDefault();
        if (somenteLeitura)
          return;
        setBusca((pB) => ({ ...pB, aberta: true, comSubstituir: true }));
        requestAnimationFrame(() => campoDeBusca.current?.select());
        return;
      }
      if (ctrl && (pEvento.key === 'g' || pEvento.key === 'G')) {
        pEvento.preventDefault();
        setIrPara('');
        requestAnimationFrame(() => campoIrPara.current?.focus());
        return;
      }
      if (pEvento.key === 'Escape' && (busca.aberta || irPara !== null)) {
        pEvento.preventDefault();
        setBusca((pB) => ({ ...pB, aberta: false }));
        setIrPara(null);
        return;
      }
      if (somenteLeitura)
        return;

      // Tab / Shift+Tab: recua ou avança a seleção (linhas inteiras quando há mais de uma).
      if (pEvento.key === 'Tab') {
        pEvento.preventDefault();
        const inicioBloco = inicioDaLinha(texto, ini);
        const fimBloco = fimDaLinha(texto, fim);
        const bloco = texto.slice(inicioBloco, fimBloco);
        if (ini === fim && !pEvento.shiftKey) {
          inserirNoTextarea(a, unidade);
          return;
        }
        const linhasDoBloco = bloco.split('\n');
        const novas = linhasDoBloco.map((pL) => (pEvento.shiftKey ? pL.replace(new RegExp(`^( {1,${recuo}}|\\t)`), '') : pL.length > 0 || linhasDoBloco.length === 1 ? unidade + pL : pL));
        const novo = novas.join('\n');
        inserirNoTextarea(a, novo, inicioBloco, fimBloco);
        const delta = novas[0].length - linhasDoBloco[0].length;
        a.setSelectionRange(Math.max(inicioBloco, ini + delta), inicioBloco + novo.length);
        return;
      }

      // Enter: mantém o recuo; depois de `{`, `[`, `(` abre um nível e, se há o fechamento logo adiante, desce-o.
      if (pEvento.key === 'Enter' && !ctrl && !pEvento.altKey) {
        pEvento.preventDefault();
        const linha = texto.slice(inicioDaLinha(texto, ini), ini);
        let base = recuoDaLinha(linha);
        const antes = texto[ini - 1];
        const depois = texto[fim];
        if (antes !== undefined && ABERTURAS.has(antes)) {
          const interno = base + unidade;
          if (depois !== undefined && PARES[antes] === depois) {
            inserirNoTextarea(a, `\n${interno}\n${base}`, ini, fim);
            a.setSelectionRange(ini + 1 + interno.length, ini + 1 + interno.length);
            return;
          }
          base = interno;
        }
        inserirNoTextarea(a, `\n${base}`, ini, fim);
        return;
      }

      // Backspace apaga o par vazio `()` de uma vez; no recuo, apaga um nível.
      if (pEvento.key === 'Backspace' && ini === fim && ini > 0) {
        const antes = texto[ini - 1];
        const depois = texto[ini];
        if (PARES[antes] !== undefined && PARES[antes] === depois) {
          pEvento.preventDefault();
          inserirNoTextarea(a, '', ini - 1, ini + 1);
          return;
        }
        const inicio = inicioDaLinha(texto, ini);
        const trecho = texto.slice(inicio, ini);
        if (trecho.length > 0 && /^ +$/.test(trecho) && trecho.length % recuo === 0) {
          pEvento.preventDefault();
          inserirNoTextarea(a, '', ini - recuo, ini);
          return;
        }
      }

      // Fechamento automático e pulo sobre o fechamento já existente.
      if (!ctrl && !pEvento.altKey && pEvento.key.length === 1) {
        const c = pEvento.key;
        if (FECHAMENTOS.has(c) && ini === fim && texto[ini] === c && !ABERTURAS.has(c) && (c !== '"' && c !== "'" && c !== '`' ? true : texto[ini - 1] !== '\\')) {
          pEvento.preventDefault();
          a.setSelectionRange(ini + 1, ini + 1);
          atualizarCursor();
          return;
        }
        if (PARES[c] !== undefined) {
          const depois = texto[fim];
          const antes = texto[ini - 1];
          const envolve = ini !== fim;
          const ehAspas = c === '"' || c === "'" || c === '`';
          const podeAbrir = envolve || depois === undefined || /[\s)\]};,]/.test(depois);
          const palavraAntes = ehAspas && antes !== undefined && /[\p{L}\p{N}_]/u.test(antes);
          if (podeAbrir && !palavraAntes) {
            pEvento.preventDefault();
            const miolo = texto.slice(ini, fim);
            inserirNoTextarea(a, `${c}${miolo}${PARES[c]}`, ini, fim);
            a.setSelectionRange(ini + 1, ini + 1 + miolo.length);
            atualizarCursor();
            return;
          }
        }
      }

      // Ctrl+/: comenta ou descomenta as linhas.
      if (ctrl && pEvento.key === '/') {
        pEvento.preventDefault();
        const prefixo = definicao.comentarioDeLinha;
        if (!prefixo)
          return;
        const inicioBloco = inicioDaLinha(texto, ini);
        const fimBloco = fimDaLinha(texto, fim);
        const linhasDoBloco = texto.slice(inicioBloco, fimBloco).split('\n');
        const todasComentadas = linhasDoBloco.every((pL) => pL.trim() === '' || pL.trimStart().startsWith(prefixo));
        const novas = linhasDoBloco.map((pL) => {
          if (pL.trim() === '')
            return pL;
          const r = recuoDaLinha(pL);
          return todasComentadas ? r + pL.slice(r.length).replace(new RegExp(`^${escaparRegex(prefixo)} ?`), '') : `${r}${prefixo} ${pL.slice(r.length)}`;
        });
        const novo = novas.join('\n');
        inserirNoTextarea(a, novo, inicioBloco, fimBloco);
        a.setSelectionRange(inicioBloco, inicioBloco + novo.length);
        return;
      }

      // Alt+↑/↓: move a linha (ou as linhas selecionadas).
      if (pEvento.altKey && (pEvento.key === 'ArrowUp' || pEvento.key === 'ArrowDown')) {
        pEvento.preventDefault();
        const inicioBloco = inicioDaLinha(texto, ini);
        const fimBloco = fimDaLinha(texto, fim);
        const bloco = texto.slice(inicioBloco, fimBloco);
        if (pEvento.key === 'ArrowUp') {
          if (inicioBloco === 0)
            return;
          const inicioAnterior = inicioDaLinha(texto, inicioBloco - 1);
          const anterior = texto.slice(inicioAnterior, inicioBloco - 1);
          inserirNoTextarea(a, `${bloco}\n${anterior}`, inicioAnterior, fimBloco);
          a.setSelectionRange(inicioAnterior + (ini - inicioBloco), inicioAnterior + (fim - inicioBloco));
        } else {
          if (fimBloco >= texto.length)
            return;
          const fimSeguinte = fimDaLinha(texto, fimBloco + 1);
          const seguinte = texto.slice(fimBloco + 1, fimSeguinte);
          inserirNoTextarea(a, `${seguinte}\n${bloco}`, inicioBloco, fimSeguinte);
          const deslocamento = seguinte.length + 1;
          a.setSelectionRange(ini + deslocamento, fim + deslocamento);
        }
        atualizarCursor();
        return;
      }

      // Ctrl+Shift+K apaga a linha; Ctrl+D duplica.
      if (ctrl && pEvento.shiftKey && (pEvento.key === 'K' || pEvento.key === 'k')) {
        pEvento.preventDefault();
        const inicioBloco = inicioDaLinha(texto, ini);
        const fimBloco = fimDaLinha(texto, fim);
        const ate = fimBloco < texto.length ? fimBloco + 1 : fimBloco;
        const de = ate === fimBloco && inicioBloco > 0 ? inicioBloco - 1 : inicioBloco;
        inserirNoTextarea(a, '', de, ate);
        return;
      }
      if (ctrl && !pEvento.shiftKey && (pEvento.key === 'd' || pEvento.key === 'D')) {
        pEvento.preventDefault();
        const inicioBloco = inicioDaLinha(texto, ini);
        const fimBloco = fimDaLinha(texto, fim);
        const bloco = texto.slice(inicioBloco, fimBloco);
        inserirNoTextarea(a, `\n${bloco}`, fimBloco, fimBloco);
        a.setSelectionRange(ini + bloco.length + 1, fim + bloco.length + 1);
        return;
      }

      // Home inteligente: primeiro vai ao primeiro caractere não branco.
      if (pEvento.key === 'Home' && !ctrl) {
        const inicio = inicioDaLinha(texto, ini);
        const primeiro = inicio + recuoDaLinha(texto.slice(inicio, fimDaLinha(texto, ini))).length;
        if (ini !== primeiro) {
          pEvento.preventDefault();
          a.setSelectionRange(primeiro, pEvento.shiftKey ? fim : primeiro);
          atualizarCursor();
        }
      }
    },
    [aoTeclar, atualizarCursor, busca.aberta, definicao.comentarioDeLinha, irPara, recuo, somenteLeitura],
  );

  // -------------------------------------------------------------------- busca

  useEffect(() => {
    if (pedidoDeBusca === undefined || pedidoDeBusca === 0)
      return;
    setBusca((pB) => ({ ...pB, aberta: true }));
    requestAnimationFrame(() => campoDeBusca.current?.select());
  }, [pedidoDeBusca]);

  const ocorrencias = useMemo<Ocorrencia[]>(() => {
    if (!busca.aberta || busca.termo === '')
      return [];
    let padrao: RegExp;
    try {
      const fonte = busca.regex ? busca.termo : escaparRegex(busca.termo);
      padrao = new RegExp(busca.palavra ? `\\b(?:${fonte})\\b` : fonte, busca.caixa ? 'gu' : 'giu');
    } catch {
      return [];
    }
    const saida: Ocorrencia[] = [];
    let m: RegExpExecArray | null;
    while ((m = padrao.exec(valor)) !== null && saida.length < 20000) {
      if (m[0].length === 0) {
        padrao.lastIndex += 1;
        continue;
      }
      saida.push({ ini: m.index, fim: m.index + m[0].length });
    }
    return saida;
  }, [busca.aberta, busca.termo, busca.regex, busca.palavra, busca.caixa, valor]);

  const irParaOcorrencia = useCallback(
    (pIndice: number) => {
      if (ocorrencias.length === 0)
        return;
      const indice = ((pIndice % ocorrencias.length) + ocorrencias.length) % ocorrencias.length;
      setBusca((pB) => ({ ...pB, atual: indice }));
      const a = area.current;
      if (!a)
        return;
      a.setSelectionRange(ocorrencias[indice].ini, ocorrencias[indice].fim);
      atualizarCursor();
      revelarCursor();
    },
    [atualizarCursor, ocorrencias, revelarCursor],
  );

  const substituirAtual = useCallback(() => {
    const a = area.current;
    if (!a || ocorrencias.length === 0 || somenteLeitura)
      return;
    const alvo = ocorrencias[busca.atual] ?? ocorrencias[0];
    inserirNoTextarea(a, busca.substituicao, alvo.ini, alvo.fim);
  }, [busca.atual, busca.substituicao, ocorrencias, somenteLeitura]);

  const substituirTodas = useCallback(() => {
    const a = area.current;
    if (!a || ocorrencias.length === 0 || somenteLeitura)
      return;
    let novo = '';
    let pos = 0;
    for (const o of ocorrencias) {
      novo += valor.slice(pos, o.ini) + busca.substituicao;
      pos = o.fim;
    }
    novo += valor.slice(pos);
    // Seleciona tudo e insere o texto novo: o desfazer nativo guarda a troca como UM passo.
    inserirNoTextarea(a, novo, 0, valor.length);
  }, [busca.substituicao, ocorrencias, somenteLeitura, valor]);

  useEffect(() => {
    if (!irParaLinha)
      return;
    const a = area.current;
    if (!a)
      return;
    const alvo = Math.max(1, Math.min(linhas.length, irParaLinha.linha));
    let pos = 0;
    for (let i = 0; i < alvo - 1; i++)
      pos += linhas[i].length + 1;
    a.focus();
    a.setSelectionRange(pos, pos);
    atualizarCursor();
    revelarCursor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irParaLinha]);

  const confirmarIrPara = useCallback(() => {
    const a = area.current;
    const numero = Number(irPara);
    setIrPara(null);
    if (!a || !Number.isFinite(numero) || numero < 1)
      return;
    const alvo = Math.min(linhas.length, Math.floor(numero));
    let pos = 0;
    for (let i = 0; i < alvo - 1; i++)
      pos += linhas[i].length + 1;
    a.focus();
    a.setSelectionRange(pos, pos);
    atualizarCursor();
    revelarCursor();
  }, [atualizarCursor, irPara, linhas, revelarCursor]);

  // -------------------------------------------------------------- decorações

  const pares = useMemo(() => (cursor.ini === cursor.fim ? parBalanceado(valor, cursor.ini) : null), [valor, cursor]);

  const caixaDe = useCallback(
    (pPosicao: number, pTamanho: number): { top: number; left: number; width: number } | null => {
      if (quebrarLinhas)
        return null;
      const linha = linhaDaPosicao(valor, pPosicao);
      const inicio = inicioDaLinha(valor, pPosicao);
      const textoDaLinha = linhas[linha] ?? '';
      const col = colunaVisual(textoDaLinha, pPosicao - inicio, tab);
      const colFim = colunaVisual(textoDaLinha, pPosicao - inicio + pTamanho, tab);
      return { top: linha * metricas.alturaDaLinha, left: larguraDaGutter + col * metricas.larguraDoCaractere, width: Math.max(2, (colFim - col) * metricas.larguraDoCaractere) };
    },
    [larguraDaGutter, linhas, metricas, quebrarLinhas, valor],
  );

  const decoracoes: ReactNode[] = [];
  if (!quebrarLinhas) {
    if (pares) {
      for (const p of [pares.abre, pares.fecha]) {
        const caixa = caixaDe(p, 1);
        if (caixa)
          decoracoes.push(<div key={`par-${p}`} className="adc-codigo-decoracao-par" style={caixa} />);
      }
    }
    if (busca.aberta) {
      const topoVisivel = primeiraVisivel * metricas.alturaDaLinha;
      const baseVisivel = (ultimaVisivel + 1) * metricas.alturaDaLinha;
      ocorrencias.forEach((pO, pIndice) => {
        const caixa = caixaDe(pO.ini, pO.fim - pO.ini);
        if (caixa && caixa.top >= topoVisivel && caixa.top < baseVisivel)
          decoracoes.push(<div key={`oc-${pO.ini}`} className={`adc-codigo-decoracao-busca${pIndice === busca.atual ? ' adc-codigo-decoracao-busca-atual' : ''}`} style={caixa} />);
      });
    }
  }

  // ------------------------------------------------------------------- render

  const linhasVisiveis: ReactNode[] = [];
  for (let i = primeiraVisivel; i <= ultimaVisivel; i++)
    linhasVisiveis.push(
      <LinhaRealcada
        key={i}
        texto={linhas[i]}
        tokens={cache.current.tokensDaLinha(i)}
        numero={numerosDeLinha ? i + 1 : null}
        larguraDaGutter={larguraDaGutter}
        top={quebrarLinhas ? undefined : i * metricas.alturaDaLinha}
        ativa={i === linhaDoCursor}
      />,
    );

  const estiloDoContenedor: Record<string, string | number> = {};
  if (altura === 'preencher')
    estiloDoContenedor.height = '100%';
  else if (typeof altura === 'number')
    estiloDoContenedor.height = altura;
  else {
    estiloDoContenedor.height = Math.max(metricas.alturaDaLinha * 3, alturaTotal) + 16;
    if (alturaMaxima !== undefined)
      estiloDoContenedor.maxHeight = alturaMaxima;
  }

  const larguraDoConteudo = quebrarLinhas ? undefined : Math.max(0, larguraDaGutter + larguraMaxima * metricas.larguraDoCaractere + 48);
  const total = ocorrencias.length;

  return (
    <div className={`adc-codigo${quebrarLinhas ? ' adc-codigo-quebra' : ''} ${className}`} style={{ '--adc-gutter': `${larguraDaGutter}px` } as Record<string, string>}>
      <span ref={sonda} className="adc-codigo-sonda" aria-hidden="true">
        {'M'.repeat(100)}
      </span>

      {busca.aberta && (
        <div className="adc-codigo-busca" role="search">
          <div className="adc-codigo-busca-linha">
            <input
              ref={campoDeBusca}
              id={`${id}-busca`}
              className="adc-codigo-busca-campo"
              value={busca.termo}
              placeholder="Localizar"
              aria-label="Localizar no código"
              onChange={(pE) => setBusca((pB) => ({ ...pB, termo: pE.target.value, atual: 0 }))}
              onKeyDown={(pE) => {
                if (pE.key === 'Enter') {
                  pE.preventDefault();
                  irParaOcorrencia(busca.atual + (pE.shiftKey ? -1 : 1));
                } else if (pE.key === 'Escape') {
                  pE.preventDefault();
                  setBusca((pB) => ({ ...pB, aberta: false }));
                  area.current?.focus();
                }
              }}
            />
            <span className="adc-codigo-busca-contagem" aria-live="polite">
              {busca.termo === '' ? '' : total === 0 ? 'Nenhuma ocorrência' : `${busca.atual + 1} de ${total}`}
            </span>
            <IconButton aria-label="Diferenciar maiúsculas" hint="Aa: só ocorrências com a mesma caixa" aria-pressed={busca.caixa} className={busca.caixa ? 'adc-ligado' : ''} onClick={() => setBusca((pB) => ({ ...pB, caixa: !pB.caixa, atual: 0 }))}>
              <CaseSensitive size={16} />
            </IconButton>
            <IconButton aria-label="Palavra inteira" hint="Só palavras inteiras" aria-pressed={busca.palavra} className={busca.palavra ? 'adc-ligado' : ''} onClick={() => setBusca((pB) => ({ ...pB, palavra: !pB.palavra, atual: 0 }))}>
              <WholeWord size={16} />
            </IconButton>
            <IconButton aria-label="Expressão regular" hint="O termo é uma expressão regular" aria-pressed={busca.regex} className={busca.regex ? 'adc-ligado' : ''} onClick={() => setBusca((pB) => ({ ...pB, regex: !pB.regex, atual: 0 }))}>
              <Regex size={16} />
            </IconButton>
            <IconButton aria-label="Ocorrência anterior" shortcut="Shift+Enter" onClick={() => irParaOcorrencia(busca.atual - 1)} disabled={total === 0}>
              <ArrowUp size={16} />
            </IconButton>
            <IconButton aria-label="Próxima ocorrência" shortcut="Enter" onClick={() => irParaOcorrencia(busca.atual + 1)} disabled={total === 0}>
              <ArrowDown size={16} />
            </IconButton>
            {!somenteLeitura && (
              <IconButton aria-label="Substituir" hint="Mostra o campo de substituição" shortcut="Ctrl+H" aria-pressed={busca.comSubstituir} className={busca.comSubstituir ? 'adc-ligado' : ''} onClick={() => setBusca((pB) => ({ ...pB, comSubstituir: !pB.comSubstituir }))}>
                <Replace size={16} />
              </IconButton>
            )}
            <IconButton aria-label="Fechar a busca" shortcut="Esc" onClick={() => { setBusca((pB) => ({ ...pB, aberta: false })); area.current?.focus(); }}>
              <X size={16} />
            </IconButton>
          </div>
          {busca.comSubstituir && !somenteLeitura && (
            <div className="adc-codigo-busca-linha">
              <input
                className="adc-codigo-busca-campo"
                value={busca.substituicao}
                placeholder="Substituir por"
                aria-label="Substituir por"
                onChange={(pE) => setBusca((pB) => ({ ...pB, substituicao: pE.target.value }))}
                onKeyDown={(pE) => {
                  if (pE.key === 'Enter') {
                    pE.preventDefault();
                    if (pE.ctrlKey)
                      substituirTodas();
                    else
                      substituirAtual();
                  }
                }}
              />
              <button type="button" className="adc-codigo-busca-botao" onClick={substituirAtual} disabled={total === 0}>
                Substituir
              </button>
              <button type="button" className="adc-codigo-busca-botao" onClick={substituirTodas} disabled={total === 0}>
                Substituir todas
              </button>
            </div>
          )}
        </div>
      )}

      {irPara !== null && (
        <div className="adc-codigo-busca" role="dialog" aria-label="Ir para a linha">
          <div className="adc-codigo-busca-linha">
            <input
              ref={campoIrPara}
              className="adc-codigo-busca-campo"
              value={irPara}
              inputMode="numeric"
              placeholder={`Ir para a linha (1 a ${linhas.length})`}
              aria-label="Número da linha"
              onChange={(pE) => setIrPara(pE.target.value.replace(/\D/g, ''))}
              onKeyDown={(pE) => {
                if (pE.key === 'Enter') {
                  pE.preventDefault();
                  confirmarIrPara();
                } else if (pE.key === 'Escape') {
                  pE.preventDefault();
                  setIrPara(null);
                  area.current?.focus();
                }
              }}
            />
            <button type="button" className="adc-codigo-busca-botao" onClick={confirmarIrPara}>
              Ir
            </button>
            <IconButton aria-label="Fechar" shortcut="Esc" onClick={() => { setIrPara(null); area.current?.focus(); }}>
              <X size={16} />
            </IconButton>
          </div>
        </div>
      )}

      <div ref={contenedor} className="adc-codigo-rolagem" style={estiloDoContenedor} onScroll={aoRolar}>
        <div className="adc-codigo-conteudo" style={quebrarLinhas ? undefined : { height: alturaTotal, width: larguraDoConteudo, minWidth: '100%' }}>
          {!quebrarLinhas && linhaDoCursor >= primeiraVisivel && linhaDoCursor <= ultimaVisivel && (
            <div className="adc-codigo-decoracao-linha" style={{ top: linhaDoCursor * metricas.alturaDaLinha, height: metricas.alturaDaLinha }} />
          )}
          {decoracoes}
          <div className="adc-codigo-linhas" aria-hidden="true">
            {linhasVisiveis}
          </div>
          <textarea
            ref={area}
            id={`${id}-area`}
            className="adc-codigo-textarea"
            value={valor}
            onChange={aoMudarTexto}
            onKeyDown={aoTeclarNoTexto}
            onKeyUp={atualizarCursor}
            onClick={atualizarCursor}
            onSelect={atualizarCursor}
            onFocus={() => { atualizarCursor(); aoFocar?.(); }}
            onBlur={aoDesfocar}
            readOnly={somenteLeitura}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap={quebrarLinhas ? 'soft' : 'off'}
            aria-label={rotuloAcessivel}
            aria-multiline="true"
            placeholder={placeholder}
            style={quebrarLinhas ? undefined : { height: alturaTotal, width: larguraDoConteudo, minWidth: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
