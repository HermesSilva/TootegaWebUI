/**
 * O contrato do GRÁFICO DE BALEIA: o que quem usa o gráfico entrega já calculado. O gráfico só desenha — não conhece o
 * método nem o domínio: fases e trilhas, os valores de cada região, os rótulos já formatados e os semáforos já
 * decididos chegam prontos (dono, 2026-10-25: template genérico, elementos usáveis em separado).
 */

import type { XTomDoPainel } from '../elementos/tipos';

/** Em que pé está a fase na data de leitura: decide se há realizado e se há projeção. */
export type XEstadoDaFase = 'concluida' | 'corrente' | 'futura';

/** Uma fase: uma faixa vertical do gráfico. A `duracao` é a unidade do eixo do tempo (dias úteis, dias corridos…). */
export interface XFaseDaBaleia {
  id: string;
  nome: string;
  /** Linha de apoio sob o nome (período, duração), já escrita por quem usa. */
  detalhe?: string;
  duracao: number;
  estado: XEstadoDaFase;
}

/** Uma trilha: uma raia horizontal do gráfico (uma disciplina, uma equipe, uma frente). */
export interface XTrilhaDaBaleia {
  id: string;
  nome: string;
}

/** Uma região (fase × trilha), com tudo já calculado. */
export interface XRegiaoDaBaleia {
  /** Total previsto na região, na unidade da série. */
  previsto: number;
  /** Realizado até a data de leitura (0 na fase futura). */
  realizado: number;
  /**
   * Pontos de intensidade dentro da fase: `[fração 0..1, valor por unidade de duração]`. Sem eles, a curva da fase é a
   * média (total ÷ duração). Dão forma própria a cada série.
   */
  pontosPrevistos?: [number, number][];
  pontosRealizados?: [number, number][];
  /** Volume escrito no canto da região no gráfico: o destaque em negrito e o complemento ("116", " / 200"). */
  rotulo?: { destaque: string; complemento: string };
  /** O texto da célula na visão em tabela ("116 h·h / 200 h·h"). */
  textoNaTabela: string;
  /** Uma linha de apoio na célula da tabela ("projeção 205 h·h"). */
  detalheNaTabela?: string;
  /** Os dois semáforos da região, na ordem de `nomesDosSemaforos`. */
  semaforos: [XTomDoPainel, XTomDoPainel];
  /** Texto acessível da região (leitor de tela): o que ela é e o que os números dizem. */
  descricao: string;
}

/** As regiões por trilha e por fase: `regioes[idDaTrilha][idDaFase]`. */
export type XRegioesDaBaleia = Record<string, Record<string, XRegiaoDaBaleia>>;

export interface XRegiaoSelecionada {
  fase: string;
  trilha: string;
}
