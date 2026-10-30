/**
 * XDocumentEditor - Editor Unificado de CPF/CNPJ
 *
 * Campo que aceita tanto CPF quanto CNPJ com:
 * - Auto-detecção baseada na quantidade de dígitos
 * - Máscara dinâmica (CPF: XXX.XXX.XXX-XX, CNPJ: XX.XXX.XXX/XXXX-XX)
 * - Validação de dígitos verificadores
 * - Configuração para aceitar apenas CPF, apenas CNPJ ou ambos
 * - TIPO derivado: escreve o código do tipo (física/jurídica) no campo `documentTypeField`
 * - CONSULTA ao sair do campo: com `lookupEndpoint`, busca o documento e preenche os campos
 *   vinculados (`fieldBindings`); se a resposta trouxer `errorKey`, exibe o aviso no campo.
 *   SÓ NA INCLUSÃO (dono, 2026-10-12): em edição o registro já existe e nada se consulta —
 *   vale para todo cadastro que pesquisa o documento, porque a regra mora aqui, no editor
 *
 * Tudo dirigido por dados (CE-19): o editor não conhece nenhuma aplicação.
 */

import { useState, useCallback, useMemo, useEffect, useRef, type JSX, type ChangeEvent } from 'react';
import { FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

import type { XDataEditor } from '@core/types';
import { api } from '@core/lib/api';
import {
  sanitizeDocument,
  detectDocumentType,
  applyDocumentMask,
  type DocumentType,
} from '@core/lib/formatting';
import { useFormBusy } from '@core/hooks/useFormBusy';
import type { SelecaoDoPicker } from '@core/lib/pickerSelecao';
import { XPickerLupa, temPicker } from './XPickerLupa';

// ============================================================================
// Types
// ============================================================================

interface XDocumentEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================
//
// A sanitização, a detecção de espécie e a MÁSCARA do documento moram em `@core/lib/formatting`
// (2026-08-07): o critério de documento do diálogo de busca precisa exatamente das mesmas, e uma
// cópia aqui faria dois campos de documento se comportarem diferente na mesma tela.

/**
 * Valida CPF usando algoritmo de dígitos verificadores
 */
function validateCPF(pDigits: string): boolean {
  if (pDigits.length !== 11)
    return false;

  // CPFs com todos os dígitos iguais são inválidos
  if (/^(\d)\1{10}$/.test(pDigits))
    return false;

  // Calcula primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++)
    sum += parseInt(pDigits[i]) * (10 - i);

  let digit = (sum * 10) % 11;
  if (digit === 10)
    digit = 0;

  if (digit !== parseInt(pDigits[9]))
    return false;

  // Calcula segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++)
    sum += parseInt(pDigits[i]) * (11 - i);

  digit = (sum * 10) % 11;
  if (digit === 10)
    digit = 0;

  if (digit !== parseInt(pDigits[10]))
    return false;

  return true;
}

/**
 * Valida o CNPJ (dígitos verificadores). Aceita o formato ALFANUMÉRICO 2026: posições 1–12
 * alfanuméricas, 13–14 numéricas. O valor de cada posição no cálculo é (código ASCII − 48), o que
 * inclui o CNPJ numérico legado como caso particular.
 */
function validateCNPJ(pChars: string): boolean {
  if (pChars.length !== 14)
    return false;

  // Todas as posições iguais é inválido (ex.: AAAAAAAAAAAA00 / 00000000000000).
  if (/^(.)\1{13}$/.test(pChars))
    return false;

  // Os dois dígitos verificadores são sempre numéricos.
  if (!/^\d$/.test(pChars[12]) || !/^\d$/.test(pChars[13]))
    return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const val = (pChar: string): number => pChar.charCodeAt(0) - 48;

  let sum = 0;
  for (let i = 0; i < 12; i++)
    sum += val(pChars[i]) * weights1[i];

  let digit = sum % 11;
  digit = digit < 2 ? 0 : 11 - digit;

  if (digit !== val(pChars[12]))
    return false;

  sum = 0;
  for (let i = 0; i < 13; i++)
    sum += val(pChars[i]) * weights2[i];

  digit = sum % 11;
  digit = digit < 2 ? 0 : 11 - digit;

  if (digit !== val(pChars[13]))
    return false;

  return true;
}

/**
 * Valida o documento conforme seu tipo
 */
function validateDocument(
  pChars: string,
  pAllowCPF: boolean,
  pAllowCNPJ: boolean
): { isValid: boolean; message?: string } {
  if (!pChars)
    return { isValid: true };

  const type = detectDocumentType(pChars, pAllowCPF, pAllowCNPJ);

  // CPF
  if (type === 'cpf' && pChars.length === 11) {
    if (!pAllowCPF)
      return { isValid: false, message: 'CPF não é permitido. Use um CNPJ.' };

    if (!validateCPF(pChars))
      return { isValid: false, message: 'CPF inválido' };

    return { isValid: true };
  }

  // CNPJ (numérico ou alfanumérico)
  if (type === 'cnpj' && pChars.length === 14) {
    if (!pAllowCNPJ)
      return { isValid: false, message: 'CNPJ não é permitido. Use um CPF.' };

    if (!validateCNPJ(pChars))
      return { isValid: false, message: 'CNPJ inválido' };

    return { isValid: true };
  }

  // Incompleto
  return { isValid: true };
}

// ============================================================================
// Component
// ============================================================================

export function XDocumentEditor({
  editor,
  value,
  onChange,
  error,
  disabled,
}: XDocumentEditorProps): JSX.Element {
  const editorModel = editor.editor;

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const allowCPF = editorModel.documentAllowCPF !== false; // true por padrão
  const allowCNPJ = editorModel.documentAllowCNPJ !== false; // true por padrão

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [displayValue, setDisplayValue] = useState('');
  const [localValidation, setLocalValidation] = useState<{ isValid: boolean; message?: string }>({ isValid: true });

  // Aviso vindo da CONSULTA (errorKey da resposta) — ex.: documento já cadastrado. Some ao editar.
  const [lookupError, setLookupError] = useState<string | undefined>(undefined);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Último documento consultado: impede repetir a chamada (o blur logo após digitar consultaria de novo).
  const consultadoRef = useRef('');

  // LUPA: só existe quando o modelo declara para onde ela busca (CE-19 — o editor não conhece App).
  // O botão e o diálogo são da XPickerLupa; aqui só se sabe SE há lupa, para dar espaço ao ícone.
  const temLupa = temPicker(editorModel);

  // Enquanto a consulta roda, o formulário inteiro fica ocupado — véu com indicador de progresso.
  // `emInclusao` diz se o registro é novo: a consulta só existe para PREENCHER um cadastro novo.
  const { marcarOcupado, emInclusao } = useFormBusy();

  // ---------------------------------------------------------------------------
  // Initialize Display Value
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (value) {
      const chars = sanitizeDocument(String(value), allowCNPJ);
      setDisplayValue(applyDocumentMask(chars, detectDocumentType(chars, allowCPF, allowCNPJ)));
    } else {
      setDisplayValue('');
    }
  }, [value, allowCPF, allowCNPJ]);

  // ---------------------------------------------------------------------------
  // Current Document Type
  // ---------------------------------------------------------------------------

  const currentDigits = useMemo(() => sanitizeDocument(displayValue, allowCNPJ), [displayValue, allowCNPJ]);
  const currentType = useMemo(() => detectDocumentType(currentDigits, allowCPF, allowCNPJ), [currentDigits, allowCPF, allowCNPJ]);

  const isComplete = useMemo(() => {
    return (currentType === 'cpf' && currentDigits.length === 11) ||
           (currentType === 'cnpj' && currentDigits.length === 14);
  }, [currentType, currentDigits.length]);

  // ---------------------------------------------------------------------------
  // Placeholder
  // ---------------------------------------------------------------------------

  const placeholder = useMemo(() => {
    const translatedPlaceholder = (editorModel.placeholderText ?? '');
    if (translatedPlaceholder)
      return translatedPlaceholder;

    if (allowCPF && allowCNPJ)
      return 'Digite CPF ou CNPJ';

    if (allowCPF)
      return 'Digite o CPF';

    if (allowCNPJ)
      return 'Digite o CNPJ';

    return 'Documento';
  }, [editorModel.placeholderText, allowCPF, allowCNPJ]);

  // ---------------------------------------------------------------------------
  // Document Type Label
  // ---------------------------------------------------------------------------

  const typeLabel = useMemo(() => {
    if (currentDigits.length === 0)
      return null;

    if (currentType === 'cpf')
      return 'CPF';

    if (currentType === 'cnpj')
      return 'CNPJ';

    return null;
  }, [currentDigits.length, currentType]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Tipo DERIVADO do documento (CE-19): o editor já sabe distinguir CPF de CNPJ, então escreve o
   * código no campo que o modelo indicar (`documentTypeField`). Só deriva quando o documento está
   * completo — antes disso não há como saber, e escrever um palpite faria campos condicionais
   * piscarem enquanto o usuário digita.
   */
  const bindingsDoTipo = useCallback((pChars: string, pType: DocumentType): Record<string, unknown> | undefined => {
    const campo = editorModel.documentTypeField;
    if (!campo)
      return undefined;

    if (pType === 'cpf' && pChars.length === 11)
      return { [campo]: editorModel.documentTypeCPFValue ?? '' };

    if (pType === 'cnpj' && pChars.length === 14)
      return { [campo]: editorModel.documentTypeCNPJValue ?? '' };

    // Documento APAGADO: o tipo volta ao neutro que o modelo declarar. Sem isto, o que sobra é o tipo
    // do documento ANTERIOR, e o formulário segue regido por um dado que não está mais na tela — o
    // campo que dependia dele continuaria destravado, ou preenchido, sem nada que o justifique.
    if (pChars.length === 0 && editorModel.documentTypeEmptyValue)
      return { [campo]: editorModel.documentTypeEmptyValue };

    return undefined;
  }, [
    editorModel.documentTypeField,
    editorModel.documentTypeCPFValue,
    editorModel.documentTypeCNPJValue,
    editorModel.documentTypeEmptyValue,
  ]);

  /**
   * CONSULTA o documento no `lookupEndpoint`. A resposta preenche os campos vinculados
   * (`fieldBindings`) e pode trazer o texto de um impedimento (ex.: documento já cadastrado),
   * exibido no campo. Falha de rede é silenciosa: o usuário preenche à mão.
   *
   * Enquanto roda, o FORMULÁRIO INTEIRO fica ocupado (véu + indicador de progresso): a resposta vai
   * reescrever vários campos, e não faz sentido o usuário digitar por cima do que está prestes a ser
   * substituído. A consulta pode demorar — ela sai para um terceiro.
   *
   * Não repete o mesmo documento: `consultadoRef` guarda o último já consultado.
   *
   * Em EDIÇÃO não consulta (dono, 2026-10-12): o registro já existe, a resposta reescreveria o que
   * foi gravado e o "já cadastrado" acusaria o próprio registro.
   */
  const consultar = useCallback(async (pChars: string, pType: DocumentType): Promise<void> => {
    const endpoint = editorModel.lookupEndpoint;
    if (!endpoint || !emInclusao || consultadoRef.current === pChars)
      return;

    consultadoRef.current = pChars;

    setIsLookingUp(true);
    marcarOcupado(true);
    try {
      const resposta = await api.get<Record<string, unknown>>(`${endpoint}/${pChars}`, undefined, true);

      const chaveErro = resposta?.errorKey;
      setLookupError(chaveErro ? String(chaveErro) : undefined);

      const bindings: Record<string, unknown> = { ...bindingsDoTipo(pChars, pType) };
      for (const b of editorModel.fieldBindings ?? []) {
        const v = resposta?.[b.sourceField];

        if (v != null && v !== '')
          bindings[b.targetField] = v;
        else if (b.clearWhenAbsent)
          // O campo é da CONSULTA, não do usuário: sem valor na resposta, o que sobrou é do documento
          // ANTERIOR. Deixá-lo seria mostrar (e gravar) o nome de outra pessoa.
          bindings[b.targetField] = '';
      }

      if (Object.keys(bindings).length > 0)
        onChange(pChars, bindings);
    } catch {
      // Documento desconhecido ou serviço indisponível: mantém o valor; o usuário preenche à mão.
    } finally {
      setIsLookingUp(false);
      marcarOcupado(false);
    }
  }, [editorModel.lookupEndpoint, editorModel.fieldBindings, emInclusao, onChange, bindingsDoTipo, marcarOcupado]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    // Sanitiza (alfanumérico p/ CNPJ; dígitos p/ CPF), aplica a máscara e propaga o valor CRU
    // (sem máscara) — dígitos no CPF, alfanumérico MAIÚSCULO no CNPJ.
    const chars = sanitizeDocument(e.target.value, allowCNPJ);
    const type = detectDocumentType(chars, allowCPF, allowCNPJ);
    setDisplayValue(applyDocumentMask(chars, type));
    setLookupError(undefined);

    const validation = chars.length === 0
      ? { isValid: true }
      : validateDocument(chars, allowCPF, allowCNPJ);
    setLocalValidation(validation);

    onChange(chars || '', bindingsDoTipo(chars, type));

    // A consulta começa no instante em que o documento fica VÁLIDO — digitado ou colado —, sem
    // esperar o usuário sair do campo (dono, 2026-07-12). Documento incompleto ou com dígito
    // verificador errado não gasta a cota do terceiro.
    const completo = (type === 'cpf' && chars.length === 11) || (type === 'cnpj' && chars.length === 14);
    if (completo && validation.isValid)
      void consultar(chars, type);
    else
      consultadoRef.current = '';   // mudou o documento: o próximo válido volta a consultar
  }, [allowCPF, allowCNPJ, onChange, bindingsDoTipo, consultar]);

  const handleFocus = useCallback(() => {
    // Focus tracking - pode ser usado para estilos ou validação
  }, []);

  /**
   * Registro escolhido na LUPA. O caminho é o MESMO da consulta por documento — o valor do campo
   * mais os `fieldBindings` sobre a resposta —, e é de propósito: o formulário fica no estado em que
   * ficaria se o documento tivesse sido digitado. Um segundo caminho, com regras próprias, seria
   * duas verdades para o mesmo formulário.
   *
   * O documento escolhido vai para `consultadoRef`: ele já veio do cadastro, e reconsultá-lo no
   * primeiro blur seria uma ida ao servidor para reescrever o que acabou de ser preenchido.
   */
  const aoEscolherNoPicker = useCallback((pSelecao: SelecaoDoPicker): void => {
    // O valor e os vínculos vêm prontos da lupa (`selecaoDoPicker`); o que é PRÓPRIO deste editor —
    // limpar a máscara, descobrir se é CPF ou CNPJ e publicar o tipo no formulário — fica aqui.
    const chars = sanitizeDocument(pSelecao.valor, allowCNPJ);
    const type = detectDocumentType(chars, allowCPF, allowCNPJ);

    const bindings: Record<string, unknown> = { ...bindingsDoTipo(chars, type), ...pSelecao.bindings };

    consultadoRef.current = chars;
    setLookupError(undefined);
    setLocalValidation({ isValid: true });
    setDisplayValue(applyDocumentMask(chars, type));
    onChange(chars, Object.keys(bindings).length > 0 ? bindings : undefined);
  }, [allowCPF, allowCNPJ, bindingsDoTipo, onChange]);

  /**
   * Ao SAIR do campo: revalida e consulta, caso a consulta ainda não tenha acontecido — é a rede de
   * segurança para o valor que chegou sem passar pelo onChange (preenchimento do navegador, por
   * exemplo). Documento já consultado não repete.
   */
  const handleBlur = useCallback(async () => {
    const validation = validateDocument(currentDigits, allowCPF, allowCNPJ);
    setLocalValidation(validation);

    if (validation.isValid && isComplete)
      await consultar(currentDigits, currentType);
  }, [currentDigits, currentType, isComplete, allowCPF, allowCNPJ, consultar]);

  // ---------------------------------------------------------------------------
  // Final Error Message
  // ---------------------------------------------------------------------------

  const finalError = error || lookupError || (!localValidation.isValid ? localValidation.message : undefined);

  // ---------------------------------------------------------------------------
  // Validation Icon
  // ---------------------------------------------------------------------------

  const ValidationIcon = useMemo(() => {
    if (isLookingUp)
      return <Loader2 className="w-4 h-4 text-brand-text-muted animate-spin" />;

    if (!currentDigits || !isComplete)
      return null;

    if (lookupError)
      return <AlertCircle className="w-4 h-4 text-danger" />;

    if (localValidation.isValid) {
      return (
        <CheckCircle className="w-4 h-4 text-success" />
      );
    }

    return (
      <AlertCircle className="w-4 h-4 text-danger" />
    );
  }, [currentDigits, isComplete, localValidation.isValid, lookupError, isLookingUp]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Label Row - título e erro lado a lado */}
      {editor.title && (
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor={editor.id}
            className="text-ui font-medium text-brand-text-secondary"
          >
            {(editor.title ?? '')}
            {editorModel.isRequired && (
              <span className="text-danger ml-1">*</span>
            )}
          </label>
          {/* Error inline com label */}
          {finalError && (
            <span className="text-ui-xs text-danger">
              {finalError}
            </span>
          )}
        </div>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Document Icon */}
        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />

        {/* Input */}
        <input
          id={editor.id}
          type="text"
          inputMode={allowCNPJ ? 'text' : 'numeric'}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled || editorModel.isReadOnly}
          className={`
            w-full h-editor pl-10 ${temLupa ? 'pr-28' : 'pr-20'}
            text-ui rounded-lg border
            bg-brand-surface text-brand-text-primary
            placeholder:text-brand-text-muted
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg
            ${finalError ? 'border-danger focus:ring-danger' : 'border-border'}
          `}
        />

        {/* Type Badge */}
        {typeLabel && (
          <span
            className={`
              absolute ${temLupa ? 'right-[4.5rem]' : 'right-10'} top-1/2 -translate-y-1/2
              px-2 py-0.5 text-[10px] font-semibold rounded
              ${currentType === 'cpf' ? 'bg-info-bg text-info' : 'bg-brand-primary/10 text-brand-primary'}
            `}
          >
            {typeLabel}
          </span>
        )}

        {/* Validation Icon */}
        {ValidationIcon && (
          <span className={`absolute ${temLupa ? 'right-9' : 'right-3'} top-1/2 -translate-y-1/2`}>
            {ValidationIcon}
          </span>
        )}

        {/* LUPA — abre a busca por documento OU nome, para quem não tem o número na mão. É a MESMA
            peça de todo campo que busca registro (XPickerLupa): só aparece com endpoint declarado
            (CE-19) e some no campo travado, porque buscar sem poder escolher é caminho sem saída. */}
        {!disabled && !editorModel.isReadOnly && (
          <XPickerLupa editorModel={editorModel} onSelect={aoEscolherNoPicker} />
        )}
      </div>
    </div>
  );
}
