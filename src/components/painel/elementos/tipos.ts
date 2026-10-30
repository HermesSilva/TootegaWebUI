/**
 * Tipos do PAINEL DE TRABALHO — o template das telas de trabalho (dashboards) de qualquer SaaS (dono, 2026-10-25).
 *
 * O painel é a moldura: cabeçalho (onde estou, em que estado, como estava em que data), ações, abas, a faixa
 * "precisa de você", o corpo e o rodapé. O conteúdo é de quem o usa: nada aqui conhece o domínio de um SaaS, e a
 * mesma moldura serve a qualquer objeto acompanhado (um projeto, um pedido, um ambiente).
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** O tom semântico de um status, sinal ou contador. A cor sai do tom, nunca de quem monta a tela. */
export type XTomDoPainel = 'neutro' | 'info' | 'sucesso' | 'aviso' | 'perigo';

/** Um passo da trilha de navegação do cabeçalho ("Empresa › PROJETO"). */
export interface XMigalhaDoPainel {
  rotulo: string;
  /** Código/sigla: sai em fonte monoespaçada. */
  codigo?: boolean;
  /** O passo ganha a seta que abre a lista para trocar de objeto (de empresa, por exemplo). Ausente ⇒ sem seta. */
  escolha?: XEscolhaNoCabecalho;
  /** Clicar no NOME abre o objeto (a App do tipo dele, no registro). Ausente ⇒ o nome é texto. */
  aoAbrir?: () => void;
}

/** Uma escolha no cabeçalho: a seta ao lado do nome abre a lista dos que existem (o nome em si abre o objeto). */
export interface XEscolhaNoCabecalho {
  /** Nome acessível do combobox (ex.: "Portal do Cliente: trocar de projeto"). */
  rotuloAcessivel: string;
  opcoes: XOpcaoDoMenu[];
  /** A opção corrente (marcada na lista). Ausente ⇒ ainda não há escolha: a lista é para ABRIR um (o nível só por navegação). */
  selecionada?: string;
  /** O que a lista diz quando não há opção nenhuma (ex.: "Você não tem acesso a nenhum repositório"). Ausente ⇒ lista vazia. */
  vazio?: string;
  aoEscolher: (pID: string) => void;
}

/** O estado do objeto, à direita do título ("Elaboração · dia 34 de 60"). */
export interface XStatusDoPainel {
  rotulo: string;
  detalhe?: string;
  tom: XTomDoPainel;
  /** Fração decorrida (0..1): desenha a régua fina sob o status. */
  progresso?: number;
}

/** Uma ação do cabeçalho. A cor é a do papel (paleta semântica do Core). */
export interface XAcaoDoPainel {
  id: string;
  rotulo: string;
  icone?: LucideIcon;
  /** Ícone servido pelo App (`/icons/<nome>.svg`), no lugar do `icone` — o avatar da Jaci, por exemplo. */
  iconeDoApp?: string;
  papel: 'criar' | 'neutro' | 'leitura';
  desabilitada?: boolean;
  dica?: string;
  aoAcionar: () => void;
}

/** Uma aba do painel. */
export interface XAbaDoPainel {
  id: string;
  rotulo: string;
  /** Contador discreto ao lado do rótulo (ex.: revisões abertas). */
  contador?: number;
  /** O que o contador conta, para leitor de tela ("revisões abertas" ⇒ "3 revisões abertas"). */
  rotuloDoContador?: string;
}

/** Um motivo para o usuário agir, na faixa "precisa de você". */
export interface XItemDeAtencao {
  id: string;
  quantidade: number;
  /** O texto que segue o número: "revisões aguardando". */
  rotulo: string;
  tom: XTomDoPainel;
}

/** Uma opção de menu suspenso (seletor de data, menu "mais"). */
export interface XOpcaoDoMenu {
  id: string;
  rotulo: string;
  detalhe?: string;
  icone?: LucideIcon;
}

/** Slot livre que o painel posiciona e o usuário do template preenche. */
export type XSlotDoPainel = ReactNode;
