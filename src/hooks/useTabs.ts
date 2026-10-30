import { useContext } from 'react';
import { TabsContext, type TabsContextValue } from '@core/contexts';

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx)
    throw new Error('useTabs must be used within TabsProvider');
  return ctx;
}
