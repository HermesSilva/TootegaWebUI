/**
 * Os contratos das NOVIDADES DA VERSÃO (dono, 2026-10-25), como `api/sys/novidades` os devolve (espelho de
 * `Tootega.Agente.Docs.Novidades`). Datas em ISO `AAAA-MM-DD`; HTML já renderizado com o pipeline do manual.
 */

/** Uma versão na lista. As contagens são as do recorte do usuário (só o que é das telas do menu dele). */
export interface ResumoDeNotaDeVersao {
  versao: string;
  data: string;
  titulo: string;
  resumo: string;
  /** URL publicada da capa; vazia sem capa. */
  destaque: string;
  novidades: number;
  melhorias: number;
  correcoes: number;
}

export interface ItemRenderizado {
  titulo: string;
  html: string;
}

export interface GrupoRenderizado {
  /** Estável: `novidade`, `melhoria` ou `correcao` — decide a cor do selo. */
  grupo: string;
  rotulo: string;
  itens: ItemRenderizado[];
}

export interface NotaDeVersaoRenderizada {
  versao: string;
  data: string;
  titulo: string;
  resumo: string;
  destaque: string;
  aberturaHTML: string;
  grupos: GrupoRenderizado[];
  /** A mesma nota no manual completo. */
  linkNoManual: string;
}
