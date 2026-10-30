/**
 * GRÁFICO DE BALEIA — o "hump chart" do RUP, redesenhado (dono, 2026-10-25): o tempo corre na horizontal, com as
 * fases como faixas; cada trilha é uma raia, e a altura da curva é a intensidade (valor por unidade de duração). Três
 * leituras separadas por TRATAMENTO, não só por cor: o previsto é a linha com fundo translúcido; o realizado é o
 * preenchimento sólido até a data de leitura; a projeção é o tracejado que continua o ritmo até o fim da fase corrente.
 * A hachura marca o que ficou abaixo do previsto.
 *
 * GENÉRICO: não conhece método nem domínio. Fases, trilhas, valores, rótulos e semáforos chegam já calculados
 * (`tipos.ts`). Mede a própria largura e altura e desenha em pixels (o texto nunca distorce); a raia cresce para
 * preencher a altura do contêiner, com piso. Passar o mouse mostra a régua e o quadro do instante; cada região é uma
 * área clicável e focável.
 *
 * CONTRASTE (WCAG 2.2 AA, 1.4.11): as séries não se tocam — o realizado tem borda e a linha do previsto e a projeção
 * têm contorno na cor da superfície — e cada série tem 3:1 contra a superfície (cores em `coresDaBaleia.css`).
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import { TAMANHO_DO_INDICADOR, XFormaDeStatus } from '../elementos/XIndicadorDeStatus';
import { XSemaforo } from '../elementos/XSemaforo';
import { COR_PREVISTO, COR_REALIZADO, FUNDO_PREVISTO, HACHURA_PREVISTO, PREENCHIMENTO_REALIZADO } from './coresDaBaleia';
import { amostrar, faseNoInstante, intensidade, montarCalendario, perfisPrevistos, perfisRealizados } from './curvaDaBaleia';
import type { XFaseDaBaleia, XRegiaoSelecionada, XRegioesDaBaleia, XTrilhaDaBaleia } from './tipos';
import { XAmostraDaSerie } from './XAmostraDaSerie';

export interface XGraficoDeBaleiaProps {
  fases: XFaseDaBaleia[];
  trilhas: XTrilhaDaBaleia[];
  regioes: XRegioesDaBaleia;
  /** Unidades decorridas da fase corrente na data de leitura (na unidade das durações). */
  decorridosNaCorrente: number;
  /** Texto do marcador da data de leitura ("Hoje", "Em 16/10"). */
  rotuloDoMarcador: string;
  /** Unidade acrescentada ao rótulo da região quando cabe (" h·h"). */
  unidade?: string;
  /** Unidade dos valores do quadro do mouse ("h·h/dia"). */
  unidadePorDia?: string;
  /** Os nomes dos dois semáforos de cada região, na ordem de `semaforos`. */
  nomesDosSemaforos?: [string, string];
  /** Nomes das séries no quadro do mouse. */
  rotulos?: { previsto?: string; realizado?: string; projecao?: string };
  rotuloAcessivel?: string;
  /** A dica no pé do quadro do mouse (sem ela, nada). */
  dicaDeClique?: string;
  selecionada: XRegiaoSelecionada | null;
  aoSelecionar: (pRegiao: XRegiaoSelecionada | null) => void;
}

/** Altura mínima de uma raia: abaixo dela a curva perde a leitura. Acima, a raia cresce para preencher a área. */
const ALTURA_MINIMA_DA_RAIA = 58;
const ALTURA_MAXIMA_DA_RAIA = 140;
const ALTURA_DO_TOPO = 44;
const ALTURA_DO_PE = 28;
const FOLGA_DIREITA = 8;
const FOLGA_DA_BASE = 5;
const FOLGA_DO_TOPO = 22;   // abaixo dos indicadores dos semáforos (12 px, a 8 px da linha da seção)
const LARGURA_SEM_MEDIDA = 760;
/** Recuo da borda esquerda: o nome da trilha fica na linha da seção, à direita — não há coluna de rótulos. */
const RECUO = 8;

/** A altura que o gráfico pede quando não há sobra para preencher (área estreita). */
export function alturaMinimaDoGrafico(pQuantasTrilhas: number): number {
  return ALTURA_DO_TOPO + pQuantasTrilhas * ALTURA_MINIMA_DA_RAIA + ALTURA_DO_PE;
}

