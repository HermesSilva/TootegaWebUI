/**
 * posicaoFlutuante — ONDE abre um painel ancorado a um campo (lista de lookup, picker), uma regra só.
 *
 * Ordem fixa (dono, 2026-10-23): ABAIXO do campo; não coube ⇒ ACIMA; não coube ⇒ à DIREITA; não coube
 * ⇒ à ESQUERDA. Nenhum lado comporta o painel inteiro ⇒ fica o lado vertical com mais espaço, e a
 * altura encolhe para caber (quem chama aplica `maxHeight` e rola por dentro).
 *
 * Era escrita quatro vezes (combo, lookup, seleção múltipla e picker), e cada cópia só sabia abrir
 * para baixo ou, quando muito, para cima: o picker do destinatário, perto do pé da tela, nascia
 * cortado pela borda da janela. Num lugar só, os quatro passam a se comportar igual.
 *
 * As coordenadas são da JANELA, porque todos esses painéis vão por portal com `position: fixed`.
 * Acima, a posição sai em `bottom` (e não em `top`): a lista real pode ser mais baixa que a altura
 * pedida, e ancorar pela base a mantém colada ao campo em vez de deixar um vão entre os dois.
 */

export type LadoFlutuante = 'abaixo' | 'acima' | 'direita' | 'esquerda';

export interface PosicaoFlutuante {
  lado: LadoFlutuante;
  top?: number;
  bottom?: number;
  left: number;
  /** Altura disponível no lado escolhido — teto do painel. */
  maxHeight: number;
}

export interface OpcoesPosicaoFlutuante {
  /** Largura do painel. */
  largura: number;
  /** Altura que o painel quer (a medida real, ou o teto da lista). */
  altura: number;
  /** Distância entre o campo e o painel. */
  folga?: number;
  /** Distância mínima até a borda da janela. */
  margem?: number;
  /** Piso de altura quando nenhum lado comporta o painel inteiro. */
  alturaMinima?: number;
}

export function posicaoFlutuante(pCampo: DOMRect, pOpcoes: OpcoesPosicaoFlutuante): PosicaoFlutuante {
  const { largura, altura, folga = 4, margem = 8, alturaMinima = 120 } = pOpcoes;
  const larguraJanela = window.innerWidth;
  const alturaJanela = window.innerHeight;

  const espacoAbaixo = alturaJanela - pCampo.bottom - folga - margem;
  const espacoAcima = pCampo.top - folga - margem;
  const espacoDireita = larguraJanela - pCampo.right - folga - margem;
  const espacoEsquerda = pCampo.left - folga - margem;
  const alturaUtil = alturaJanela - 2 * margem;

  // Na vertical, alinha à esquerda do campo sem vazar pela direita da janela.
  const leftVertical = Math.max(margem, Math.min(pCampo.left, larguraJanela - largura - margem));
  // Ao lado, alinha ao topo do campo sem vazar pelo pé da janela.
  const topLateral = Math.max(margem, Math.min(pCampo.top, alturaJanela - altura - margem));

  if (altura <= espacoAbaixo)
    return { lado: 'abaixo', top: pCampo.bottom + folga, left: leftVertical, maxHeight: espacoAbaixo };

  if (altura <= espacoAcima)
    return { lado: 'acima', bottom: alturaJanela - pCampo.top + folga, left: leftVertical, maxHeight: espacoAcima };

  if (altura <= alturaUtil && largura <= espacoDireita)
    return { lado: 'direita', top: topLateral, left: pCampo.right + folga, maxHeight: alturaUtil };

  if (altura <= alturaUtil && largura <= espacoEsquerda)
    return { lado: 'esquerda', top: topLateral, left: pCampo.left - folga - largura, maxHeight: alturaUtil };

  // Nenhum lado comporta o painel inteiro: o vertical com mais espaço, com a altura encolhida.
  if (espacoAbaixo >= espacoAcima)
    return { lado: 'abaixo', top: pCampo.bottom + folga, left: leftVertical, maxHeight: Math.max(alturaMinima, espacoAbaixo) };

  return { lado: 'acima', bottom: alturaJanela - pCampo.top + folga, left: leftVertical, maxHeight: Math.max(alturaMinima, espacoAcima) };
}
