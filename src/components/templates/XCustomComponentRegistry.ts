/**
 * XCustomComponentRegistry — Central registry for custom content components.
 *
 * Maps component names (defined in backend XApplication.CustomComponentName)
 * to React components rendered inside Custom and Dashboard view templates.
 *
 * Usage:
 *   // Register (typically in the app's main.tsx or a dedicated setup file)
 *   XCustomComponentRegistry.register('AnnotationBoard', AnnotationBoard);
 *
 *   // Resolve (used internally by XCustomView and XDashboardView)
 *   const Component = XCustomComponentRegistry.resolve('AnnotationBoard');
 */

import type { ComponentType } from 'react';
import type { XApplication, XApplicationState, XFilterInfo, XSortInfo } from '@core/types';

// ============================================================================
// Custom Component Props — Standard contract for content-area components
// ============================================================================

/**
 * Props injected into every custom content component.
 * Components registered in the registry MUST accept this interface.
 */
export interface XCustomComponentProps {
  /** Full application model (access to dataView, formView, permissions, etc.) */
  application: XApplication;

  /** Current application state (mode, selection, filters, sorting, pagination). */
  state: XApplicationState;

  /** Active filters, pre-formatted for API consumption. */
  filters: XFilterInfo[];

  /** Active sorting, pre-formatted for API consumption. */
  sort: XSortInfo[];

  /** Tab identifier for scoped rendering (tour targets, z-index, etc.) */
  tabID: string;

  /** Portal target inside the filter action buttons area (before search button). */
  filterActionPortal?: HTMLDivElement | null;
}

// ============================================================================
// Registry
// ============================================================================

type CustomComponent = ComponentType<XCustomComponentProps>;

const _Registry = new Map<string, CustomComponent>();

export const XCustomComponentRegistry = {
  /**
   * Register a custom content component by name.
   * If a component with the same name already exists, it is replaced.
   */
  register(pName: string, pComponent: CustomComponent): void {
    _Registry.set(pName, pComponent);
  },

  /**
   * Resolve a registered component by name.
   * Returns `null` if no component is registered under the given name.
   */
  resolve(pName: string): CustomComponent | null {
    return _Registry.get(pName) ?? null;
  },

  /**
   * Check if a component is registered under the given name.
   */
  has(pName: string): boolean {
    return _Registry.has(pName);
  },

  /**
   * Remove a registered component by name.
   */
  unregister(pName: string): boolean {
    return _Registry.delete(pName);
  },

  /**
   * List all registered component names (useful for debugging).
   */
  names(): string[] {
    return Array.from(_Registry.keys());
  },
} as const;