// Cores da moldura (faixas, divisórias, marcador, régua, seção) e da seleção, que seguem o tema. As das séries vêm de
// `coresDaBaleia.css`.
const COR = {
  selecaoContorno: 'hsl(var(--brand-primary))',
  secao: 'hsl(var(--brand-primary) / 0.4)',
  faixa: 'hsl(var(--muted-bg) / 0.45)',
  divisoria: 'hsl(var(--border-color))',
  marcador: 'hsl(var(--text-primary))',
  regua: 'hsl(var(--text-muted))',
  superficie: 'hsl(var(--brand-surface))',
  selecao: 'hsl(var(--brand-primary) / 0.07)',
  /** A faixa alternada já composta sobre a superfície (sem transparência), para a margem atrás do nome da trilha. */
  faixaOpaca: 'color-mix(in srgb, hsl(var(--muted-bg)) 45%, hsl(var(--brand-surface)))',
};

const DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Os pontos da cunha de seção (a do XFormView): 2 px de espessura em `pX0`, afinando até 0,5 px em `pX1`. */
function cunha(pX0: number, pX1: number, pY: number): string {
  return `${pX0},${pY - 1} ${pX1},${pY - 0.25} ${pX1},${pY + 0.25} ${pX0},${pY + 1}`;
}

/** Largura e altura do contêiner, acompanhando o redimensionamento (sem medida, as de reserva). */
function useTamanho(pAlturaDeReserva: number): [RefObject<HTMLDivElement | null>, number, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState({ largura: LARGURA_SEM_MEDIDA, altura: pAlturaDeReserva });
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (elemento)
      setTamanho({
        largura: elemento.clientWidth > 0 ? elemento.clientWidth : LARGURA_SEM_MEDIDA,
        altura: elemento.clientHeight > 0 ? elemento.clientHeight : pAlturaDeReserva,
      });
  }, [pAlturaDeReserva]);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined')
      return;
    const observador = new ResizeObserver(([pEntrada]) => {
      const { width, height } = pEntrada.contentRect;
      if (width > 0 && height > 0)
        setTamanho({ largura: width, altura: height });
    });
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, []);
  return [ref, tamanho.largura, tamanho.altura];
}

