import { useCallback, useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, ExternalLink, GripHorizontal, Loader2, X } from 'lucide-react';
import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';

/**
 * A janela de trecho (dono, 2026-10-18): ao clicar numa "estrela" da Jaci ou num "ver mais", abre à
 * ESQUERDA uma janela flutuante, arrastável pelo cabeçalho e redimensionável pelo canto, só com a
 * seção citada — renderizada pelo servidor (`api/sys/documentacao/trecho`) com a qualidade do manual —
 * sem abrir o documento inteiro. É elemento da casca (como o painel da Jaci): portal, camada do
 * `ZIndexManager`. Posição e tamanho ficam lembrados enquanto a página vive.
 */

/** Espelho de `TrechoEncontrado` (Tootega.Agente.Docs). Só o que a janela usa. */
export interface TrechoDeAjuda {
  id: string;
  titulo: string;
  cadeia: string[];
  caminho: string;
  tipo: string;
  ancora: string;
  html: string;
}

/** Um relacionado (espelho de `FonteDeElemento`): seção da mesma página, documento da mesma tela, quem cita o elemento, norma. */
export interface RelacionadoDeAjuda {
  caminho: string;
  titulo: string;
  fragmentoID: string;
  ancora: string;
  tipo: string;
  relacao: string;
}

/** Espelho de `RespostaDeTrecho`. */
export interface RespostaDeTrecho {
  partes: TrechoDeAjuda[];
  relacionados: RelacionadoDeAjuda[];
}

export interface XJanelaDeTrechoProps {
  /** O id do fragmento (`caminho#secao`), como vem nas fontes da Jaci e no "ver mais". */
  id: string;
  /** Título mostrado enquanto o trecho carrega. */
  titulo: string;
  onFechar: () => void;
  /**
   * Camada mínima: a janela fica ACIMA deste z-index. Serve a quem a abre de um painel que está acima do
   * contador comum (a Jaci fixada) — sem isto o trecho nasceria escondido atrás do painel que o abriu.
   */
  acimaDe?: number;
}

const ROTA = '/sys/documentacao/trecho';
const MANUAL = '/manual/index.html';
const LARGURA_MINIMA = 300;
const ALTURA_MINIMA = 200;
const MARGEM = 8;

interface Quadro { left: number; top: number; width: number; height: number }

/**
 * Nasce na ÁREA DA APLICAÇÃO (`[data-app-area]`: à direita do menu, abaixo do cabeçalho), proporcional a
 * ela — 60% da largura e 75% da altura, encostada ao canto superior esquerdo (dono, 2026-10-18). Sem a
 * área (tela de entrada), cai para a janela do navegador. Quem já arrastou ou redimensionou reabre onde
 * deixou: o quadro é preferência do perfil (`ajuda.trecho`).
 */
function quadroInicial(): Quadro {
  const area = areaDaAplicacao();
  const largura = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const altura = typeof window === 'undefined' ? 768 : window.innerHeight;
  if (area) {
    return {
      left: area.left + 16,
      top: area.top + 16,
      width: Math.max(LARGURA_MINIMA, Math.round((area.right - area.left) * 0.6)),
      height: Math.max(ALTURA_MINIMA, Math.round((area.bottom - area.top) * 0.75)),
    };
  }
  return { left: 16, top: 72, width: Math.min(460, largura - 2 * MARGEM), height: Math.min(520, altura - 72 - MARGEM) };
}

/**
 * Os limites da janela: a ÁREA DA APLICAÇÃO quando ela existe (a janela nunca cobre o menu nem o
 * cabeçalho — dono, 2026-10-18), senão a janela do navegador.
 */
function limites(): { left: number; top: number; right: number; bottom: number } {
  const area = areaDaAplicacao();
  if (area)
    return area;
  const largura = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const altura = typeof window === 'undefined' ? 768 : window.innerHeight;
  return { left: 0, top: 0, right: largura, bottom: altura };
}

/**
 * A área da aplicação: `[data-app-area]` quando há aba aberta; sem aba (a página inicial), o conteúdo do
 * `<main>` da casca — o retângulo dele menos o recuo do cabeçalho (`padding-top`) e do menu (`padding-left`),
 * que é exatamente o espaço à direita do menu e abaixo do cabeçalho (dono, 2026-10-18: a janela abria sobre o
 * menu na página inicial porque só a primeira marca era procurada).
 */
