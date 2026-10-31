/**
 * TABELA DE SÍMBOLOS do TeX: sequência de controle → caractere Unicode + classe de átomo, em modo matemático e em
 * modo texto. Escrita da casa a partir das tabelas Unicode e do manual do amssymb; a lista do KaTeX serviu de
 * conferência (nomes e classes). Letras e dígitos entram por programa; caractere Unicode digitado direto é aceito
 * quando a tabela inversa o conhece.
 */

import type { ClasseDeAtomo } from '../ast';

export interface EntradaDeSimbolo {
  classe: ClasseDeAtomo;
  texto: string;
}

export const SIMBOLOS_MATH = new Map<string, EntradaDeSimbolo>();
export const SIMBOLOS_TEXT = new Map<string, EntradaDeSimbolo>();
/** Caractere Unicode → entrada (para aceitar `α`, `∞`, `≤` digitados). */
export const UNICODE_MATH = new Map<string, EntradaDeSimbolo>();

function math(pClasse: ClasseDeAtomo, pTexto: string, pNomes: string | string[], pAceitaUnicode = true): void {
  const entrada: EntradaDeSimbolo = { classe: pClasse, texto: pTexto };
  for (const nome of Array.isArray(pNomes) ? pNomes : [pNomes])
    SIMBOLOS_MATH.set(nome, entrada);
  if (pAceitaUnicode && !UNICODE_MATH.has(pTexto))
    UNICODE_MATH.set(pTexto, entrada);
}

function text(pTexto: string, pNomes: string | string[]): void {
  const entrada: EntradaDeSimbolo = { classe: 'textord', texto: pTexto };
  for (const nome of Array.isArray(pNomes) ? pNomes : [pNomes])
    SIMBOLOS_TEXT.set(nome, entrada);
}

function ambos(pClasse: ClasseDeAtomo, pTexto: string, pNomes: string | string[], pAceitaUnicode = true): void {
  math(pClasse, pTexto, pNomes, pAceitaUnicode);
  text(pTexto, pNomes);
}

// ---------------------------------------------------------------- relações

