/**
 * XButtonActionRegistry — registry for custom button-bar actions (XButton.actionCommand
 * with XButtonAction.Custom). Lets an app attach a flow to a toolbar button without the
 * framework knowing about it.
 *
 * A registered entry is a React component mounted by XApplicationView when its button is
 * clicked. It collects whatever it needs (e.g. a PFX upload) then calls onComplete with
 * the initial data to open the Create form prefilled — or onCancel to dismiss.
 *
 * Register in app setup (e.g. App main.tsx):
 *   XButtonActionRegistry.register('createFromCertificate', CreateCompanyFromCertificate);
 */

import type { ComponentType } from 'react';
import type { XApplication } from '@core/types';

export interface XButtonActionComponentProps {
  /** Dismiss and open the Create form prefilled with this data. */
  onComplete: (pInitialData: Record<string, unknown>) => void;
  /** Dismiss without opening the form. */
  onCancel: () => void;
  /** Dismiss and refresh the grid (for self-saving actions that don't open the Create form). */
  onDone?: () => void;
  /** The currently selected row (single-selection actions), or null. */
  selectedRow?: Record<string, unknown> | null;
  /** The application model — data-driven endpoints (apiBaseURL) live here (CE-19). */
  application: XApplication;
}

type ButtonActionComponent = ComponentType<XButtonActionComponentProps>;

const _Registry = new Map<string, ButtonActionComponent>();

export const XButtonActionRegistry = {
  register(pCommand: string, pComponent: ButtonActionComponent): void {
    _Registry.set(pCommand, pComponent);
  },
  resolve(pCommand: string | null | undefined): ButtonActionComponent | null {
    return pCommand ? _Registry.get(pCommand) ?? null : null;
  },
  has(pCommand: string | null | undefined): boolean {
    return !!pCommand && _Registry.has(pCommand);
  },
  unregister(pCommand: string): boolean {
    return _Registry.delete(pCommand);
  },
} as const;
