/**
 * useVersionCheck — guarda de versão da aplicação.
 *
 * Depois de um deploy, nenhuma aba pode continuar rodando o código antigo. São DUAS perguntas
 * diferentes, e o hook faz as duas:
 *
 *   1. **O bundle que acabou de carregar é o mesmo de antes?** Compara `__BUILD_VERSION__` (embutido
 *      no bundle) com o que ficou no `localStorage`. Mudou ⇒ os caches locais gravados pela versão
 *      anterior podem estar fora de forma: apaga-os e recarrega.
 *   2. **O servidor já tem versão mais nova que a minha?** Busca `/version.json` com `no-store`.
 *      Esta é a pergunta que a primeira NÃO responde: uma aba aberta durante o deploy segue com o
 *      bundle antigo em memória, e comparar a constante dele com ela mesma nunca acusa nada — o
 *      relógio girava para sempre sem detectar deploy algum.
 *
 * O `version.json` é emitido pelo Vite (plugin `emit-version-json`) e servido sem cache pelo nginx.
 * A versão vem do CD, com o SHA do commit, e por isso é única por deploy.
 */

import { useEffect, useRef } from 'react';

// Provided by Vite define in each consuming project's vite.config.ts
declare const __BUILD_VERSION__: string;

const BUILD_VERSION = __BUILD_VERSION__;

const VERSION_STORAGE_KEY = 'Tootega-app-version';
const CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds

/** Carimbo da versão publicada. Estático, sem cache, e não depende do back estar de pé. */
const VERSION_ENDPOINT = '/version.json';

/**
 * Marca de que JÁ se recarregou por causa desta versão do servidor. Vive na sessão da aba.
 *
 * Sem ela, um servidor que anuncie uma versão que o bundle entregue não confirma — proxy à frente
 * servindo `index.html` velho, camada de CDN atrasada — poria a aba num CICLO de recargas, que é
 * pior que o cache preso: o usuário perde o que está digitando, repetidamente. Uma tentativa por
 * versão anunciada; falhou, o hook desiste e registra no console.
 */
const RELOAD_ATTEMPT_KEY = 'Tootega-app-version-reload';

/**
 * Checks if the current build version matches the stored version.
 * If versions differ, forces a hard reload to get the latest assets.
 */
