/**
 * XEditor - Factory de Editores
 * 
 * Renderiza o editor correto baseado no tipo configurado em XUIEditorModel.
 * Centraliza a lógica de criação de editores para filtros e formulários.
 */

import { type JSX } from 'react';
import type { XDataEditor, XRowAction } from '@core/types';
import { XTextEditor } from './XTextEditor';
import { XCEPEditor } from './XCEPEditor';
import { XComboBoxEditor } from './XComboBoxEditor';
import { XLookupEditor } from './XLookupEditor';
import { XMultiLookupEditor } from './XMultiLookupEditor';
import { XMultiSelectEditor } from './XMultiSelectEditor';
import { XJSONEditor } from './XJSONEditor';
import { XStatementEditor } from './XStatementEditor';
import { XDocumentEditor } from './XDocumentEditor';
import { XDateEditor } from './XDateEditor';
import { XDateTimeEditor } from './XDateTimeEditor';
import { XTimeEditor } from './XTimeEditor';
import { XNumberEditor } from './XNumberEditor';
import { XCurrencyEditor } from './XCurrencyEditor';
import { XPercentEditor } from './XPercentEditor';
import { XBooleanEditor } from './XBooleanEditor';
import { XColorEditor } from './XColorEditor';
import { XUrlEditor } from './XUrlEditor';
import { XFileUploadEditor } from './XFileUploadEditor';
import { XImageUploadEditor } from './XImageUploadEditor';
import { XFieldEditorRegistry } from '../XFieldEditorRegistry';

// ============================================================================
// Types
// ============================================================================

export interface XEditorProps {
  editor: XDataEditor;
  value: unknown;
  /** Texto a EXIBIR quando o valor é uma chave (lookup). Vem do campo `displayValueField` do modelo. */
  displayValue?: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
  /**
   * Ação POR LINHA de uma grade embutida (XItemsGridEditor): o botão "Baixar" da linha da parcela. A
   * grade não executa — delega ao pai (até o XApplicationView, que abre o modal e recarrega o form).
   */
  onGridRowAction?: (pAction: XRowAction, pRow: Record<string, unknown>) => void;
}

// ============================================================================
// Editor Type Enum Values (matching backend)
// ============================================================================

const EditorType = {
  Text: 1,
  TextArea: 2,
  Number: 3,
  Date: 4,
  DateTime: 5,
  Time: 6,
  Boolean: 7,
  ComboBox: 8,
  RadioButton: 9,
  Checkbox: 10,
  FileUpload: 11,
  ColorPicker: 12,
  DataLookup: 13,
  AutoComplete: 14,
  Password: 15,
  Email: 16,
  Phone: 17,
  Currency: 18,
  CPF: 19,
  CNPJ: 20,
  CEP: 21,
  Slider: 22,
  Rating: 23,
  Hidden: 24,
  Percent: 25,
  URL: 26,
  MultiSelect: 27,
  ImageUpload: 28,
  JSON: 29,
  Statement: 30,
} as const;

// ============================================================================
// Component
// ============================================================================

