/**
 * XSingleFormView — SingleForm Template Layout
 *
 * Renders the SingleForm view template: ONE record's form, filling the application area — no grid,
 * no selection, no modal. The record is implied by context (the current tenant/company), not chosen
 * from a list; the form loads from `loadEndpoint` (a GET with no id) and saves to `saveEndpoint`
 * (a PUT). Used for configuration screens (e.g. the CFG billing account).
 *
 * It is 100% data-driven (CE-19): the form is declared in the back (`XFormView`) and rendered by the
 * shared `XFormView` component — there is NO per-App custom component. Being contained in the
 * application area (never an overlay) honours the front containment directive.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │  Title                                    [×]    │
 * ├─────────────────────────────────────────────────┤
 * │  Form (sections + editors)                       │
 * │                                                  │
 * ├─────────────────────────────────────────────────┤
 * │                            [Salvar]  [Fechar]    │
 * └─────────────────────────────────────────────────┘
 */

import { useState, useCallback, useEffect, type JSX } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Save, Loader2, LogOut } from 'lucide-react';
import { XApplicationMode } from '@core/types';
import type { XApplication } from '@core/types';
import { api, ApiError } from '@core/lib/api';
import { CLOSE_BUTTON_CLASS } from '@core/lib';
import { XFormView } from './XFormView';

/**
 * `useQueryClient` LANÇA sem `QueryClientProvider` acima; aqui a ausência é legítima (o formulário pode montar sem
 * ele, como nos testes). Sem cliente, a releitura depois de gravar só não acontece.
 */
function useQueryClientOpcional(): QueryClient | null {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- o try/catch não ramifica a ordem dos hooks: useQueryClient
    // é sempre chamado; o catch só trata a ausência do provider.
    return useQueryClient();
  } catch {
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface XSingleFormViewProps {
  application: XApplication;
  tabID: string;
  onClose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function XSingleFormView({
  application,
  tabID,
  onClose,
}: XSingleFormViewProps): JSX.Element {
  const formView = application.formView;

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Os campos recusados pelo servidor, marcados no formulário (dono, 2026-10-12: a validação marca TODOS os campos).
  const [erros, setErros] = useState<Record<string, string>>({});
  const queryClient = useQueryClientOpcional();

  // ---------------------------------------------------------------------------
  // Load — GET the single record (no id: the record is the one of the context)
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    if (!formView.loadEndpoint)
      return;

    setIsLoading(true);
    try {
      const detail = await api.get<Record<string, unknown>>(formView.loadEndpoint);
      setFormData(detail ?? {});
    } catch (error) {
      // O erro global (ErrorContext) já avisa; aqui o formulário só fica com o que tinha.
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [formView.loadEndpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---------------------------------------------------------------------------
  // Change / Save
  // ---------------------------------------------------------------------------

  const handleChange = useCallback((pFieldName: string, pValue: unknown, pBindings?: Record<string, unknown>) => {
    setFormData((prev) => ({ ...prev, ...(pBindings ?? {}), [pFieldName]: pValue }));
    // Mexeu no campo recusado: a marca sai dele (as dos outros ficam até a próxima gravação).
    setErros((prev) => {
      if (!(pFieldName in prev))
        return prev;
      const { [pFieldName]: _corrigido, ...resto } = prev;
      return resto;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!formView.saveEndpoint)
      return;

    setIsSaving(true);
    setErros({});
    try {
      // PUT: o registro é o do contexto (inquilino/empresa, ou o do nível do AppX pelo {contexto}) — não há criação avulsa.
      await api.put(formView.saveEndpoint, formData);
      // Recarrega para reexibir o que o servidor consolidou (ex.: o texto da conta escolhida).
      await load();
      // Dentro de um AppX, o cabeçalho e a lista de registros podem ter mudado (o nome do projeto): o AppX os relê.
      void queryClient?.invalidateQueries({ queryKey: ['painel-resumo'] });
      void queryClient?.invalidateQueries({ queryKey: ['painel-contextos'] });
    } catch (error) {
      // O diálogo já lista os erros (api.ts); aqui cada campo recusado fica marcado, com a mesma frase embaixo.
      if (error instanceof ApiError && error.fieldErrors.length > 0)
        setErros(Object.fromEntries(error.fieldErrors.map((pE) => [pE.field, pE.messages.join('\n')])));
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [formView.saveEndpoint, formData, load, queryClient]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="relative flex flex-col h-full bg-brand-surface"
      data-tab-id={tabID}
      data-application-id={application.id}
    >
      {/* Header — título + fechar (mesmo padrão das demais views) */}
      <div className="flex items-center px-2 sm:px-4 py-2 border-b border-border-light bg-brand-surface min-h-row gap-2">
        <span className="text-ui font-medium text-brand-fg">{formView.title || application.title}</span>
        <div className="flex-1 min-w-[8px]" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={'Fechar'}
            className={CLOSE_BUTTON_CLASS}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{'Fechar'}</span>
          </button>
        )}
      </div>

      {/* Corpo do formulário (seções + editores), com rolagem */}
      <div className="flex-1 min-h-0 overflow-auto px-2 sm:px-4 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-brand-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-ui">{'Carregando…'}</span>
          </div>
        ) : (
          <XFormView
            formView={formView}
            data={formData}
            onChange={handleChange}
            errors={erros}
          />
        )}
      </div>

      {/* Rodapé — Salvar (não há Cancelar avulso: fechar sai sem gravar) */}
      <div className="flex items-center justify-end px-2 sm:px-4 py-2 border-t border-border-light bg-brand-surface gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || isLoading}
          className="h-10 sm:h-8 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg transition-colors px-3"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="text-ui">{'Salvar'}</span>
        </button>
      </div>
    </div>
  );
}

// Modo de aplicação implícito da SingleForm: edição do registro corrente.
export const SINGLE_FORM_MODE = XApplicationMode.Edit;