export function useVersionCheck(): void {
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Check version on mount
    function checkVersion(): void {
      try {
        const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
        
        // First visit - store the version
        if (!storedVersion) {
          localStorage.setItem(VERSION_STORAGE_KEY, BUILD_VERSION);
          return;
        }

        // Version changed - force hard reload
        if (storedVersion !== BUILD_VERSION) {
          // Já recarregamos MIRANDO outra versão e voltamos neste mesmo bundle: o servidor anuncia
          // uma coisa e entrega outra (cache de borda, proxy atrasado). Recarregar de novo só
          // repetiria o passeio, e cada volta custa o que o usuário estava digitando. Sincroniza o
          // registro, limpa o que era da versão anterior e para por aqui.
          const alvoTentado = lerTentativa();

          if (alvoTentado && alvoTentado !== BUILD_VERSION) {
            console.warn(
              `[VersionCheck] Recarreguei mirando ${alvoTentado} e continuo em ${BUILD_VERSION}. `
              + 'Não insisto — provável cache de borda servindo o index.html antigo.');
            localStorage.setItem(VERSION_STORAGE_KEY, BUILD_VERSION);
            clearStaleCache();
            return;
          }

          console.log(`[VersionCheck] Version changed: ${storedVersion} → ${BUILD_VERSION}`);

          // Update stored version first to prevent reload loop
          localStorage.setItem(VERSION_STORAGE_KEY, BUILD_VERSION);

          // Clear any cached data that might be stale
          clearStaleCache();

          // OS CACHES DO NAVEGADOR TAMBÉM. `clearStaleCache` mexe só no localStorage; quem descarta o
          // Cache Storage e promove o service worker em espera é o `descartarCachesDoNavegador`, e só
          // o OUTRO caminho (versão anunciada pelo servidor) o chamava. Aqui a página recarregava com
          // o precache antigo intacto — o sintoma clássico de "limpei o cache e continua velho",
          // justamente o que a função existe para evitar.
          //
          // DISPARA SEM AGUARDAR, e o reload segue no mesmo passo. Aguardar seria o instinto, mas
          // atrasaria o recarregamento por uma limpeza que pode demorar (ou nunca resolver, se o
          // service worker estiver preso) — e recarregar é o que devolve a tela ao usuário. O que se
          // ganha com o disparo já é o essencial: `caches.delete` e `skipWaiting` são registrados
          // ANTES de a navegação começar, e o navegador os conclui mesmo com a página saindo. Se a
          // limpeza perder a corrida, o pior caso é o de hoje — uma recarga a mais —, nunca uma tela
          // travada esperando.
          void descartarCachesDoNavegador();

          // Force hard reload (bypass cache)
          window.location.reload();
        }
      } catch (err) {
        console.warn('[VersionCheck] Error checking version:', err);
      }
    }

    // Pergunta 2 — o servidor já publicou versão mais nova? É a única que enxerga um deploy
    // acontecido DEPOIS de esta aba carregar. `cache: 'no-store'` para o próprio navegador não
    // responder do cache aquilo que existe justamente para desmenti-lo.
    let cancelado = false;

    async function verificarNoServidor(): Promise<void> {
      try {
        const resposta = await fetch(`${VERSION_ENDPOINT}?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store' },
        });

        if (!resposta.ok || cancelado)
          return;

        const { version } = (await resposta.json()) as { version?: string };

        if (cancelado || !version || version === BUILD_VERSION)
          return;

        // Uma tentativa por versão anunciada — ver RELOAD_ATTEMPT_KEY.
        if (lerTentativa() === version) {
          console.warn(
            `[VersionCheck] O servidor anuncia ${version}, mas o recarregamento continuou entregando `
            + `${BUILD_VERSION}. Não insisto (evita laço de recargas) — provável cache de borda.`);
          return;
        }

        console.log(`[VersionCheck] Nova versão publicada: ${BUILD_VERSION} → ${version}`);
        gravarTentativa(version);
        localStorage.setItem(VERSION_STORAGE_KEY, version);

        clearStaleCache();
        await descartarCachesDoNavegador();

        window.location.reload();
      } catch {
        // Rede fora, servidor reiniciando, arquivo ausente: a próxima rodada tenta de novo. Guarda
        // de versão nunca pode derrubar a tela.
      }
    }

    function verificar(): void {
      checkVersion();
      void verificarNoServidor();
    }

    // Initial check on mount
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      verificar();
    }

    // Periodic check in case app stays open during deployment
    const interval = setInterval(verificar, CHECK_INTERVAL_MS);

    // Also check when tab becomes visible again
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'visible')
        verificar();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelado = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

/** Versão que a última recarga tentou alcançar. `sessionStorage` indisponível ⇒ sem marca. */
function lerTentativa(): string {
  try {
    return sessionStorage.getItem(RELOAD_ATTEMPT_KEY) ?? '';
  } catch {
    return '';
  }
}

function gravarTentativa(pVersao: string): void {
  try {
    sessionStorage.setItem(RELOAD_ATTEMPT_KEY, pVersao);
  } catch { /* modo privado/armazenamento cheio: sem marca, e o guarda simplesmente não age */ }
}

/**
 * Descarta o que o NAVEGADOR guarda por conta própria: o Cache Storage (onde mora o app shell do
 * service worker) e o service worker em espera.
 *
 * Sem isto, o `reload` volta a ser atendido pelo próprio service worker, que serve o `index.html`
 * antigo do precache — a página recarrega e nada muda, que é o sintoma clássico de "limpei o cache
 * e continua velho". `skipWaiting` promove o worker novo já instalado em vez de esperar todas as
 * abas fecharem.
 */
async function descartarCachesDoNavegador(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((pNome) => caches.delete(pNome)));
    }

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();

      for (const registro of registros) {
        registro.waiting?.postMessage({ type: 'SKIP_WAITING' });
        await registro.update().catch(() => undefined);
      }
    }
  } catch (pErro) {
    console.warn('[VersionCheck] Não consegui descartar os caches do navegador:', pErro);
  }
}

/**
 * Clears potentially stale cached data after version change.
 */
function clearStaleCache(): void {
  try {
    // Clear tour completion status (in case tour steps changed)
    const keysToPreserve = [VERSION_STORAGE_KEY, 'Tootega-auth-state'];
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('Tootega-') && !keysToPreserve.includes(key))
        keysToRemove.push(key);
    }
    
    keysToRemove.forEach((key) => {
      console.log(`[VersionCheck] Clearing stale cache: ${key}`);
      localStorage.removeItem(key);
    });
  } catch (err) {
    console.warn('[VersionCheck] Error clearing cache:', err);
  }
}

/**
 * Utility to force clear all cache and reload.
 * Can be called manually from browser console: clearCacheAndReload()
 */
(window as unknown as Record<string, unknown>).clearCacheAndReload = function (): void {
  console.log('[VersionCheck] Force clearing all cache...');
  
  try {
    // Clear localStorage
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key)
        keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear caches if available
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    
    console.log('[VersionCheck] Cache cleared, reloading...');
    
    // Hard reload
    window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
  } catch (err) {
    console.error('[VersionCheck] Error during cache clear:', err);
    window.location.reload();
  }
};
