import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type JSX, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, BookOpen, Loader2, Search, X } from 'lucide-react';
import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';
import type { RespostaDeTrecho, TrechoDeAjuda } from './XJanelaDeTrecho';
import {
  limitarQuadroDaAjuda, moverQuadroDaAjuda, quadroInicialDaAjuda, redimensionarQuadroDaAjuda,
  type AreaDaAjuda, type DirecaoDaAlca, type QuadroDaAjuda,
} from './quadroDaAjuda';

/** O que veio do perfil é um quadro de verdade? Valor estranho (outra versão, dado corrompido) vira o quadro inicial. */
function ehQuadro(pValor: unknown): pValor is QuadroDaAjuda {
  const q = pValor as Partial<QuadroDaAjuda> | null;
  return !!q && [q.left, q.top, q.width, q.height].every((pN) => typeof pN === 'number' && Number.isFinite(pN));
}

/** As oito alças de redimensionar: arestas finas e cantos maiores, cada uma com o cursor da sua direção. */
const ALCAS: ReadonlyArray<{ direcao: DirecaoDaAlca; classe: string }> = [
  { direcao: 'n', classe: 'top-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { direcao: 's', classe: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { direcao: 'e', classe: 'right-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
  { direcao: 'w', classe: 'left-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
  { direcao: 'ne', classe: 'top-0 right-0 h-4 w-4 cursor-nesw-resize' },
  { direcao: 'nw', classe: 'top-0 left-0 h-4 w-4 cursor-nwse-resize' },
  { direcao: 'se', classe: 'bottom-0 right-0 h-5 w-5 cursor-nwse-resize' },
  { direcao: 'sw', classe: 'bottom-0 left-0 h-5 w-5 cursor-nesw-resize' },
];

/**
 * A documentação ESTRUTURADA de uma tela (dono, 2026-10-18): o que a tela é, o que ela tem (abas,
 * campos, botões, colunas, filtros) e o que o manual diz de cada elemento — vindo de
 * `api/sys/documentacao`, já renderizada em HTML com a qualidade do manual. O painel mora DENTRO da
 * área do App (diretiva de contenção: nunca cobre a casca nem as abas), como coluna à direita.
 *
 * O conteúdo é o que a TELA NÃO DIZ (dono, 2026-10-21): descrição, guias e a explicação do formulário e de
 * cada campo. Não lista rótulos nem mensagens — o usuário já os vê. E todo link de documentação abre AQUI
 * MESMO, com Voltar: o painel nunca navega a aba do App (Ctrl+clique abre o manual em outra aba).
 *
 * É uma JANELA dentro da área do App (dono, 2026-10-21): arrastável pelo cabeçalho, redimensionável por
 * qualquer aresta ou canto, com borda na cor da marca e brilho — e presa à área que a abriu (contenção). A
 * posição e o tamanho ficam no perfil do usuário (`ajuda.painel`), ajustados à área de cada vez.
 */

/** Espelho de `DocumentacaoDeApp` / `DocumentacaoDeElemento` (Tootega.Agente.Docs). Só o que o painel usa. */
export interface ElementoDeAjuda {
  app: string;
  tituloDaApp: string;
  tipo: string;
  nome: string;
  titulo: string;
  aba: string;
  secao: string;
  resumo: string;
}

export interface FonteDeAjuda {
  caminho: string;
  titulo: string;
  fragmentoID: string;
  ancora: string;
  tipo: string;
  relacao: string;
}

export interface DocumentacaoDeAjuda {
  app: string;
  titulo: string;
  descricao?: string;
  tipo?: string;
  markdown: string;
  html: string;
  /** A explicação do formulário e de cada campo, por aba — mostrada DEPOIS dos guias (só na documentação da tela). */
  htmlDoFormulario?: string;
  elementos?: ElementoDeAjuda[];
  fontes: FonteDeAjuda[];
}

interface ResultadoDeBusca {
  elementos: ElementoDeAjuda[];
  trechos: { id: string; titulo: string; cadeia: string[]; ancora: string; html: string }[];
}

export interface XPainelAjudaProps {
  /** Nome interno da App (ex.: `VNDxPedidos`). */
  app: string;
  tituloDaApp: string;
  /** Aba do formulário em foco, se houver — o painel abre nela. */
  aba?: string;
  onFechar: () => void;
}

const ROTA = '/sys/documentacao';
const MANUAL = '/manual/index.html';

const ROTULO_DO_TIPO: Record<string, string> = {
  app: 'Tela', formulario: 'Formulário', aba: 'Aba', secao: 'Seção', campo: 'Campo', coluna: 'Coluna',
  filtro: 'Filtro', botao: 'Botão', 'acao-de-linha': 'Ação de linha', mensagem: 'Mensagem',
};

/** Classes do HTML renderizado: o mesmo "ar" do manual, dentro das cores da casca. */
const CLASSE_DO_CORPO = [
  'text-ui text-brand-text leading-relaxed',
  '[&_h1]:text-ui-lg [&_h1]:font-semibold [&_h1]:mb-2',
  '[&_h2]:text-ui [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1',
  '[&_h3]:text-ui [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1',
  '[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5',
  '[&_table]:w-full [&_table]:text-ui-xs [&_table]:mb-3 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-border-light [&_th]:py-1',
  '[&_td]:border-b [&_td]:border-border-light [&_td]:py-1 [&_td]:pr-2 [&_td]:align-top',
  '[&_img]:rounded [&_img]:border [&_img]:border-border-light [&_img]:my-2 [&_img]:max-w-full',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:mb-2',
  '[&_a]:text-brand-primary [&_a]:underline [&_code]:text-ui-xs [&_code]:bg-brand-surface-2 [&_code]:px-1 [&_code]:rounded',
].join(' ');

export function XPainelAjuda({ app, tituloDaApp, aba, onFechar }: XPainelAjudaProps): JSX.Element {
  const [documento, setDocumento] = useState<DocumentacaoDeAjuda | null>(null);
  const [tela, setTela] = useState<DocumentacaoDeAjuda | null>(null);
  const [busca, setBusca] = useState('');
  const [resultado, setResultado] = useState<ResultadoDeBusca | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [falha, setFalha] = useState('');
  // Pilha de trechos abertos DENTRO do painel (link, fonte, "abrir o trecho"); vazia = a tela/elemento.
  const [pilha, setPilha] = useState<{ id: string; titulo: string }[]>([]);
  const [partes, setPartes] = useState<TrechoDeAjuda[]>([]);
  // Os GUIAS da tela, inteiros e com as imagens explicadas (dono, 2026-10-21): o que torna a ajuda útil.
  const [guias, setGuias] = useState<TrechoDeAjuda[][]>([]);
  const abortar = useRef<AbortController | null>(null);

  // --- A janela: área medida, quadro corrente e gesto (arrasto ou redimensionamento) em curso ---------------
  const painelRef = useRef<HTMLElement>(null);
  const [area, setArea] = useState<AreaDaAjuda | null>(null);
  const [guardado, gravarQuadro, guardadoCarregado] = usePreferenciaDoUsuario<QuadroDaAjuda | null>('ajuda.painel', null);
  const [quadro, setQuadro] = useState<QuadroDaAjuda | null>(null);
  const mexeu = useRef(false);
  const gesto = useRef<{ modo: 'mover' | DirecaoDaAlca; x: number; y: number; inicio: QuadroDaAjuda } | null>(null);

  // A área é o container posicionado do App (o pai do painel): medida ao abrir e a cada mudança de tamanho.
  useLayoutEffect(() => {
    const pai = painelRef.current?.offsetParent as HTMLElement | null;
    if (!pai)
      return;
    const medir = () => setArea({ largura: pai.clientWidth, altura: pai.clientHeight });
    medir();
    if (typeof ResizeObserver === 'undefined')
      return;
    const observador = new ResizeObserver(medir);
    observador.observe(pai);
    return () => observador.disconnect();
  }, []);

  // SEM PISCAR (dono, 2026-10-21): o painel só aparece quando já sabe onde fica. Se o navegador guardou a posição,
  // ela vale na hora; se não guardou (primeiro uso, outro navegador), espera o perfil responder. Depois de
  // visível, só a pessoa o move — a resposta tardia do perfil não o reposiciona mais (ela fica para a próxima vez).
  const tinhaLocal = useRef(ehQuadro(guardado));
  const [visivel, setVisivel] = useState(false);

  // Em LAYOUT effect, antes da pintura: o primeiro quadro desenhado já é o definitivo.
  useLayoutEffect(() => {
    const decidido = tinhaLocal.current || guardadoCarregado;
    if (!decidido)
      return;
    // Área que não se deixa medir (sem container posicionado): aparece na coluna padrão, em vez de sumir.
    if (!area || area.largura <= 0 || area.altura <= 0) {
      setVisivel(true);
      return;
    }
    setQuadro((pAtual) => (pAtual && (mexeu.current || visivel)
      ? limitarQuadroDaAjuda(pAtual, area)
      : limitarQuadroDaAjuda(ehQuadro(guardado) ? guardado : quadroInicialDaAjuda(area), area)));
    setVisivel(true);
  }, [area, guardado, guardadoCarregado, visivel]);

  const iniciarGesto = useCallback((pModo: 'mover' | DirecaoDaAlca) => (pEvento: ReactPointerEvent<HTMLElement>) => {
    if (pEvento.button !== 0 || !quadro)
      return;
    // O cabeçalho arrasta, mas os botões dele (Voltar, Fechar) continuam sendo botões.
    if (pModo === 'mover' && (pEvento.target as HTMLElement).closest('button'))
      return;
    pEvento.preventDefault();
    pEvento.stopPropagation();
    gesto.current = { modo: pModo, x: pEvento.clientX, y: pEvento.clientY, inicio: quadro };
    pEvento.currentTarget.setPointerCapture(pEvento.pointerId);
  }, [quadro]);

  const continuarGesto = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    const atual = gesto.current;
    if (!atual || !area)
      return;
    const dx = pEvento.clientX - atual.x;
    const dy = pEvento.clientY - atual.y;
    mexeu.current = true;
    setQuadro(atual.modo === 'mover'
      ? moverQuadroDaAjuda(atual.inicio, dx, dy, area)
      : redimensionarQuadroDaAjuda(atual.inicio, atual.modo, dx, dy, area));
  }, [area]);

  const terminarGesto = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    if (!gesto.current)
      return;
    gesto.current = null;
    if (pEvento.currentTarget.hasPointerCapture(pEvento.pointerId))
      pEvento.currentTarget.releasePointerCapture(pEvento.pointerId);
    if (quadro)
      gravarQuadro({ left: Math.round(quadro.left), top: Math.round(quadro.top), width: Math.round(quadro.width), height: Math.round(quadro.height) });
  }, [quadro, gravarQuadro]);

  const carregar = useCallback(async (pChamada: (pSinal: AbortSignal) => Promise<void>) => {
    abortar.current?.abort();
    const controlador = new AbortController();
    abortar.current = controlador;
    setCarregando(true);
    setFalha('');
    try {
      await pChamada(controlador.signal);
    } catch (erro) {
      if (!controlador.signal.aborted)
        setFalha(mensagemDeFalha(erro, `consultar a documentação da tela ${tituloDaApp}`));
    } finally {
      if (!controlador.signal.aborted)
        setCarregando(false);
    }
  }, [tituloDaApp]);

  // A tela inteira ao abrir; com aba em foco, direto a aba.
  useEffect(() => {
    void carregar(async (pSinal) => {
      const doc = await api.get<DocumentacaoDeAjuda>(`${ROTA}/app/${encodeURIComponent(app)}`, pSinal, true);
      const dosGuias: TrechoDeAjuda[][] = [];
      for (const fonte of doc.fontes.filter((pF) => pF.relacao === 'cobre')) {
        const resposta = await api.get<RespostaDeTrecho>(`${ROTA}/trecho?id=${encodeURIComponent(fonte.fragmentoID)}`, pSinal, true);
        if (resposta.partes.length > 0)
          dosGuias.push(resposta.partes);
      }
      setGuias(dosGuias);
      setTela(doc);
      if (aba) {
        const daAba = await api.get<DocumentacaoDeAjuda>(`${ROTA}/elemento?app=${encodeURIComponent(app)}&tipo=aba&nome=${encodeURIComponent(aba)}`, pSinal, true);
        setDocumento(daAba);
      } else {
        setDocumento(doc);
      }
    });
    return () => abortar.current?.abort();
  }, [app, aba, carregar]);

  const abrirElemento = useCallback((pElemento: ElementoDeAjuda) => {
    setResultado(null);
    void carregar(async (pSinal) => {
      const doc = await api.get<DocumentacaoDeAjuda>(
        `${ROTA}/elemento?app=${encodeURIComponent(pElemento.app)}&tipo=${encodeURIComponent(pElemento.tipo)}&nome=${encodeURIComponent(pElemento.nome)}`, pSinal, true);
      setDocumento(doc);
    });
  }, [carregar]);

  const buscar = useCallback((pEvento: FormEvent) => {
    pEvento.preventDefault();
    const texto = busca.trim();
    if (!texto)
      return;
    void carregar(async (pSinal) => {
      const achado = await api.get<ResultadoDeBusca>(`${ROTA}/buscar?q=${encodeURIComponent(texto)}&app=${encodeURIComponent(app)}&limite=10`, pSinal, true);
      setResultado(achado);
    });
  }, [app, busca, carregar]);

  const voltarParaATela = useCallback(() => {
    setResultado(null);
    setDocumento(tela);
  }, [tela]);

  const abrirTrecho = useCallback((pID: string, pTitulo: string) => {
    if (pID)
      setPilha((pPilha) => [...pPilha, { id: pID, titulo: pTitulo || pID }]);
  }, []);

  const trechoAtual = pilha.length > 0 ? pilha[pilha.length - 1] : null;

  useEffect(() => {
    if (!trechoAtual)
      return;
    void carregar(async (pSinal) => {
      const resposta = await api.get<RespostaDeTrecho>(`${ROTA}/trecho?id=${encodeURIComponent(trechoAtual.id)}`, pSinal, true);
      setPartes(resposta.partes);
    });
  }, [trechoAtual, carregar]);

  const voltar = useCallback(() => {
    if (pilha.length > 0)
      setPilha((pPilha) => pPilha.slice(0, -1));
    else
      voltarParaATela();
  }, [pilha.length, voltarParaATela]);

  /**
   * Link clicado no conteúdo: manual (`/manual/index.html#ancora`) ou `#secao` ⇒ abre o trecho AQUI, empilhado;
   * endereço externo ⇒ nova aba. Nada navega a aba do App. Ctrl/Shift/Cmd+clique segue o navegador (manual inteiro).
   */
  const aoClicarNoConteudo = useCallback((pEvento: React.MouseEvent<HTMLElement>) => {
    const link = (pEvento.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!link || pEvento.ctrlKey || pEvento.metaKey || pEvento.shiftKey)
      return;
    const href = link.getAttribute('href') ?? '';
    const cerquilha = href.indexOf('#');
    if ((href.startsWith(MANUAL) || href.startsWith('#')) && cerquilha >= 0) {
      pEvento.preventDefault();
      abrirTrecho(href.slice(cerquilha + 1), link.textContent?.trim() ?? '');
      return;
    }
    if (/^https?:\/\//i.test(href)) {
      pEvento.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }, [abrirTrecho]);

  /**
   * O livro do cabeçalho (dono, 2026-10-21): o MANUAL COMPLETO numa aba nova do navegador, já na seção que se lê —
   * o trecho aberto ou, na tela, o guia dela. Sem seção conhecida, o manual desde o começo. A aba do App não muda.
   */
  const abrirManualCompleto = useCallback(() => {
    const ancora = trechoAtual
      ? partes[0]?.ancora ?? ''
      : documento?.fontes.find((pF) => pF.relacao === 'cobre')?.ancora ?? documento?.fontes[0]?.ancora ?? '';
    window.open(ancora ? `${MANUAL}#${ancora}` : MANUAL, '_blank', 'noopener,noreferrer');
  }, [trechoAtual, partes, documento]);

  // A busca do painel não devolve MENSAGENS (dono, 2026-10-21): elas não são parte da ajuda da tela.
  const elementosDaBusca = (resultado?.elementos ?? []).filter((pE) => pE.tipo !== 'mensagem');

  const naTela = documento !== null && documento === tela && resultado === null && pilha.length === 0;

  return (
    <aside
      ref={painelRef}
      // Antes da primeira medição, a coluna à direita de sempre; depois, o quadro (posição e tamanho) da janela.
      // Invisível (mas medível) até o quadro estar decidido: nada de aparecer num lugar e pular para outro.
      // Área sem medida: visível na coluna padrão (classes abaixo), sem quadro próprio.
      style={!visivel
        ? { visibility: 'hidden' }
        : quadro ? { left: quadro.left, top: quadro.top, width: quadro.width, height: quadro.height } : undefined}
      // Borda na cor da marca e brilho (halo + glow), como o painel da Jaci (dono, 2026-10-21).
      className={`absolute z-20 flex max-w-full flex-col overflow-hidden rounded-xl border-2 border-brand-primary/60 bg-brand-surface
                  shadow-[0_0_0_4px_hsl(var(--brand-primary)/0.12),0_0_28px_6px_hsl(var(--brand-primary)/0.35),0_25px_50px_-12px_rgb(0_0_0/0.4)]
                  ${quadro && visivel ? '' : 'inset-y-2 right-2 w-[clamp(480px,55%,1000px)]'}`}
      role="complementary"
      aria-label={`Ajuda da tela ${tituloDaApp}`}
      data-testid="painel-ajuda"
    >
      {ALCAS.map((pAlca) => (
        <div
          key={pAlca.direcao}
          className={`absolute z-10 ${pAlca.classe}`}
          title="Arraste para redimensionar"
          data-testid={`painel-ajuda-redimensionar-${pAlca.direcao}`}
          onPointerDown={iniciarGesto(pAlca.direcao)}
          onPointerMove={continuarGesto}
          onPointerUp={terminarGesto}
          onPointerCancel={() => { gesto.current = null; }}
        />
      ))}
      <header
        className="flex cursor-move select-none items-center gap-2 border-b border-border-light px-3 py-2"
        title="Arraste para mover"
        data-testid="painel-ajuda-cabecalho"
        onPointerDown={iniciarGesto('mover')}
        onPointerMove={continuarGesto}
        onPointerUp={terminarGesto}
        onPointerCancel={() => { gesto.current = null; }}
      >
        {!naTela && (
          <button type="button" onClick={voltar} className="rounded p-1 hover:bg-brand-surface-2" title={`Voltar para ${tituloDaApp}`} aria-label={`Voltar para ${tituloDaApp}`}>
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-ui font-semibold truncate">{trechoAtual?.titulo ?? documento?.titulo ?? tituloDaApp}</span>
        {!trechoAtual && documento?.tipo && documento.tipo !== 'app' && (
          <span className="text-ui-xs text-brand-text-secondary">{ROTULO_DO_TIPO[documento.tipo] ?? documento.tipo}</span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={abrirManualCompleto}
          className="rounded p-1 hover:bg-brand-surface-2"
          title="Abrir o manual completo em outra aba"
          aria-label="Abrir o manual completo em outra aba"
          data-testid="painel-ajuda-manual"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <button type="button" onClick={onFechar} className="rounded p-1 hover:bg-brand-surface-2" title="Fechar a ajuda" aria-label="Fechar a ajuda">
          <X className="h-4 w-4" />
        </button>
      </header>

      <form onSubmit={buscar} className="flex items-center gap-1 border-b border-border-light px-3 py-2">
        <input
          type="search"
          value={busca}
          onChange={(pEvento) => setBusca(pEvento.target.value)}
          placeholder="Campo, botão, aba ou assunto…"
          aria-label="Buscar na documentação desta tela"
          className="min-w-0 flex-1 rounded border border-border-light bg-brand-surface px-2 py-1 text-ui"
        />
        <button type="submit" className="rounded p-1 hover:bg-brand-surface-2" title="Buscar" aria-label="Buscar">
          <Search className="h-4 w-4" />
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2" onClick={aoClicarNoConteudo} data-testid="painel-ajuda-conteudo">
        {carregando && (
          <p className="flex items-center gap-2 text-ui text-brand-text-secondary"><Loader2 className="h-4 w-4 animate-spin" />{'Consultando a documentação…'}</p>
        )}
        {falha && <p className="text-ui text-warning" role="alert">{falha}</p>}

        {!carregando && trechoAtual && partes.map((pParte) => (
          // HTML do servidor: o mesmo pipeline do manual publicado em /manual.
          <div key={pParte.id} className={CLASSE_DO_CORPO} dangerouslySetInnerHTML={{ __html: pParte.html }} />
        ))}

        {!carregando && !trechoAtual && resultado && (
          <div>
            {elementosDaBusca.length === 0 && resultado.trechos.length === 0 && (
              <p className="text-ui text-brand-text-secondary">{`Nada encontrado para "${busca.trim()}" na documentação de ${tituloDaApp}. Tente o rótulo exato que a tela mostra.`}</p>
            )}
            {elementosDaBusca.length > 0 && (
              <ul className="mb-3">
                {elementosDaBusca.map((pElemento) => (
                  <li key={`${pElemento.tipo}:${pElemento.nome}`}>
                    <button type="button" onClick={() => abrirElemento(pElemento)} className="w-full rounded px-2 py-1 text-left hover:bg-brand-surface-2">
                      <span className="text-ui-xs text-brand-text-secondary">{ROTULO_DO_TIPO[pElemento.tipo] ?? pElemento.tipo}{pElemento.aba ? ` · aba ${pElemento.aba}` : ''}</span>
                      <span className="block text-ui font-medium">{pElemento.titulo}</span>
                      {pElemento.resumo && <span className="block text-ui-xs text-brand-text-secondary">{pElemento.resumo}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {resultado.trechos.map((pTrecho) => (
              <section key={pTrecho.id} className="mb-3 rounded border border-border-light p-2">
                <p className="mb-1 text-ui-xs text-brand-text-secondary">{pTrecho.cadeia.join(' › ')}</p>
                <div className={CLASSE_DO_CORPO} dangerouslySetInnerHTML={{ __html: pTrecho.html }} />
                <a
                  href={`${MANUAL}#${pTrecho.ancora}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-xs text-brand-primary underline"
                  onClick={(pEvento) => { if (pEvento.ctrlKey || pEvento.metaKey || pEvento.shiftKey) return; pEvento.preventDefault(); pEvento.stopPropagation(); abrirTrecho(pTrecho.id, pTrecho.titulo); }}
                >{'Abrir o trecho'}</a>
              </section>
            ))}
          </div>
        )}

        {!carregando && !trechoAtual && !resultado && documento && (
          <div>
            {/* HTML do servidor: Markdown da documentação do produto renderizado pelo mesmo pipeline do manual — o mesmo conteúdo já publicado em /manual. */}
            <div className={CLASSE_DO_CORPO} dangerouslySetInnerHTML={{ __html: documento.html }} />
            {naTela && guias.map((pPartes) => (
              <section key={pPartes[0].id} className="mt-3 border-t border-border-light pt-3" data-testid="painel-ajuda-guia">
                {pPartes.map((pParte) => (
                  <div key={pParte.id} className={CLASSE_DO_CORPO} dangerouslySetInnerHTML={{ __html: pParte.html }} />
                ))}
              </section>
            ))}
            {naTela && documento.htmlDoFormulario && (
              <section className="mt-3 border-t border-border-light pt-3" data-testid="painel-ajuda-formulario">
                <div className={CLASSE_DO_CORPO} dangerouslySetInnerHTML={{ __html: documento.htmlDoFormulario }} />
              </section>
            )}
            {!naTela && documento.fontes.length > 0 && (
              <p className="mt-3 text-ui-xs text-brand-text-secondary">
                {'Fontes: '}
                {documento.fontes.map((pFonte, pIndice) => (
                  <span key={pFonte.fragmentoID}>
                    {pIndice > 0 ? ' · ' : ''}
                    <a
                      href={`${MANUAL}#${pFonte.ancora}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                      title="Abrir o trecho aqui (o manual completo abre com Ctrl+clique)"
                      onClick={(pEvento) => { if (pEvento.ctrlKey || pEvento.metaKey || pEvento.shiftKey) return; pEvento.preventDefault(); pEvento.stopPropagation(); abrirTrecho(pFonte.fragmentoID, pFonte.titulo); }}
                    >{pFonte.titulo}</a>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
