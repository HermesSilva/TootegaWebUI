/**
 * useError - Hook para acessar o contexto de erro
 */

import { useContext } from 'react';
import { ErrorContext, type ErrorContextValue } from '@core/contexts/ErrorContext';

export function useError(): ErrorContextValue {
  const ctx = useContext(ErrorContext);
  if (!ctx)
    throw new Error('useError must be used within ErrorProvider');
  return ctx;
}
