/**
 * Editors - Barrel Export
 * 
 * Exporta todos os editores do sistema de templates.
 */

export { XEditor } from './XEditor';
export type { XEditorProps } from './XEditor';

export { XTextEditor } from './XTextEditor';
export { XComboBoxEditor } from './XComboBoxEditor';
export { XStatementEditor } from './XStatementEditor';
export { XLookupEditor } from './XLookupEditor';
export { XDocumentEditor } from './XDocumentEditor';
export { XDateEditor } from './XDateEditor';
export { XDateTimeEditor } from './XDateTimeEditor';
export { XTimeEditor } from './XTimeEditor';
export { XNumberEditor } from './XNumberEditor';
export { XCurrencyEditor } from './XCurrencyEditor';
export { XPercentEditor } from './XPercentEditor';
export { XBooleanEditor } from './XBooleanEditor';
export { XColorEditor } from './XColorEditor';
export { XUrlEditor } from './XUrlEditor';
export { XMultiSelectEditor } from './XMultiSelectEditor';
export { XJSONEditor } from './XJSONEditor';
export { XFileUploadEditor } from './XFileUploadEditor';
export { XImageUploadEditor } from './XImageUploadEditor';

// Levar o conteúdo do campo para a área de transferência — peça única, usada por qualquer editor.
export { XBotaoCopiar } from './XBotaoCopiar';

// Diálogo genérico de busca de registro — reusável por qualquer editor ou App (CE-19).
export { XRecordPickerDialog } from './XRecordPickerDialog';
export { XItemPickerDialog } from './XItemPickerDialog';
export { XReportFieldEditor, XREPORT_FIELD_EDITOR } from './XReportFieldEditor';
export { XAlertListEditor } from './XAlertListEditor';
export { XReadOnlyListEditor } from './XReadOnlyListEditor';
// Caixa de itens (dono, 2026-10-26): registros escolhidos como pastilhas, com '+' no cabeçalho e 'x' em cada um.
export { XCaixaDeItensEditor } from './XCaixaDeItensEditor';
