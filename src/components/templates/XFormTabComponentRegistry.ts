/**
 * XFormTabComponentRegistry — registry for custom components rendered inside a
 * tabbed-form tab (XFormTab.customComponentName).
 *
 * Distinct from XCustomComponentRegistry (content-area views): form-tab components
 * edit a slice of the form's data and report changes back, so the parent save sends
 * the whole aggregate in one request. Used e.g. by the client-company child tabs
 * (addresses / contacts / CNAEs / certificates).
 *
 * Register in the app setup (e.g. App main.tsx):
 *   XFormTabComponentRegistry.register('LegalEntityAddressesEditor', LegalEntityAddressesEditor);
 */

import type { ComponentType } from 'react';
import type { XFormTab } from '@core/types';

/**
 * Props injected into every form-tab custom component.
 */
export interface XFormTabComponentProps {
  /** The full form data record (all fields + nested collections). */
  formData: Record<string, unknown>;

  /** Update a field/collection on the form data. Triggers the parent's dirty state. */
  onFormDataChange: (pFieldName: string, pValue: unknown) => void;

  /** Whether the form is read-only (Detail mode). */
  isReadOnly: boolean;

  /** Current form mode (Create/Edit/Detail) as the raw enum value. */
  mode: number;

  /** The tab model — data-driven endpoints (dataEndpoint / lookupEndpoint) live here (CE-19). */
  tab: XFormTab;

  /**
   * Recarrega o registro do formulário a partir do back (o mesmo GET que o abriu).
   *
   * Existe porque uma aba pode disparar uma operação que o BACK usa para alterar campos de OUTRAS
   * abas — e aí o formulário em memória fica velho sem que nada o denuncie. O caso que a motivou
   * (dono, 2026-09-17): subir o certificado faz o back consultar a Secretaria da Fazenda e gravar a
   * Inscrição Estadual na aba Empresa. O formulário, que havia carregado a inscrição VAZIA, seguia
   * exibindo o vazio e o Salvar a reescrevia por cima — a correta era apagada pelo estado obsoleto
   * da tela, e a tela ainda parecia certa.
   *
   * Chamar DEPOIS de a operação concluir. Sem efeito no modo Criação (não há registro a reler) e
   * quando a App não declara `loadEndpoint`.
   */
  onReloadForm?: () => void | Promise<void>;
}

type FormTabComponent = ComponentType<XFormTabComponentProps>;

const _Registry = new Map<string, FormTabComponent>();

export const XFormTabComponentRegistry = {
  register(pName: string, pComponent: FormTabComponent): void {
    _Registry.set(pName, pComponent);
  },
  resolve(pName: string): FormTabComponent | null {
    return _Registry.get(pName) ?? null;
  },
  has(pName: string): boolean {
    return _Registry.has(pName);
  },
  unregister(pName: string): boolean {
    return _Registry.delete(pName);
  },
  names(): string[] {
    return Array.from(_Registry.keys());
  },
} as const;
