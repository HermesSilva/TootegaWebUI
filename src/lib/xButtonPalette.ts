/**
 * xButtonPalette — a fonte ÚNICA de cor de botão (dono, 2026-08-13).
 *
 * Cada papel semântico da paleta (`XButtonColor`) mapeia para um conjunto FIXO de classes Tailwind —
 * fundo, hover e texto. É a única tabela de cor de botão do produto: o mesmo papel produz o mesmo tom
 * em QUALQUER App, para qualquer botão (padrão OU custom), porque nenhuma tela pinta botão à mão. O
 * operador reconhece "Novo" pelo verde e "Fechar" pelo vermelho abafado antes de ler o rótulo, e esse
 * reconhecimento não depende de quem montou a App.
 *
 * Cores FIXAS, não variáveis de tema: as variáveis (--info, --success, --brand-primary) mudam de matiz
 * entre temas — num deles --info é laranja — e as ações canônicas da barra precisam de cor estável.
 *
 * Como se liga tudo:
 * - Botão canônico (por `XButtonAction`): `PALETA_POR_ACAO` diz o papel; a App não declara nada.
 * - Botão custom / ação de linha: a App declara o papel em `XButton.color` / `XRowAction.color`.
 * - Sem papel declarado ⇒ `XButtonColor.Default` ⇒ neutro sólido e estável.
 *
 * O "Fechar" reusa `CLOSE_BUTTON_STYLE` (mesma cor renderizada fora do XButtonBar pelos modais).
 */

import { XButtonAction, XButtonColor } from '@core/types';
import { CLOSE_BUTTON_STYLE } from './closeButtonStyle';

/**
 * Papel semântico → classes Tailwind (fundo + hover + texto). É a paleta em si; muda-se o tom de um
 * papel aqui, e toda a plataforma acompanha.
 */
export const XBUTTON_PALETTE: Record<XButtonColor, string> = {
  // Neutro: cinza escuro sólido, estável. É onde caem os custom sem papel (DANFE avulso, ações
  // secundárias) — todos com o MESMO neutro, em vez de o cinza que o tema pintaria por tipo.
  [XButtonColor.Default]: 'bg-slate-700 hover:bg-slate-600 text-white',
  [XButtonColor.Neutral]: 'bg-slate-600 hover:bg-slate-500 text-white',

  // Escrita: criar (verde), editar/salvar (azul).
  [XButtonColor.Create]: 'bg-green-600 hover:bg-green-700 text-white',
  [XButtonColor.Edit]: 'bg-blue-600 hover:bg-blue-700 text-white',

  // Leitura: azul CLARO/pastel — presente, sem a saturação de quem escreve.
  [XButtonColor.Read]: 'bg-sky-300/70 hover:bg-sky-300 text-sky-950',

  // Dados que saem da grade: exportar (violeta).
  [XButtonColor.Export]: 'bg-violet-600 hover:bg-violet-700 text-white',

  // Saída/encerramento: vermelho abafado (mesma cor do Fechar dos modais).
  [XButtonColor.Close]: CLOSE_BUTTON_STYLE,

  // Destrutivo: vermelho sólido (excluir, desativar).
  [XButtonColor.Danger]: 'bg-red-600 hover:bg-red-700 text-white',

  // Atenção sem destruir: âmbar.
  [XButtonColor.Warning]: 'bg-amber-500 hover:bg-amber-600 text-white',

  // Destaque do fluxo — a próxima etapa esperada (transmitir, emitir): índigo.
  [XButtonColor.Highlight]: 'bg-indigo-600 hover:bg-indigo-700 text-white',

  // Documento auxiliar (DANFE, proposta, DANFSe): ardósia escura, distinta das ações que escrevem.
  [XButtonColor.Document]: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
};

/**
 * Ação canônica → papel semântico. Aqui a barra decide a cor do botão PADRÃO sem que a App declare
 * nada. Ações fora da tabela seguem o tipo do botão (BUTTON_TYPE_STYLES), como antes.
 */
export const PALETA_POR_ACAO: Partial<Record<XButtonAction, XButtonColor>> = {
  [XButtonAction.Create]: XButtonColor.Create,
  [XButtonAction.Edit]: XButtonColor.Edit,
  [XButtonAction.Save]: XButtonColor.Edit,
  [XButtonAction.View]: XButtonColor.Read,
  [XButtonAction.Export]: XButtonColor.Export,
  [XButtonAction.Refresh]: XButtonColor.Neutral,
  [XButtonAction.Close]: XButtonColor.Close,
  [XButtonAction.Delete]: XButtonColor.Danger,
  [XButtonAction.Deactivate]: XButtonColor.Danger,
  [XButtonAction.Activate]: XButtonColor.Create,
  [XButtonAction.RemoveChecked]: XButtonColor.Danger,
};

/**
 * A classe de cor de um botão, resolvida numa fonte só. Precedência:
 *   1) papel EXPLÍCITO no botão (`color`), quando não é Default — o que o custom declara;
 *   2) papel da AÇÃO canônica (`PALETA_POR_ACAO`);
 *   3) `null` ⇒ o chamador cai no estilo por TIPO (BUTTON_TYPE_STYLES).
 */
export function classeDeCorDoBotao(
  pAction: XButtonAction,
  pColor: XButtonColor | undefined,
): string | null {
  // Papel explícito e conhecido (o custom declara). Ignora o Default e qualquer valor fora da paleta
  // (ex.: dado antigo com string vazia), que caem na resolução por ação abaixo.
  if (pColor !== undefined && pColor !== XButtonColor.Default && XBUTTON_PALETTE[pColor] !== undefined)
    return XBUTTON_PALETTE[pColor];

  const papelDaAcao = PALETA_POR_ACAO[pAction];
  if (papelDaAcao !== undefined)
    return XBUTTON_PALETTE[papelDaAcao];

  return null;
}