export function XEditor({
  editor,
  value,
  displayValue,
  originalValue,
  onChange,
  error,
  disabled,
  onGridRowAction,
}: XEditorProps): JSX.Element {
  const editorType = editor.editor.editorType;

  // Per-field custom editor (opt-in via customEditorName) — rendered in place with the
  // same props as a built-in editor.
  const customName = editor.editor.customEditorName;
  if (customName && XFieldEditorRegistry.has(customName)) {
    const CustomEditor = XFieldEditorRegistry.resolve(customName)!;
    return (
      <CustomEditor
        editor={editor}
        value={value}
        originalValue={originalValue}
        onChange={onChange}
        error={error}
        disabled={disabled}
        onGridRowAction={onGridRowAction}
      />
    );
  }

  // Hidden
  if (editorType === EditorType.Hidden)
    return <input type="hidden" value={String(value ?? '')} />;

  // CEP — editor próprio: mascara, BUSCA o endereço e preenche a cadeia (véu + spinner). Antes caía
  // no XTextEditor (texto cru); agora é um template dedicado, como CPF/CNPJ têm o XDocumentEditor.
  if (editorType === EditorType.CEP)
    return (
      <XCEPEditor
        editor={editor}
        value={value}
        originalValue={originalValue}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // JSON: documento formatado e colorido, só leitura (auditoria de IA).
  if (editorType === EditorType.JSON)
    return <XJSONEditor editor={editor} value={value} />;

  // Demonstrativo: a conta em linhas tipadas, valores alinhados e resultado em destaque. Só leitura.
  if (editorType === EditorType.Statement)
    return <XStatementEditor editor={editor} value={value} />;

  // Text, TextArea, Password, Email, Phone
  if (
    editorType === EditorType.Text ||
    editorType === EditorType.TextArea ||
    editorType === EditorType.Password ||
    editorType === EditorType.Email ||
    editorType === EditorType.Phone
  )
    return (
      <XTextEditor
        editor={editor}
        value={value as string}
        originalValue={originalValue as string}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // Number
  if (editorType === EditorType.Number)
    return (
      <XNumberEditor
        editor={editor}
        value={value as number}
        originalValue={originalValue as number}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // Currency
  if (editorType === EditorType.Currency)
    return (
      <XCurrencyEditor
        editor={editor}
        value={value as number}
        originalValue={originalValue as number}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // Date, DateTime, Time
  if (editorType === EditorType.Date)
    return (
      <XDateEditor
        editor={editor}
        value={value as string}
        originalValue={originalValue as string}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  if (editorType === EditorType.DateTime)
    return (
      <XDateTimeEditor
        editor={editor}
        value={value as string}
        originalValue={originalValue as string}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  if (editorType === EditorType.Time)
    return (
      <XTimeEditor
        editor={editor}
        value={value as string}
        originalValue={originalValue as string}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // Boolean, Checkbox
  if (editorType === EditorType.Boolean || editorType === EditorType.Checkbox)
    return (
      <XBooleanEditor
        editor={editor}
        value={value as boolean}
        originalValue={originalValue as boolean}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // ComboBox, RadioButton
  if (editorType === EditorType.ComboBox || editorType === EditorType.RadioButton)
    return (
      <XComboBoxEditor
        editor={editor}
        value={value}
        originalValue={originalValue}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // DataLookup, AutoComplete
  if (editorType === EditorType.DataLookup || editorType === EditorType.AutoComplete) {
    if (editor.editor.isMultiSelect)
      return (
        <XMultiLookupEditor
          editor={editor}
          value={value}
          originalValue={originalValue}
          onChange={onChange}
          error={error}
          disabled={disabled}
        />
      );

    return (
      <XLookupEditor
        editor={editor}
        value={value}
        displayText={displayValue}
        originalValue={originalValue}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );
  }

  // MultiSelect (flags bitmask)
  if (editorType === EditorType.MultiSelect)
    return (
      <XMultiSelectEditor
        editor={editor}
        value={value}
        originalValue={originalValue}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // Document (CPF/CNPJ)
  if (editorType === EditorType.CPF || editorType === EditorType.CNPJ)
    return (
      <XDocumentEditor
        editor={editor}
        value={value as string}
        originalValue={originalValue as string}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // ColorPicker
  if (editorType === EditorType.ColorPicker)
    return (
      <XColorEditor
        editor={editor}
        value={value as string}
        originalValue={originalValue as string}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // Percent
  if (editorType === EditorType.Percent)
    return (
      <XPercentEditor
        editor={editor}
        value={value as number}
        originalValue={originalValue as number}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // FileUpload
  if (editorType === EditorType.FileUpload)
    return (
      <XFileUploadEditor
        editor={editor}
        value={value}
        originalValue={originalValue}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // ImageUpload — arquivo COM prévia, tipo/tamanho conferidos na escolha e remoção explícita.
  if (editorType === EditorType.ImageUpload)
    return (
      <XImageUploadEditor
        editor={editor}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // URL
  if (editorType === EditorType.URL)
    return (
      <XUrlEditor
        editor={editor}
        value={value as string}
        originalValue={originalValue as string}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );

  // Fallback para tipos não implementados
  return (
    <XTextEditor
      editor={editor}
      value={value as string}
      originalValue={originalValue as string}
      onChange={onChange}
      error={error}
      disabled={disabled}
    />
  );
}
