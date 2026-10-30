/**
 * ErrorContext - Contexto global para tratamento de erros
 * 
 * Gerencia erros não tratados e exibe modal com detalhes.
 * Em modo debug, mostra stack trace e informações técnicas.
 */

import { createContext, useState, useCallback, useEffect, type ReactNode, type JSX } from 'react';
import { errorEmitter, type ErrorCategory, type FieldError } from '@core/lib/errorEmitter';
import { safeRandomUUID } from '@core/lib/uuid';

// ============================================================================
// Types
// ============================================================================

export interface ErrorInfo {
  id: string;
  category: ErrorCategory;
  title: string;
  message: string;
  details?: string;
  fieldErrors?: FieldError[];
  code?: string;
  statusCode?: number;
  url?: string;
  method?: string;
  stack?: string;
  timestamp: Date;

  /**
   * A aba de App que estava à frente quando a mensagem foi levantada — o CONTEXTO dela (dono,
   * 2026-08-08). O diálogo só aparece enquanto essa aba está ativa: trocar de aba não pode deixar o
   * aviso de um App por cima da tela de outro, e voltar à aba de origem o traz de volta.
   *
   * Vazio quando não havia App à frente (login, cadastro, landing, ou mensagem da própria casca):
   * aí a mensagem é da sessão e aparece sempre.
   */
  originTabId?: string;
}

export interface ErrorContextValue {
  error: ErrorInfo | null;
  showError: (pError: Partial<ErrorInfo> & { message: string }) => void;
  clearError: () => void;
  isDebugMode: boolean;
}

// ============================================================================
// Context
// ============================================================================

export const ErrorContext = createContext<ErrorContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ErrorProviderProps {
  children: ReactNode;
}

/**
 * Qual aba de App está à frente NESTE INSTANTE, lida da própria casca (`data-active-tab-id`, na área
 * do App). Vem do DOM, e não de um contexto, porque o `ErrorProvider` vive FORA do `TabsProvider` —
 * ele precisa existir antes da autenticação, quando aba nenhuma existe. Sem casca (login, cadastro,
 * landing) devolve vazio, e a mensagem passa a ser da sessão: aparece sempre.
 */
function abaCorrente(): string {
  if (typeof document === 'undefined')
    return '';

  return document.querySelector('[data-app-area]')?.getAttribute('data-active-tab-id') ?? '';
}

export function ErrorProvider({ children }: ErrorProviderProps): JSX.Element {
  const [error, setError] = useState<ErrorInfo | null>(null);
  
  // Debug mode based on environment
  const isDebugMode = import.meta.env.DEV;

  const showError = useCallback((pError: Partial<ErrorInfo> & { message: string }) => {
    const errorInfo: ErrorInfo = {
      originTabId: pError.originTabId ?? abaCorrente(),
      id: safeRandomUUID(),
      category: pError.category || 'error',
      title: pError.title || 'Erro',
      message: pError.message,
      details: pError.details,
      fieldErrors: pError.fieldErrors,
      code: pError.code,
      statusCode: pError.statusCode,
      url: pError.url,
      method: pError.method,
      stack: pError.stack,
      timestamp: new Date(),
    };

    setError(errorInfo);
    
    // Also log to console in debug mode
    if (import.meta.env.DEV) {
      console.error('[ErrorContext]', errorInfo);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Subscribe to error events from non-React modules (like api.ts)
  useEffect(() => {
    const unsubscribe = errorEmitter.subscribe((pError) => {
      showError({
        category: pError.category,
        title: pError.title,
        message: pError.message,
        details: pError.details,
        fieldErrors: pError.fieldErrors,
        code: pError.code,
        statusCode: pError.statusCode,
        url: pError.url,
        method: pError.method,
        stack: pError.stack,
      });
    });

    return unsubscribe;
  }, [showError]);

  return (
    <ErrorContext.Provider value={{ error, showError, clearError, isDebugMode }}>
      {children}
    </ErrorContext.Provider>
  );
}
