import { useContext } from 'react';
import { SidebarContext, type SidebarContextValue } from '@core/contexts';

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx)
    throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
