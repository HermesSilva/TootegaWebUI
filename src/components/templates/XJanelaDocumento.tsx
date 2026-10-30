/**
 * XJanelaDocumento — JANELA FLUTUANTE que mostra um documento em PDF (o DANFE da nota, ao lado do formulário
 * da carta de correção — dono, 2026-10-22). Arrasta pelo cabeçalho e redimensiona pelo canto, sempre DENTRO
 * da área que a contém (diretiva de contenção: nunca cobre a casca nem as abas). Fica por cima do diálogo
 * que a abriu e não o bloqueia: o usuário lê o documento e escreve ao mesmo tempo.
 *
 * O PDF vem de um POST (o mesmo endpoint da ação que baixa o documento) e é exibido pelo leitor de PDF do
 * navegador. A geometria é a de `quadroDaJanela`: funções puras, em pixels da área do App, sem margem — a
 * janela encosta nas bordas do App.
 * Nenhum conhecimento de App aqui — quem declara o endpoint e os textos é o back (CE-19).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';

import { api } from '@core/lib/api';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import {
  limitarQuadroDaJanela, moverQuadroDaJanela, quadroInicialDaJanela, redimensionarQuadroDaJanela,
  type AreaDaJanela, type QuadroDaJanela,
} from './quadroDaJanela';
import { IconButton } from '../ui/IconButton';

interface XJanelaDocumentoProps {
  /** Título da janela (declarado no back). */
  titulo: string;
  /** Endpoint JÁ RESOLVIDO (sem marcadores) que devolve o PDF por POST. */
  endpoint: string;
  onClose: () => void;
}

export function XJanelaDocumento({ titulo, endpoint, onClose }: XJanelaDocumentoProps): JSX.Element {
  const [zIndex] = useState(() => ZIndexManager.next());
  const raiz = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<AreaDaJanela | null>(null);
  // Onde a área do App começa, medida a partir do quadro em que a janela está posicionada (pixels).
  const [origem, setOrigem] = useState({ x: 0, y: 0 });
  const [quadro, setQuadro] = useState<QuadroDaJanela | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  // O LIMITE é a ÁREA DO APP (`[data-app-area]`): a janela encosta à esquerda, à direita, no topo e na base
  // dela (dono, 2026-10-22). A janela é posicionada pelo ancestral POSICIONADO (`offsetParent`, o quadro do
  // diálogo que a abriu), então o quadro — que vive nas coordenadas da área do App — é deslocado pela
  // diferença entre os dois. Sem área marcada, vale o próprio quadro posicionado.
  useLayoutEffect(() => {
    const posicionado = (raiz.current?.offsetParent as HTMLElement | null) ?? raiz.current?.parentElement;
    if (!posicionado)
      return;
    const limite = (posicionado.closest('[data-app-area]') as HTMLElement | null) ?? posicionado;
    const medir = (): void => {
      const caixaLimite = limite.getBoundingClientRect();
      const caixaPosicionado = posicionado.getBoundingClientRect();
      const medida = { largura: limite.clientWidth, altura: limite.clientHeight };
      setOrigem({ x: caixaLimite.left - caixaPosicionado.left, y: caixaLimite.top - caixaPosicionado.top });
      setArea(medida);
      setQuadro((pAtual) => pAtual ? limitarQuadroDaJanela(pAtual, medida) : quadroInicialDaJanela(medida));
    };
    medir();
    if (typeof ResizeObserver === 'undefined')
      return;
    const observador = new ResizeObserver(medir);
    observador.observe(limite);
    return () => observador.disconnect();
  }, []);

  // Busca o PDF uma vez por endpoint. A recusa do back já sai no diálogo global; aqui a janela diz o que
  // houve, em vez de ficar em branco (erro mudo é defeito).
  useEffect(() => {
    let vivo = true;
    let criada: string | null = null;
    setUrl(null);
    setFalha(null);
    void (async () => {
      try {
        const { blob } = await api.downloadBlob(endpoint, {});
        if (!vivo)
          return;
        criada = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setUrl(criada);
      } catch (erro) {
        if (vivo)
          setFalha(mensagemDeFalha(erro, `abrir o documento (${endpoint})`));
      }
    })();
    return () => {
      vivo = false;
      if (criada)
        URL.revokeObjectURL(criada);
    };
  }, [endpoint]);

  // Arrasto (cabeçalho) e redimensionamento (canto): o ponteiro fica CAPTURADO pela alça, então passar por
  // cima do PDF (um iframe) durante o gesto não o interrompe.
  const gesto = useRef<{ modo: 'mover' | 'redimensionar'; x: number; y: number; inicio: QuadroDaJanela } | null>(null);

  const iniciar = useCallback((pModo: 'mover' | 'redimensionar') => (pEvento: ReactPointerEvent<HTMLElement>) => {
    if (!quadro || pEvento.button !== 0 || (pModo === 'mover' && (pEvento.target as HTMLElement).closest('button, a')))
      return;
    gesto.current = { modo: pModo, x: pEvento.clientX, y: pEvento.clientY, inicio: quadro };
    pEvento.currentTarget.setPointerCapture(pEvento.pointerId);
  }, [quadro]);

  const mover = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    const g = gesto.current;
    if (!g || !area)
      return;
    const dx = pEvento.clientX - g.x;
    const dy = pEvento.clientY - g.y;
    setQuadro(g.modo === 'mover'
      ? moverQuadroDaJanela(g.inicio, dx, dy, area)
      : redimensionarQuadroDaJanela(g.inicio, dx, dy, area));
  }, [area]);

  const terminar = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    gesto.current = null;
    if (pEvento.currentTarget.hasPointerCapture(pEvento.pointerId))
      pEvento.currentTarget.releasePointerCapture(pEvento.pointerId);
  }, []);

  return (
    <div
      ref={raiz}
      role="dialog"
      aria-label={titulo}
      data-testid="janela-documento"
      className="x-moldura-modal absolute flex flex-col rounded-xl bg-brand-surface overflow-hidden"
      style={quadro
        ? { left: origem.x + quadro.left, top: origem.y + quadro.top, width: quadro.width, height: quadro.height, zIndex }
        : { inset: 0, visibility: 'hidden', zIndex }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border-light bg-muted-bg cursor-move select-none touch-none shrink-0"
        onPointerDown={iniciar('mover')}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
      >
        <h2 className="text-ui font-semibold text-brand-text-primary whitespace-nowrap">{titulo}</h2>
        <div className="flex items-center gap-1 shrink-0">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title={'Abrir em outra aba do navegador'}
              aria-label={'Abrir em outra aba do navegador'}
              className="p-1.5 rounded-md text-brand-text-secondary hover:bg-hover"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <IconButton aria-label={'Fechar'} onClick={onClose}>
            <X className="w-5 h-5" />
          </IconButton>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 bg-muted-bg">
        {url ? (
          <iframe src={url} title={titulo} className="w-full h-full border-0" />
        ) : falha ? (
          <p className="p-4 text-ui-sm text-danger whitespace-pre-wrap">{falha}</p>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        )}
      </div>

      {/* Alça de redimensionar no canto inferior direito. */}
      <div
        className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize touch-none"
        onPointerDown={iniciar('redimensionar')}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        aria-hidden="true"
      />
    </div>
  );
}