function areaDaAplicacao(): { left: number; top: number; right: number; bottom: number } | null {
  if (typeof document === 'undefined')
    return null;
  const marcada = document.querySelector('[data-app-area]')?.getBoundingClientRect();
  if (marcada && marcada.width > LARGURA_MINIMA && marcada.height > ALTURA_MINIMA)
    return { left: marcada.left, top: marcada.top, right: marcada.right, bottom: marcada.bottom };

  const principal = document.querySelector<HTMLElement>('main[data-tour="app-content"]');
  if (!principal)
    return null;
  const rect = principal.getBoundingClientRect();
  const estilo = getComputedStyle(principal);
  const left = rect.left + (parseFloat(estilo.paddingLeft) || 0);
  const top = rect.top + (parseFloat(estilo.paddingTop) || 0);
  const right = rect.right - (parseFloat(estilo.paddingRight) || 0);
  const bottom = rect.bottom - (parseFloat(estilo.paddingBottom) || 0);
  return right - left > LARGURA_MINIMA && bottom - top > ALTURA_MINIMA ? { left, top, right, bottom } : null;
}

/** Mantém a janela dentro dos limites, com tamanho mínimo. */
function dentroDaTela(pQuadro: Quadro): Quadro {
  const l = limites();
  const width = Math.max(LARGURA_MINIMA, Math.min(pQuadro.width, l.right - l.left - 2 * MARGEM));
  const height = Math.max(ALTURA_MINIMA, Math.min(pQuadro.height, l.bottom - l.top - 2 * MARGEM));
  return {
    width,
    height,
    left: Math.max(l.left + MARGEM, Math.min(pQuadro.left, l.right - width - MARGEM)),
    top: Math.max(l.top + MARGEM, Math.min(pQuadro.top, l.bottom - height - MARGEM)),
  };
}

const ROTULO_DO_TIPO: Record<string, string> = { tutorial: 'tutorial', guia: 'guia', referencia: 'referência', explicacao: 'explicação', norma: 'norma' };

/** Os grupos de relacionados, na ordem em que aparecem; o rótulo é o que a pessoa lê. */
const GRUPOS_DE_RELACIONADOS: [string, string][] = [
  ['secao', 'Nesta página'],
  ['app', 'Sobre a mesma tela'],
  ['menciona', 'Guias que citam este item'],
  ['norma', 'Normas relacionadas'],
];

/** O estilo do HTML da ajuda (pipeline do manual) — o mesmo na janela de trecho e nas novidades da versão. */
export const CLASSE_DO_CORPO_DA_AJUDA = [
  'text-ui text-brand-text leading-relaxed',
  '[&_h1]:text-ui-lg [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-ui [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1',
  '[&_h3]:text-ui [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:text-ui [&_h4]:font-medium [&_h4]:mt-2 [&_h5]:text-ui [&_h5]:font-medium [&_h5]:mt-2',
  '[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5',
  '[&_table]:w-full [&_table]:text-ui-xs [&_table]:mb-3 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-border-light [&_th]:py-1',
  '[&_td]:border-b [&_td]:border-border-light [&_td]:py-1 [&_td]:pr-2 [&_td]:align-top',
  '[&_img]:rounded [&_img]:border [&_img]:border-border-light [&_img]:my-2 [&_img]:max-w-full',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:mb-2',
  '[&_a]:text-brand-primary [&_a]:underline [&_code]:text-ui-xs [&_code]:bg-brand-surface-2 [&_code]:px-1 [&_code]:rounded',
].join(' ');