const RELACOES: [string, string | string[]][] = [
  ['=', '='], ['<', '<'], ['>', '>'], [':', ':'],
  ['≡', '\\equiv'], ['≺', '\\prec'], ['≻', '\\succ'], ['∼', '\\sim'], ['⊥', '\\perp'], ['⪯', '\\preceq'], ['⪰', '\\succeq'],
  ['≃', '\\simeq'], ['∣', '\\mid'], ['≪', '\\ll'], ['≫', '\\gg'], ['≍', '\\asymp'], ['∥', '\\parallel'], ['⋈', '\\bowtie'],
  ['⌣', '\\smile'], ['⊑', '\\sqsubseteq'], ['⊒', '\\sqsupseteq'], ['≐', '\\doteq'], ['⌢', '\\frown'], ['∋', ['\\ni', '\\owns']],
  ['∝', '\\propto'], ['⊢', '\\vdash'], ['⊣', '\\dashv'], ['∈', ['\\in', '\\isin']], ['∉', '\\notin'], ['∌', '\\notni'],
  ['⊂', '\\subset'], ['⊃', '\\supset'], ['⊆', ['\\subseteq', '\\sube']], ['⊇', ['\\supseteq', '\\supe']], ['⊈', '\\nsubseteq'], ['⊉', '\\nsupseteq'],
  ['⊊', ['\\subsetneq', '\\varsubsetneq']], ['⊋', ['\\supsetneq', '\\varsupsetneq']], ['⊏', '\\sqsubset'], ['⊐', '\\sqsupset'],
  ['≤', ['\\leq', '\\le']], ['≥', ['\\geq', '\\ge']], ['≠', ['\\neq', '\\ne']], ['≮', '\\nless'], ['≯', '\\ngtr'],
  ['≰', ['\\nleq', '\\nleqslant']], ['≱', ['\\ngeq', '\\ngeqslant']], ['⊨', ['\\models', '\\vDash']], ['⊩', '\\Vdash'], ['⊪', '\\Vvdash'],
  ['⊬', '\\nvdash'], ['⊭', '\\nvDash'], ['⊮', '\\nVdash'], ['⊯', '\\nVDash'], ['≈', ['\\approx', '\\thickapprox']], ['≅', '\\cong'],
  ['≊', '\\approxeq'], ['≏', '\\bumpeq'], ['≎', '\\Bumpeq'], ['≑', ['\\doteqdot', '\\Doteq']], ['≒', '\\fallingdotseq'],
  ['≓', '\\risingdotseq'], ['≖', '\\eqcirc'], ['≗', '\\circeq'], ['≜', '\\triangleq'], ['≦', '\\leqq'], ['≧', '\\geqq'],
  ['≨', ['\\lneqq', '\\lvertneqq']], ['≩', ['\\gneqq', '\\gvertneqq']], ['⩽', '\\leqslant'], ['⩾', '\\geqslant'], ['⪅', '\\lessapprox'],
  ['⪆', '\\gtrapprox'], ['⪇', '\\lneq'], ['⪈', '\\gneq'], ['⪉', '\\lnapprox'], ['⪊', '\\gnapprox'], ['⪕', '\\eqslantless'],
  ['⪖', '\\eqslantgtr'], ['≶', '\\lessgtr'], ['≷', '\\gtrless'], ['⋚', '\\lesseqgtr'], ['⋛', '\\gtreqless'], ['⪋', '\\lesseqqgtr'],
  ['⪌', '\\gtreqqless'], ['≲', '\\lesssim'], ['≳', '\\gtrsim'], ['⋦', '\\lnsim'], ['⋧', '\\gnsim'], ['≾', '\\precsim'],
  ['≿', '\\succsim'], ['⋨', '\\precnsim'], ['⋩', '\\succnsim'], ['⪷', '\\precapprox'], ['⪸', '\\succapprox'],
  ['⪹', '\\precnapprox'], ['⪺', '\\succnapprox'], ['⋖', '\\lessdot'], ['⋗', '\\gtrdot'], ['⋘', ['\\lll', '\\llless']],
  ['⋙', ['\\ggg', '\\gggtr']], ['⊴', ['\\trianglelefteq', '\\unlhd']], ['⊵', ['\\trianglerighteq', '\\unrhd']],
  ['◁', '\\vartriangleleft'], ['▷', '\\vartriangleright'], ['⋪', '\\ntriangleleft'], ['⋫', '\\ntriangleright'],
  ['⋬', '\\ntrianglelefteq'], ['⋭', '\\ntrianglerighteq'], ['∽', '\\backsim'], ['⋍', '\\backsimeq'], ['≬', '\\between'],
  ['⋔', '\\pitchfork'], ['∴', '\\therefore'], ['∵', '\\because'], ['⫅', '\\subseteqq'], ['⫆', '\\supseteqq'],
  ['⫋', ['\\subsetneqq', '\\varsubsetneqq']], ['⫌', ['\\supsetneqq', '\\varsupsetneqq']], ['⊀', '\\nprec'], ['⊁', '\\nsucc'],
  ['⋠', ['\\npreceq', '\\precneqq']], ['⋡', ['\\nsucceq', '\\succneqq']], ['≁', '\\nsim'], ['≆', '\\ncong'], ['∤', ['\\nmid', '\\nshortmid']],
  ['∦', ['\\nparallel', '\\nshortparallel']], ['⊸', '\\multimap'], ['∝', '\\varpropto'], ['⊶', '\\origof'], ['⊷', '\\imageof'],
  ['⫫', '\\Perp'], ['⫪', '\\Top'], ['≂', '\\eqsim'], ['⋕', '\\equivHash'], ['⫝', '\\forks'],
  ['∣', ['\\shortmid']], ['∥', ['\\shortparallel']], ['⊨', '\\vDash'],
  // Dois-pontos compostos: o Unicode tem os caracteres; sai o caractere, não a montagem com kerns.
  ['≔', '\\coloneqq'], ['∷', '\\dblcolon'], ['≕', '\\eqqcolon'],
  // Setas são relações.
  ['←', ['\\leftarrow', '\\gets']], ['→', ['\\rightarrow', '\\to']], ['↔', '\\leftrightarrow'], ['⇐', '\\Leftarrow'],
  ['⇒', '\\Rightarrow'], ['⇔', '\\Leftrightarrow'], ['↦', '\\mapsto'], ['⟼', '\\longmapsto'], ['⟵', '\\longleftarrow'],
  ['⟶', '\\longrightarrow'], ['⟷', '\\longleftrightarrow'], ['⟸', '\\Longleftarrow'], ['⟹', '\\Longrightarrow'],
  ['⟺', '\\Longleftrightarrow'], ['↩', '\\hookleftarrow'], ['↪', '\\hookrightarrow'], ['↑', '\\uparrow'], ['↓', '\\downarrow'],
  ['↕', '\\updownarrow'], ['⇑', '\\Uparrow'], ['⇓', '\\Downarrow'], ['⇕', '\\Updownarrow'], ['↗', '\\nearrow'], ['↘', '\\searrow'],
  ['↙', '\\swarrow'], ['↖', '\\nwarrow'], ['⇀', '\\rightharpoonup'], ['⇁', '\\rightharpoondown'], ['↼', '\\leftharpoonup'],
  ['↽', '\\leftharpoondown'], ['⇌', '\\rightleftharpoons'], ['⇋', '\\leftrightharpoons'], ['⇇', '\\leftleftarrows'],
  ['⇉', '\\rightrightarrows'], ['⇈', '\\upuparrows'], ['⇊', '\\downdownarrows'], ['⇆', '\\leftrightarrows'], ['⇄', '\\rightleftarrows'],
  ['↞', '\\twoheadleftarrow'], ['↠', '\\twoheadrightarrow'], ['↢', '\\leftarrowtail'], ['↣', '\\rightarrowtail'],
  ['↫', '\\looparrowleft'], ['↬', '\\looparrowright'], ['↰', '\\Lsh'], ['↱', '\\Rsh'], ['↶', '\\curvearrowleft'],
  ['↷', '\\curvearrowright'], ['↺', '\\circlearrowleft'], ['↻', '\\circlearrowright'], ['↿', '\\upharpoonleft'],
  ['↾', ['\\upharpoonright', '\\restriction']], ['⇃', '\\downharpoonleft'], ['⇂', '\\downharpoonright'], ['⇚', '\\Lleftarrow'],
  ['⇛', '\\Rrightarrow'], ['⇝', ['\\rightsquigarrow', '\\leadsto']], ['↭', '\\leftrightsquigarrow'], ['⇢', '\\dashrightarrow'],
  ['⇠', '\\dashleftarrow'], ['↚', '\\nleftarrow'], ['↛', '\\nrightarrow'], ['↮', '\\nleftrightarrow'], ['⇍', '\\nLeftarrow'],
  ['⇏', '\\nRightarrow'], ['⇎', '\\nLeftrightarrow'], ['⊸', '\\multimap'],
];
for (const [c, n] of RELACOES)
  math('rel', c, n);

