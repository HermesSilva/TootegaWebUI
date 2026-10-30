/**
 * XFieldEditorRegistry — registry for per-FIELD custom editor components.
 *
 * Lets a single form field opt into a bespoke renderer (e.g. an IP-address viewer
 * with a "list all" modal) without the framework's XEditor dispatch knowing about it.
 * A field references it via XUIEditorModel.customEditorName; XEditor resolves + renders
 * it in place, receiving the same XEditorProps as a built-in editor.
 *
 * Register in app setup (App main.tsx):
 *   XFieldEditorRegistry.register('StationIpAddressesEditor', StationIpAddressesEditor);
 */

import type { ComponentType } from 'react';
import type { XEditorProps } from './editors/XEditor';

type FieldEditorComponent = ComponentType<XEditorProps>;

const _Registry = new Map<string, FieldEditorComponent>();

export const XFieldEditorRegistry = {
  register(pName: string, pComponent: FieldEditorComponent): void {
    _Registry.set(pName, pComponent);
  },
  resolve(pName: string | null | undefined): FieldEditorComponent | null {
    return pName ? _Registry.get(pName) ?? null : null;
  },
  has(pName: string | null | undefined): boolean {
    return !!pName && _Registry.has(pName);
  },
  unregister(pName: string): boolean {
    return _Registry.delete(pName);
  },
} as const;
