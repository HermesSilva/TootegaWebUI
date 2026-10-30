/**
 * XCEPEditor — Editor de CEP com BUSCA de endereço
 *
 * Digita-se o CEP; ao completar os oito dígitos (digitado OU colado), o editor CONSULTA o endereço
 * (lookupEndpoint/{cep}) e preenche os campos vinculados (fieldBindings: campo da resposta → campo do
 * formulário) — logradouro, complemento, bairro, cidade, UF, código do município. Enquanto a busca
 * roda, um SPINNER aparece no campo e o FORMULÁRIO INTEIRO fica ocupado (véu com indicador de
 * progresso): a resposta vai reescrever vários campos, e não faz sentido digitar por cima do que está
 * prestes a ser substituído.
 *
 * Elegância e usabilidade (dono, 2026-07-15): logo abaixo do campo, a CONFIRMAÇÃO do endereço
 * resolvido; e o FOCO salta para o campo Número (cepNumberField) — o único dado que o CEP não traz.
 * CEP não encontrado é AVISO (laranja), nunca erro vermelho: o usuário preenche à mão.
 *
 * Genérico e dirigido por dados (CE-19): o editor não conhece nenhuma aplicação — o endpoint, os
 * vínculos e o campo de foco vêm todos do modelo publicado pelo back.
 */

import { useCallback, useEffect, useState, type JSX, type ChangeEvent, type KeyboardEvent } from 'react';
import { MapPin, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { useCepLookup } from '@core/hooks/useCepLookup';

// ============================================================================
// Types
// ============================================================================

interface XCEPEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Máscara
// ============================================================================

/** Formato adotado pela Tootega: XX.XXX-XXX (ex.: 69.005-070). Máscara progressiva ao digitar. */
function aplicarMascaraCEP(pValor: string): string {
  const d = pValor.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2)
    return d;
  if (d.length <= 5)
    return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
}

function digitosDe(pValor: unknown): string {
  return String(pValor ?? '').replace(/\D/g, '').slice(0, 8);
}

// ============================================================================
// Component
// ============================================================================

