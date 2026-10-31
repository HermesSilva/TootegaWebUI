/**
 * Modelos de documento de EXEMPLO para a tela de estudo (dono, 2026-10-28). Os textos ilustram o mecanismo; os
 * modelos de verdade nascem no back de cada módulo, com as regras do produto. Explicações e exemplos são AsciiDoc
 * inline: `*negrito*`, `_itálico_`, `` `mono` ``, `#realce#`, `kbd:[Tecla]`…
 */

import type { ModeloDeDocumento } from '../modelo/modeloDeDocumento';

export const MODELO_ITEM_DE_TRABALHO: ModeloDeDocumento = {
  nome: 'item-de-trabalho',
  rotulo: 'Item de trabalho',
  tituloInicial: 'Título do item',
  explicacao:
    'Descreve uma unidade de trabalho que alguém vai *executar* e alguém vai *aceitar*. O motor lê cada seção pelo nome: sem as quatro obrigatórias o item #não entra no fluxo# (item bem-formado). Escreva para quem _não participou_ da conversa que originou o pedido.',
  secoes: [
    { titulo: 'O quê', nivel: 1, obrigatoria: true, explicacao: 'O *resultado concreto* que se espera ao fim: o que existirá, mudará ou deixará de existir. Uma ou duas frases, _sem solução técnica_.', exemplo: 'O cliente consegue baixar a nota em PDF a partir da tela do pedido.' },
    { titulo: 'Por quê', nivel: 1, obrigatoria: true, explicacao: 'O *problema* ou a *oportunidade* que motiva o item e quem é afetado. É o que permite questionar a prioridade mais tarde.', exemplo: 'Hoje o cliente pede a nota por e-mail e o suporte gasta *40 minutos por dia* reenviando.' },
    { titulo: 'Critério de pronto', nivel: 1, obrigatoria: true, explicacao: 'A lista *verificável* do que precisa ser verdade para o item ser aceito. Cada linha é um teste que alguém consegue executar e responder _sim_ ou _não_.', esqueleto: '* [ ] ', exemplo: '`[ ]` O botão aparece só em pedido faturado. `[ ]` O PDF abre no navegador em menos de 3 segundos.' },
    { titulo: 'Valor esperado', nivel: 1, obrigatoria: true, explicacao: 'O *ganho mensurável* depois da entrega, com a medida e o prazo em que será conferido. É o que separa #concluído# de #sucesso#.', exemplo: 'Reduzir os reenvios de nota pelo suporte de 40 para *menos de 5 por dia*, medido 30 dias após a publicação.' },
    { titulo: 'Riscos e dependências', nivel: 1, obrigatoria: false, explicacao: 'O que pode *impedir* ou *atrasar*: outro item, uma decisão pendente, um terceiro. Deixe vazio se não houver.' },
  ],
};

export const MODELO_DECISAO: ModeloDeDocumento = {
  nome: 'decisao',
  rotulo: 'Registro de decisão (ADR)',
  tituloInicial: 'ADR-0000: título da decisão',
  explicacao:
    'Registra uma decisão de arquitetura ou de produto de forma que, daqui a um ano, alguém entenda *por que* ela foi tomada e *o que custou*. A decisão é #imutável# depois de aceita: muda-se com outro ADR que a substitui.',
  secoes: [
    { titulo: 'Contexto', nivel: 1, obrigatoria: true, explicacao: 'A situação que exigiu decidir: forças em jogo, restrições, o que estava em discussão. *Fatos*, não opiniões.' },
    { titulo: 'Decisão', nivel: 1, obrigatoria: true, explicacao: 'O que foi decidido, em frases *afirmativas* e sem condicional. Quem decidiu e quando.', exemplo: 'O ANVIL hospeda o git real atrás do gateway; *não reimplementa Git*. Decidido pelo dono em 2026-10-24.' },
    { titulo: 'Alternativas consideradas', nivel: 1, obrigatoria: true, explicacao: 'As opções que foram avaliadas e *por que cada uma perdeu*. Uma lista, uma opção por item, com o motivo.', esqueleto: '* ' },
    { titulo: 'Consequências', nivel: 1, obrigatoria: true, explicacao: 'O que fica *mais fácil* e o que fica *mais difícil* depois da decisão, inclusive o que passa a ser proibido. Positivas _e_ negativas.' },
    { titulo: 'Situação', nivel: 1, obrigatoria: false, explicacao: '`Proposta`, `Aceita`, `Substituída` (por qual ADR) ou `Revogada`.', esqueleto: 'Proposta.' },
  ],
};

export const MODELO_INCIDENTE: ModeloDeDocumento = {
  nome: 'incidente',
  rotulo: 'Relato de incidente',
  tituloInicial: 'Incidente: título curto',
  explicacao:
    'Relata um incidente de produção ou homologação para *aprender* com ele, #sem culpar pessoas#: o relato é sobre o sistema e o processo. A linha do tempo precisa de *horários*; a causa raiz precisa de *evidência*.',
  secoes: [
    { titulo: 'O que aconteceu', nivel: 1, obrigatoria: true, explicacao: 'O *sintoma* visto pelo usuário ou pela operação, em duas ou três frases. O que parou, o que ficou errado, por quanto tempo.' },
    { titulo: 'Impacto', nivel: 1, obrigatoria: true, explicacao: '*Quem* foi afetado e *em que medida*: usuários, assinantes, operações, dados. Números sempre que houver.' },
    { titulo: 'Linha do tempo', nivel: 1, obrigatoria: true, explicacao: 'Os eventos em ordem, com *data e hora*: primeiro sinal, detecção, mitigação, resolução. Uma tabela com hora e evento.', esqueleto: '[cols="1,3",options="header"]\n|===\n|Hora |Evento\n\n| |\n|===' },
    { titulo: 'Causa raiz', nivel: 1, obrigatoria: true, explicacao: 'A causa técnica *comprovada*, e a cadeia de "por quês" até ela. Hipótese não comprovada fica marcada como _hipótese_.' },
    { titulo: 'Ações', nivel: 1, obrigatoria: true, explicacao: 'O que será feito para o incidente *não se repetir*, com responsável (chapéu, não pessoa) e prazo. Uma tarefa por linha.', esqueleto: '* [ ] ' },
    { titulo: 'O que funcionou', nivel: 1, obrigatoria: false, explicacao: 'O que ajudou a detectar ou resolver *mais rápido*, para repetir da próxima vez.' },
  ],
};

export const MODELOS_DE_EXEMPLO: readonly ModeloDeDocumento[] = [MODELO_ITEM_DE_TRABALHO, MODELO_DECISAO, MODELO_INCIDENTE];