// ---------------------------------------------------------------- binários

const BINARIOS: [string, string | string[]][] = [
  ['+', '+'], ['−', '-'], ['∗', ['*', '\\ast']], ['⋆', '\\star'], ['∘', '\\circ'], ['∙', '\\bullet'], ['⋅', '\\cdot'],
  ['∩', '\\cap'], ['∪', '\\cup'], ['⊎', '\\uplus'], ['⊓', '\\sqcap'], ['⊔', '\\sqcup'], ['∨', ['\\vee', '\\lor']],
  ['∧', ['\\wedge', '\\land']], ['∖', '\\setminus'], ['≀', '\\wr'], ['⋄', '\\diamond'], ['△', '\\bigtriangleup'],
  ['▽', '\\bigtriangledown'], ['◃', '\\triangleleft'], ['▹', '\\triangleright'], ['⊲', '\\lhd'], ['⊳', '\\rhd'], ['⊕', '\\oplus'], ['⊖', '\\ominus'],
  ['⊗', '\\otimes'], ['⊘', '\\oslash'], ['⊙', '\\odot'], ['◯', '\\bigcirc'], ['†', '\\dagger'], ['‡', '\\ddagger'],
  ['⨿', '\\amalg'], ['±', ['\\pm', '\\plusmn']], ['∓', '\\mp'], ['×', '\\times'], ['÷', '\\div'], ['⋉', '\\ltimes'], ['⋊', '\\rtimes'],
  ['⋋', '\\leftthreetimes'], ['⋌', '\\rightthreetimes'], ['⋏', '\\curlywedge'], ['⋎', '\\curlyvee'], ['⊝', '\\circleddash'],
  ['⊞', '\\boxplus'], ['⊟', '\\boxminus'], ['⊠', '\\boxtimes'], ['⊡', '\\boxdot'], ['⊛', '\\circledast'], ['⊚', '\\circledcirc'],
  ['∔', '\\dotplus'], ['⋇', '\\divideontimes'], ['⋒', ['\\Cap', '\\doublecap']], ['⋓', ['\\Cup', '\\doublecup']],
  ['⊼', '\\barwedge'], ['⊻', '\\veebar'], ['⌆', '\\doublebarwedge'], ['⊺', '\\intercal'], ['∖', '\\smallsetminus'],
  ['⋅', '\\centerdot'], ['⊺', '\\intercal'], ['&', '\\And'],
];
for (const [c, n] of BINARIOS)
  math('bin', c, n);

