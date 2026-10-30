export { useAuth } from './useAuth';
export { useInbox, type MensagemInbox } from './useInbox';
export { useDevice } from './useDevice';
export { useTheme } from './useTheme';
export { useDashboardStats, useApiQuery, dashboardKeys } from './useQueries';
export type { DashboardStats } from './useQueries';
export { useUserMenu, menuKeys } from './useMenu';
export { useSidebar } from './useSidebar';
export { useTabs } from './useTabs';
export { useError } from './useError';
export { useCompany } from './useCompany';
export { useFormBusy } from './useFormBusy';
export { useVersionCheck } from './useVersionCheck';
export { usePWA } from './usePWA';
export { usePreferenciaDoUsuario } from './usePreferenciaDoUsuario';
export { usePaineisAoEntrar, chaveDosPaineisAoEntrar } from './usePaineisAoEntrar';

// Application Hooks - Template-Driven UI
export {
  useApplication,
  useApplicationByName,
  useApplicationData,
  useLookupSearch,
  useApplicationCreate,
  useApplicationUpdate,
  useApplicationDelete,
  applicationKeys,
} from './useApplication';

// Site Config - Branding (name/title/description) + initial page, from backend appsettings
export { useSiteConfig } from './useSiteConfig';
export type { SiteConfig, InitialPage } from './useSiteConfig';

// Seletor de arquivos que também avisa quando o usuário CANCELA (o `<input type="file">` não avisa)
export { useSeletorDeArquivo } from './useSeletorDeArquivo';
export { useMolduraDeModal, chaveDoQuadroDoFormulario } from './useMolduraDeModal';
export type { MolduraDeModal, OpcoesMolduraDeModal, QuadroDeModal } from './useMolduraDeModal';
export type { SeletorDeArquivo, OpcoesSeletorDeArquivo } from './useSeletorDeArquivo';
export { useAppX } from './useAppX';
