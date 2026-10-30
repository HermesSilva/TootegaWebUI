/**
 * O `**destaque**` das mensagens do back, renderizado como NEGRITO (dono, 2026-09-17).
 *
 * O produto inteiro escreve mensagem com realce — "a empresa **ACME** está **sem Inscrição
 * Estadual**" — porque a diretiva CE-21 manda a mensagem ser formatada, com destaque e orientação.
 * O `ErrorModal` até hoje resolvia isso **apagando** os asteriscos; onde ninguém os apagava, eles
 * chegavam crus à tela, como aconteceu no relatório de conferência.
 *
 * Aqui eles viram o que sempre significaram: o pedaço que o usuário tem de ler primeiro.
 *
 * **Por que não uma biblioteca de Markdown.** O back não escreve Markdown — escreve texto em pt-BR
 * com um único realce. Trazer um renderizador completo abriria a porta para link, imagem e HTML
 * embutido vindos de uma string que atravessa a fronteira, e o ganho seria zero: nenhuma mensagem
 * do produto usa nada além de `**`.
 */

import type { JSX, ReactNode } from 'react';

/** Captura `**...**` — o menor trecho possível, para dois realces na mesma frase não se fundirem. */
const REALCE = /\*\*(.+?)\*\*/g;

/**
 * O texto com os trechos entre `**` em negrito. Sem realce nenhum, devolve a string como veio.
 *
 * Devolve nós React (não HTML), e é o ponto: nada do que vem do servidor é interpretado como
 * marcação — só se escolhe o peso da fonte de cada pedaço. Uma mensagem com `<script>` chega à tela
 * como o texto `<script>`, que é o comportamento correto.
 */
export function textoRealcado(pTexto: string): ReactNode {
  if (!pTexto)
    return '';

  if (!pTexto.includes('**'))
    return pTexto;

  const partes: ReactNode[] = [];
  let ultimo = 0;
  let achado: RegExpExecArray | null;

  REALCE.lastIndex = 0;
  while ((achado = REALCE.exec(pTexto)) !== null) {
    if (achado.index > ultimo)
      partes.push(pTexto.slice(ultimo, achado.index));

    partes.push(
      <strong key={`r${achado.index}`} className="font-semibold">{achado[1]}</strong>);

    ultimo = achado.index + achado[0].length;
  }

  if (ultimo < pTexto.length)
    partes.push(pTexto.slice(ultimo));

  return partes;
}

/**
 * O mesmo, quebrando em PARÁGRAFOS nas linhas em branco. As mensagens do produto separam o "o que
 * houve" do "o que fazer" com uma linha vazia (CE-21), e colá-los num bloco só desfaz justamente a
 * leitura que a mensagem foi escrita para ter.
 */
export function paragrafosRealcados(pTexto: string): JSX.Element[] {
  return (pTexto ?? '')
    .split(/\n{2,}/)
    .map((pParagrafo) => pParagrafo.trim())
    .filter((pParagrafo) => pParagrafo.length > 0)
    .map((pParagrafo, pIndice) => (
      // `whitespace-pre-line`: a quebra simples dentro do parágrafo é do autor da mensagem.
      <p key={pIndice} className="whitespace-pre-line leading-relaxed">
        {textoRealcado(pParagrafo)}
      </p>
    ));
}