// ---------------------------------------------------------------- abre/fecha

const ABRE: [string, string | string[]][] = [
  ['(', '('], ['[', ['[', '\\lbrack']], ['{', ['\\{', '\\lbrace']], ['⟨', ['\\langle', '\\lang']], ['⟨', '\\langle'],
  ['⌈', '\\lceil'], ['⌊', '\\lfloor'], ['⟮', '\\lgroup'], ['⟦', '\\llbracket'], ['⌜', '\\ulcorner'], ['⌞', '\\llcorner'],
  ['⎰', '\\lmoustache'], ['⟪', '\\llangle'],
];
for (const [c, n] of ABRE)
  math('open', c, n);
const FECHA: [string, string | string[]][] = [
  [')', ')'], [']', [']', '\\rbrack']], ['}', ['\\}', '\\rbrace']], ['⟩', ['\\rangle', '\\rang']], ['⌉', '\\rceil'], ['⌋', '\\rfloor'],
  ['⟯', '\\rgroup'], ['⟧', '\\rrbracket'], ['⌝', '\\urcorner'], ['⌟', '\\lrcorner'], ['⎱', '\\rmoustache'], ['⟫', '\\rrangle'],
  ['?', '?'], ['!', '!'],
];
for (const [c, n] of FECHA)
  math('close', c, n);
// Delimitadores ambíguos (abrem e fecham) ficam como textord; `\left`/`\right` os esticam.
math('textord', '|', ['|', '\\vert'], true);
math('open', '|', '\\lvert', false);
math('close', '|', '\\rvert', false);
math('textord', '‖', ['\\Vert', '\\|'], true);
math('open', '‖', '\\lVert', false);
math('close', '‖', '\\rVert', false);
math('textord', '/', '/');
math('textord', '\\', '\\backslash');

// ---------------------------------------------------------------- pontuação

math('punct', ',', ',');
math('punct', ';', ';');
math('punct', ':', '\\colon', false);
math('punct', '.', '\\ldotp', false);
math('punct', '⋅', '\\cdotp', false);

