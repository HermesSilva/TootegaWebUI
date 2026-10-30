import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@core/contexts';
import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';

/**
 * Uma preferência do usuário, lembrada no PERFIL (dono, 2026-10-18): posição do painel da Jaci, posição e
 * tamanho da janela de ajuda, e o que mais a tela quiser lembrar por pessoa. Vive em
 * `SYSxUsuarioPreferencia` (chave/valor JSON) pela rota `api/sys/profile/preferencias/{chave}`.
 *
 * Leve por desenho: o valor nasce do `localStorage` (cache local, sem esperar a rede), o servidor o
 * substitui quando responde, e cada gravação espera o usuário parar de mexer (700 ms) antes de um único
 * PUT. Sem sessão (tela de entrada), fica só no navegador — e nada falha por isso.
 */

const ROTA = '/sys/profile/preferencias';
const ATRASO_DA_GRAVACAO_MS = 700;

interface PreferenciaDTO { chave: string; valor: string }

function chaveLocal(pChave: string): string {
  return `preferencia:${pChave}`;
}

function lerLocal<T>(pChave: string): T | undefined {
  try {
    const bruto = localStorage.getItem(chaveLocal(pChave));
    return bruto === null ? undefined : (JSON.parse(bruto) as T);
  } catch {
    return undefined;
  }
}

function gravarLocal<T>(pChave: string, pValor: T): void {
  try {
    localStorage.setItem(chaveLocal(pChave), JSON.stringify(pValor));
  } catch {
    // Navegador sem armazenamento (modo privado restrito): a preferência vive só na sessão da página.
  }
}

/**
 * @returns `[valor, gravar, carregadaDoServidor]` — `carregadaDoServidor` vira `true` quando o perfil respondeu
 * (com valor ou sem), para quem precisa distinguir "ainda não sei" de "o usuário nunca gravou".
 */
export function usePreferenciaDoUsuario<T>(pChave: string, pPadrao: T): [T, (pValor: T) => void, boolean] {
  const autenticado = !!useContext(AuthContext)?.isAuthenticated;
  const [valor, setValor] = useState<T>(() => lerLocal<T>(pChave) ?? pPadrao);
  const [carregada, setCarregada] = useState(!autenticado);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autenticado)
      return;
    const abortar = new AbortController();
    api.get<PreferenciaDTO | null>(`${ROTA}/${encodeURIComponent(pChave)}`, abortar.signal, true)
      .then((pPreferencia) => {
        if (pPreferencia?.valor) {
          const doServidor = JSON.parse(pPreferencia.valor) as T;
          gravarLocal(pChave, doServidor);
          setValor(doServidor);
        }
        setCarregada(true);
      })
      .catch((pErro) => {
        if (abortar.signal.aborted)
          return;
        // Preferência é conforto, não dado: a falha fica no console com o motivo, e a tela segue com o local.
        console.warn(`Preferência "${pChave}": ${mensagemDeFalha(pErro, 'ler a preferência do perfil')}`);
        setCarregada(true);
      });
    return () => abortar.abort();
  }, [pChave, autenticado]);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const gravar = useCallback((pValor: T) => {
    setValor(pValor);
    gravarLocal(pChave, pValor);
    if (!autenticado)
      return;
    if (temporizador.current)
      clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      api.put<unknown, T>(`${ROTA}/${encodeURIComponent(pChave)}`, pValor)
        .catch((pErro) => console.warn(`Preferência "${pChave}": ${mensagemDeFalha(pErro, 'gravar a preferência no perfil')}`));
    }, ATRASO_DA_GRAVACAO_MS);
  }, [pChave, autenticado]);

  return [valor, gravar, carregada];
}
