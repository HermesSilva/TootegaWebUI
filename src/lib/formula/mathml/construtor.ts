/**
 * CONSTRUTOR de MathML Core a partir da árvore da fórmula. O navegador faz o layout (Chromium ≥ 109, Firefox,
 * Safari); nós só precisamos escolher os elementos certos e cobrir o que o Core não tem: `mathvariant` só aceita
 * `normal` (letras viram alfanuméricos matemáticos do Unicode), não há `menclose` (cercaduras por CSS em `mrow`),
 * não há `mlabeledtr` (etiquetas numa coluna extra), `mpadded` não aceita percentuais nem `lspace` negativo
 * (sobreposições por `transform` em CSS). Referência estudada: `buildMathML.ts` do KaTeX.
 */

import type { Arranjo, ClasseDeAtomo, EstiloMatematico, FonteMatematica, Medida, No, Simbolo } from '../ast';
import { arredondar, cssDaMedida, emEm } from '../tex/medidas';
import { comFonte } from '../tex/unicode';
import { comClasse, el, textoDe, type ElementoMathML } from './arvore';

export interface OpcoesDoConstrutor {
  display: boolean;
  /** A fonte TeX/AsciiMath, para o `annotation`. */
  fonte?: string;
  /** `application/x-tex` ou `text/x-asciimath`. */
  codificacao?: string;
}

interface Contexto {
  estilo: EstiloMatematico;
  /** Multiplicador de tamanho corrente (1 = normal), para `\large` absoluto. */
  tamanho: number;
  /** Dentro de `\text`: letras retas. */
  emTexto: boolean;
}

const MULTIPLICADORES = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.44, 1.728, 2.074, 2.488];

/** Espaços do TeX por classe forçada (`\mathrel{…}` etc.), em em. */
const ESPACO_DA_CLASSE: Partial<Record<ClasseDeAtomo, [number, number]>> = {
  bin: [0.2222, 0.2222],
  rel: [0.2778, 0.2778],
  punct: [0, 0.1667],
  inner: [0, 0],
  mathord: [0, 0],
  textord: [0, 0],
  open: [0, 0],
  close: [0, 0],
};

const TAMANHO_DO_DELIMITADOR = ['1.2em', '1.8em', '2.4em', '3em'];

/** Acentos combinantes → forma espaçada que fica bem num `mo`. */
const ACENTO_ESPACADO: Record<string, string> = {
  '\u0301': '\u02ca', '\u0300': '\u02cb', '\u0308': '¨', '\u0303': '~', '\u0304': '¯', '\u030c': 'ˇ', '\u0302': '^', '\u0307': '˙', '\u030b': '˝',
};

const OPERADOR_LIKE = /^[\p{P}\p{S}]+$/u;

export class Construtor {
  private readonly opcoes: OpcoesDoConstrutor;
  private numeroDeEquacao = 0;

  constructor(pOpcoes: OpcoesDoConstrutor) {
    this.opcoes = pOpcoes;
  }

  /** O elemento `<math>` completo. */
  construir(pNos: No[]): ElementoMathML {
    const contexto: Contexto = { estilo: this.opcoes.display ? 'display' : 'text', tamanho: 1, emTexto: false };
    const linhas = dividirEmLinhas(pNos);
    let corpo: ElementoMathML;
    if (linhas.length > 1) {
      // `\\` no topo: uma linha por `mtr`, centradas (o Core não tem quebra de linha).
      const mtr = linhas.map((pLinha) => el('mtr', {}, [el('mtd', { class: 'adc-f-col-c' }, [this.mrow(this.lista(pLinha, contexto))])]));
      corpo = el('mtable', { class: 'adc-f-linhas' }, mtr);
    } else
      corpo = this.mrow(this.lista(pNos, contexto));
    const filhos: (ElementoMathML | string)[] = [corpo];
    if (this.opcoes.fonte !== undefined) {
      const anotacao = el('annotation', { encoding: this.opcoes.codificacao ?? 'application/x-tex' }, [this.opcoes.fonte]);
      filhos.length = 0;
      filhos.push(el('semantics', {}, [corpo, anotacao]));
    }
    const atributos: Record<string, string> = { xmlns: 'http://www.w3.org/1998/Math/MathML', class: 'adc-formula' };
    if (this.opcoes.display)
      atributos.display = 'block';
    return el('math', atributos, filhos);
  }

