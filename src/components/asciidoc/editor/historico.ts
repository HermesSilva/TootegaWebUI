/**
 * HISTÓRICO — desfazer/refazer por INSTANTÂNEOS (documento + seleção). Como o documento é imutável com
 * compartilhamento estrutural, guardar o objeto inteiro custa só os blocos que mudaram. Digitação consecutiva é
 * agrupada numa janela de tempo, para o Ctrl+Z desfazer palavras e não letras.
 */

import type { Documento } from '../modelo/tipos';
import type { Selecao } from './selecao';

export interface Instantaneo {
  documento: Documento;
  selecao: Selecao | null;
}

const LIMITE = 400;
const JANELA_DE_AGRUPAMENTO_MS = 600;

export class Historico {
  private passado: Instantaneo[] = [];
  private futuro: Instantaneo[] = [];
  private ultimoRegistro = 0;
  private ultimoGrupo: string | null = null;

  /**
   * Guarda o estado ANTES de uma mudança. `pGrupo` identifica mudanças que se fundem (ex.: "digitar"): dentro da
   * janela, o mesmo grupo não cria entrada nova.
   */
  registrar(pAntes: Instantaneo, pGrupo: string | null = null): void {
    const agora = Date.now();
    const agrupa = pGrupo !== null && pGrupo === this.ultimoGrupo && agora - this.ultimoRegistro < JANELA_DE_AGRUPAMENTO_MS && this.passado.length > 0;
    this.ultimoRegistro = agora;
    this.ultimoGrupo = pGrupo;
    this.futuro = [];
    if (agrupa)
      return;
    this.passado.push(pAntes);
    if (this.passado.length > LIMITE)
      this.passado.shift();
  }

  /** Fecha o grupo corrente: a próxima mudança abre entrada nova mesmo dentro da janela. */
  fecharGrupo(): void {
    this.ultimoGrupo = null;
  }

  desfazer(pAtual: Instantaneo): Instantaneo | null {
    const anterior = this.passado.pop();
    if (!anterior)
      return null;
    this.futuro.push(pAtual);
    this.ultimoGrupo = null;
    return anterior;
  }

  refazer(pAtual: Instantaneo): Instantaneo | null {
    const proximo = this.futuro.pop();
    if (!proximo)
      return null;
    this.passado.push(pAtual);
    this.ultimoGrupo = null;
    return proximo;
  }

  get podeDesfazer(): boolean {
    return this.passado.length > 0;
  }

  get podeRefazer(): boolean {
    return this.futuro.length > 0;
  }

  limpar(): void {
    this.passado = [];
    this.futuro = [];
    this.ultimoGrupo = null;
  }
}
