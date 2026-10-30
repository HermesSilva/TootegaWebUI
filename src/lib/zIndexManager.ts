/**
 * ZIndexManager - Gerenciador de Z-Index Dinâmico
 * 
 * Contador estático que garante que elementos empilhados (modais, dropdowns, etc.)
 * sempre fiquem na ordem correta de sobreposição.
 * 
 * Uso:
 * - Ao abrir um modal: const zIndex = ZIndexManager.next()
 * - Ao abrir um dropdown dentro do modal: const dropdownZIndex = ZIndexManager.next()
 * - O dropdown terá z-index maior que o modal, garantindo sobreposição correta
 */

const BASE_Z_INDEX = 1000;

let _CurrentZIndex = BASE_Z_INDEX;

export const ZIndexManager = {
  /**
   * Retorna o próximo z-index disponível e incrementa o contador
   */
  next(): number {
    return ++_CurrentZIndex;
  },

  /**
   * Retorna o z-index atual sem incrementar
   */
  current(): number {
    return _CurrentZIndex;
  },

  /**
   * Reseta o contador (útil para testes)
   */
  reset(): void {
    _CurrentZIndex = BASE_Z_INDEX;
  },
};
