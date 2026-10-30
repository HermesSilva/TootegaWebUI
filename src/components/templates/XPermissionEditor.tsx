/**
 * XPermissionEditor - Permission Management for Role Profiles
 *
 * Displays a grid of available applications with a settings button
 * to open a claims modal for each app. Allows toggling individual
 * claims on/off per application.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │  Icon │ Application Name │ N of M claims │ [⚙] │
 * │  Icon │ Application Name │ N of M claims │ [⚙] │
 * └─────────────────────────────────────────────────┘
 *
 * Claims Modal:
 * ┌─────────────────────────────────────────────────┐
 * │  App Name - Permissions                    [X]  │
 * │  ☐ Select All                                   │
 * │  ┌──────────────┐ ┌──────────────┐              │
 * │  │ ☑ Claim 1    │ │ ☐ Claim 2    │              │
 * │  │ ☑ Claim 3    │ │ ☐ Claim 4    │              │
 * │  └──────────────┘ └──────────────┘              │
 * │                                    [Close]      │
 * └─────────────────────────────────────────────────┘
 */

import { useState, useCallback, useEffect, useMemo, type JSX } from 'react';
import { Settings, Loader2, Check, Shield, ShieldCheck } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { XApplicationMode } from '@core/types';
import { api } from '@core/lib/api';
import { XModalShell } from './XModalShell';

// ============================================================================
// Types
// ============================================================================

interface ApplicationWithClaims {
  id: string;
  name: string;
  title: string;
  icon: string;
  availableClaims: ClaimLookup[];
}

interface ClaimLookup {
  id: number;
  claimType: string;
  claimValue: string;
  description: string;
  groupID: number | null;
  groupName: string | null;
}

interface ProfileApp {
  id: string;
  applicationID: string;
  applicationName: string;
  applicationTitle: string;
  applicationIcon: string;
  claims: ProfileAppClaim[];
}

interface ProfileAppClaim {
  id: string;
  claimID: number;
  claimType: string;
  claimValue: string;
  claimDescription: string;
}

export interface XPermissionEditorProps {
  dataEndpoint: string;
  formData: Record<string, unknown>;
  onFormDataChange: (pFieldName: string, pValue: unknown) => void;
  isReadOnly: boolean;
  mode: XApplicationMode;
}

// ============================================================================
// Helper: Get Lucide Icon by name
// ============================================================================

function getIconByName(pName: string): React.ComponentType<{ className?: string }> | null {
  if (!pName) return null;

  const iconName = pName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const icon = (LucideIcons as Record<string, unknown>)[iconName];
  return typeof icon === 'function' ? icon as React.ComponentType<{ className?: string }> : null;
}

// ============================================================================
// Claims Modal Component
// ============================================================================

interface ClaimsModalProps {
  isOpen: boolean;
  application: ApplicationWithClaims;
  activeClaims: Set<number>;
  isReadOnly: boolean;
  onToggleClaim: (pClaimID: number) => void;
  onToggleAll: (pChecked: boolean) => void;
  onClose: () => void;
}

