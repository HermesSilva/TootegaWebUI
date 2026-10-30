/**
 * Estilo canônico do botão "Fechar".
 *
 * Fechar é a MESMA ação em qualquer superfície — barra da App, modal, visualizador, painel — e por
 * isso tem uma cor só, definida num lugar só. Antes cada tela repetia as classes à mão e elas
 * divergiam ao primeiro ajuste: a barra da App ganhou o vermelho abafado, e os modais ficaram com o
 * cinza neutro que herdaram do botão "Cancelar".
 *
 * Vermelho ABAFADO: sinaliza saída sem gritar como um botão destrutivo (Excluir), e ganha saturação
 * só no hover, quando o gesto já está em curso. Cor fixa em qualquer tema — as variáveis de tema
 * (--danger, --info) mudam de matiz entre temas, e o usuário reconhece Fechar pela cor antes de ler
 * o rótulo. O ícone que o acompanha é sempre o `LogOut` do lucide-react.
 */
export const CLOSE_BUTTON_STYLE = 'bg-red-900/60 hover:bg-red-800 text-red-100/80 hover:text-white';

/** Botão "Fechar" completo (forma + cor), para telas que o renderizam fora do XButtonBar. */
export const CLOSE_BUTTON_CLASS = `
  inline-flex items-center justify-center gap-1.5 sm:gap-2
  font-medium rounded-lg transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary
  px-2.5 sm:px-3 py-2 sm:py-1.5 text-ui-sm sm:text-ui
  min-h-[40px] sm:min-h-[36px]
  ${CLOSE_BUTTON_STYLE}
`;
