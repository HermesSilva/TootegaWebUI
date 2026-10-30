/**
 * AppTabContent - Renderiza o conteúdo de uma tab de aplicação
 * 
 * Carrega a definição XApplication via API e renderiza o XApplicationView
 */

import type { JSX } from 'react';
import { useApplication } from '@core/hooks';
import { XApplicationView } from '@core/components/templates/XApplicationView';
import type { AppTab } from '@core/types';

// ============================================================================
// Types
// ============================================================================

export interface AppTabContentProps {
  tab: AppTab;
  onClose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function AppTabContent({ tab, onClose }: AppTabContentProps): JSX.Element {
  const { data: application, isLoading, error } = useApplication(tab.menuItem.applicationID);

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-brand-text-secondary text-ui">
          {'Carregando aplicação...'}
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-brand-error text-ui mb-2">{'Erro ao carregar aplicação'}</p>
          <p className="text-brand-text-muted text-ui-sm">{error.message}</p>
        </div>
      </div>
    );

  if (!application)
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-brand-text-muted text-ui">{'Aplicação não encontrada'}</div>
      </div>
    );

  return (
    <XApplicationView
      application={application}
      tabID={tab.id}
      onClose={onClose}
      filtroInicial={tab.filtroInicial}
      registroInicial={tab.registroInicial}
    />
  );
}
