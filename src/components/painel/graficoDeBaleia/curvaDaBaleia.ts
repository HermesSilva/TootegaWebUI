/**
 * A matemática do GRÁFICO DE BALEIA (o "hump chart" do RUP): a intensidade de uma trilha ao longo do tempo (valor por
 * unidade de duração) como uma curva suave que incha nas fases em que a trilha trabalha mais.
 *
 * Cada fase contribui com o seu PERFIL (a média — total ÷ duração — ou os pontos de intensidade da região) multiplicado
 * por uma JANELA suave centrada nela: uma gaussiana que vale 1 no meio da fase e 0,5 na fronteira, de modo que fases
 * vizinhas se fundem sem degrau e cada uma desenha uma corcova arredondada. O eixo começa e termina em zero (rampa nas
 * pontas). É desenho para LEITURA de forma, não contabilidade: a área sob a curva aproxima, mas não reproduz
 * exatamente, o total da região.
 */

import type { XFaseDaBaleia, XRegiaoDaBaleia } from './tipos';

/** O eixo do tempo do gráfico, na unidade das durações. */
export interface XCalendarioDaBaleia {
  inicio: Record<string, number>;
  duracao: Record<string, number>;
  total: number;
  /** A posição da data de leitura no eixo. */
  hoje: number;
  /** Unidades decorridas da fase corrente na data de leitura (0 sem fase corrente). */
  decorridosNaCorrente: number;
  /** Onde termina a fase corrente (= `hoje` sem fase corrente): até aqui vai a projeção. */
  fimDaCorrente: number;
}

export function montarCalendario(pFases: XFaseDaBaleia[], pDecorridosNaCorrente: number): XCalendarioDaBaleia {
  const inicio: Record<string, number> = {};
  const duracao: Record<string, number> = {};
  let cursor = 0;
  let hoje: number | null = null;
  let fimDaCorrente: number | null = null;
  let fimDasConcluidas = 0;
  for (const fase of pFases) {
    inicio[fase.id] = cursor;
    duracao[fase.id] = fase.duracao;
    if (fase.estado === 'concluida')
      fimDasConcluidas = cursor + fase.duracao;
    if (fase.estado === 'corrente') {
      hoje = cursor + Math.min(fase.duracao, Math.max(0, pDecorridosNaCorrente));
      fimDaCorrente = cursor + fase.duracao;
    }
    cursor += fase.duracao;
  }
  const temCorrente = hoje !== null;
  return {
    inicio,
    duracao,
    total: cursor,
    hoje: hoje ?? fimDasConcluidas,
    decorridosNaCorrente: temCorrente ? Math.max(0, pDecorridosNaCorrente) : 0,
    fimDaCorrente: fimDaCorrente ?? fimDasConcluidas,
  };
}

/** A fase em que cai um instante do eixo. */
export function faseNoInstante(pFases: XFaseDaBaleia[], pCalendario: XCalendarioDaBaleia, pT: number): XFaseDaBaleia {
  return pFases.find((pF) => pT < pCalendario.inicio[pF.id] + pCalendario.duracao[pF.id]) ?? pFases[pFases.length - 1];
}

const LN2 = Math.log(2);
const RAMPA_DAS_PONTAS = 6;

function janela(pT: number, pInicio: number, pDuracao: number): number {
  const meia = pDuracao / 2;
  const u = (pT - (pInicio + meia)) / meia;
  return Math.exp(-LN2 * u * u);
}

function rampa(pT: number, pTotal: number): number {
  const borda = Math.min(pT, pTotal - pT) / RAMPA_DAS_PONTAS;
  if (borda >= 1)
    return 1;
  const x = Math.max(0, borda);
  return x * x * (3 - 2 * x);
}

/** O que a curva incha numa fase: a média, ou os pontos de intensidade da região. */
export interface XPerfilDaFase {
  media: number;
  pontos?: [number, number][];
}

export type XPerfisPorFase = Record<string, XPerfilDaFase>;