// ---------------------------------------------------------------- operadores grandes

const OPERADORES: [string, string | string[]][] = [
  ['∑', ['\\sum', '\\Sigma']], ['∏', '\\prod'], ['∐', '\\coprod'], ['∫', ['\\int', '\\intop']], ['∬', '\\iint'], ['∭', '\\iiint'],
  ['⨌', '\\iiiint'], ['∮', '\\oint'], ['∯', '\\oiint'], ['∰', '\\oiiint'], ['⋀', '\\bigwedge'], ['⋁', '\\bigvee'],
  ['⋂', '\\bigcap'], ['⋃', '\\bigcup'], ['⨆', '\\bigsqcup'], ['⨄', '\\biguplus'], ['⨁', '\\bigoplus'], ['⨂', '\\bigotimes'],
  ['⨀', '\\bigodot'], ['∫', '\\smallint'],
];
for (const [c, n] of OPERADORES) {
  // `\Sigma` é letra maiúscula, não operador; só o ∑ como `\sum` é operador.
  const nomes = (Array.isArray(n) ? n : [n]).filter((pN) => pN !== '\\Sigma');
  math('op', c, nomes);
}

// ---------------------------------------------------------------- gregas

const GREGAS_MINUSCULAS: [string, string][] = [
  ['α', '\\alpha'], ['β', '\\beta'], ['γ', '\\gamma'], ['δ', '\\delta'], ['ϵ', '\\epsilon'], ['ζ', '\\zeta'], ['η', '\\eta'],
  ['θ', '\\theta'], ['ι', '\\iota'], ['κ', '\\kappa'], ['λ', '\\lambda'], ['μ', '\\mu'], ['ν', '\\nu'], ['ξ', '\\xi'],
  ['ο', '\\omicron'], ['π', '\\pi'], ['ρ', '\\rho'], ['σ', '\\sigma'], ['τ', '\\tau'], ['υ', '\\upsilon'], ['ϕ', '\\phi'],
  ['χ', '\\chi'], ['ψ', '\\psi'], ['ω', '\\omega'], ['ε', '\\varepsilon'], ['ϑ', '\\vartheta'], ['ϖ', '\\varpi'],
  ['ϱ', '\\varrho'], ['ς', '\\varsigma'], ['φ', '\\varphi'], ['ϰ', '\\varkappa'], ['ϝ', '\\digamma'],
];
for (const [c, n] of GREGAS_MINUSCULAS)
  math('mathord', c, n);
const GREGAS_MAIUSCULAS: [string, string][] = [
  ['Γ', '\\Gamma'], ['Δ', '\\Delta'], ['Θ', '\\Theta'], ['Λ', '\\Lambda'], ['Ξ', '\\Xi'], ['Π', '\\Pi'], ['Σ', '\\Sigma'],
  ['Υ', '\\Upsilon'], ['Φ', '\\Phi'], ['Ψ', '\\Psi'], ['Ω', '\\Omega'],
  ['Α', '\\Alpha'], ['Β', '\\Beta'], ['Ε', '\\Epsilon'], ['Ζ', '\\Zeta'], ['Η', '\\Eta'], ['Ι', '\\Iota'], ['Κ', '\\Kappa'],
  ['Μ', '\\Mu'], ['Ν', '\\Nu'], ['Ο', '\\Omicron'], ['Ρ', '\\Rho'], ['Τ', '\\Tau'], ['Χ', '\\Chi'],
];
for (const [c, n] of GREGAS_MAIUSCULAS)
  math('textord', c, n);

// ---------------------------------------------------------------- ordinários