export function XCEPEditor({
  editor,
  value,
  onChange,
  error,
  disabled,
}: XCEPEditorProps): JSX.Element {
  const editorModel = editor.editor;
  const endpoint = editorModel.lookupEndpoint;

  const [displayValue, setDisplayValue] = useState('');
  // Confirmação do endereço resolvido (logradouro, bairro — cidade/UF), mostrada abaixo do campo.
  const [resolvido, setResolvido] = useState<string | null>(null);

  const { buscando, naoEncontrado, consultar, limpar } = useCepLookup(endpoint);

  // Exibe SEMPRE o valor mascarado — inclusive o carregado do servidor (que chega cru).
  useEffect(() => {
    setDisplayValue(aplicarMascaraCEP(digitosDe(value)));
  }, [value]);

  // ---------------------------------------------------------------------------
  // Aplicação da resposta
  // ---------------------------------------------------------------------------

  /**
   * Espalha a cadeia de endereço da resposta pelos campos do formulário (fieldBindings), monta a
   * confirmação amigável e leva o foco ao Número. O valor principal continua os dígitos do CEP.
   */
  const aplicar = useCallback((pDigitos: string, pResposta: Record<string, unknown>): void => {
    const bindings: Record<string, unknown> = {};
    for (const b of editorModel.fieldBindings ?? []) {
      const v = pResposta[b.sourceField];
      if (v != null && v !== '')
        bindings[b.targetField] = v;
    }
    onChange(pDigitos, Object.keys(bindings).length > 0 ? bindings : undefined);

    // Confirmação: "Logradouro, Bairro — Cidade/UF" (o que a resposta trouxer). Campos fixos do
    // contrato de CEP (CepLookupDTO) — este é o editor de CEP, então lê-los aqui é legítimo.
    const rua = String(pResposta.logradouro ?? '');
    const bairro = String(pResposta.bairro ?? '');
    const cidade = String(pResposta.cidade ?? '');
    const uf = String(pResposta.uf ?? '');
    const linha = [rua, bairro].filter(Boolean).join(', ');
    const local = [cidade, uf].filter(Boolean).join('/');
    setResolvido([linha, local].filter(Boolean).join(' — ') || null);

    // Foca o Número DEPOIS que o React aplica os bindings. O campo é achado pelo atributo name (= nome
    // do campo, como o XTextEditor o define). Sem cepNumberField declarado, não move o foco.
    const campoNumero = editorModel.cepNumberField;
    if (campoNumero)
      setTimeout(() => {
        document.querySelector<HTMLInputElement>(`[name="${campoNumero}"]`)?.focus();
      }, 0);
  }, [editorModel.fieldBindings, editorModel.cepNumberField, onChange]);

  const dispararConsulta = useCallback((pDigitos: string): void => {
    void consultar(pDigitos, (resposta) => aplicar(pDigitos, resposta));
  }, [consultar, aplicar]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    const digitos = digitosDe(e.target.value);
    setDisplayValue(aplicarMascaraCEP(digitos));
    limpar();
    if (digitos.length < 8)
      setResolvido(null);
    onChange(digitos);

    // A busca começa assim que o CEP fica completo — digitado ou colado —, sem esperar sair do campo.
    if (digitos.length === 8)
      dispararConsulta(digitos);
  }, [limpar, onChange, dispararConsulta]);

  // Rede de segurança: valor que chegou sem passar pelo onChange (preenchimento do navegador) é
  // consultado ao sair do campo. O hook deduplica — não repete o que já buscou.
  const handleBlur = useCallback((): void => {
    const digitos = digitosDe(value);
    if (digitos.length === 8)
      dispararConsulta(digitos);
  }, [value, dispararConsulta]);

  // Enter força a busca imediata do CEP já completo.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter')
      return;
    const digitos = digitosDe(value);
    if (digitos.length === 8) {
      e.preventDefault();
      dispararConsulta(digitos);
    }
  }, [value, dispararConsulta]);

  // ---------------------------------------------------------------------------
  // Ícone de estado (direita)
  // ---------------------------------------------------------------------------

  const completo = digitosDe(value).length === 8;
  let iconeEstado: JSX.Element | null = null;
  if (buscando)
    iconeEstado = <Loader2 aria-label={'Buscando endereço…'} className="w-4 h-4 text-brand-text-muted animate-spin" />;
  else if (naoEncontrado)
    iconeEstado = <AlertCircle className="w-4 h-4 text-warning" />;
  else if (completo && resolvido)
    iconeEstado = <CheckCircle className="w-4 h-4 text-success" />;

  const placeholder = (editorModel.placeholderText ?? '') || '00.000-000';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Rótulo + erro do formulário lado a lado */}
      {editor.title && (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={editor.id} className="text-ui font-medium text-brand-text-secondary">
            {(editor.title ?? '')}
            {editorModel.isRequired && <span className="text-danger ml-1">*</span>}
          </label>
          {error && <span className="text-ui-xs text-danger">{error}</span>}
        </div>
      )}

      {/* Campo */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />

        <input
          id={editor.id}
          name={editor.fieldName}
          type="tel"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || editorModel.isReadOnly}
          aria-busy={buscando}
          className={`
            w-full h-editor pl-10 pr-10
            text-ui rounded-lg border
            bg-brand-surface text-brand-text-primary
            placeholder:text-brand-text-muted
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg
            ${error ? 'border-danger focus:ring-danger' : 'border-border'}
          `}
        />

        {iconeEstado && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{iconeEstado}</span>
        )}
      </div>

      {/* Aviso laranja: CEP não encontrado (não bloqueia — o usuário preenche à mão) */}
      {naoEncontrado && (
        <p className="mt-1 text-ui-xs text-warning">{'CEP não encontrado — preencha o endereço manualmente.'}</p>
      )}

      {/* Confirmação do endereço resolvido */}
      {!naoEncontrado && resolvido && (
        <p className="mt-1 text-ui-xs text-brand-text-muted truncate" title={resolvido}>
          {resolvido}
        </p>
      )}

      {/* Dica do modelo (quando não há aviso nem confirmação a mostrar) */}
      {!naoEncontrado && !resolvido && editorModel.hintText && (
        <p className="mt-1 text-ui-xs text-brand-text-muted">{(editorModel.hintText ?? '')}</p>
      )}
    </div>
  );
}
