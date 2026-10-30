/**
 * useSiteConfig
 *
 * Fetches the application branding from the backend (GET /api/sys/site, anonymous)
 * and applies it on boot:
 *   - sets document.title from the configured title (browser tab / PWA).
 *
 * The initial page (landing | home | login) is exposed so the "/" route renders the
 * configured page. Renaming the app or changing the landing requires editing only the
 * backend appsettings (SYS:Aplicacao) — no back or front code change.
 *
 * Backend contract — GET /api/sys/site (anonymous):
 *   { "nome": "Tootega", "titulo": "Tootega App", "descricao": "...", "paginaInicial": "landing" }
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@core/lib/api';

export type InitialPage = 'landing' | 'home' | 'login';

export interface SiteConfig {
  nome: string;
  titulo: string;
  descricao: string;
  paginaInicial: InitialPage;
  /** Se o auto-cadastro público exige o passo "empresa" (razão social + CNPJ + endereço). */
  pedeEmpresa: boolean;
  /**
   * Com o passo "empresa" ligado, se ele pede o documento (CPF). Default do back = true; false (o ANVIL)
   * = o passo pede nome, telefone e endereço, e a chave do assinante é o e-mail.
   */
  pedeDocumento: boolean;
}

// Used until the backend responds and if the request fails — never blocks boot. NEUTRO (dono, 2026-10-23):
// a plataforma não carrega marca de produto; o nome de cada SaaS vem do back (SYS:Aplicacao:Nome).
const FallbackConfig: SiteConfig = {
  nome: 'Tootega',
  titulo: 'Tootega',
  descricao: '',
  paginaInicial: 'landing',
  pedeEmpresa: false,
  pedeDocumento: true
};

const CACHE_KEY = 'siteConfig.cache';

/**
 * Aplica o branding do assinante ao título da aba.
 *
 * O nome e a descrição vêm do back (white-label por assinante) e são um texto só, em pt-BR — o
 * produto fala uma língua (dono, 2026-08-03).
 */
function applyConfig(pConfig: SiteConfig): void {
  if (pConfig.titulo)
    document.title = pConfig.titulo;
}

/** Read a cached config synchronously on boot, applying it. Never throws. */
function readCachedConfig(): SiteConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as SiteConfig;
    applyConfig(cfg);
    return cfg;
  } catch {
    return null;
  }
}

export function useSiteConfig(): { config: SiteConfig; isReady: boolean; error: unknown } {
  // Hydrate branding from cache synchronously so warm loads never wait on the backend.
  const [cached] = useState<SiteConfig | null>(() => readCachedConfig());
  const [applied, setApplied] = useState<boolean>(() => cached !== null);

  const query = useQuery<SiteConfig>({
    queryKey: ['siteConfig'],
    queryFn: async ({ signal }) => {
      return await api.get<SiteConfig>('/sys/site', signal);
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1
  });

  useEffect(() => {
    // On failure, brand with the fallback (or cache) rather than blocking the app.
    if (query.isError) {
      if (!cached)
        applyConfig(FallbackConfig);
      setApplied(true);
      return;
    }
    if (!query.data) return;

    applyConfig(query.data);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(query.data));
    } catch { /* storage full/unavailable — cache is best-effort */ }

    setApplied(true);
  }, [query.data, query.isError]);

  return { config: query.data ?? cached ?? FallbackConfig, isReady: applied, error: query.error };
}