const ORDINARIOS: [string, string | string[]][] = [
  ['∞', ['\\infty', '\\infin']], ['∅', ['\\emptyset', '\\varnothing', '\\empty']], ['∇', '\\nabla'], ['∂', '\\partial'],
  ['ℵ', ['\\aleph', '\\alef', '\\alefsym']], ['ℶ', '\\beth'], ['ℷ', '\\gimel'], ['ℸ', '\\daleth'], ['ℏ', ['\\hbar', '\\hslash']],
  ['ℓ', '\\ell'], ['℘', ['\\wp', '\\weierp']], ['ℜ', ['\\Re', '\\real']], ['ℑ', ['\\Im', '\\image']], ['∀', '\\forall'],
  ['∃', ['\\exists', '\\exist']], ['∄', '\\nexists'], ['¬', ['\\neg', '\\lnot']], ['♭', '\\flat'], ['♮', '\\natural'], ['♯', '\\sharp'],
  ['♣', ['\\clubsuit', '\\clubs']], ['♢', ['\\diamondsuit', '\\diamonds']], ['♡', ['\\heartsuit', '\\hearts']], ['♠', ['\\spadesuit', '\\spades']],
  ['⊤', '\\top'], ['⊥', '\\bot'], ['√', '\\surd'], ['′', '\\prime'], ['‵', '\\backprime'], ['∠', '\\angle'],
  ['∡', '\\measuredangle'], ['∢', '\\sphericalangle'], ['△', ['\\triangle', '\\vartriangle']], ['▽', '\\triangledown'],
  ['◊', ['\\lozenge', '\\Diamond']], ['⧫', '\\blacklozenge'], ['■', '\\blacksquare'], ['□', ['\\square', '\\Box']], ['★', '\\bigstar'],
  ['▲', '\\blacktriangle'], ['▼', '\\blacktriangledown'], ['◀', '\\blacktriangleleft'], ['▶', '\\blacktriangleright'],
  ['∁', '\\complement'], ['ð', '\\eth'], ['Ⅎ', '\\Finv'], ['⅁', '\\Game'], ['ı', '\\imath'], ['ȷ', '\\jmath'], ['℧', '\\mho'],
  ['✓', '\\checkmark'], ['✠', '\\maltese'], ['⋯', '\\cdots'], ['⋮', '\\vdots'], ['⋱', '\\ddots'], ['…', ['\\ldots', '\\mathellipsis']],
  ['⋯', '\\dotsb'], ['…', ['\\dotsc', '\\dotso']], ['⋯', '\\dotsm'], ['∫', '\\dotsi'],
  ['╱', '\\diagup'], ['╲', '\\diagdown'], ['°', '\\degree'], ['#', '\\#'], ['%', '\\%'], ['&', '\\&'], ['_', '\\_'],
  ['$', ['\\$', '\\textdollar']], ['£', ['\\pounds', '\\mathsterling']], ['¥', '\\yen'], ['€', '\\euro'],
  ['¶', '\\P'], ['§', '\\S'], ['©', '\\copyright'], ['®', '\\circledR'], ['Ⓢ', '\\circledS'], ['†', '\\dag'], ['‡', '\\ddag'],
  ['@', '@'], ['"', '"'], ['\'', '\''], ['`', '`'], ['^', '\\textasciicircum'], ['~', '\\textasciitilde'],
  ['ℏ', '\\hslash'], ['⅋', '\\parr'], ['⊺', '\\intercal'], ['⌀', '\\diameter'],
  ['ℂ', '\\Complex'], ['ℕ', '\\N'], ['ℝ', '\\R'], ['ℤ', '\\Z'],
  ['ℏ', '\\hbar'], ['∟', '\\rightangle'], ['‘', '\\lq'], ['’', '\\rq'], ['\\', '\\textbackslash'],
];
for (const [c, n] of ORDINARIOS)
  math('textord', c, n);
// `\N`, `\R`, `\Z`, `\Complex` são macros no KaTeX para `\mathbb{N}`…; aqui saem direto como o caractere duplo.

// ---------------------------------------------------------------- texto