  // ---------------------------------------------------------------- listas

  /** Constrói uma lista de nós e aplica as fusões (dígitos adjacentes, textos adjacentes). */
  private lista(pNos: No[], pContexto: Contexto): ElementoMathML[] {
    const saida: ElementoMathML[] = [];
    for (const no of pNos) {
      const construido = this.no(no, pContexto);
      if (!construido)
        continue;
      if (construido.nome === 'mrow' && construido.filhos.length === 0 && Object.keys(construido.atributos).length === 0 && no.tipo === 'grupo' && pNos.length > 1)
        continue;
      // Função nomeada (`\sin` + U+2061) entra plana na lista, como no TeX; o `mrow` era só transporte.
      if (construido.nome === 'mrow' && construido.atributos.class === 'adc-f-funcao') {
        saida.push(...(construido.filhos as ElementoMathML[]));
        continue;
      }
      saida.push(construido);
    }
    return fundir(saida);
  }

  private mrow(pFilhos: ElementoMathML[]): ElementoMathML {
    if (pFilhos.length === 1)
      return pFilhos[0];
    return el('mrow', {}, pFilhos);
  }

  private grupoOuNo(pNo: No, pContexto: Contexto): ElementoMathML {
    if (pNo.tipo === 'grupo')
      return this.mrow(this.lista(pNo.filhos, pContexto));
    const construido = this.no(pNo, pContexto) ?? el('mrow');
    if (construido.nome === 'mrow' && construido.atributos.class === 'adc-f-funcao')
      return el('mrow', {}, construido.filhos);
    return construido;
  }

  // ---------------------------------------------------------------- nós

