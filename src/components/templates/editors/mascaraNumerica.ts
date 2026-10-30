/**
 * mascaraNumerica — a máscara numérica ÚNICA do template (dono, 2026-10-12): todo editor de valor
 * numérico, com ou sem decimal, formata ENQUANTO se digita, do mesmo jeito. Moeda, número, percentual,
 * a célula de moeda e a célula inteira da grade de itens chamam estas funções — nenhum editor tem
 * máquina própria. Até aqui cada um tinha a sua: a moeda tirava o milhar ao focar e só o repunha no
 * blur, o número nunca mostrava milhar, o percentual formatava só ao sair e a célula inteira lia de
 * um terceiro jeito. O "Valor do frete" aparecia como "14500,00" enquanto se digitava, e o operador
 * contava zeros.
 *
 * Forma pt-BR, a do produto (`getIntlLocale`): milhar com ponto, decimal com vírgula.
 *
 * Regras de digitação (binárias):
 *  - dígito entra; o milhar é RECOLOCADO a cada tecla ("1234" → "1.234");
 *  - o separador decimal é o que o operador DIGITOU — vírgula ou ponto valem igual (dono, 2026-10-10:
 *    "32.5" e "32,5" são o mesmo número); os pontos que a máscara pôs nunca são lidos como decimal;
 *  - texto COLADO com os dois separadores segue a grafia: "1.234,56" é mil e tantos (o último
 *    separador é o decimal); vários pontos e nenhuma vírgula são milhares ("1.234.567");
 *  - casas = 0 (inteiro): a vírgula CORTA o que vier depois e o ponto é milhar (ignorado);
 *  - as casas decimais são TRUNCADAS no que excede o modelo; sem casas declaradas, até dez;
 *  - sinal só no início, e só quando o campo o permite (mínimo negativo ou sem mínimo);
 *  - apagar um ponto de milhar apaga o dígito ANTES dele — o ponto não é do operador.
 *
 * O cursor acompanha: a máscara devolve onde ele deve ficar depois de recolocar os pontos, para que
 * editar no meio do número não jogue o cursor para o fim.
 */

import { getIntlLocale } from '@core/lib';

export interface XOpcoesMascaraNumerica {
  /** Casas decimais: `0` = inteiro (sem vírgula); `undefined` = livre (até dez). */
  casas?: number;
  /** Aceita o sinal de menos no início. */
  permiteNegativo?: boolean;
}

export interface XTextoMascarado {
  /** O texto formatado, pronto para o `<input>`. */
  texto: string;
  /** Onde o cursor deve ficar no texto formatado. */
  caret: number;
}

const MILHAR = '.';
const DECIMAL = ',';
const CASAS_LIVRES = 10;

/**
 * Aplica a máscara ao texto que acabou de ser digitado (ou colado).
 *
 * @param pCru      o valor do `<input>` depois da tecla;
 * @param pAnterior o texto que o campo exibia ANTES da tecla (já mascarado) — é por ele que se sabe
 *                  o que o operador inseriu e o que já era da máscara;
 * @param pCaretCru a posição do cursor no texto cru;
 */
