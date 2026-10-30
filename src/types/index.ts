export type { 
  User,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  AuthContextType 
} from './auth.types';

export type {
  MenuItem,
  MenuGroup,
  UserMenu,
} from './menu.types';

export type {
  SystemInfo,
  ApplicationInfo,
  OperatingSystemInfo,
  HardwareInfo,
  DatabaseInfo,
  ClientInfo,
} from './system.types';

// XModel Types - Template-Driven UI
export {
  XApplicationMode,
  XViewTemplate,
  XDataType,
  XFieldAlignment,
  XSortDirection,
  XButtonType,
  XButtonAction,
  XButtonColor,
  XButtonAlignment,
  XButtonBarPosition,
  XFilterLayout,
  XFilterLogicalOperator,
  XFilterOperator,
  XRowSelectionMode,
  XUIEditorType,
  XEstiloLinhaDemonstrativo,
  XUIEmphasis,
  XFormSectionLayout,
  XExportFormat,
  XExportOrientation,
  XExportPaperSize,
} from './xmodel.types';

export type {
  XModel,
  XLinhaDemonstrativo,
  XLookupItem,
  XLookupColumn,
  XFieldBinding,
  XButton,
  XButtonBar,
  XDataField,
  XUIEditorModel,
  XUIGridColumn,
  XUIGridPricing,
  XUIPickerSearchField,
  XDataEditor,
  XFormField,
  XVisibilityRule,
  XValueRule,
  XFormSection,
  XFormView,
  XFormPricing,
  XFilter,
  XPagination,
  XDataViewHeader,
  XDataViewRow,
  XDataView,
  XRowAction,
  XApplication,
  XApplicationViewer,
  XQueryFilterItem,
  XQuerySort,
  XQueryRequest,
  XQueryResponse,
  XFilterInfo,
  XSortInfo,
  XLookupSearchRequest,
  XLookupSearchResponse,
  XApplicationState,
  XExportColumn,
  XExportConfig,
  XExportRequest,
  XFormTab,
  XDetailGrid,
  XDetailGridColumn,
  XTabbedFormView,
} from './xmodel.types';

// Navegador (XViewTemplate.Navigator)
export type { XNavigatorItem, XNavigatorGroup, XNavigatorView } from './navigator.types';

// AppX — painel de trabalho (XViewTemplate.Workspace)
export { TOKEN_CONTEXTO, XWorkspaceContextSource, XWorkspaceTone } from './workspace.types';
export type {
  XWorkspaceSection,
  XWorkspaceView,
  XWorkspaceBreadcrumb,
  XWorkspaceLevel,
  XWorkspaceStatus,
  XWorkspaceHeader,
  XWorkspaceAttentionItem,
  XWorkspaceSummary,
  XWorkspaceContextOption,
  XWorkspaceStartItem,
} from './workspace.types';

// Re-export from contexts
export type { AppTab } from '@core/contexts';