  private no(pNo: No, pContexto: Contexto): ElementoMathML | null {
    switch (pNo.tipo) {
      case 'simbolo':
        return this.simbolo(pNo, pContexto);
      case 'grupo':
        return this.mrow(this.lista(pNo.filhos, pContexto));
      case 'supsub':
        return this.supsub(pNo, pContexto);
      case 'fracao': {
        const estilo = pNo.estilo ?? pContexto.estilo;
        const interno: Contexto = { ...pContexto, estilo: estilo === 'display' ? 'text' : estilo === 'text' ? 'script' : 'scriptscript' };
        const atributos: Record<string, string> = {};
        if (pNo.barra === false)
          atributos.linethickness = '0';
        else if (typeof pNo.barra === 'object')
          atributos.linethickness = cssDaMedida(pNo.barra);
        let saida = el('mfrac', atributos, [this.grupoOuNo(pNo.numerador, interno), this.grupoOuNo(pNo.denominador, interno)]);
        if (pNo.delimitadorEsquerdo !== undefined || pNo.delimitadorDireito !== undefined)
          saida = el('mrow', {}, [moEsticavel(pNo.delimitadorEsquerdo ?? '', 'open'), saida, moEsticavel(pNo.delimitadorDireito ?? '', 'close')].filter((pE) => pE.filhos.length > 0 || pE.nome !== 'mo'));
        if (pNo.estilo)
          saida = mstyleDoEstilo(pNo.estilo, [saida]);
        return saida;
      }
      case 'raiz': {
        const radicando = this.grupoOuNo(pNo.radicando, pContexto);
        if (pNo.indice)
          return el('mroot', {}, [radicando, this.grupoOuNo(pNo.indice, { ...pContexto, estilo: 'scriptscript' })]);
        return el('msqrt', {}, [radicando]);
      }
      case 'delimitado': {
        const filhos: ElementoMathML[] = [];
        if (pNo.esquerda !== '')
          filhos.push(moEsticavel(pNo.esquerda, 'open'));
        filhos.push(...this.lista(pNo.corpo, pContexto));
        if (pNo.direita !== '')
          filhos.push(moEsticavel(pNo.direita, 'close'));
        return el('mrow', { class: 'adc-f-delimitado' }, filhos);
      }
      case 'meio':
        return pNo.delimitador === '' ? el('mrow') : moEsticavel(pNo.delimitador, 'rel');
      case 'delimitadorComTamanho': {
        const tamanho = TAMANHO_DO_DELIMITADOR[pNo.tamanho - 1];
        const atributos: Record<string, string> = { stretchy: 'true', symmetric: 'true', minsize: tamanho, maxsize: tamanho };
        if (pNo.classe === 'mathord') {
          atributos.lspace = '0';
          atributos.rspace = '0';
        } else if (pNo.classe === 'rel') {
          atributos.lspace = '0.2778em';
          atributos.rspace = '0.2778em';
        } else
          atributos.form = pNo.classe === 'open' ? 'prefix' : 'postfix';
        return el('mo', atributos, [pNo.delimitador]);
      }
      case 'acento':
        return this.acento(pNo, pContexto);
      case 'operador':
        return this.operador(pNo, pContexto);
      case 'texto': {
        // Símbolos e acentos ficam texto; um grupo vindo de `$…$` dentro do texto volta à matemática.
        const interno: Contexto = { ...pContexto, emTexto: true };
        const construidos: ElementoMathML[] = [];
        for (const filho of pNo.filhos) {
          const contexto = filho.tipo === 'grupo' || filho.tipo === 'supsub' || filho.tipo === 'fracao' ? { ...pContexto, emTexto: false } : interno;
          const construido = this.no(filho, contexto);
          if (construido)
            construidos.push(construido);
        }
        const filhos = fundir(construidos);
        let saida = this.mrow(filhos.length === 0 ? [el('mtext', {}, ['\u00a0'])] : filhos);
        if (pNo.fonte && pNo.fonte !== 'normal')
          saida = comClasse(saida.nome === 'mrow' || saida.nome === 'mtext' ? saida : el('mrow', {}, [saida]), `adc-f-texto-${pNo.fonte}`);
        else if (pNo.fonte === 'normal' && saida.nome === 'mtext')
          saida = comClasse(saida, 'adc-f-texto-normal');
        return saida;
      }
      case 'estilo':
        return mstyleDoEstilo(pNo.estilo, this.lista(pNo.filhos, { ...pContexto, estilo: pNo.estilo }));
      case 'tamanho': {
        const novo = MULTIPLICADORES[Math.min(Math.max(pNo.tamanho, 1), 11) - 1];
        const filhos = this.lista(pNo.filhos, { ...pContexto, tamanho: novo });
        return el('mstyle', { mathsize: `${arredondar(novo / pContexto.tamanho)}em` }, filhos);
      }
      case 'cor':
        return el('mstyle', { mathcolor: pNo.cor }, this.lista(pNo.filhos, pContexto));
      case 'espaco':
        if (pNo.texto)
          return el('mtext', {}, ['\u00a0']);
        return el('mspace', { width: cssDaMedida(pNo.largura) });
      case 'fantasma': {
        const fantasma = el('mphantom', {}, this.lista(pNo.corpo, pContexto));
        if (pNo.somente === 'horizontal')
          return el('mpadded', { height: '0', depth: '0' }, [fantasma]);
        if (pNo.somente === 'vertical')
          return el('mpadded', { width: '0' }, [fantasma]);
        return fantasma;
      }
      case 'esmagar': {
        const atributos: Record<string, string> = {};
        if (pNo.acima)
          atributos.height = '0';
        if (pNo.abaixo)
          atributos.depth = '0';
        return el('mpadded', atributos, this.lista(pNo.corpo, pContexto));
      }
      case 'sobreposicao': {
        const classe = pNo.alinhamento === 'esquerda' ? 'adc-f-llap' : pNo.alinhamento === 'centro' ? 'adc-f-clap' : 'adc-f-rlap';
        return el('mpadded', { width: '0', class: classe }, [this.mrow(this.lista(pNo.corpo, pContexto))]);
      }
      case 'elevar': {
        const deslocamento = emEm(pNo.deslocamento);
        const atributos: Record<string, string> = { voffset: `${arredondar(deslocamento)}em` };
        return el('mpadded', atributos, this.lista(pNo.corpo, pContexto));
      }
      case 'cercadura': {
        const atributos: Record<string, string> = { class: `adc-f-cerc adc-f-cerc-${pNo.especie}` };
        if (pNo.corDoFundo)
          atributos.mathbackground = pNo.corDoFundo;
        if (pNo.corDaBorda)
          atributos.style = `border-color:${pNo.corDaBorda}`;
        const corpo = this.lista(pNo.corpo, pNo.especie === 'boxed' ? { ...pContexto, estilo: 'text' } : pContexto);
        return el('mrow', atributos, pNo.especie === 'boxed' ? [mstyleDoEstilo('text', corpo)] : corpo);
      }
      case 'linha': {
        const corpo = this.mrow(this.lista(pNo.corpo, pContexto));
        const traco = el('mo', { stretchy: 'true' }, ['‾']);
        return pNo.posicao === 'acima' ? el('mover', { accent: 'true' }, [corpo, traco]) : el('munder', { accentunder: 'true' }, [corpo, traco]);
      }
      case 'chave': {
        const corpo = this.mrow(this.lista(pNo.corpo, pContexto));
        return pNo.acima ? el('mover', { accent: 'true' }, [corpo, el('mo', { stretchy: 'true' }, ['⏞'])]) : el('munder', { accentunder: 'true' }, [corpo, el('mo', { stretchy: 'true' }, ['⏟'])]);
      }
      case 'seta': {
        const seta = el('mo', { stretchy: 'true', lspace: '0.2778em', rspace: '0.2778em' }, [pNo.seta]);
        const scripts: Contexto = { ...pContexto, estilo: 'script' };
        const acima = el('mrow', { class: 'adc-f-rotulo-seta' }, this.lista(pNo.acima, scripts));
        if (pNo.abaixo) {
          const abaixo = el('mrow', { class: 'adc-f-rotulo-seta' }, this.lista(pNo.abaixo, scripts));
          return el('munderover', {}, [seta, abaixo, acima]);
        }
        return el('mover', {}, [seta, acima]);
      }
      case 'arranjo':
        return this.arranjo(pNo, pContexto);
      case 'etiqueta': {
        const corpo = this.mrow(this.lista(pNo.corpo, pContexto));
        const rotulo = this.rotulo(pNo.rotulo, pNo.crua, pContexto);
        return el('mtable', { class: 'adc-f-etiquetada' }, [el('mtr', {}, [el('mtd', { class: 'adc-f-col-c' }, [corpo]), el('mtd', { class: 'adc-f-etiqueta' }, [rotulo])])]);
      }
      case 'regra': {
        const atributos: Record<string, string> = { width: cssDaMedida(pNo.largura), height: cssDaMedida(pNo.altura), mathbackground: 'currentColor', class: 'adc-f-regra' };
        const regra = el('mspace', atributos);
        if (pNo.deslocamento)
          return el('mpadded', { voffset: cssDaMedida(pNo.deslocamento) }, [regra]);
        return regra;
      }
      case 'verbatim':
        return el('mtext', { class: 'adc-f-mono' }, [pNo.texto.replace(/ /g, '\u00a0')]);
      case 'erro':
        return el('merror', { class: 'adc-f-erro' }, [el('mtext', {}, [pNo.texto === '' ? '?' : pNo.texto])]);
      case 'classe': {
        const filhos = this.lista(pNo.corpo, pContexto);
        const [esq, dir] = ESPACO_DA_CLASSE[pNo.classe] ?? [0, 0];
        const saida: ElementoMathML[] = [];
        if (esq > 0)
          saida.push(el('mspace', { width: `${esq}em` }));
        saida.push(...filhos);
        if (dir > 0)
          saida.push(el('mspace', { width: `${dir}em` }));
        return el('mrow', { class: `adc-f-classe-${pNo.classe}` }, saida);
      }
      case 'escolha': {
        const escolhido = pContexto.estilo === 'display' ? pNo.display : pContexto.estilo === 'text' ? pNo.text : pContexto.estilo === 'script' ? pNo.script : pNo.scriptscript;
        return this.mrow(this.lista(escolhido, pContexto));
      }
      case 'quebra':
        return null;   // tratada em `construir` (linhas)
      case 'envoltorio': {
        const filhos = this.lista(pNo.corpo, pContexto);
        return el('mrow', { class: `adc-f-${pNo.especie}` }, filhos);
      }
      case 'externo': {
        if (pNo.especie === 'url' || pNo.especie === 'imagem')
          return el('mtext', { class: 'adc-f-mono' }, [pNo.alvo]);
        return el('mrow', { class: 'adc-f-externo' }, this.lista(pNo.corpo, pContexto));
      }
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- símbolo

  private simbolo(pNo: Simbolo, pContexto: Contexto): ElementoMathML {
    let texto = pNo.texto;
    if (pNo.negado)
      texto += '\u0338';
    if (pNo.modo === 'text' || pContexto.emTexto)
      return el('mtext', {}, [texto === ' ' ? '\u00a0' : texto]);
    const fonte: FonteMatematica | undefined = pNo.fonte;
    switch (pNo.classe) {
      case 'mathord': {
        if (OPERADOR_LIKE.test(texto) && !/\p{L}/u.test(texto))
          return el('mo', { lspace: '0', rspace: '0' }, [texto]);
        return mi(texto, fonte, true);
      }
      case 'textord': {
        if (/^[0-9]+$/.test(texto))
          return el('mn', {}, [fonte ? comFonte(texto, fonte) : texto]);
        if (OPERADOR_LIKE.test(texto) && !/\p{L}/u.test(texto) && !/^[∞∅∂∇ℵℶℷℸℏℓ℘ℜℑ¬∀∃∄♭♮♯♣♢♡♠⊤⊥√∠∡∢△▽◊⧫■□★▲▼◀▶∁ðℲ⅁ı℧✓✠°¶§©®Ⓢ†‡€£¥$%#&_@⋮╱╲⌀∟]$/u.test(texto))
          return el('mo', { lspace: '0', rspace: '0', stretchy: 'false' }, [texto]);
        return mi(texto, fonte, false);
      }
      case 'op':
        return el('mo', { largeop: 'true', movablelimits: 'false' }, [texto]);
      case 'open':
        return el('mo', { stretchy: 'false', form: 'prefix' }, [texto]);
      case 'close':
        return el('mo', { stretchy: 'false', form: 'postfix' }, [texto]);
      case 'bin':
      case 'rel':
      case 'punct':
      case 'inner':
      default:
        return el('mo', texto === '|' || texto === '‖' ? { stretchy: 'false' } : {}, [texto]);
    }
  }

  // ---------------------------------------------------------------- scripts

  private supsub(pNo: No & { tipo: 'supsub' }, pContexto: Contexto): ElementoMathML {
    const base = pNo.base ? this.grupoOuNo(pNo.base, pContexto) : el('mrow');
    const scripts: Contexto = { ...pContexto, estilo: pContexto.estilo === 'display' || pContexto.estilo === 'text' ? 'script' : 'scriptscript' };
    const sup = pNo.sup ? this.grupoOuNo(pNo.sup, scripts) : undefined;
    const sub = pNo.sub ? this.grupoOuNo(pNo.sub, scripts) : undefined;
    const emCima = this.limitesEmCima(pNo, pContexto);
    if (emCima) {
      // Chave/linha já é mover/munder: o rótulo entra por fora, do mesmo lado.
      if (sup && sub)
        return el('munderover', {}, [base, sub, sup]);
      if (sup)
        return el('mover', {}, [base, sup]);
      if (sub)
        return el('munder', {}, [base, sub]);
      return base;
    }
    if (sup && sub)
      return el('msubsup', {}, [base, sub, sup]);
    if (sup)
      return el('msup', {}, [base, sup]);
    if (sub)
      return el('msub', {}, [base, sub]);
    return base;
  }

  private limitesEmCima(pNo: No & { tipo: 'supsub' }, pContexto: Contexto): boolean {
    if (!pNo.base)
      return false;
    const base = desembrulharNo(pNo.base);
    if (base.tipo === 'chave')
      return true;
    if (pNo.limites !== undefined)
      return pNo.limites;
    if (base.tipo === 'operador')
      return base.limites && (pContexto.estilo === 'display' || Boolean(base.estrela));
    if (base.tipo === 'simbolo' && base.classe === 'op')
      return pContexto.estilo === 'display' && base.texto !== '∫' && base.texto !== '∬' && base.texto !== '∭' && base.texto !== '⨌' && base.texto !== '∮' && base.texto !== '∯' && base.texto !== '∰';
    return false;
  }

  // ---------------------------------------------------------------- acento

  private acento(pNo: No & { tipo: 'acento' }, pContexto: Contexto): ElementoMathML {
    if (pNo.emTexto) {
      const base = this.grupoOuNo(pNo.base, { ...pContexto, emTexto: true });
      const texto = textoDe(base);
      const composto = (texto.length > 0 ? texto[0] + pNo.acento + texto.slice(1) : pNo.acento).normalize('NFC');
      return el('mtext', {}, [composto]);
    }
    const base = this.grupoOuNo(pNo.base, pContexto);
    const caractere = ACENTO_ESPACADO[pNo.acento] ?? pNo.acento;
    const mo = el('mo', { stretchy: pNo.largo ? 'true' : 'false' }, [caractere]);
    if (pNo.embaixo)
      return el('munder', { accentunder: 'true' }, [base, mo]);
    return el('mover', { accent: 'true' }, [base, mo]);
  }

  // ---------------------------------------------------------------- operador

  private operador(pNo: No & { tipo: 'operador' }, pContexto: Contexto): ElementoMathML {
    if (pNo.simbolo !== undefined)
      return el('mo', { largeop: pNo.grande ? 'true' : 'false', movablelimits: 'false', lspace: '0.1667em', rspace: '0.1667em' }, [pNo.simbolo]);
    const nome = pNo.nome ?? [];
    const soTexto = nome.every((pN) => pN.tipo === 'simbolo' || (pN.tipo === 'espaco'));
    let elemento: ElementoMathML;
    if (soTexto) {
      const texto = nome.map((pN) => (pN.tipo === 'simbolo' ? pN.texto : pN.tipo === 'espaco' ? '\u2009' : '')).join('');
      elemento = el('mi', texto.length === 1 ? { mathvariant: 'normal' } : {}, [texto]);
    } else
      elemento = el('mrow', { class: 'adc-f-operador' }, this.lista(nome, { ...pContexto, emTexto: true }));
    // Função aplicada: U+2061 (invisível) dá o espaço fino certo antes do argumento. O `mrow` é transporte: `lista()` o abre.
    return el('mrow', { class: 'adc-f-funcao' }, [elemento, el('mo', {}, ['\u2061'])]);
  }

  // ---------------------------------------------------------------- arranjo

  private arranjo(pNo: Arranjo, pContexto: Contexto): ElementoMathML {
    const interno: Contexto = pNo.estilo ? { ...pContexto, estilo: pNo.estilo } : pNo.ambiente === 'array' || pNo.ambiente === 'matrix' || pNo.ambiente.endsWith('matrix') || pNo.ambiente.endsWith('matrix*') ? { ...pContexto, estilo: 'text' } : pContexto;
    const temEtiqueta = pNo.linhas.some((pL) => pL.etiqueta !== undefined && pL.etiqueta !== null);
    const linhas: ElementoMathML[] = [];
    pNo.linhas.forEach((pLinha, pIndice) => {
      const celulas: ElementoMathML[] = [];
      const ultima = pIndice === pNo.linhas.length - 1;
      pNo.colunas.forEach((pColuna, pJ) => {
        const conteudo = pLinha.celulas[pJ] ?? [];
        const classes = [`adc-f-col-${pColuna.alinhamento[0]}`];
        if (pColuna.colada)
          classes.push('adc-f-colada');
        if (pJ > 0 && pNo.ambiente.startsWith('align') && !pColuna.colada)
          classes.push('adc-f-par');
        if (pJ > 0 && (pNo.ambiente.endsWith('cases')))
          classes.push('adc-f-cases');
        if (pColuna.linhasAntes > 0)
          classes.push(pColuna.linhasAntes > 1 ? 'adc-f-borda-esq-dupla' : 'adc-f-borda-esq');
        if (pColuna.tracejadasAntes > 0)
          classes.push('adc-f-borda-esq-tracejada');
        if (pJ === pNo.colunas.length - 1) {
          if (pNo.linhasDepois > 0)
            classes.push(pNo.linhasDepois > 1 ? 'adc-f-borda-dir-dupla' : 'adc-f-borda-dir');
          if (pNo.tracejadasDepois > 0)
            classes.push('adc-f-borda-dir-tracejada');
        }
        if (pLinha.linhasAntes > 0)
          classes.push(pLinha.linhasAntes > 1 ? 'adc-f-borda-topo-dupla' : 'adc-f-borda-topo');
        if (pLinha.tracejadasAntes > 0)
          classes.push('adc-f-borda-topo-tracejada');
        if (ultima && pNo.linhasNoFim > 0)
          classes.push(pNo.linhasNoFim > 1 ? 'adc-f-borda-base-dupla' : 'adc-f-borda-base');
        if (ultima && pNo.tracejadasNoFim > 0)
          classes.push('adc-f-borda-base-tracejada');
        const atributos: Record<string, string> = { class: classes.join(' ') };
        if (pLinha.espacoDepois)
          atributos.style = `padding-bottom:${cssDaMedida(pLinha.espacoDepois)}`;
        celulas.push(el('mtd', atributos, [this.mrow(this.lista(conteudo, interno))]));
      });
      if (temEtiqueta) {
        const etiqueta = pLinha.etiqueta;
        const rotulo = etiqueta === undefined || etiqueta === null ? el('mrow') : this.rotulo(etiqueta, Boolean(pLinha.etiquetaCrua), pContexto);
        celulas.push(el('mtd', { class: 'adc-f-etiqueta' }, [rotulo]));
      }
      linhas.push(el('mtr', {}, celulas));
    });
    const classes = ['adc-f-arranjo', `adc-f-${pNo.ambiente.replace('*', '')}`];
    if (pNo.compacto)
      classes.push('adc-f-compacto');
    if (temEtiqueta)
      classes.push('adc-f-etiquetada');
    let saida: ElementoMathML = el('mtable', { class: classes.join(' ') }, linhas);
    if (pNo.estilo)
      saida = mstyleDoEstilo(pNo.estilo, [saida]);
    if (pNo.delimitadorEsquerdo || pNo.delimitadorDireito) {
      const filhos: ElementoMathML[] = [];
      if (pNo.delimitadorEsquerdo)
        filhos.push(moEsticavel(pNo.delimitadorEsquerdo, 'open'));
      filhos.push(saida);
      if (pNo.delimitadorDireito)
        filhos.push(moEsticavel(pNo.delimitadorDireito, 'close'));
      saida = el('mrow', {}, filhos);
    }
    return saida;
  }

  /** O rótulo de uma equação: `\tag{x}` como veio, ou `(n)` numerado. */
  private rotulo(pRotulo: No[], pCrua: boolean, pContexto: Contexto): ElementoMathML {
    if (pRotulo.length === 0) {
      this.numeroDeEquacao += 1;
      return el('mtext', {}, [`(${this.numeroDeEquacao})`]);
    }
    const corpo = this.lista(pRotulo, { ...pContexto, estilo: 'text' });
    if (pCrua)
      return this.mrow(corpo);
    return el('mrow', {}, [el('mo', { stretchy: 'false' }, ['(']), ...corpo, el('mo', { stretchy: 'false' }, [')'])]);
  }
}

// ---------------------------------------------------------------- auxiliares

function mi(pTexto: string, pFonte: FonteMatematica | undefined, pLetraItalica: boolean): ElementoMathML {
  if (pFonte && pFonte !== 'normal') {
    const convertido = comFonte(pTexto, pFonte);
    if (convertido !== pTexto)
      return el('mi', {}, [convertido]);
    // Sem variante Unicode (ex.: `\mathit{∞}`): fica como está, reto.
    return el('mi', { mathvariant: 'normal' }, [pTexto]);
  }
  const unico = [...pTexto].length === 1;
  if (pFonte === 'normal' || !pLetraItalica)
    return el('mi', unico ? { mathvariant: 'normal' } : {}, [pTexto]);
  // Letra única sem fonte: itálico automático do MathML. Multi-letra (ex.: `αβ` vindo direto) fica reto.
  return el('mi', {}, [pTexto]);
}

function moEsticavel(pTexto: string, pClasse: 'open' | 'close' | 'rel'): ElementoMathML {
  if (pTexto === '')
    return el('mo', {});
  const atributos: Record<string, string> = { stretchy: 'true', symmetric: 'true' };
  if (pClasse === 'open')
    atributos.form = 'prefix';
  else if (pClasse === 'close')
    atributos.form = 'postfix';
  else {
    atributos.lspace = '0.2778em';
    atributos.rspace = '0.2778em';
  }
  if (pClasse !== 'rel')
    atributos.fence = 'true';
  return el('mo', atributos, [pTexto]);
}

function mstyleDoEstilo(pEstilo: EstiloMatematico, pFilhos: ElementoMathML[]): ElementoMathML {
  const atributos: Record<string, string> = { displaystyle: pEstilo === 'display' ? 'true' : 'false', scriptlevel: pEstilo === 'script' ? '1' : pEstilo === 'scriptscript' ? '2' : '0' };
  return el('mstyle', atributos, pFilhos);
}

function desembrulharNo(pNo: No): No {
  return pNo.tipo === 'grupo' && pNo.filhos.length === 1 ? desembrulharNo(pNo.filhos[0]) : pNo;
}

/** `\\` no nível de cima divide a fórmula em linhas. */
function dividirEmLinhas(pNos: No[]): No[][] {
  const linhas: No[][] = [[]];
  for (const no of pNos) {
    if (no.tipo === 'quebra')
      linhas.push([]);
    else
      linhas[linhas.length - 1].push(no);
  }
  if (linhas.length > 1 && linhas[linhas.length - 1].length === 0)
    linhas.pop();
  return linhas;
}

/** Funde `mn` adjacentes (e `.`/`,` entre dígitos) e `mtext` adjacentes. */
function fundir(pElementos: ElementoMathML[]): ElementoMathML[] {
  const saida: ElementoMathML[] = [];
  for (const e of pElementos) {
    const anterior = saida[saida.length - 1];
    if (anterior && semAtributos(anterior) && semAtributos(e)) {
      if (anterior.nome === 'mn' && e.nome === 'mn') {
        anterior.filhos = [textoDe(anterior) + textoDe(e)];
        continue;
      }
      if (anterior.nome === 'mtext' && e.nome === 'mtext') {
        anterior.filhos = [textoDe(anterior) + textoDe(e)];
        continue;
      }
    }
    // `90^\circ`: o número antes de um script cuja base é um dígito entra na base (`<msup><mn>90</mn>…`), como o leitor vê.
    if (anterior && anterior.nome === 'mn' && semAtributos(anterior) && (e.nome === 'msup' || e.nome === 'msub' || e.nome === 'msubsup')) {
      const base = e.filhos[0];
      if (typeof base !== 'string' && base.nome === 'mn' && semAtributos(base)) {
        base.filhos = [textoDe(anterior) + textoDe(base)];
        saida.pop();
        saida.push(e);
        continue;
      }
    }
    // `3.14`: o ponto entre dígitos entra no número.
    const penultimo = saida[saida.length - 2];
    if (anterior && penultimo && e.nome === 'mn' && semAtributos(e) && penultimo.nome === 'mn' && semAtributos(penultimo) && anterior.nome === 'mo' && (textoDe(anterior) === '.' || textoDe(anterior) === ',') && anterior.atributos.lspace === '0') {
      penultimo.filhos = [textoDe(penultimo) + textoDe(anterior) + textoDe(e)];
      saida.pop();
      continue;
    }
    saida.push(e);
  }
  return saida;
}

function semAtributos(pElemento: ElementoMathML): boolean {
  return Object.keys(pElemento.atributos).length === 0;
}

export function construirMathML(pNos: No[], pOpcoes: OpcoesDoConstrutor): ElementoMathML {
  return new Construtor(pOpcoes).construir(pNos);
}

/** Para testes: uma medida em em como texto. */
export function medidaParaCSS(pMedida: Medida): string {
  return cssDaMedida(pMedida);
}
