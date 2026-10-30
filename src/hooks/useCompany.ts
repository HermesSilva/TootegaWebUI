import { useContext } from 'react';
import { CompanyContext, type CompanyContextValue } from '@core/contexts/CompanyContext';

/** Empresa corrente do usuário logado (ver CompanyProvider). */
export function useCompany(): CompanyContextValue {
  return useContext(CompanyContext);
}
