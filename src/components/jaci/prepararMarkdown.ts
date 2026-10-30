/**
 * O `MessageText` da casca entende parágrafos, listas numeradas (`N. ` em linhas próprias) e **negrito**.
 * O Markdown da Jaci pode chegar com título (`## Passos`), marcador (`- item`) e, pior, a enumeração
 * EMENDADA no parágrafo — "faça assim: 1) abra… 2) confira… 3) salve." (visto em 2026-10-18). Aqui tudo
 * isso vira o que a casca renderiza bem: título em negrito, bolinha no marcador e UM PASSO POR LINHA.
 */

const MARCADOR_DE_PASSO = /(\d{1,2})[.)]\s+/g;

/**
 * Uma linha com DOIS OU MAIS marcadores "N) " ou "N. " é uma enumeração emendada: cada marcador ganha a
 * própria linha. Um marcador sozinho ("art. 8) …", "ver item 2. do contrato") não é lista e fica como está.
 */
export function quebrarEnumeracaoInline(pLinha: string): string {
  const marcadores = [...pLinha.matchAll(MARCADOR_DE_PASSO)];
  if (marcadores.length < 2)
    return pLinha;

  let resultado = '';
  let cursor = 0;
  for (const marcador of marcadores) {
    const inicio = marcador.index ?? 0;
    const antes = pLinha.slice(cursor, inicio);
    // Quebra só quando o marcador não está no começo da linha; o texto anterior perde o espaço final.
    resultado += inicio === 0 ? '' : `${antes.replace(/[\s:;,]+$/, (pFim) => (pFim.includes(':') ? ':' : ''))}\n`;
    resultado += `${marcador[1]}. `;
    cursor = inicio + marcador[0].length;
  }
  resultado += pLinha.slice(cursor);
  return resultado;
}

export function prepararMarkdown(pTexto: string): string {
  return (pTexto ?? '')
    .split('\n')
    .map(quebrarEnumeracaoInline)
    .join('\n')
    .split('\n')
    .map((pLinha) => {
      const titulo = /^\s*#{1,6}\s+(.*)$/.exec(pLinha);
      if (titulo)
        return `**${titulo[1].trim()}**`;

      // "1) texto" vira "1. texto": o MessageText só reconhece "N. ".
      const passo = /^(\s*)(\d{1,2})\)\s+(.*)$/.exec(pLinha);
      if (passo)
        return `${passo[1]}${passo[2]}. ${passo[3]}`;

      return pLinha.replace(/^(\s*)[-*]\s+/, '$1• ');
    })
    .join('\n');
}
