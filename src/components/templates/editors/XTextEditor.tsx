/**
 * XTextEditor - Editor de Texto
 * 
 * Input de texto simples com suporte a diferentes tipos:
 * Text, TextArea, Password, Email, Phone, CEP
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type JSX, type ChangeEvent } from 'react';
import { X } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import type { SelecaoDoPicker } from '@core/lib/pickerSelecao';
import { XEditorLabel } from './XEditorLabel';
import { XBotaoCopiar } from './XBotaoCopiar';
import { XPickerLupa, temPicker } from './XPickerLupa';

// ============================================================================
// Types
// ============================================================================

interface XTextEditorProps {
  editor: XDataEditor;
  value: string;
  originalValue?: string;
  onChange: (pValue: string, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Editor Type Constants
// ============================================================================

// Valores espelham XUIEditorType (Core). O CEP tem editor próprio (XCEPEditor) — não passa por aqui.
const EditorType = {
  Text: 1,
  TextArea: 2,
  Password: 15,
  Email: 16,
  Phone: 17,
} as const;

// ============================================================================
// Masks
// ============================================================================

function applyPhoneMask(pValue: string): string {
  const numbers = pValue.replace(/\D/g, '').slice(0, 11);

  if (numbers.length <= 10)
    return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();

  return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

// Validação simples de e-mail (formato) para feedback AO DIGITAR.
function isValidEmail(pValue: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pValue);
}

// ============================================================================
// Component
// ============================================================================

export function XTextEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XTextEditorProps): JSX.Element {
  const editorModel = editor.editor;
  const editorType = editorModel.editorType;

  // Validação de e-mail ao digitar (só o tipo Email). "" não acusa erro (obrigatoriedade é à parte).
  const [emailError, setEmailError] = useState<string | undefined>(undefined);

  // ---------------------------------------------------------------------------
  // Input Type
  // ---------------------------------------------------------------------------

  const inputType = useMemo(() => {
    switch (editorType) {
      case EditorType.Password:
        return 'password';
      case EditorType.Email:
        return 'email';
      case EditorType.Phone:
        return 'tel';
      default:
        return 'text';
    }
  }, [editorType]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const rawValue = e.target.value;

    // Campos especializados (mascaram automaticamente): guardam SÓ dígitos; a exibição aplica a
    // máscara (displayValue). Coerente com o editor de documento (CPF/CNPJ), que também grava dígitos.
    if (editorType === EditorType.Phone) {
      onChange(rawValue.replace(/\D/g, '').slice(0, 11));
      return;
    }
    if (editorType === EditorType.Email)
      setEmailError(rawValue && !isValidEmail(rawValue) ? 'E-mail inválido' : undefined);

    onChange(rawValue);
  }, [editorType, onChange]);

  const handleRevert = useCallback(() => {
    onChange(originalValue ?? '');
  }, [onChange, originalValue]);

  // Registro escolhido na LUPA: o valor entra no campo e os vínculos vão para o formulário — o
  // mesmo caminho de quem digitou, e não um segundo caminho com regras próprias.
  const aoEscolherNoPicker = useCallback((pSelecao: SelecaoDoPicker) => {
    onChange(pSelecao.valor, Object.keys(pSelecao.bindings).length > 0 ? pSelecao.bindings : undefined);
  }, [onChange]);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  // Normalize values for comparison (treat null/undefined as empty string)
  const normalizedValue = value ?? '';
  const normalizedOriginal = originalValue ?? '';

  // Show revert button only if value was changed from original
  const hasChanged = normalizedValue !== normalizedOriginal;
  const comLupa = temPicker(editorModel);
  const showRevertButton = hasChanged && !disabled && !editorModel.isReadOnly;

  // Os DOIS botões convivem à direita do campo (dono, 2026-08-06): limpar primeiro, lupa depois. Um
  // campo com busca precisa tanto de "procurar" quanto de "desfazer o que ficou aqui" — sem o
  // segundo, o único jeito de esvaziar um filtro escolhido na lupa é apagar o texto letra por letra.
  // A folga à direita do texto acompanha quantos botões existem, senão o valor passa por baixo deles.
  // O botão desfaz quando existe um valor ORIGINAL para voltar (formulário) e limpa quando não
  // existe (filtro, que nasce vazio). O rótulo segue o que ele faz de fato — "desfazer alteração"
  // num filtro descreveria uma coisa que não aconteceu.
  const rotuloDoBotaoLimpar = normalizedOriginal === '' ? 'Limpar' : 'Desfazer alteração';
  const botoesADireita = (showRevertButton ? 1 : 0) + (comLupa ? 1 : 0);
  const folgaDireita = botoesADireita === 2 ? 'pr-16' : botoesADireita === 1 ? 'pr-8' : '';

  // Translate placeholder text (may be a translation key)
  const translatedPlaceholder = (editorModel.placeholderText ?? '');

  // Valor EXIBIDO já mascarado (Phone) — vale inclusive para o dado carregado do servidor, que antes
  // aparecia cru porque a máscara só rodava no onChange. A máscara normaliza dígitos.
  const displayValue = useMemo(() => {
    const v = value ?? '';
    if (editorType === EditorType.Phone)
      return applyPhoneMask(v);
    return v;
  }, [value, editorType]);

  // Erro final = erro do formulário (pai) OU o de e-mail digitado.
  const finalError = error || emailError;

  // ---------------------------------------------------------------------------
  // Common Props
  // ---------------------------------------------------------------------------

  const commonProps = useMemo(() => ({
    id: editor.id,
    name: editor.fieldName,
    value: displayValue,
    onChange: handleChange,
    placeholder: translatedPlaceholder,
    disabled: disabled || editorModel.isReadOnly,
    required: editorModel.isRequired,
    minLength: editorModel.minLength ?? undefined,
    maxLength: editorModel.maxLength ?? undefined,
    tabIndex: editorModel.tabIndex || undefined,
    className: `
      w-full h-editor px-3 ${folgaDireita} text-ui rounded-lg border
      bg-brand-surface text-brand-text-primary
      placeholder:text-brand-text-muted
      focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg
      ${finalError ? 'border-danger focus:ring-danger' : 'border-border'}
    `,
  }), [
    editor.id,
    editor.fieldName,
    displayValue,
    handleChange,
    translatedPlaceholder,
    editorModel,
    disabled,
    finalError,
    showRevertButton,
    comLupa,
    folgaDireita,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // O campo se AJUSTA À JANELA quando o modelo o declara (`fillsHeight`): a caixa ocupa a altura que
  // a seção lhe der e rola só quando o texto passa disso. É o que o rastro de uma exceção pede —
  // altura fixa o espremia em três linhas com meia tela vazia embaixo. Nesse modo `rows` não vale:
  // quem se ajusta à janela não conta linhas.
  const preencheAltura = editorModel.fillsHeight === true;

  /** A base dos campos SEM a altura fixa do editor — a área de texto define a sua. */
  const semAlturaFixa = commonProps.className.replace('h-editor', '');

  /**
   * A base da ÁREA DE TEXTO sem a folga da direita: ali os botões são outros (copiar, e o desfazer
   * quando há o que desfazer), então a folga é recontada abaixo. Sai da string em vez de ser
   * sobreposta, pelo mesmo motivo da altura: entre dois utilitários do mesmo grupo, quem vence é a
   * ordem da folha de estilo, não a da string.
   */
  const baseDaAreaDeTexto = semAlturaFixa.replace('pr-16', '').replace('pr-8', '');

  // Texto SÓ DE LEITURA não rola por dentro (dono, 2026-10-22): numa caixa de linhas fixas, um texto
  // explicativo que ninguém edita virava uma segunda barra de rolagem dentro do diálogo, que já rola.
  // A caixa cresce até caber o texto — quem rola, se preciso, é o corpo do diálogo. O texto editável
  // segue com as linhas declaradas (quem digita precisa de uma área estável).
  const somenteLeitura = editorModel.isReadOnly === true;
  const cresceComTexto = editorType === EditorType.TextArea && somenteLeitura && !preencheAltura;
  const areaDeTexto = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const area = areaDeTexto.current;
    if (!cresceComTexto || !area)
      return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + 2}px`;
  }, [cresceComTexto, displayValue]);

  return (
    <div className={`w-full ${preencheAltura ? 'h-full min-h-0 flex flex-col' : ''}`}>
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Input */}
      {editorType === EditorType.TextArea ? (
        <div className={`relative ${preencheAltura ? 'flex-1 min-h-0' : ''}`}>
          <textarea
            {...commonProps}
            ref={areaDeTexto}
            rows={preencheAltura ? undefined : (editorModel.rows && editorModel.rows > 0 ? editorModel.rows : 3)}
            // `h-editor` sai da string, não é sobreposto: as duas são utilitários de ALTURA, e entre
            // classes do mesmo grupo quem vence é a ordem da folha de estilo, não a da string — a
            // altura fixa do editor podia ganhar de `h-full` e o campo continuava do tamanho de uma
            // linha, sem nada no código sugerindo o motivo.
            // O piso do elástico (8rem) não é decoração: `h-full` só vale enquanto o corpo do modal
            // tem altura definida, e onde essa cadeia não existir o campo encolheria até o próprio
            // texto — MENOR que a área de texto comum, justamente no campo que pede mais espaço. Com
            // o piso, o pior caso continua legível.
            className={`${baseDaAreaDeTexto} py-2 ${showRevertButton ? 'pr-16' : 'pr-8'} resize-none ${
              preencheAltura ? 'h-full min-h-[8rem]' : cresceComTexto ? 'overflow-hidden' : 'h-auto min-h-[80px]'
            }`}
          />
          {showRevertButton && (
            <button
              type="button"
              onClick={handleRevert}
              className="absolute right-2 top-2 p-1 hover:bg-hover rounded"
              tabIndex={-1}
              title={'Desfazer alteração'}
            >
              <X className="w-3 h-3 text-brand-text-muted" />
            </button>
          )}
          {/* COPIAR, no canto da caixa: o conteúdo de uma área de texto é longo por natureza — pilha,
              corpo de requisição, observação — e selecionar tudo com o mouse dentro de uma caixa que
              rola por dentro é trabalho manual que o botão resolve num clique. Cede o canto ao
              desfazer quando os dois convivem: desfazer altera o dado, e fica na posição de sempre. */}
          <XBotaoCopiar
            texto={normalizedValue}
            descricao={editor.title}
            className={`absolute top-2 ${showRevertButton ? 'right-9' : 'right-2'}`}
          />
        </div>
      ) : (
        <div className="relative">
          <input
            {...commonProps}
            type={inputType}
          />
          <XPickerLupa
            editorModel={editorModel}
            disabled={disabled || editorModel.isReadOnly}
            onSelect={aoEscolherNoPicker}
          />
          {showRevertButton && (
            <button
              type="button"
              onClick={handleRevert}
              className={`absolute ${comLupa ? 'right-9' : 'right-2'} top-1/2 -translate-y-1/2 p-1 hover:bg-hover rounded`}
              tabIndex={-1}
              title={rotuloDoBotaoLimpar}
              aria-label={rotuloDoBotaoLimpar}
            >
              <X className="w-3 h-3 text-brand-text-muted" />
            </button>
          )}
        </div>
      )}

      {/* Hint or Error */}
      {(finalError || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${finalError ? 'text-danger' : 'text-brand-text-muted'}`}>
          {finalError || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
