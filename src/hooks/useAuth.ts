import { useContext } from 'react';
import { AuthContext } from '@core/contexts';
import type { AuthContextType } from '@core/types';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context)
    throw new Error('useAuth must be used within an AuthProvider');
  
  return context;
}
