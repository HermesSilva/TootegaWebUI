import { type JSX } from 'react';
import type { XUIGridColumn } from '@core/types';
import { XRecordPickerDialog } from './XRecordPickerDialog';

/**
 * Diálogo de SELEÇÃO da grade de itens (o botão "Novo" do pedido).
 *
 * É o <see cref="XRecordPickerDialog"/> com as colunas que o vendedor precisa para escolher, e um
 * campo de pesquisa livre. Todo o comportamento (busca com espera, estados de carga e vazio,
 * contenção do modal) vive lá: aqui só ficam as colunas, que são o que este uso tem de próprio.
 *
 * Três vêm das posições fixas do contrato de lookup — código (`group`), descrição (`text`) e preço
 * (`detail`). **Unidade** e **saldo** (dono, 2026-08-24) vêm do dicionário `columns` do item, que
 * existe para o dado extra: o preço sozinho não diz se "R$ 6,68" é por metro ou por barra, e sem o
 * saldo o vendedor só descobre que não há a peça depois de pôr a linha no pedido.
 *
 * Os títulos são escritos AQUI, e não vêm do modelo de uma App: eles são do próprio front.
 */
interface XItemPickerDialogProps {
  /** Endpoint de lookup: `POST { searchText, maxResults } → { items: [{ value, text, group }] }`. */
  endpoint: string;
  /** Filtros FIXOS vindos do formulário (`pickerContextBindings`), somados a toda busca. */
  fixedFilters?: Record<string, string>;
  /** Chamado com o item escolhido (value/text/group). */
  onSelect: (pItem: Record<string, unknown>) => void;
  /** Fecha o diálogo sem escolher. */
  onClose: () => void;
}

export function XItemPickerDialog({ endpoint, fixedFilters, onSelect, onClose }: XItemPickerDialogProps): JSX.Element {

  // As larguras somam 100 (percentual da grade). A descrição cede o espaço das colunas novas: ela é a
  // única que tolera truncar, porque as primeiras palavras já identificam o produto.
  const colunas: XUIGridColumn[] = [
    { fieldName: 'group', title: 'Código', editorType: 'text', width: 20 },
    { fieldName: 'text', title: 'Descrição', editorType: 'text', width: 40 },
    { fieldName: 'unidade', title: 'Unidade', editorType: 'text', width: 10 },
    { fieldName: 'saldo', title: 'Saldo', editorType: 'number', width: 12 },
    { fieldName: 'detail', title: 'Preço', editorType: 'currency', width: 18 },
  ];

  return (
    <XRecordPickerDialog
      endpoint={endpoint}
      fixedFilters={fixedFilters}
      columns={colunas}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
