/**
 * Escala de largura do formulário — FE-2, FE-3, FE-8 e FE-9 (Docs-Para-AI/front-dimensoes-de-modal.md).
 *
 * Fonte ÚNICA das medidas: o motor do front (XFormModal/XTabbedFormModal/XFormView) e o teste da
 * escala leem daqui — duas tabelas de mínimos divergiriam no primeiro editor novo.
 *
 * O que este módulo responde:
 *   - qual a largura MÍNIMA em pixels de cada tipo de editor (a máscara não encolhe);
 *   - qual o PISO em pixels de um formulário (a linha mais larga dele) — FE-9;
 *   - se um campo CABE na largura que as colunas lhe deram — FE-8.
 *
 * O que ele NÃO faz: esticar coisa alguma. O mínimo é contrato verificado, nunca força que deforma
 * o layout (FE-1/FE-6). Vale só no desktop (FE-0).
 */

import { XUIEditorType } from '@core/types';
import type { XFormField, XFormView, XTabbedFormView } from '@core/types';

/** Colunas do grid interno do formulário. Fixo (FE-2). */
export const TOTAL_COLUMNS = 32;

/**
 * Largura de referência da ÁREA DO APP, em pixels — a menor tela desktop suportada (FE-8):
 * viewport 1280 − barra lateral 280 (`--sidebar-width`) − espaçamentos ≈ 970.
 * Coube aqui, cabe em qualquer tela maior.
 */
export const APP_AREA_REFERENCE_WIDTH = 970;

/** Altura de UMA linha de campo (rótulo + editor + espaçamento), em pixels — FE-4. */
export const FIELD_ROW_HEIGHT = 60;

/** Teto do modal: 90% da área do App, largura e altura (FE-5). */
export const MODAL_MAX_PERCENT = 90;

/** Recuo horizontal do corpo do formulário (px-6 + pl-2), somado dos dois lados. */
const FORM_HORIZONTAL_PADDING = 56;

/**
 * Mínimo do editor, em pixels — vem do MODELO publicado pelo back (`minWidth`), tabela única em
 * `XEscalaFormulario.MinimoDoEditor` (D2: o back é a verdade). Zero = sem mínimo, o campo trunca.
 * O back já zera o `minWidth` de quem declarou a exceção da FE-8.
 */
export function editorMinWidth(pField: XFormField): number {
  return pField.editor.editor.minWidth ?? 0;
}

/** O campo entra na escala? Sem mínimo, oculto, ou com exceção declarada (FE-8) ⇒ fica de fora. */
function contaNaEscala(pField: XFormField): boolean {
  return pField.editor.editor.editorType !== XUIEditorType.Hidden
    && pField.colSpan > 0
    && editorMinWidth(pField) > 0;
}

/** Todos os campos do formulário, com ou sem abas. */
export function camposDoFormulario(pFormView: XFormView | XTabbedFormView): XFormField[] {
  const comAbas = pFormView as XTabbedFormView;
  const secoes = comAbas.tabs?.length
    ? comAbas.tabs.flatMap((pT) => pT.sections ?? [])
    : pFormView.sections;

  return secoes.flatMap((pS) => pS.fields);
}

/**
 * PISO do modal, em pixels (FE-9): a linha mais larga manda. Para cada seção e cada linha, soma-se
 * o mínimo dos editores que contam na escala, mais os espaçamentos entre eles e o recuo do corpo.
 *
 * Campos sem mínimo (texto livre) ocupam o resto das colunas e não somam nada: eles truncam.
 */
export function pisoDoFormularioPx(pFormView: XFormView | XTabbedFormView): number {
  const gap = pFormView.fieldGap || 12;
  const linhas = new Map<string, XFormField[]>();

  const comAbas = pFormView as XTabbedFormView;
  const secoes = comAbas.tabs?.length
    ? comAbas.tabs.flatMap((pT) => pT.sections ?? [])
    : pFormView.sections;

  secoes.forEach((pSecao, pIndiceSecao) => {
    pSecao.fields.forEach((pCampo) => {
      const chave = `${pIndiceSecao}:${pCampo.row}`;
      const atual = linhas.get(chave) ?? [];
      atual.push(pCampo);
      linhas.set(chave, atual);
    });
  });

  let piso = 0;

  linhas.forEach((pCamposDaLinha) => {
    const exigentes = pCamposDaLinha.filter(contaNaEscala);
    if (exigentes.length === 0)
      return;

    // O mínimo de um campo cobre as colunas DELE; a linha inteira precisa da largura em que essas
    // colunas comportem o mínimo. Daí a projeção para as 32 colunas: um CNPJ (250px) em 8 colunas
    // exige um corpo de 250 × 32/8 = 1000px.
    const exigenciaDaLinha = Math.max(
      ...exigentes.map((pC) => (editorMinWidth(pC) * TOTAL_COLUMNS) / pC.colSpan)
    );

    const espacamentos = gap * (pCamposDaLinha.length - 1);
    piso = Math.max(piso, exigenciaDaLinha + espacamentos + FORM_HORIZONTAL_PADDING);
  });

  return Math.ceil(piso);
}

