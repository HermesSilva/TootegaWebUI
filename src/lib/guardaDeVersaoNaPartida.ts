/**
 * VERSIONAMENTO NA RAIZ (dono, 2026-10-22) — a aplicação ANTIGA nunca chega a rodar.
 *
 * O caso que motivou: quem abriu o app há semanas e voltou hoje recebeu o `index.html` e os JS antigos
 * (servidos pelo service worker, do cache dele). O código velho subiu, chamou a API nova e deu erro — e
 * a guarda que existia (`useVersionCheck`) mora DENTRO do bundle, então só agia depois do estrago.
 *
 * Esta guarda roda no `main.tsx` ANTES do React e antes de qualquer chamada ao back:
 *   1. pergunta ao servidor a versão publicada (`/version.json`, sem cache);
 *   2. igual à do código carregado ⇒ segue;
 *   3. diferente ⇒ desregistra o service worker, apaga os caches do navegador e recarrega pedindo a
 *      versão nova — o código antigo para aqui;
 *   4. uma tentativa por versão (marca na sessão): se a recarga ainda entregar o código velho (cache de
 *      borda), não entra em laço — segue, e o `useVersionCheck` continua de olho.
 * Sem rede ou sem resposta em `TEMPO_MAXIMO_MS`, segue: a guarda nunca impede o app de abrir.
 */

/** Marca, na sessão, da versão que a última recarga da partida tentou alcançar. */
const MARCA_DA_TENTATIVA = 'Tootega-partida-versao';

/** Marca da recarga por arquivo ausente (camada C). */
const MARCA_ARQUIVO_AUSENTE = 'Tootega-partida-arquivo-ausente';

/** O parâmetro que a recarga põe na URL para furar qualquer cache intermediário. */
const PARAMETRO_DA_RECARGA = 'v';

/** Quanto se espera pelo `/version.json` antes de seguir sem ele. */
export const TEMPO_MAXIMO_MS = 1500;

export type DesfechoDaPartida = 'segue' | 'recarregando';

/** O que a guarda usa do navegador — injetável para teste. */
export interface AmbienteDaPartida {
  buscarVersaoPublicada: () => Promise<string | null>;
  sessao: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  descartarCopiasLocais: () => Promise<void>;
  recarregar: (pVersao: string) => void;
  limparParametroDaRecarga: () => void;
}

/**
 * Confere a versão antes de a aplicação subir. Devolve `'recarregando'` quando a página já está indo
 * buscar a versão nova — quem chamou NÃO deve montar o React.
 */
export async function garantirVersaoNaPartida(
  pVersaoDoCodigo: string, pAmbiente: AmbienteDaPartida = ambienteDoNavegador(),
): Promise<DesfechoDaPartida> {
  const publicada = await pAmbiente.buscarVersaoPublicada().catch(() => null);

  // Sem resposta (offline, servidor reiniciando): segue. Abrir com o que há é melhor que não abrir.
  if (!publicada)
    return 'segue';

  if (publicada === pVersaoDoCodigo) {
    pAmbiente.sessao.removeItem(MARCA_DA_TENTATIVA);
    pAmbiente.limparParametroDaRecarga();
    return 'segue';
  }

  // Já recarregamos mirando esta versão e o código velho voltou: não insiste (evita laço).
  if (pAmbiente.sessao.getItem(MARCA_DA_TENTATIVA) === publicada) {
    console.warn(`[Partida] O servidor publica ${publicada}, mas a recarga entregou ${pVersaoDoCodigo}. Sigo sem insistir.`);
    return 'segue';
  }

  pAmbiente.sessao.setItem(MARCA_DA_TENTATIVA, publicada);
  await pAmbiente.descartarCopiasLocais();
  pAmbiente.recarregar(publicada);
  return 'recarregando';
}

/**
 * CAMADA C — arquivo que não existe mais. Se uma página velha pedir um pedaço do código (chunk) que o
 * deploy já removeu do servidor, o Vite dispara `vite:preloadError`. Recarrega UMA vez por sessão, em vez
 * de deixar a tela quebrada com "Failed to fetch dynamically imported module".
 */
export function instalarRecargaPorArquivoAusente(): void {
  window.addEventListener('vite:preloadError', (pEvento) => {
    try {
      if (sessionStorage.getItem(MARCA_ARQUIVO_AUSENTE))
        return;
      sessionStorage.setItem(MARCA_ARQUIVO_AUSENTE, '1');
    } catch { /* sem sessão, recarrega assim mesmo */ }

    pEvento.preventDefault();
    window.location.reload();
  });
}

// ---- o navegador de verdade ----------------------------------------------------------------------

function ambienteDoNavegador(): AmbienteDaPartida {
  return {
    buscarVersaoPublicada: async () => {
      const controle = new AbortController();
      const relogio = setTimeout(() => controle.abort(), TEMPO_MAXIMO_MS);
      try {
        const resposta = await fetch(`/version.json?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store' },
          signal: controle.signal,
        });
        if (!resposta.ok)
          return null;
        const { version } = (await resposta.json()) as { version?: string };
        return version?.trim() || null;
      } finally {
        clearTimeout(relogio);
      }
    },
    sessao: sessaoSegura(),
    descartarCopiasLocais: async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registros = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registros.map((pR) => pR.unregister()));
        }
        if (typeof caches !== 'undefined') {
          const nomes = await caches.keys();
          await Promise.all(nomes.map((pNome) => caches.delete(pNome)));
        }
      } catch (pErro) {
        console.warn('[Partida] Não consegui descartar as cópias locais:', pErro);
      }
    },
    recarregar: (pVersao) => {
      const url = new URL(window.location.href);
      url.searchParams.set(PARAMETRO_DA_RECARGA, pVersao);
      window.location.replace(url.toString());
    },
    limparParametroDaRecarga: () => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(PARAMETRO_DA_RECARGA))
        return;
      url.searchParams.delete(PARAMETRO_DA_RECARGA);
      window.history.replaceState(window.history.state, '', url.toString());
    },
  };
}

/** sessionStorage que não lança (modo privado, armazenamento cheio). */
function sessaoSegura(): AmbienteDaPartida['sessao'] {
  return {
    getItem: (pChave) => { try { return sessionStorage.getItem(pChave); } catch { return null; } },
    setItem: (pChave, pValor) => { try { sessionStorage.setItem(pChave, pValor); } catch { /* sem marca */ } },
    removeItem: (pChave) => { try { sessionStorage.removeItem(pChave); } catch { /* nada */ } },
  };
}