export function XJanelaDeTrecho({ id, titulo, onFechar, acimaDe }: XJanelaDeTrechoProps): JSX.Element | null {
  // Navegação DENTRO da janela (dono, 2026-10-18): um link do trecho abre o trecho ligado aqui mesmo, com
  // pilha para voltar — a janela nunca leva a pessoa para fora.
  const [pilha, setPilha] = useState<{ id: string; titulo: string }[]>(() => [{ id, titulo }]);
  const atual = pilha[pilha.length - 1];
  const [quadroGuardado, gravarQuadro, quadroCarregado] = usePreferenciaDoUsuario<Quadro | null>('ajuda.trecho', null);
  const [quadro, setQuadro] = useState<Quadro>(() => dentroDaTela(quadroGuardado ?? quadroInicial()));
  const mexeu = useRef(false);
  const [z] = useState(() => Math.max(ZIndexManager.next(), (acimaDe ?? 0) + 1));

  // O perfil respondeu depois de a janela abrir: vale o que ele guardou, a menos que a pessoa já tenha mexido.
  useEffect(() => {
    if (quadroCarregado && quadroGuardado && !mexeu.current)
      setQuadro(dentroDaTela(quadroGuardado));
  }, [quadroCarregado, quadroGuardado]);
  const [partes, setPartes] = useState<TrechoDeAjuda[]>([]);
  const [relacionados, setRelacionados] = useState<RelacionadoDeAjuda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falha, setFalha] = useState('');
  const gesto = useRef<{ modo: 'mover' | 'redimensionar'; x: number; y: number; quadro: Quadro } | null>(null);

  // Um id novo vindo de fora (outra estrela clicada) recomeça a pilha.
  useEffect(() => {
    setPilha([{ id, titulo }]);
  }, [id, titulo]);

  useEffect(() => {
    const abortar = new AbortController();
    setCarregando(true);
    setFalha('');
    api.get<RespostaDeTrecho>(`${ROTA}?id=${encodeURIComponent(atual.id)}`, abortar.signal, true)
      .then((pResposta) => { setPartes(pResposta.partes); setRelacionados(pResposta.relacionados ?? []); })
      .catch((pErro) => { if (!abortar.signal.aborted) setFalha(mensagemDeFalha(pErro, `abrir o trecho "${atual.titulo}" da documentação`)); })
      .finally(() => { if (!abortar.signal.aborted) setCarregando(false); });
    return () => abortar.abort();
  }, [atual]);

  /**
   * Link clicado dentro do trecho: âncora do manual ⇒ empilha e abre aqui; âncora solta (#secao) ⇒ idem;
   * endereço externo ⇒ nova aba, para a janela continuar onde está. Nada navega a página.
   */
  const aoClicarNoConteudo = useCallback((pEvento: React.MouseEvent<HTMLElement>) => {
    const link = (pEvento.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!link)
      return;
    const href = link.getAttribute('href') ?? '';
    pEvento.preventDefault();
    const cerquilha = href.indexOf('#');
    if (href.startsWith(MANUAL) && cerquilha >= 0) {
      const ancora = href.slice(cerquilha + 1);
      if (ancora)
        setPilha((pPilha) => [...pPilha, { id: ancora, titulo: link.textContent?.trim() || ancora }]);
      return;
    }
    if (href.startsWith('#')) {
      setPilha((pPilha) => [...pPilha, { id: href.slice(1), titulo: link.textContent?.trim() || href }]);
      return;
    }
    if (/^https?:\/\//i.test(href))
      window.open(href, '_blank', 'noopener,noreferrer');
  }, []);

  const voltar = useCallback(() => setPilha((pPilha) => (pPilha.length > 1 ? pPilha.slice(0, -1) : pPilha)), []);

  // Fecha com Esc — é janela da casca, não modal de App (onde o Esc não fecha por decisão do dono).
  useEffect(() => {
    const aoTeclar = (pEvento: KeyboardEvent) => { if (pEvento.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const iniciar = useCallback((pModo: 'mover' | 'redimensionar') => (pEvento: ReactPointerEvent<HTMLElement>) => {
    if (pEvento.button !== 0)
      return;
    pEvento.preventDefault();
    gesto.current = { modo: pModo, x: pEvento.clientX, y: pEvento.clientY, quadro };
    pEvento.currentTarget.setPointerCapture(pEvento.pointerId);
  }, [quadro]);

  const mover = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    const atual = gesto.current;
    if (!atual)
      return;
    const dx = pEvento.clientX - atual.x;
    const dy = pEvento.clientY - atual.y;
    const novo = dentroDaTela(atual.modo === 'mover'
      ? { ...atual.quadro, left: atual.quadro.left + dx, top: atual.quadro.top + dy }
      : { ...atual.quadro, width: atual.quadro.width + dx, height: atual.quadro.height + dy });
    mexeu.current = true;
    setQuadro(novo);
    gravarQuadro(novo);   // no perfil, depois que a pessoa parar de mexer
  }, [gravarQuadro]);

  const terminar = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    if (!gesto.current)
      return;
    gesto.current = null;
    if (pEvento.currentTarget.hasPointerCapture(pEvento.pointerId))
      pEvento.currentTarget.releasePointerCapture(pEvento.pointerId);
  }, []);

  if (typeof document === 'undefined')
    return null;

  const primeira = partes[0];
  const tituloMostrado = primeira ? primeira.cadeia[primeira.cadeia.length - 1] ?? primeira.titulo : atual.titulo;
  const documento = primeira ? primeira.cadeia[0] ?? '' : '';

  return createPortal(
    <section
      role="dialog"
      aria-label={`Trecho da documentação: ${tituloMostrado}`}
      data-testid="janela-de-trecho"
      className="fixed flex flex-col rounded-lg border-2 border-brand-primary/60 bg-brand-surface shadow-2xl"
      // Borda e brilho na cor da marca (dono, 2026-10-18): a janela flutua sobre a tela e tem de se destacar dela.
      style={{ left: quadro.left, top: quadro.top, width: quadro.width, height: quadro.height, zIndex: z, boxShadow: '0 0 0 1px hsl(var(--brand-primary) / 0.35), 0 0 28px 2px hsl(var(--brand-primary) / 0.35), 0 24px 48px -12px rgb(0 0 0 / 0.6)' }}
    >
      <header
        className="flex cursor-move select-none items-center gap-2 rounded-t-lg border-b border-border-light bg-brand-surface-2 px-3 py-2"
        onPointerDown={iniciar('mover')}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        data-testid="janela-de-trecho-cabecalho"
      >
        {pilha.length > 1 && (
          <button
            type="button"
            onClick={voltar}
            onPointerDown={(pEvento) => pEvento.stopPropagation()}
            className="rounded p-1 text-brand-text-secondary hover:bg-brand-surface hover:text-brand-primary"
            title="Voltar ao trecho anterior"
            aria-label="Voltar ao trecho anterior"
            data-testid="janela-de-trecho-voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <BookOpen className="h-4 w-4 flex-shrink-0 text-brand-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-ui font-semibold" title={tituloMostrado}>{tituloMostrado}</div>
          {documento && documento !== tituloMostrado && (
            <div className="truncate text-ui-xs text-brand-text-secondary" title={documento}>
              {documento}{primeira?.tipo ? ` · ${ROTULO_DO_TIPO[primeira.tipo] ?? primeira.tipo}` : ''}
            </div>
          )}
        </div>
        {/* Só o que está no manual publicado (docs/produto) tem seção lá; norma do acervo abre só aqui. */}
        {primeira && primeira.caminho.startsWith('docs/produto/') && (
          <a
            href={`${MANUAL}#${primeira.ancora}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1 text-brand-text-secondary hover:bg-brand-surface hover:text-brand-primary"
            title="Abrir esta seção no manual completo"
            aria-label="Abrir esta seção no manual completo"
            onPointerDown={(pEvento) => pEvento.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={onFechar}
          onPointerDown={(pEvento) => pEvento.stopPropagation()}
          className="rounded p-1 text-brand-text-secondary hover:bg-brand-surface hover:text-brand-primary"
          title="Fechar"
          aria-label="Fechar o trecho"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3" onClick={aoClicarNoConteudo} data-testid="janela-de-trecho-conteudo">
        {carregando && (
          <p className="flex items-center gap-2 text-ui text-brand-text-secondary"><Loader2 className="h-4 w-4 animate-spin" />{'Buscando o trecho…'}</p>
        )}
        {falha && <p className="text-ui text-warning" role="alert">{falha}</p>}
        {!carregando && !falha && partes.map((pParte) => (
          // HTML do servidor: a documentação do produto renderizada pelo mesmo pipeline do manual já publicado em /manual.
          <div key={pParte.id} className={CLASSE_DO_CORPO_DA_AJUDA} dangerouslySetInnerHTML={{ __html: pParte.html }} />
        ))}
        {!carregando && !falha && relacionados.length > 0 && (
          <nav className="mt-4 border-t border-border-light pt-3" aria-label="Relacionados" data-testid="janela-de-trecho-relacionados">
            {GRUPOS_DE_RELACIONADOS.map(([relacao, rotulo]) => {
              const itens = relacionados.filter((pR) => pR.relacao === relacao);
              if (itens.length === 0)
                return null;
              return (
                <div key={relacao} className="mb-2">
                  <div className="text-ui-xs font-semibold text-brand-text-secondary">{rotulo}</div>
                  <ul>
                    {itens.map((pItem) => (
                      <li key={pItem.fragmentoID}>
                        <button
                          type="button"
                          onClick={() => setPilha((pPilha) => [...pPilha, { id: pItem.fragmentoID, titulo: pItem.titulo }])}
                          className="w-full rounded px-1 py-0.5 text-left text-ui text-brand-primary hover:bg-brand-surface-2 hover:underline"
                        >
                          {pItem.titulo}
                          {pItem.tipo && <span className="text-ui-xs text-brand-text-muted">{` · ${ROTULO_DO_TIPO[pItem.tipo] ?? pItem.tipo}`}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      <div
        className="absolute bottom-0 right-0 flex h-5 w-5 cursor-nwse-resize items-end justify-end text-brand-text-muted"
        onPointerDown={iniciar('redimensionar')}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        title="Arraste para redimensionar"
        data-testid="janela-de-trecho-redimensionar"
      >
        <GripHorizontal className="h-3.5 w-3.5 -rotate-45" />
      </div>
    </section>,
    document.body,
  );
}