/**
 * Largura efetiva do modal, em pixels, dada a largura real da área do App (FE-3 + FE-9):
 * o percentual declarado, elevado pelo piso quando ele for maior. O piso PODE ultrapassar o teto de
 * 90% — é a única coisa que ultrapassa, e então a área do App rola (FE-9).
 */
export function larguraDoModalPx(
  pFormView: XFormView | XTabbedFormView,
  pLarguraDaAreaDoApp: number
): number {
  const percentual = Math.min(pFormView.modalWidth || MODAL_MAX_PERCENT, MODAL_MAX_PERCENT);
  const pretendida = (pLarguraDaAreaDoApp * percentual) / 100;

  return Math.max(pretendida, pisoDoFormularioPx(pFormView));
}

/** Altura do corpo do modal, em pixels. Zero ⇒ a altura segue o conteúdo (FE-4). */
export function alturaDoCorpoPx(pFormView: XFormView | XTabbedFormView): number {
  if (pFormView.modalRows > 0)
    return pFormView.modalRows * FIELD_ROW_HEIGHT;

  return pFormView.maxHeight > 0 ? pFormView.maxHeight : 0;
}

/**
 * O editor genérico que CEDE altura por natureza: a grade de itens (FE-11). Reconhecido pelo nome do
 * editor customizado, nunca pela App.
 */
const EDITOR_ELASTICO = 'XItemsGridEditor';

/**
 * O campo ABSORVE a sobra vertical do corpo: a grade de itens (FE-11) e todo campo que o modelo
 * declarou `fillsHeight` — o texto sem tamanho previsível, como o rastro de uma exceção. Fonte ÚNICA:
 * o XFormView (que distribui a sobra) e o modal (que precisa TER sobra para distribuir) leem daqui.
 */
export function ehCampoElastico(pField: XFormField): boolean {
  return pField.editor.editor.customEditorName === EDITOR_ELASTICO
      || pField.editor.editor.fillsHeight === true;
}

/**
 * O formulário tem campo elástico? Então o corpo do modal precisa de altura DEFINIDA.
 *
 * Não é detalhe de estilo: sem altura definida no corpo, `height: 100%` do campo elástico resolve
 * para `auto` e ele encolhe até o próprio conteúdo — a pilha de uma exceção saía com DUAS linhas e o
 * resto do modal vazio embaixo, exatamente o oposto do que "se ajusta à janela" promete. Campo comum
 * não sofre disso porque tem altura de linha própria (FE-7); quem cede altura só existe se houver
 * uma altura de onde ceder.
 */
export function temCampoElastico(pFormView: XFormView | XTabbedFormView): boolean {
  return camposDoFormulario(pFormView).some(ehCampoElastico);
}

export interface XCampoForaDaEscala {
  fieldName: string;
  editorType: XUIEditorType;
  colSpan: number;
  minimoPx: number;
  disponivelPx: number;
}

/**
 * Campos que NÃO cabem, medidos sobre a área do App de referência (FE-8). O teste da escala falha
 * com esta lista; em execução o piso (FE-9) garante o mínimo e o modal alarga.
 */
export function camposForaDaEscala(pFormView: XFormView | XTabbedFormView): XCampoForaDaEscala[] {
  const gap = pFormView.fieldGap || 12;
  const percentual = Math.min(pFormView.modalWidth || MODAL_MAX_PERCENT, MODAL_MAX_PERCENT);
  const corpo = (APP_AREA_REFERENCE_WIDTH * percentual) / 100 - FORM_HORIZONTAL_PADDING;

  return camposDoFormulario(pFormView)
    .filter(contaNaEscala)
    .map((pCampo) => {
      const minimo = editorMinWidth(pCampo);
      const disponivel = (corpo * pCampo.colSpan) / TOTAL_COLUMNS - gap;

      return {
        fieldName: pCampo.editor.fieldName,
        editorType: pCampo.editor.editor.editorType,
        colSpan: pCampo.colSpan,
        minimoPx: minimo,
        disponivelPx: Math.floor(disponivel),
      };
    })
    .filter((pC) => pC.disponivelPx < pC.minimoPx);
}