export function mascararDigitacao(
  pCru: string,
  pAnterior: string,
  pCaretCru: number,
  pOpcoes: XOpcoesMascaraNumerica = {},
): XTextoMascarado {
  const casas = pOpcoes.casas;
  const inteiro = casas === 0;

  // O que mudou entre o texto anterior e o cru: prefixo e sufixo comuns delimitam a edição.
  let prefixo = 0;
  while (prefixo < pAnterior.length && prefixo < pCru.length && pAnterior[prefixo] === pCru[prefixo])
    prefixo++;
  let sufixo = 0;
  while (
    sufixo < pAnterior.length - prefixo
    && sufixo < pCru.length - prefixo
    && pAnterior[pAnterior.length - 1 - sufixo] === pCru[pCru.length - 1 - sufixo]
  )
    sufixo++;

  let cru = pCru;
  let caretCru = Math.max(0, Math.min(pCaretCru, cru.length));
  const inserido = cru.slice(prefixo, cru.length - sufixo);
  const removido = pAnterior.slice(prefixo, pAnterior.length - sufixo);

  // Apagou SÓ um ponto de milhar: o ponto é da máscara, não do operador — o que ele quis apagar foi
  // o dígito antes dele. Sem isto a máscara reporia o ponto e a tecla não faria nada.
  if (inserido.length === 0 && removido === MILHAR && prefixo > 0 && /\d/.test(cru[prefixo - 1] ?? '')) {
    cru = cru.slice(0, prefixo - 1) + cru.slice(prefixo);
    caretCru = prefixo - 1;
  }

  // Qual separador do trecho INSERIDO é o decimal: com vírgula, é ela (e o ponto é milhar); só pontos e
  // mais de um, são milhares; um ponto só, é decimal (dono, 2026-10-10).
  const inicioInserido = prefixo;
  const fimInserido = cru.length - sufixo;
  const temVirgulaInserida = inserido.includes(DECIMAL);
  const pontosInseridos = inserido.split(MILHAR).length - 1;
  const pontoInseridoEhDecimal = !temVirgulaInserida && pontosInseridos === 1;

  // Forma canônica: sinal, dígitos e UMA vírgula — sem milhar. O caret é contado nela.
  let canonico = '';
  let caretCanonico = 0;
  let cortado = false;
  for (let i = 0; i < cru.length; i++) {
    const ch = cru[i];
    const foiInserido = i >= inicioInserido && i < fimInserido;
    let aceito = '';

    if (cortado) {
      // Inteiro: a vírgula cortou — o resto não entra (mas o caret não passa daqui).
    } else if (/\d/.test(ch)) {
      aceito = ch;
    } else if (ch === DECIMAL || ch === MILHAR) {
      // No inteiro o ponto é SEMPRE milhar ("9.000" digitado ou colado), nunca decimal.
      const ehDecimal = ch === DECIMAL
        ? true
        : (foiInserido && pontoInseridoEhDecimal && !inteiro);
      if (ehDecimal) {
        if (inteiro)
          cortado = true;
        else if (!canonico.includes(DECIMAL))
          aceito = DECIMAL;
      }
      // Ponto de milhar (da máscara ou colado): não entra.
    } else if (ch === '-' && pOpcoes.permiteNegativo && canonico.length === 0 && i === 0) {
      aceito = '-';
    }

    canonico += aceito;
    if (i < caretCru)
      caretCanonico += aceito.length;
  }

  // Sinal, parte inteira e decimal.
  const negativo = canonico.startsWith('-');
  const semSinal = negativo ? canonico.slice(1) : canonico;
  const posVirgula = semSinal.indexOf(DECIMAL);
  let parteInteira = posVirgula >= 0 ? semSinal.slice(0, posVirgula) : semSinal;
  let parteDecimal = posVirgula >= 0 ? semSinal.slice(posVirgula + 1) : '';
  const temVirgula = posVirgula >= 0;

  // Zeros à esquerda saem ("007" → "7"), mas o zero sozinho fica ("0", "0,5").
  const zerosRemovidos = parteInteira.length - parteInteira.replace(/^0+(?=\d)/, '').length;
  parteInteira = parteInteira.replace(/^0+(?=\d)/, '');

  // Decimais além do modelo são truncados.
  const tetoCasas = casas === undefined ? CASAS_LIVRES : casas;
  const decimaisExcedentes = Math.max(0, parteDecimal.length - tetoCasas);
  parteDecimal = parteDecimal.slice(0, tetoCasas);

  // Recoloca o caret na forma canônica final (zeros e decimais removidos antes dele descontam).
  let caretFinalCanonico = caretCanonico;
  const inicioInteira = negativo ? 1 : 0;
  if (zerosRemovidos > 0 && caretFinalCanonico > inicioInteira)
    caretFinalCanonico -= Math.min(zerosRemovidos, caretFinalCanonico - inicioInteira);
  const canonicoFinal = (negativo ? '-' : '') + parteInteira + (temVirgula ? DECIMAL + parteDecimal : '');
  if (decimaisExcedentes > 0)
    caretFinalCanonico = Math.min(caretFinalCanonico, canonicoFinal.length);
  caretFinalCanonico = Math.max(0, Math.min(caretFinalCanonico, canonicoFinal.length));

  // Milhar: grupos de três da direita para a esquerda.
  const inteiraComMilhar = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, MILHAR);
  const texto = (negativo ? '-' : '') + inteiraComMilhar + (temVirgula ? DECIMAL + parteDecimal : '');

  // O caret no texto formatado: depois do mesmo número de caracteres canônicos (os pontos não contam).
  let caret = 0;
  let contados = 0;
  while (caret < texto.length && contados < caretFinalCanonico) {
    if (texto[caret] !== MILHAR)
      contados++;
    caret++;
  }
  // Caret logo antes de um ponto de milhar: fica depois dele, para a próxima tecla continuar o grupo.
  if (texto[caret] === MILHAR && contados === caretFinalCanonico && caretFinalCanonico > 0)
    caret++;

  return { texto, caret };
}

/** Lê o texto mascarado como número; vazio, só sinal ou só vírgula ⇒ `undefined`. */
export function lerMascarado(pTexto: string): number | undefined {
  const canonico = pTexto.replace(/\./g, '').replace(DECIMAL, '.');
  if (!/\d/.test(canonico))
    return undefined;
  const numero = Number(canonico);
  return Number.isFinite(numero) ? numero : undefined;
}

/**
 * Formata o VALOR (não o texto) para exibição fora da digitação: casas fixas quando o modelo as
 * declara ("1.234,50"); sem casas declaradas, o número como veio ("12,5"), até dez casas.
 */
export function formatarValor(pValor: number | undefined, pCasas?: number): string {
  if (pValor === undefined || !Number.isFinite(pValor))
    return '';

  return pValor.toLocaleString(getIntlLocale(), {
    minimumFractionDigits: pCasas ?? 0,
    maximumFractionDigits: pCasas ?? CASAS_LIVRES,
  });
}

/** Arredonda às casas do modelo; sem casas, devolve como está. */
export function arredondarAsCasas(pValor: number, pCasas?: number): number {
  return pCasas === undefined ? pValor : Number(pValor.toFixed(pCasas));
}

/** Converte o valor cru do modelo em número (`''`, `null` e texto não numérico ⇒ `undefined`). */
export function numeroOuIndefinido(pValor: unknown): number | undefined {
  if (pValor === null || pValor === undefined || pValor === '')
    return undefined;
  const numero = Number(pValor);
  return Number.isFinite(numero) ? numero : undefined;
}
