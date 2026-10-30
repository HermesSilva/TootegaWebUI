/**
 * ERRO MUDO É DEFEITO (dono, 2026-08-07, binária).
 *
 * Nenhuma falha chega ao usuário sem dizer **o que** aconteceu e **por quê**. É proibido, em todo o
 * front, o texto genérico — "ocorreu um erro inesperado", "erro ao processar", "tente novamente" —
 * porque ele não informa, não orienta e ainda apaga a única pista que o usuário teria para relatar
 * o problema. O `guardaErroMudo.test.ts` reprova a suíte se alguma dessas frases voltar ao código.
 *
 * Quase toda falha do front é um `Error` que já traz mensagem escrita: da API (o back a manda
 * pronta, formatada) ou do próprio navegador. Este auxiliar existe para o `catch`: aproveitar essa
 * mensagem e, quando ela não existe, dizer ao menos **qual operação** falhou.
 */

/**
 * Texto exibível a partir do que foi capturado num `catch`.
 *
 * @param pErro     O que o `catch` recebeu — normalmente um `Error`/`ApiError`.
 * @param pOperacao O que o usuário estava fazendo, em linguagem dele e no infinitivo:
 *                  "trocar a senha", "salvar o pedido". Entra na frase quando não há mensagem.
 */
export function mensagemDeFalha(pErro: unknown, pOperacao: string): string {
  if (pErro instanceof Error && pErro.message.trim())
    return pErro.message;

  // Sem Error e sem mensagem: joga-se o que veio (uma string, um objeto) para não perder a pista.
  const bruto = typeof pErro === 'string' ? pErro.trim() : '';
  if (bruto)
    return bruto;

  return `Não foi possível ${pOperacao}, e o sistema não obteve o motivo da falha — o que, por si, é defeito nosso.\n\n**O que fazer:** repita a operação. Se repetir, avise o suporte informando esta mensagem.`;
}