const TEXTO: [string, string | string[]][] = [
  ['#', '\\#'], ['%', '\\%'], ['&', '\\&'], ['_', '\\_'], ['$', ['\\$', '\\textdollar']], ['{', ['\\{', '\\textbraceleft']],
  ['}', ['\\}', '\\textbraceright']], ['\\', '\\textbackslash'], ['~', '\\textasciitilde'], ['^', '\\textasciicircum'],
  ['|', '\\textbar'], ['<', '\\textless'], ['>', '\\textgreater'], ['–', '\\textendash'], ['—', '\\textemdash'],
  ['“', '\\textquotedblleft'], ['”', '\\textquotedblright'], ['‘', ['\\textquoteleft', '\\lq']], ['’', ['\\textquoteright', '\\rq']],
  ['†', ['\\textdagger', '\\dag']], ['‡', ['\\textdaggerdbl', '\\ddag']], ['…', ['\\textellipsis', '\\ldots', '\\dots']],
  ['®', ['\\textregistered', '\\circledR']], ['©', ['\\textcopyright', '\\copyright']], ['£', ['\\textsterling', '\\pounds']],
  ['¥', ['\\textyen', '\\yen']], ['€', ['\\texteuro', '\\euro']], ['°', ['\\textdegree', '\\degree']], ['¶', '\\P'], ['§', '\\S'],
  ['_', '\\textunderscore'], ['✓', '\\checkmark'], ['✠', '\\maltese'], ['ı', '\\i'], ['ȷ', '\\j'], ['ß', '\\ss'],
  ['æ', '\\ae'], ['œ', '\\oe'], ['ø', '\\o'], ['Æ', '\\AE'], ['Œ', '\\OE'], ['Ø', '\\O'], ['å', '\\aa'], ['Å', '\\AA'],
  ['¡', '\\textexclamdown'], ['¿', '\\textquestiondown'], ['«', '\\guillemotleft'], ['»', '\\guillemotright'],
  ['‹', '\\guilsinglleft'], ['›', '\\guilsinglright'], ['„', '\\quotedblbase'], ['‚', '\\quotesinglbase'],
  ['\u00a0', ['~', '\\nobreakspace', '\\space', '\\ ']],
];
for (const [c, n] of TEXTO)
  text(c, n);
// Espaço explícito também vale em matemática (caractere de texto).
math('textord', '\u00a0', ['\\nobreakspace', '\\space'], false);

// ---------------------------------------------------------------- letras e dígitos

for (let i = 0; i < 26; i++) {
  const maiuscula = String.fromCharCode(65 + i);
  const minuscula = String.fromCharCode(97 + i);
  ambos('mathord', maiuscula, maiuscula);
  ambos('mathord', minuscula, minuscula);
}
for (let i = 0; i < 10; i++)
  ambos('textord', String(i), String(i));
// Letras com acento digitadas direto, e as latinas estendidas: ordinárias.
for (const c of 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿĀāĂăĄąĆćČčĎďĐđĒēĖėĘęĚěĞğĢģĪīĮįİıĶķĹĺĻļĽľŁłŃńŅņŇňŌōŐőŒœŔŕŘřŚśŞşŠšŢţŤťŪūŮůŰűŲųŸŹźŻżŽž')
  ambos('mathord', c, c);
// Cirílico e grego digitados direto.
for (let cp = 0x410; cp <= 0x44f; cp++)
  ambos('mathord', String.fromCodePoint(cp), String.fromCodePoint(cp));

export function simboloMath(pNome: string): EntradaDeSimbolo | undefined {
  return SIMBOLOS_MATH.get(pNome);
}

export function simboloText(pNome: string): EntradaDeSimbolo | undefined {
  return SIMBOLOS_TEXT.get(pNome);
}

/** Caractere digitado direto que o modo matemático aceita (`α`, `≤`, `→`, `∞`…). */
export function simboloUnicode(pCaractere: string): EntradaDeSimbolo | undefined {
  return UNICODE_MATH.get(pCaractere);
}