export function XGraficoDeBaleia({
  fases,
  trilhas,
  regioes,
  decorridosNaCorrente,
  rotuloDoMarcador,
  unidade = '',
  unidadePorDia = '',
  nomesDosSemaforos = ['Prazo', 'Esforço'],
  rotulos,
  rotuloAcessivel = 'Gráfico de baleia: intensidade por trilha ao longo das fases',
  dicaDeClique,
  selecionada,
  aoSelecionar,
}: XGraficoDeBaleiaProps): JSX.Element {
  const alturaMinima = alturaMinimaDoGrafico(trilhas.length);
  const [conteiner, largura, alturaDisponivel] = useTamanho(alturaMinima);
  // A raia cresce para o gráfico ocupar a altura que o contêiner tem.
  const alturaDaRaia = Math.min(ALTURA_MAXIMA_DA_RAIA, Math.max(ALTURA_MINIMA_DA_RAIA,
    Math.floor((alturaDisponivel - ALTURA_DO_TOPO - ALTURA_DO_PE) / Math.max(1, trilhas.length))));
  const [foco, setFoco] = useState<{ t: number; raia: number } | null>(null);
  const idDaHachura = `hachura-abaixo-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const nomePrevisto = rotulos?.previsto ?? 'Previsto';
  const nomeRealizado = rotulos?.realizado ?? 'Realizado';
  const nomeProjecao = rotulos?.projecao ?? 'Projeção';

  // Atrás do nome da trilha (na última fase) o fundo é a faixa alternada quando a última fase é das com faixa.
  const fundoDoTitulo = (fases.length - 1) % 2 === 1 ? COR.faixaOpaca : COR.superficie;
  const larguraDoPlano = Math.max(120, largura - RECUO - FOLGA_DIREITA);
  const altura = ALTURA_DO_TOPO + trilhas.length * alturaDaRaia + ALTURA_DO_PE;
  const baseDasRaias = ALTURA_DO_TOPO + trilhas.length * alturaDaRaia;

  const calendario = useMemo(() => montarCalendario(fases, decorridosNaCorrente), [fases, decorridosNaCorrente]);

  const raias = useMemo(() => trilhas.map((pTrilha) => {
    const regioesDaTrilha = regioes[pTrilha.id] ?? {};
    const previstas = perfisPrevistos(fases, regioesDaTrilha);
    const realizadas = perfisRealizados(fases, regioesDaTrilha, calendario);
    return {
      trilha: pTrilha,
      previstas,
      realizadas,
      previsto: amostrar(fases, previstas, calendario, 0, calendario.total, 240),
      previstoAteHoje: amostrar(fases, previstas, calendario, 0, calendario.hoje, 200),
      realizado: amostrar(fases, realizadas, calendario, 0, calendario.hoje, 200),
      projecao: calendario.decorridosNaCorrente > 0 ? amostrar(fases, realizadas, calendario, calendario.hoje, calendario.fimDaCorrente, 80) : [],
    };
  }), [trilhas, regioes, fases, calendario]);

  // Cada raia na PRÓPRIA escala: com escala única, as trilhas de pouco volume viravam um traço. A comparação de volume
  // entre trilhas fica com os rótulos.
  const maximos = raias.map((pR) => Math.max(0.01, ...[...pR.previsto, ...pR.realizado, ...pR.projecao].map(([, pV]) => pV)));

  const x = (pT: number): number => RECUO + (pT / calendario.total) * larguraDoPlano;
  const topoDaRaia = (pI: number): number => ALTURA_DO_TOPO + pI * alturaDaRaia;
  const y = (pV: number, pI: number): number =>
    topoDaRaia(pI) + alturaDaRaia - FOLGA_DA_BASE - (pV / maximos[pI]) * (alturaDaRaia - FOLGA_DA_BASE - FOLGA_DO_TOPO);
  const base = (pI: number): number => topoDaRaia(pI) + alturaDaRaia - FOLGA_DA_BASE;

  const linha = (pPontos: [number, number][], pI: number): string =>
    pPontos.map(([pT, pV], pK) => `${pK === 0 ? 'M' : 'L'}${x(pT).toFixed(1)},${y(pV, pI).toFixed(1)}`).join('');
  const area = (pPontos: [number, number][], pI: number): string =>
    pPontos.length === 0 ? '' : `M${x(pPontos[0][0]).toFixed(1)},${base(pI)}${linha(pPontos, pI).replace(/^M/, 'L')}L${x(pPontos[pPontos.length - 1][0]).toFixed(1)},${base(pI)}Z`;

  function aoMover(pEvento: MouseEvent<SVGSVGElement>): void {
    const caixa = pEvento.currentTarget.getBoundingClientRect();
    const px = pEvento.clientX - caixa.left;
    const py = pEvento.clientY - caixa.top;
    const raia = Math.floor((py - ALTURA_DO_TOPO) / alturaDaRaia);
    if (px < RECUO || px > RECUO + larguraDoPlano || raia < 0 || raia >= trilhas.length) {
      setFoco(null);
      return;
    }
    setFoco({ t: ((px - RECUO) / larguraDoPlano) * calendario.total, raia });
  }

  function aoTeclar(pEvento: KeyboardEvent<SVGRectElement>, pRegiao: XRegiaoSelecionada | null): void {
    if (pEvento.key === 'Enter' || pEvento.key === ' ') {
      pEvento.preventDefault();
      aoSelecionar(pRegiao);
    }
  }

  const regiaoDe = (pTrilha: string, pFase: string) => regioes[pTrilha]?.[pFase];
  const xDoMarcador = x(calendario.hoje);

  return (
    // A raiz ESTICA até a altura do contêiner (com piso), e o desenho vai numa camada posicionada dentro dela: assim o
    // SVG não empurra a altura de volta, e o contêiner pode encolher quando a janela diminui.
    <div ref={conteiner} className="relative w-full flex-1 select-none" style={{ minHeight: alturaMinima }}>
      <div className="absolute inset-0">
        <svg
          width={largura}
          height={altura}
          role="group"
          aria-label={rotuloAcessivel}
          onMouseMove={aoMover}
          onMouseLeave={() => setFoco(null)}
          className="block"
        >
          <defs>
            <pattern id={idDaHachura} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={5} style={{ stroke: HACHURA_PREVISTO }} strokeWidth={2} />
            </pattern>
          </defs>

          {/* Faixas das fases, cabeçalho e divisórias */}
          {fases.map((pFase, pI) => {
            const x0 = x(calendario.inicio[pFase.id]);
            const x1 = x(calendario.inicio[pFase.id] + calendario.duracao[pFase.id]);
            return (
              <g key={pFase.id}>
                {pI % 2 === 1 && <rect x={x0} y={ALTURA_DO_TOPO} width={x1 - x0} height={baseDasRaias - ALTURA_DO_TOPO} fill={COR.faixa} />}
                {pI > 0 && <line x1={x0} x2={x0} y1={ALTURA_DO_TOPO - 6} y2={baseDasRaias} stroke={COR.divisoria} strokeDasharray="3 4" />}
                <text x={x0 + 8} y={18} className={`text-[12px] font-semibold ${pFase.estado === 'corrente' ? 'fill-brand-primary' : 'fill-brand-text-primary'}`}>
                  {pFase.nome}
                </text>
                {pFase.detalhe && x1 - x0 > 118 && (
                  <text x={x0 + 8} y={33} className="text-[10.5px] fill-brand-text-muted">{pFase.detalhe}</text>
                )}
              </g>
            );
          })}

          {/* Raias: a linha da SEÇÃO (a cunha do XFormView, na cor da marca a 40%) acima de cada trilha, com o nome da
              trilha à DIREITA na cor de destaque; a margem na cor do fundo interrompe a cunha atrás do nome. */}
          {raias.map((pRaia, pI) => (
            <g key={pRaia.trilha.id}>
              <polygon points={cunha(0, RECUO + larguraDoPlano, topoDaRaia(pI))} fill={COR.secao} />
              <text
                x={RECUO + larguraDoPlano}
                y={topoDaRaia(pI)}
                textAnchor="end"
                dominantBaseline="middle"
                stroke={fundoDoTitulo}
                strokeWidth={10}
                strokeLinejoin="round"
                paintOrder="stroke"
                className="text-[12px] font-medium fill-brand-primary"
              >
                {pRaia.trilha.nome}
              </text>
            </g>
          ))}

          {/* Região selecionada */}
          {selecionada && (() => {
            const i = trilhas.findIndex((pT) => pT.id === selecionada.trilha);
            if (i < 0 || calendario.inicio[selecionada.fase] === undefined)
              return null;
            const x0 = x(calendario.inicio[selecionada.fase]);
            const x1 = x(calendario.inicio[selecionada.fase] + calendario.duracao[selecionada.fase]);
            return (
              <rect
                x={x0 + 1.5} y={topoDaRaia(i) + 1.5} width={x1 - x0 - 3} height={alturaDaRaia - 3} rx={6}
                fill={COR.selecao} stroke={COR.selecaoContorno} strokeOpacity={0.6} strokeWidth={1.5}
              />
            );
          })()}

          {/* As baleias. Camadas, de baixo para cima: fundo do previsto; hachura sob o previsto até a data de leitura (o
              que o realizado não cobrir fica à mostra = abaixo do previsto); realizado sólido com borda da superfície;
              linha do previsto com contorno da superfície; projeção tracejada com contorno da superfície. */}
          {raias.map((pRaia, pI) => (
            <g key={pRaia.trilha.id} aria-hidden="true">
              <path d={area(pRaia.previsto, pI)} style={{ fill: FUNDO_PREVISTO }} />
              <path d={area(pRaia.previstoAteHoje, pI)} fill={`url(#${idDaHachura})`} />
              <path d={area(pRaia.realizado, pI)} style={{ fill: PREENCHIMENTO_REALIZADO }} stroke={COR.superficie} strokeWidth={1.5} strokeLinejoin="round" />
              <path d={linha(pRaia.previsto, pI)} fill="none" stroke={COR.superficie} strokeWidth={5.75} strokeLinejoin="round" strokeLinecap="round" />
              <path d={linha(pRaia.previsto, pI)} fill="none" style={{ stroke: COR_PREVISTO }} strokeWidth={1.75} strokeLinejoin="round" />
              {pRaia.projecao.length > 0 && (
                <>
                  <path d={linha(pRaia.projecao, pI)} fill="none" stroke={COR.superficie} strokeWidth={6} strokeLinecap="round" />
                  <path d={linha(pRaia.projecao, pI)} fill="none" style={{ stroke: COR_REALIZADO }} strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
                </>
              )}
            </g>
          ))}

          {/* Volume escrito no canto de cada região que tem rótulo — em tinta de texto, nunca na cor da série. */}
          {raias.map((pRaia, pI) => fases.map((pFase) => {
            const rotulo = regiaoDe(pRaia.trilha.id, pFase.id)?.rotulo;
            const x0 = x(calendario.inicio[pFase.id]);
            const larguraDaRegiao = x(calendario.inicio[pFase.id] + calendario.duracao[pFase.id]) - x0;
            if (!rotulo || larguraDaRegiao < 70)
              return null;
            return (
              <text
                key={`${pRaia.trilha.id}-${pFase.id}`}
                x={x0 + 6}
                y={topoDaRaia(pI) + 12}
                aria-hidden="true"
                pointerEvents="none"
                className="text-[10.5px] tabular-nums fill-brand-text-muted"
              >
                <tspan className="font-semibold fill-brand-text-primary">{rotulo.destaque}</tspan>
                {`${rotulo.complemento}${larguraDaRegiao >= 130 ? unidade : ''}`}
              </text>
            );
          }))}

          {/* Marcador da data de leitura */}
          <g aria-hidden="true">
            <line x1={xDoMarcador} x2={xDoMarcador} y1={ALTURA_DO_TOPO - 4} y2={baseDasRaias + 4} stroke={COR.marcador} strokeWidth={1.25} />
            <rect x={xDoMarcador - 30} y={baseDasRaias + 6} width={60} height={18} rx={9} fill={COR.marcador} />
            <text x={xDoMarcador} y={baseDasRaias + 19} textAnchor="middle" className="text-[10.5px] font-medium fill-brand-surface">
              {rotuloDoMarcador}
            </text>
          </g>

          {/* Os dois semáforos no canto superior direito de cada região, por FORMA, no tamanho de todo indicador. */}
          {raias.map((pRaia, pI) => fases.map((pFase) => {
            const semaforos = regiaoDe(pRaia.trilha.id, pFase.id)?.semaforos;
            if (!semaforos)
              return null;
            const direita = x(calendario.inicio[pFase.id] + calendario.duracao[pFase.id]) - 4;
            const alto = topoDaRaia(pI) + 8;
            const lado = TAMANHO_DO_INDICADOR;
            return (
              <g key={`${pRaia.trilha.id}-${pFase.id}`} aria-hidden="true" pointerEvents="none">
                <g transform={`translate(${direita - 2 * lado - 4}, ${alto})`}><XFormaDeStatus tom={semaforos[0]} /></g>
                <g transform={`translate(${direita - lado}, ${alto})`}><XFormaDeStatus tom={semaforos[1]} /></g>
              </g>
            );
          }))}

          {/* Régua do foco */}
          {foco && (() => {
            const raia = raias[foco.raia];
            const px = x(foco.t);
            const valorPrevisto = intensidade(fases, raia.previstas, calendario, foco.t);
            const temReal = foco.t <= calendario.hoje;
            const temProjecao = !temReal && raia.projecao.length > 0 && foco.t <= calendario.fimDaCorrente;
            const valorReal = temReal || temProjecao ? intensidade(fases, raia.realizadas, calendario, foco.t) : null;
            return (
              <g aria-hidden="true" pointerEvents="none">
                <line x1={px} x2={px} y1={ALTURA_DO_TOPO} y2={baseDasRaias} stroke={COR.regua} strokeDasharray="2 3" />
                <circle cx={px} cy={y(valorPrevisto, foco.raia)} r={4} fill={COR.superficie} style={{ stroke: COR_PREVISTO }} strokeWidth={2} />
                {valorReal !== null && (
                  <circle cx={px} cy={y(valorReal, foco.raia)} r={4} style={{ fill: COR_REALIZADO }} stroke={COR.superficie} strokeWidth={2} />
                )}
              </g>
            );
          })()}

          {/* Alvos de clique e foco: uma área por região, maior que a marca. */}
          {raias.map((pRaia, pI) => fases.map((pFase) => {
            const dados = regiaoDe(pRaia.trilha.id, pFase.id);
            if (!dados)
              return null;
            const x0 = x(calendario.inicio[pFase.id]);
            const x1 = x(calendario.inicio[pFase.id] + calendario.duracao[pFase.id]);
            const regiao = { fase: pFase.id, trilha: pRaia.trilha.id };
            const marcada = selecionada?.fase === pFase.id && selecionada.trilha === pRaia.trilha.id;
            return (
              <rect
                key={`${pRaia.trilha.id}-${pFase.id}`}
                x={x0} y={topoDaRaia(pI)} width={x1 - x0} height={alturaDaRaia} rx={6}
                role="button"
                tabIndex={0}
                aria-pressed={marcada}
                aria-label={dados.descricao}
                onClick={() => aoSelecionar(marcada ? null : regiao)}
                onKeyDown={(pEvento) => aoTeclar(pEvento, marcada ? null : regiao)}
                className="fill-transparent stroke-transparent cursor-pointer outline-none focus-visible:stroke-brand-primary"
                strokeWidth={1.5}
              />
            );
          }))}
        </svg>

        {/* Quadro do foco */}
        {foco && (() => {
          const raia = raias[foco.raia];
          const fase = faseNoInstante(fases, calendario, foco.t);
          const dia = Math.min(calendario.duracao[fase.id], Math.floor(foco.t - calendario.inicio[fase.id]) + 1);
          const valorPrevisto = intensidade(fases, raia.previstas, calendario, foco.t);
          const temReal = foco.t <= calendario.hoje;
          const temProjecao = !temReal && raia.projecao.length > 0 && foco.t <= calendario.fimDaCorrente;
          const valorReal = temReal || temProjecao ? intensidade(fases, raia.realizadas, calendario, foco.t) : null;
          const semaforos = regiaoDe(raia.trilha.id, fase.id)?.semaforos;
          const px = x(foco.t);
          const esquerda = px > largura - 236 ? px - 228 : px + 14;
          const comUnidade = (pValor: number): string => `${DECIMAL.format(pValor)}${unidadePorDia ? ` ${unidadePorDia}` : ''}`;
          return (
            <div
              role="tooltip"
              className="absolute z-10 w-[214px] px-3 py-2 rounded-lg bg-brand-surface border border-border shadow-lg pointer-events-none"
              style={{ left: Math.max(0, esquerda), top: topoDaRaia(foco.raia) - 6 }}
            >
              <div className="text-ui-sm font-semibold text-brand-text-primary">{raia.trilha.nome}</div>
              <div className="text-ui-xs text-brand-text-muted">{`${fase.nome} · dia ${dia} de ${calendario.duracao[fase.id]}`}</div>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ui-xs">
                <dt className="flex items-center gap-1.5 text-brand-text-secondary">{nomePrevisto}<XAmostraDaSerie serie="previsto" /></dt>
                <dd className="text-right tabular-nums text-brand-text-primary">{comUnidade(valorPrevisto)}</dd>
                <dt className="flex items-center gap-1.5 text-brand-text-secondary">
                  {temProjecao ? nomeProjecao : nomeRealizado}
                  <XAmostraDaSerie serie={temProjecao ? 'projecao' : 'realizado'} />
                </dt>
                <dd className="text-right tabular-nums text-brand-text-primary">{valorReal === null ? '—' : comUnidade(valorReal)}</dd>
              </dl>
              {semaforos && (
                <div className="mt-1.5 flex items-center gap-3">
                  <XSemaforo medida={nomesDosSemaforos[0]} tom={semaforos[0]} comRotulo />
                  <XSemaforo medida={nomesDosSemaforos[1]} tom={semaforos[1]} comRotulo />
                </div>
              )}
              {dicaDeClique && (
                <div className="mt-1.5 pt-1.5 border-t border-border-light text-ui-xs text-brand-text-muted">{dicaDeClique}</div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
