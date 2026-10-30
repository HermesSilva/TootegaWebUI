/**
 * Templates - Barrel Export
 * 
 * Exporta todos os componentes do sistema de templates Model-Driven UI.
 */

// Modal Shell (canonical responsive/contained modal container)
export { XModalShell } from './XModalShell';
export type { XModalShellProps, XModalShellSize, XModalShellVariant } from './XModalShell';

// Main View
export { XApplicationView } from './XApplicationView';
export type { XApplicationViewProps } from './XApplicationView';

// View Templates
export { XCustomView } from './XCustomView';
export type { XCustomViewProps } from './XCustomView';
export { XDashboardView } from './XDashboardView';
export type { XDashboardViewProps } from './XDashboardView';
export { XSingleFormView } from './XSingleFormView';
export type { XSingleFormViewProps } from './XSingleFormView';
export { XSettingsFormView } from './XSettingsFormView';
export type { XSettingsFormViewProps } from './XSettingsFormView';
export { XCardListView } from './XCardListView';
export type { XCardListViewProps } from './XCardListView';
export { XWorkspaceView, comContexto, chaveDoResumo } from './XWorkspaceView';
export type { XWorkspaceViewProps } from './XWorkspaceView';
export { XNavigatorView } from './XNavigatorView';
export type { XNavigatorViewProps } from './XNavigatorView';

// Custom Component Registry
export { XCustomComponentRegistry } from './XCustomComponentRegistry';
export type { XCustomComponentProps } from './XCustomComponentRegistry';

// Form-tab Custom Component Registry
export { XFormTabComponentRegistry } from './XFormTabComponentRegistry';
export type { XFormTabComponentProps } from './XFormTabComponentRegistry';

// Generic form-tab component: user → companies whitelist (access matrix)
export { AccessMatrixEditor } from './AccessMatrixEditor';
export { SelectionMatrixEditor } from './SelectionMatrixEditor';

// Generic form-tab component: member → roles (RBAC N:N)
export { RoleMatrixEditor } from './RoleMatrixEditor';

// Generic read-only form-tab: a role's permissions grouped by App (RBAC catalog view)
export { RolePermissionsView } from './RolePermissionsView';

// Certificate (A1) of the PLATFORM (SaaS-admin). The fiscal ones (person's certificate, batch upload,
// replace, SEFAZ authorizer endpoints) are the ERP's and live in its App since 2026-10-23.
export { PlatformCertificateUpload } from './PlatformCertificateUpload';

// Button-bar Custom Action Registry
export { XButtonActionRegistry } from './XButtonActionRegistry';
export type { XButtonActionComponentProps } from './XButtonActionRegistry';

export { XFieldEditorRegistry } from './XFieldEditorRegistry';

// MultiSelect editor (flags bitmask)
export { XMultiSelectEditor } from './editors/XMultiSelectEditor';

// Button Bar
export { XButtonBar } from './XButtonBar';

// Filter
export { XFilter } from './XFilter';

// Data View
export { XDataView } from './XDataView';
export { XDataViewHeader } from './XDataViewHeader';
export { XDataViewRow } from './XDataViewRow';

// Pagination
export { XPagination } from './XPagination';

// Editors
export { XEditor } from './editors/XEditor';
export type { XEditorProps } from './editors/XEditor';
export { XTextEditor } from './editors/XTextEditor';
export { XComboBoxEditor } from './editors/XComboBoxEditor';
export { XLookupEditor } from './editors/XLookupEditor';
export { XDocumentEditor } from './editors/XDocumentEditor';
export { XDateEditor } from './editors/XDateEditor';
export { XDateTimeEditor } from './editors/XDateTimeEditor';
export { XTimeEditor } from './editors/XTimeEditor';
export { XNumberEditor } from './editors/XNumberEditor';
export { XCurrencyEditor } from './editors/XCurrencyEditor';
export { XPercentEditor } from './editors/XPercentEditor';
export { XBooleanEditor } from './editors/XBooleanEditor';
export { XColorEditor } from './editors/XColorEditor';
export { XUrlEditor } from './editors/XUrlEditor';

// Form View
export { XFormView } from './XFormView';
export type { XFormViewProps } from './XFormView';
export { XFormModal } from './XFormModal';
export type { XFormModalProps } from './XFormModal';
export { XTabbedFormModal } from './XTabbedFormModal';
export type { XTabbedFormModalProps } from './XTabbedFormModal';

// Export Dialog
export { XExportDialog } from './XExportDialog';
export type { XExportDialogProps } from './XExportDialog';
