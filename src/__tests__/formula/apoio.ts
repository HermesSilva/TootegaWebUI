import { renderizarFormula, type NotacaoEfetiva } from '@core/lib/formula';

/** O miolo do `<math>`: é o que a fórmula virou, sem o invólucro comum a todas. */
export function corpo(pFonte: string, pNotacao: NotacaoEfetiva, pBloco = false): string {
  return renderizarFormula(pFonte, { notacao: pNotacao, bloco: pBloco, anotar: false })
    .mathml.replace(/^<math[^>]*>/, '').replace(/<\/math>$/, '');
}

export function avisos(pFonte: string, pNotacao: NotacaoEfetiva, pBloco = false): string[] {
  return renderizarFormula(pFonte, { notacao: pNotacao, bloco: pBloco, anotar: false }).avisos.map((pA) => pA.texto);
}

/** Lista o que não renderizou limpo: aviso ou `merror`. Vazia é o resultado esperado. */
export function problemas(pFontes: Iterable<string>, pNotacao: NotacaoEfetiva = 'latexmath', pBloco = true): string[] {
  const ruins: string[] = [];
  for (const fonte of pFontes) {
    const { mathml, avisos: lista } = renderizarFormula(fonte, { notacao: pNotacao, bloco: pBloco, anotar: false });
    if (lista.length > 0 || mathml.includes('<merror'))
      ruins.push(`${fonte} :: ${lista[0]?.texto ?? 'merror'}`);
  }
  return ruins;
}
