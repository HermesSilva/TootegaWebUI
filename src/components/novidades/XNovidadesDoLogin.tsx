/**
 * XNovidadesDoLogin — mostra as NOVIDADES DA VERSÃO depois do login (dono, 2026-10-25). A casca de cada SaaS o
 * monta uma vez; ele decide sozinho quando aparecer:
 *
 * - só com usuário autenticado e empresa escolhida — não disputa a tela com o seletor de empresa;
 * - uma vez por LOGIN: navegar não o reabre, mas sair e entrar de novo, sim. A marca "já mostrei" vive no
 *   sessionStorage, é gravada só DEPOIS de o servidor responder (falha transitória tenta de novo no próximo login)
 *   e é apagada no fim da sessão, pelo `AuthContext` (`lib/marcaDeNovidades`) (dono, 2026-10-25: gravada antes da resposta e nunca apagada, uma falha num login deixava
 *   a aba sem novidades para sempre — inclusive depois de sair e entrar de novo);
 * - só se houver versão MAIS NOVA que a última que o usuário marcou como vista ("Não mostrar novamente"). A
 *   última vista é preferência do PERFIL (`novidades.vista`), então vale em qualquer navegador; o pedido espera o
 *   perfil responder, para não mostrar o que ele já dispensou.
 *
 * Novidade é conforto: falha ao buscá-las não mostra diálogo de erro (o pedido é silencioso) — fica no console
 * com o motivo, e o login segue.
 */

import { useEffect, useState, type JSX } from 'react';

import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { useAuth } from '@core/hooks/useAuth';
import { useCompany } from '@core/hooks/useCompany';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';
import { chaveDasNovidadesMostradas } from '@core/lib/marcaDeNovidades';
import { XNovidadesModal } from './XNovidadesModal';
import type { ResumoDeNotaDeVersao } from './tiposDeNovidades';

/** Preferência do perfil: a versão mais nova que o usuário marcou como vista. */
export const PREFERENCIA_NOVIDADES_VISTA = 'novidades.vista';

export function XNovidadesDoLogin(): JSX.Element | null {
  const { isAuthenticated, user } = useAuth();
  const { company, mustSelect, isSelectorOpen } = useCompany();
  const [vista, gravarVista, perfilRespondeu] = usePreferenciaDoUsuario<string | null>(PREFERENCIA_NOVIDADES_VISTA, null);
  const [versoes, setVersoes] = useState<ResumoDeNotaDeVersao[] | null>(null);

  const pronto = isAuthenticated && !!company && !mustSelect && !isSelectorOpen && perfilRespondeu;
  const chave = chaveDasNovidadesMostradas(user?.id ?? '');

  useEffect(() => {
    if (!pronto || sessionStorage.getItem(chave))
      return;

    const abortar = new AbortController();
    const desde = vista ? `?desde=${encodeURIComponent(vista)}` : '';
    api.get<ResumoDeNotaDeVersao[]>(`/sys/novidades${desde}`, abortar.signal, true)
      .then((pLista) => {
        // Só agora: o servidor respondeu (com ou sem novidade). Falhou ⇒ sem marca, e o próximo login tenta de novo.
        sessionStorage.setItem(chave, '1');
        if (pLista && pLista.length > 0)
          setVersoes(pLista);
      })
      .catch((pErro) => {
        if (!abortar.signal.aborted)
          console.warn(`Novidades da versão: ${mensagemDeFalha(pErro, 'buscar as novidades da versão no login')}`);
      });
    return () => abortar.abort();
  }, [pronto, chave, vista]);

  if (!versoes)
    return null;

  return (
    <XNovidadesModal
      modo="login"
      versoes={versoes}
      onFechar={(pNaoMostrarMais) => {
        // Marcada, a mais nova MOSTRADA vira a última vista: só uma versão acima dela traz o modal de volta.
        if (pNaoMostrarMais)
          gravarVista(versoes[0].versao);
        setVersoes(null);
      }}
    />
  );
}
