/**
 * Recarrega a página inteira. Existe como função própria, e não como `window.location.reload()` escrito no
 * chamador, por um motivo só: o jsdom não implementa navegação, e o teste precisa trocar a recarga por um
 * espião para provar QUANDO ela acontece.
 */
export function recarregarPagina(): void {
  window.location.reload();
}
