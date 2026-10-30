/**
 * useMascaraNumerica — o comportamento de TODO campo numérico do template, num hook só (dono,
 * 2026-10-12): formata enquanto se digita (`mascararDigitacao`), propaga o número a cada tecla (o
 * rodapé do pedido reage ao vivo), aplica mínimo, máximo e arredondamento ao sair, e reexibe o valor
 * formatado quando o modelo muda por fora (editor controlado). Moeda, número, percentual e as
 * células da grade só decidem as casas, o sinal e os limites — o resto é daqui.
 *
 * O cursor é reposto depois de cada formatação (`useLayoutEffect` + `setSelectionRange`): sem isto,
 * um `<input>` controlado joga o cursor para o fim toda vez que a máscara insere um ponto.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { arredondarAsCasas, formatarValor, lerMascarado, mascararDigitacao, numeroOuIndefinido } from './mascaraNumerica';

export interface XMascaraNumericaParametros {
  /** O valor do modelo (número, texto numérico, nulo ou vazio). */
  valor: unknown;
  /** Recebe o número lido a cada tecla e ao sair; `null` quando o campo esvazia. */
  aoMudar: (pValor: number | null) => void;
  /** Casas decimais: `0` inteiro; `undefined` livre. */
  casas?: number;
  permiteNegativo?: boolean;
  minimo?: number;
  maximo?: number;
}

export interface XMascaraNumerica {
  /** O texto a exibir no `<input>`. */
  texto: string;
  /** Prenda ao `<input>`: é por ele que o cursor é reposto. */
  inputRef: RefObject<HTMLInputElement | null>;
  aoDigitar: (pEvento: ChangeEvent<HTMLInputElement>) => void;
  aoFocar: () => void;
  aoSair: () => void;
  /** Reexibe um valor vindo de fora (o "desfazer"), formatado. */
  reexibir: (pValor: unknown) => void;
  /** O valor formatado para leitura (campo só-leitura, célula travada). */
  formatado: string;
}

export function useMascaraNumerica({
  valor,
  aoMudar,
  casas,
  permiteNegativo = false,
  minimo,
  maximo,
}: XMascaraNumericaParametros): XMascaraNumerica {
  const [texto, setTexto] = useState('');
  const [focado, setFocado] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number | null>(null);

  // Fora do foco, o texto segue o modelo (editor controlado): o pai responde ao onChange e o campo
  // reexibe o que ele mandou. Focado, o operador digita e a máscara é quem cuida do texto.
  useEffect(() => {
    if (!focado)
      setTexto(formatarValor(numeroOuIndefinido(valor), casas));
  }, [valor, casas, focado]);

  useLayoutEffect(() => {
    const caret = caretRef.current;
    if (caret === null)
      return;
    caretRef.current = null;
    const input = inputRef.current;
    if (input && typeof document !== 'undefined' && document.activeElement === input)
      input.setSelectionRange(caret, caret);
  }, [texto]);

  const aoDigitar = useCallback((pEvento: ChangeEvent<HTMLInputElement>) => {
    const alvo = pEvento.target;
    const { texto: novo, caret } = mascararDigitacao(
      alvo.value, texto, alvo.selectionStart ?? alvo.value.length, { casas, permiteNegativo });
    caretRef.current = caret;
    setTexto(novo);
    aoMudar(lerMascarado(novo) ?? null);
  }, [texto, casas, permiteNegativo, aoMudar]);

  const aoFocar = useCallback(() => setFocado(true), []);

  const aoSair = useCallback(() => {
    setFocado(false);
    let numero = lerMascarado(texto);
    if (numero === undefined) {
      setTexto('');
      aoMudar(null);
      return;
    }
    numero = arredondarAsCasas(numero, casas);
    if (minimo !== undefined && numero < minimo)
      numero = minimo;
    if (maximo !== undefined && numero > maximo)
      numero = maximo;
    setTexto(formatarValor(numero, casas));
    aoMudar(numero);
  }, [texto, casas, minimo, maximo, aoMudar]);

  const reexibir = useCallback((pValor: unknown) => {
    setTexto(formatarValor(numeroOuIndefinido(pValor), casas));
  }, [casas]);

  const formatado = formatarValor(numeroOuIndefinido(valor), casas);

  return {
    // Fora do foco o campo é CONTROLADO pelo modelo: mostra o valor formatado, venha ele de onde vier
    // (o pai que não aceitou a mudança, a releitura do registro). Focado, mostra o que a máscara fez
    // com a digitação.
    texto: focado ? texto : formatado,
    inputRef,
    aoDigitar,
    aoFocar,
    aoSair,
    reexibir,
    formatado,
  };
}