export function perfisPrevistos(pFases: XFaseDaBaleia[], pRegioesDaTrilha: Record<string, XRegiaoDaBaleia>): XPerfisPorFase {
  const perfis: XPerfisPorFase = {};
  for (const fase of pFases) {
    const regiao = pRegioesDaTrilha[fase.id];
    perfis[fase.id] = { media: (regiao?.previsto ?? 0) / fase.duracao, pontos: regiao?.pontosPrevistos };
  }
  return perfis;
}

/**
 * Perfil realizado: na fase concluída, o total ÷ a duração; na corrente, o RITMO (realizado até a data ÷ unidades
 * decorridas) — que é o mesmo que a projeção linear ÷ a duração, por isso a mesma curva serve à projeção depois da
 * data de leitura — ou os pontos realizados da região; na futura, zero.
 */
export function perfisRealizados(
  pFases: XFaseDaBaleia[],
  pRegioesDaTrilha: Record<string, XRegiaoDaBaleia>,
  pCalendario: XCalendarioDaBaleia,
): XPerfisPorFase {
  const perfis: XPerfisPorFase = {};
  for (const fase of pFases) {
    const regiao = pRegioesDaTrilha[fase.id];
    if (fase.estado === 'concluida')
      perfis[fase.id] = { media: (regiao?.realizado ?? 0) / fase.duracao, pontos: regiao?.pontosRealizados };
    else if (fase.estado === 'corrente' && pCalendario.decorridosNaCorrente > 0)
      perfis[fase.id] = { media: (regiao?.realizado ?? 0) / pCalendario.decorridosNaCorrente, pontos: regiao?.pontosRealizados };
    else
      perfis[fase.id] = { media: 0 };
  }
  return perfis;
}

/** O valor do perfil numa fração da fase: a média, ou os pontos interpolados com suavização (cosseno). */
function valorDoPerfil(pPerfil: XPerfilDaFase, pFracao: number): number {
  const pontos = pPerfil.pontos;
  if (!pontos || pontos.length === 0)
    return pPerfil.media;
  if (pFracao <= pontos[0][0])
    return pontos[0][1];
  for (let i = 1; i < pontos.length; i++) {
    const [f0, v0] = pontos[i - 1];
    const [f1, v1] = pontos[i];
    if (pFracao <= f1) {
      const passo = (1 - Math.cos(Math.PI * ((pFracao - f0) / (f1 - f0)))) / 2;
      return v0 + (v1 - v0) * passo;
    }
  }
  return pontos[pontos.length - 1][1];
}

/** A intensidade (valor por unidade de duração) num instante do eixo. */
export function intensidade(pFases: XFaseDaBaleia[], pPerfis: XPerfisPorFase, pCalendario: XCalendarioDaBaleia, pT: number): number {
  let soma = 0;
  for (const fase of pFases) {
    const inicio = pCalendario.inicio[fase.id];
    const duracao = pCalendario.duracao[fase.id];
    const fracao = Math.min(1, Math.max(0, (pT - inicio) / duracao));
    soma += valorDoPerfil(pPerfis[fase.id], fracao) * janela(pT, inicio, duracao);
  }
  return soma * rampa(pT, pCalendario.total);
}

/** Amostras [t, valor] de `pDe` a `pAte`, com passo fino o bastante para a curva parecer contínua. */
export function amostrar(
  pFases: XFaseDaBaleia[],
  pPerfis: XPerfisPorFase,
  pCalendario: XCalendarioDaBaleia,
  pDe: number,
  pAte: number,
  pPassos = 160,
): [number, number][] {
  if (pAte <= pDe)
    return [];
  const pontos: [number, number][] = [];
  for (let i = 0; i <= pPassos; i++) {
    const t = pDe + ((pAte - pDe) * i) / pPassos;
    pontos.push([t, intensidade(pFases, pPerfis, pCalendario, t)]);
  }
  return pontos;
}
