/**
 * O placeholder dos campos de data — `dd/mm/aaaa`, sempre (dono, 2026-08-06).
 *
 * **Por que não é o atributo `placeholder`.** `<input type="date">` o ignora: o texto cinza que
 * aparece no campo vazio é desenhado pelo navegador, no formato do **locale dele** — daí o
 * `mm/dd/yyyy` numa tela em português. E não adianta declarar o idioma na página: o
 * `index.html` já traz `lang="pt-BR"` e o campo continuava em formato americano, porque o Chrome
 * segue a língua do NAVEGADOR, não a do documento.
 *
 * A saída é desenhar o nosso: com o campo vazio, o texto nativo fica transparente (`text-transparent`
 * apaga o do Chrome e o do Firefox de uma vez, sem depender de pseudo-elemento de fabricante) e este
 * componente escreve por cima o formato que o produto fala. Ao focar, o nativo reaparece e este some
 * — senão o usuário digitaria sem ver o que digita.
 *
 * O ícone de calendário do navegador não é afetado: ele é outro elemento, e continua clicável.
 */

import { type JSX } from 'react';

interface XPlaceholderDeDataProps {
  /** Só aparece com o campo VAZIO — havendo data, quem manda é o valor. */
  visivel: boolean;
  /** O formato escrito: `dd/mm/aaaa` ou `dd/mm/aaaa hh:mm`. */
  texto: string;
  /** Recuo à esquerda, para casar com o ícone do editor. */
  recuo?: string;
}

/** O formato de data do produto, escrito como o usuário o lê. */
export const FORMATO_DATA = 'dd/mm/aaaa';

/** O mesmo, com a hora. */
export const FORMATO_DATA_HORA = 'dd/mm/aaaa hh:mm';

/**
 * A classe do input quando vazio. Fica no mesmo arquivo do placeholder de propósito: são as duas
 * metades do mesmo truque, e separá-las é o caminho para alguém mexer numa e esquecer a outra.
 */
export const CLASSE_TEXTO_OCULTO = 'text-transparent focus:text-brand-text-primary';

export function XPlaceholderDeData({ visivel, texto, recuo = 'left-10' }: XPlaceholderDeDataProps): JSX.Element | null {
  if (!visivel)
    return null;

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute ${recuo} top-1/2 -translate-y-1/2 text-ui text-brand-text-muted peer-focus:opacity-0`}
    >
      {texto}
    </span>
  );
}