function ClaimsModal({
  isOpen,
  application,
  activeClaims,
  isReadOnly,
  onToggleClaim,
  onToggleAll,
  onClose,
}: ClaimsModalProps): JSX.Element | null {

  if (!isOpen) return null;

  const IconComponent = getIconByName(application.icon);
  const allChecked = application.availableClaims.length > 0 &&
    application.availableClaims.every((c) => activeClaims.has(c.id));
  const someChecked = application.availableClaims.some((c) => activeClaims.has(c.id));

  return (
    <XModalShell
      variant="inline"
      size="lg"
      closeLabel={'Fechar'}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {IconComponent && <IconComponent className="w-5 h-5 text-brand-primary shrink-0" />}
          {(application.title ?? '')}
        </span>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <span className="text-ui-xs text-brand-text-muted">
            {`${activeClaims.size} de ${application.availableClaims.length} permissões ativas`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-ui font-medium text-brand-text-primary
                     bg-brand-surface border border-border rounded-lg hover:bg-hover transition-colors
                     min-h-touch sm:min-h-[36px]"
          >
            {'Fechar'}
          </button>
        </div>
      }
    >
      {/* Select All */}
      {!isReadOnly && application.availableClaims.length > 1 && (
        <div className="px-5 py-3 border-b border-border-light bg-muted-bg">
          <label className="relative flex items-center gap-3 cursor-pointer group">
            <div className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-all
              ${allChecked
                ? 'bg-brand-primary border-brand-primary'
                : someChecked
                  ? 'bg-brand-primary/30 border-brand-primary'
                  : 'border-border-light group-hover:border-brand-primary/50'
              }
            `}>
              {(allChecked || someChecked) && (
                <Check className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <span className="text-ui font-medium text-brand-text-secondary">
              {'Selecionar todos'}
            </span>
            <span className="text-ui-xs text-brand-text-muted ml-auto">
              {activeClaims.size} / {application.availableClaims.length}
            </span>
            <button
              type="button"
              onClick={() => onToggleAll(!allChecked)}
              className="absolute inset-0"
              aria-label={'Selecionar todos'}
            />
          </label>
        </div>
      )}

      {/* Claims Grid */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {application.availableClaims.map((claim) => {
            const isActive = activeClaims.has(claim.id);

            return (
              <button
                key={claim.id}
                type="button"
                onClick={() => !isReadOnly && onToggleClaim(claim.id)}
                disabled={isReadOnly}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-all text-left min-h-touch
                  ${isActive
                    ? 'border-brand-primary/40 bg-brand-primary/5 hover:bg-brand-primary/10'
                    : 'border-border-light bg-brand-surface hover:bg-hover'
                  }
                  ${isReadOnly ? 'cursor-default opacity-75' : 'cursor-pointer'}
                `}
              >
                <div className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                  ${isActive
                    ? 'bg-brand-primary border-brand-primary'
                    : 'border-border-light'
                  }
                `}>
                  {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-ui font-medium text-brand-text-primary truncate">
                    {(claim.description ?? '')}
                  </div>
                  <div className="text-ui-xs text-brand-text-muted truncate">
                    {claim.claimValue}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </XModalShell>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function XPermissionEditor({
  dataEndpoint,
  formData,
  onFormDataChange,
  isReadOnly,
  mode,
}: XPermissionEditorProps): JSX.Element {

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [availableApps, setAvailableApps] = useState<ApplicationWithClaims[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithClaims | null>(null);

  // ---------------------------------------------------------------------------
  // Derived: Current profile's app/claims from formData
  // ---------------------------------------------------------------------------

  const profileApps = useMemo((): ProfileApp[] => {
    const apps = formData['apps'] as ProfileApp[] | undefined;
    return apps || [];
  }, [formData]);

  // Build a map: applicationID → Set<claimID>
  const activeClaimsMap = useMemo((): Map<string, Set<number>> => {
    const map = new Map<string, Set<number>>();
    for (const app of profileApps) {
      const claimIDs = new Set(app.claims.map((c) => c.claimID));
      map.set(app.applicationID, claimIDs);
    }
    return map;
  }, [profileApps]);

  // ---------------------------------------------------------------------------
  // Load available applications + claims
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!dataEndpoint) return;

    let cancelled = false;
    setIsLoading(true);

    api.get<ApplicationWithClaims[]>(dataEndpoint)
      .then((data) => {
        if (!cancelled) setAvailableApps(data);
      })
      .catch((error) => {
        console.error('Error loading applications-claims:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [dataEndpoint]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateProfileApps = useCallback((pAppID: string, pNewClaimIDs: Set<number>) => {
    const app = availableApps.find((a) => a.id === pAppID);
    if (!app) return;

    // Build updated apps array
    const currentApps = [...profileApps];
    const existingIndex = currentApps.findIndex((a) => a.applicationID === pAppID);

    if (pNewClaimIDs.size === 0) {
      // Remove app entirely if no claims selected
      if (existingIndex >= 0)
        currentApps.splice(existingIndex, 1);
    } else {
      const newClaims: ProfileAppClaim[] = [];
      for (const claim of app.availableClaims) {
        if (pNewClaimIDs.has(claim.id))
          newClaims.push({
            id: '',
            claimID: claim.id,
            claimType: claim.claimType,
            claimValue: claim.claimValue,
            claimDescription: claim.description,
          });
      }

      const profileApp: ProfileApp = {
        id: existingIndex >= 0 ? currentApps[existingIndex].id : '',
        applicationID: pAppID,
        applicationName: app.name,
        applicationTitle: app.title,
        applicationIcon: app.icon,
        claims: newClaims,
      };

      if (existingIndex >= 0)
        currentApps[existingIndex] = profileApp;
      else
        currentApps.push(profileApp);
    }

    onFormDataChange('apps', currentApps);
  }, [profileApps, availableApps, onFormDataChange]);

  const handleToggleClaim = useCallback((pClaimID: number) => {
    if (!selectedApp) return;

    const currentClaims = activeClaimsMap.get(selectedApp.id) || new Set<number>();
    const newClaims = new Set(currentClaims);

    if (newClaims.has(pClaimID))
      newClaims.delete(pClaimID);
    else
      newClaims.add(pClaimID);

    updateProfileApps(selectedApp.id, newClaims);
  }, [selectedApp, activeClaimsMap, updateProfileApps]);

  const handleToggleAll = useCallback((pChecked: boolean) => {
    if (!selectedApp) return;

    const newClaims = new Set<number>();
    if (pChecked)
      for (const claim of selectedApp.availableClaims)
        newClaims.add(claim.id);

    updateProfileApps(selectedApp.id, newClaims);
  }, [selectedApp, updateProfileApps]);

  const handleOpenClaims = useCallback((pApp: ApplicationWithClaims) => {
    setSelectedApp(pApp);
  }, []);

  const handleCloseClaims = useCallback(() => {
    setSelectedApp(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
      </div>
    );

  if (availableApps.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-brand-text-muted">
        <Shield className="w-10 h-10 mb-3 opacity-40" />
        <span className="text-sm">{'Nenhuma aplicação disponível'}</span>
      </div>
    );

  return (
    <div className="p-4">
      {/* Applications Grid */}
      <div className="space-y-1">
        {availableApps.map((app) => {
          const appClaims = activeClaimsMap.get(app.id);
          const activeCount = appClaims?.size || 0;
          const totalCount = app.availableClaims.length;
          const hasAnyClaims = activeCount > 0;
          const IconComponent = getIconByName(app.icon);

          return (
            <div
              key={app.id}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border transition-all
                ${hasAnyClaims
                  ? 'border-brand-primary/30 bg-brand-primary/5'
                  : 'border-border-light bg-brand-surface hover:bg-hover'
                }
              `}
            >
              {/* App Icon */}
              <div className={`
                w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                ${hasAnyClaims ? 'bg-brand-primary/15 text-brand-primary' : 'bg-muted-bg text-brand-text-muted'}
              `}>
                {IconComponent
                  ? <IconComponent className="w-4.5 h-4.5" />
                  : <Shield className="w-4.5 h-4.5" />
                }
              </div>

              {/* App Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-brand-text-primary truncate">
                  {(app.title ?? '')}
                </div>
                <div className="text-xs text-brand-text-muted">
                  {activeCount > 0 ? (
                    <span className="text-brand-primary font-medium">
                      {`${activeCount} de ${totalCount}`}
                    </span>
                  ) : (
                    <span>{'Nenhuma permissão'}</span>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              {hasAnyClaims && (
                <ShieldCheck className="w-4 h-4 text-brand-primary flex-shrink-0 hidden sm:block" />
              )}

              {/* Settings Button */}
              <button
                type="button"
                onClick={() => handleOpenClaims(app)}
                className="p-2 rounded-lg hover:bg-hover transition-colors
                         min-w-[36px] min-h-[36px] flex items-center justify-center
                         text-brand-text-muted hover:text-brand-primary flex-shrink-0"
                title={'Gerenciar permissões'}
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Claims Modal */}
      {selectedApp && (
        <ClaimsModal
          isOpen={!!selectedApp}
          application={selectedApp}
          activeClaims={activeClaimsMap.get(selectedApp.id) || new Set<number>()}
          isReadOnly={isReadOnly || mode === XApplicationMode.Create}
          onToggleClaim={handleToggleClaim}
          onToggleAll={handleToggleAll}
          onClose={handleCloseClaims}
        />
      )}
    </div>
  );
}
