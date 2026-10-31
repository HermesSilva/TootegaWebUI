/**
 * Delimitadores aceitos por `\left`, `\right`, `\middle`, `\big`… e `\genfrac`: texto do token → caractere; `.` = nada.
 */

export const DELIMITADORES = new Map<string, string>([
  ['(', '('], [')', ')'], ['[', '['], [']', ']'], ['\\lbrack', '['], ['\\rbrack', ']'], ['\\{', '{'], ['\\}', '}'],
  ['\\lbrace', '{'], ['\\rbrace', '}'], ['\\langle', '⟨'], ['\\rangle', '⟩'], ['\\lang', '⟨'], ['\\rang', '⟩'], ['<', '⟨'], ['>', '⟩'],
  ['\\lceil', '⌈'], ['\\rceil', '⌉'], ['\\lfloor', '⌊'], ['\\rfloor', '⌋'], ['\\lgroup', '⟮'], ['\\rgroup', '⟯'],
  ['\\lmoustache', '⎰'], ['\\rmoustache', '⎱'], ['/', '/'], ['\\backslash', '\\'], ['|', '|'], ['\\vert', '|'], ['\\|', '‖'],
  ['\\Vert', '‖'], ['\\lvert', '|'], ['\\rvert', '|'], ['\\lVert', '‖'], ['\\rVert', '‖'], ['\\uparrow', '↑'], ['\\downarrow', '↓'],
  ['\\updownarrow', '↕'], ['\\Uparrow', '⇑'], ['\\Downarrow', '⇓'], ['\\Updownarrow', '⇕'], ['\\llbracket', '⟦'], ['\\rrbracket', '⟧'],
  ['\\ulcorner', '⌜'], ['\\urcorner', '⌝'], ['\\llcorner', '⌞'], ['\\lrcorner', '⌟'], ['.', ''],
  ['⟨', '⟨'], ['⟩', '⟩'], ['⌈', '⌈'], ['⌉', '⌉'], ['⌊', '⌊'], ['⌋', '⌋'], ['‖', '‖'], ['↑', '↑'], ['↓', '↓'], ['⇑', '⇑'], ['⇓', '⇓'],
  ['{', '{'], ['}', '}'],
]);

/** O caractere de um delimitador escrito como texto (`\genfrac{(}{]}`), ou `null`. */
export function delimitadorDoTexto(pTexto: string): string | null {
  const texto = pTexto.trim();
  if (texto === '')
    return '';
  return DELIMITADORES.get(texto) ?? null;
}
