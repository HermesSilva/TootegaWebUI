/**
 * ErrorEmitter - Global error event system
 * 
 * Allows modules outside the React tree (like api.ts) to dispatch
 * errors captured by ErrorContext.
 * 
 * Categories (mapped from backend XResponseStatus):
 * - validation: Field-level validation errors (XResponseStatus.ValidationError)
 * - error: Business logic errors (XResponseStatus.Error)
 * - exception: Unexpected server errors (XResponseStatus.Exception)
 * - warning: Non-blocking warnings (XResponseStatus.Warning)
 * - message: Informational messages (XResponseStatus.Information)
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorCategory = 'validation' | 'error' | 'exception' | 'warning' | 'message';

export interface FieldError {
  field: string;
  messages: string[];
}

export interface ErrorEvent {
  category: ErrorCategory;
  title?: string;
  message: string;
  details?: string;
  fieldErrors?: FieldError[];
  code?: string;
  statusCode?: number;
  url?: string;
  method?: string;
  stack?: string;
}

type ErrorListener = (pError: ErrorEvent) => void;

// ============================================================================
// Emitter
// ============================================================================

class ErrorEmitter {
  private _Listeners: Set<ErrorListener> = new Set();

  subscribe(pListener: ErrorListener): () => void {
    this._Listeners.add(pListener);
    
    // Return unsubscribe function
    return () => {
      this._Listeners.delete(pListener);
    };
  }

  emit(pError: ErrorEvent): void {
    for (const listener of this._Listeners)
      listener(pError);
  }
}

// Singleton instance
export const errorEmitter = new ErrorEmitter();
