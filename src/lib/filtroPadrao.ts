/**
 * Valor inicial de um filtro, resolvido a partir do que o back declarou (CE-19).
 *
 * O modelo da App é montado no boot do servidor e fica em cache — uma data escrita ali envelhece
 * no mesmo dia e passa a mentir. Por isso o back declara um TOKEN relativo (`@inicioDoMes`) e quem
 * o resolve é o front, no instante em que a tela abre.
 *
 * Sem isto, uma consulta de extrato abre sem período nenhum e a primeira coisa que ela faz é pedir
 * o histórico inteiro do assinante para responder "o que houve esta semana".
 */

import type { XDataEditor } from '@core/types';

/** Data em ISO (`yyyy-MM-dd`), que é o formato que os editores de data e o back esperam. */
function iso(pData: Date): string {
  const mes = String(pData.getMonth() + 1).padStart(2, '0');
  const dia = String(pData.getDate()).padStart(2, '0');
  return `${pData.getFullYear()}-${mes}-${dia}`;
}

/**
 * Data COM HORA (`yyyy-MM-ddTHH:mm`) — o formato do `input[type=datetime-local]`, que é o que o
 * editor de data-hora renderiza.
 *
 * Existe separado do {@link iso} porque a diferença não é cosmética: uma data sem hora num campo
 * `DateTime` chega ao back como texto que o binder não converte, e o pedido morre com **400 antes
 * do controller** — corpo cru, fora do envelope, e o usuário lendo "Bad Request" sem motivo.
 */
function isoComHora(pData: Date): string {
  const hora = String(pData.getHours()).padStart(2, '0');
  const minuto = String(pData.getMinutes()).padStart(2, '0');
  return `${iso(pData)}T${hora}:${minuto}`;
}

/**
 * Os tokens reconhecidos. Qualquer outro texto é devolvido como veio — um valor padrão literal
 * ("Ativo" num combo de estado) continua funcionando.
 */
export function resolverTokenDeFiltro(pValor: string, pAgora: Date = new Date()): string {
  switch (pValor) {
    case '@hoje':
      return iso(pAgora);
    // O ÚNICO token com hora: alimenta campo `DateTime` ("quando a correção de estoque foi feita").
    // Os demais são de DATA, e servem a filtro de período, onde a hora não entra.
    case '@agora':
      return isoComHora(pAgora);
    case '@ontem':
      return iso(new Date(pAgora.getFullYear(), pAgora.getMonth(), pAgora.getDate() - 1));
    case '@inicioDoMes':
      return iso(new Date(pAgora.getFullYear(), pAgora.getMonth(), 1));
    case '@fimDoMes':
      return iso(new Date(pAgora.getFullYear(), pAgora.getMonth() + 1, 0));
    case '@inicioDoAno':
      return iso(new Date(pAgora.getFullYear(), 0, 1));
    default:
      return pValor;
  }
}

/**
 * Os valores iniciais dos filtros da App, chaveados pelo NOME DO EDITOR — a mesma chave que o
 * XApplicationView usa no estado, para que dois editores sobre o mesmo campo (o "de" e o "até" de
 * um período) não se atropelem.
 */
export function valoresPadraoDeFiltro(
  pEditores: readonly XDataEditor[],
  pAgora: Date = new Date()
): Record<string, unknown> {
  const valores: Record<string, unknown> = {};

  for (const editor of pEditores) {
    const declarado = editor.editor?.defaultValue ?? '';
    if (declarado === '')
      continue;

    valores[editor.name] = resolverTokenDeFiltro(declarado, pAgora);
  }

  return valores;
}
