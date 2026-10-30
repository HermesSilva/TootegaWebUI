/**
 * XNovidadesModal — as NOVIDADES DA VERSÃO (dono, 2026-10-25), em dois modos:
 *
 * - **login**: as versões que o usuário ainda não viu (já buscadas por quem abre), da mais nova para a mais
 *   velha, com a caixa "Não mostrar novamente" — marcada, a versão mais nova mostrada vira a "última vista", e o
 *   modal só volta quando sair uma mais nova;
 * - **histórico** (atalho em Informações do sistema): todas as versões, com busca, sem a caixa.
 *
 * Cada nota vem do servidor já renderizada com o pipeline do manual, no recorte do menu do usuário. Link da
 * ajuda dentro dela abre a janela de trecho (navegação completa, sem sair do sistema); link externo, nova aba.
 *
 * É diálogo DA CASCA (nenhum App o acionou: nasce do login ou de Informações do sistema) — o único tipo que pode
 * cobrir a página (`overlay`, declarado na OVERLAY_ALLOWLIST do guarda de contenção). Fecha só pelo botão.
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Bug, ExternalLink, Loader2, Search, Sparkles, TrendingUp } from 'lucide-react';

import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { CLOSE_BUTTON_STYLE } from '@core/lib';
import { XModalShell } from '../templates/XModalShell';
import { XJanelaDeTrecho, CLASSE_DO_CORPO_DA_AJUDA } from '../ajuda/XJanelaDeTrecho';
import type { NotaDeVersaoRenderizada, ResumoDeNotaDeVersao } from './tiposDeNovidades';

export interface XNovidadesModalProps {
  modo: 'login' | 'historico';
  /** No modo login: as versões ainda não vistas, já buscadas. No histórico, o modal busca todas. */
  versoes?: ResumoDeNotaDeVersao[];
  /** Fechou. `naoMostrarMais` só é verdadeiro no modo login, com a caixa marcada. */
  onFechar: (pNaoMostrarMais: boolean) => void;
}

const MANUAL = '/manual/index.html';

/** `AAAA-MM-DD` ⇒ `DD/MM/AAAA`, sem passar por Date: meia-noite UTC viraria o dia anterior no fuso do Brasil. */
export function dataDaNota(pISO: string): string {
  const [ano, mes, dia] = pISO.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : pISO;
}

const SELO: Record<string, { icone: JSX.Element; classe: string }> = {
  novidade: { icone: <Sparkles className="w-3.5 h-3.5" />, classe: 'bg-brand-primary/15 text-brand-primary ring-brand-primary/30' },
  melhoria: { icone: <TrendingUp className="w-3.5 h-3.5" />, classe: 'bg-success/15 text-success ring-success/30' },
  correcao: { icone: <Bug className="w-3.5 h-3.5" />, classe: 'bg-warning/15 text-warning ring-warning/30' },
};

export function XNovidadesModal({ modo, versoes: versoesIniciais, onFechar }: XNovidadesModalProps): JSX.Element {
  const [versoes, setVersoes] = useState<ResumoDeNotaDeVersao[] | null>(modo === 'login' ? (versoesIniciais ?? []) : null);
  const [falhaDaLista, setFalhaDaLista] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(versoesIniciais?.[0]?.versao ?? null);
  const [notas, setNotas] = useState<Record<string, NotaDeVersaoRenderizada>>({});
  const [falhaDaNota, setFalhaDaNota] = useState<string | null>(null);
  const [naoMostrarMais, setNaoMostrarMais] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [trecho, setTrecho] = useState<{ id: string; titulo: string } | null>(null);

  // Histórico: todas as versões, da mais nova para a mais velha (o servidor já ordena pela versão semântica).
  useEffect(() => {
    if (modo !== 'historico')
      return;
    const abortar = new AbortController();
    api.get<ResumoDeNotaDeVersao[]>('/sys/novidades', abortar.signal)
      .then((pLista) => {
        setVersoes(pLista ?? []);
        setSelecionada((pAtual) => pAtual ?? pLista?.[0]?.versao ?? null);
      })
      .catch((pErro) => {
        if (!abortar.signal.aborted)
          setFalhaDaLista(mensagemDeFalha(pErro, 'carregar a lista de novidades da versão'));
      });
    return () => abortar.abort();
  }, [modo]);

  // A nota selecionada, uma vez por versão (fica em memória enquanto o modal vive).
  useEffect(() => {
    if (!selecionada || notas[selecionada])
      return;
    const abortar = new AbortController();
    setFalhaDaNota(null);
    api.get<NotaDeVersaoRenderizada>(`/sys/novidades/${encodeURIComponent(selecionada)}`, abortar.signal)
      .then((pNota) => { if (pNota) setNotas((pAtuais) => ({ ...pAtuais, [selecionada]: pNota })); })
      .catch((pErro) => {
        if (!abortar.signal.aborted)
          setFalhaDaNota(mensagemDeFalha(pErro, `carregar as novidades da versão ${selecionada}`));
      });
    return () => abortar.abort();
  }, [selecionada, notas]);

  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!versoes || !termo)
      return versoes ?? [];
    return versoes.filter((pV) => `${pV.versao} ${pV.titulo} ${pV.resumo}`.toLowerCase().includes(termo));
  }, [versoes, filtro]);

  const nota = selecionada ? notas[selecionada] : undefined;
  const indice = versoes?.findIndex((pV) => pV.versao === selecionada) ?? -1;

  // Link dentro da nota: âncora do manual ⇒ janela de trecho; externo ⇒ nova aba. Nada navega a página.
  const aoClicarNoConteudo = useCallback((pEvento: React.MouseEvent<HTMLElement>) => {
    const link = (pEvento.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!link)
      return;
    const href = link.getAttribute('href') ?? '';
    pEvento.preventDefault();
    const cerquilha = href.indexOf('#');
    if (href.startsWith(MANUAL) && cerquilha >= 0) {
      setTrecho({ id: href.slice(cerquilha + 1), titulo: link.textContent?.trim() || 'Ajuda' });
      return;
    }
    if (/^https?:\/\//i.test(href))
      window.open(href, '_blank', 'noopener,noreferrer');
  }, []);

  const variasVersoes = (versoes?.length ?? 0) > 1;

  // A capa só quando acrescenta: a mesma imagem já citada num item apareceria duas vezes seguidas.
  const mostrarCapa = !!nota?.destaque && !nota.grupos.some((pG) => pG.itens.some((pI) => pI.html.includes(nota.destaque)));

  return (
    <>
      <XModalShell
        variant="overlay"
        size="xl"
        draggable
        title={modo === 'login' ? 'O que há de novo' : 'Novidades da versão'}
        subtitle={modo === 'login'
          ? ((versoes?.length ?? 0) > 1 ? `${versoes?.length} versões desde a sua última visita` : 'Desde a sua última visita')
          : 'Todas as versões, da mais nova para a mais velha'}
        closeLabel={'Fechar'}
        onClose={() => onFechar(modo === 'login' && naoMostrarMais)}
        contentClassName="flex min-h-0"
        footer={
          <>
            {modo === 'login' && (
              <label className="mr-auto inline-flex items-center gap-2 text-ui-sm text-brand-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={naoMostrarMais}
                  onChange={(pE) => setNaoMostrarMais(pE.target.checked)}
                  data-testid="novidades-nao-mostrar"
                  className="w-4 h-4 accent-brand-primary"
                />
                {'Não mostrar novamente'}
                <span className="text-ui-xs text-brand-text-muted">{'(volta quando sair uma versão nova)'}</span>
              </label>
            )}
            {nota && (
              <a
                href={nota.linkNoManual}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-ui-sm font-medium rounded-lg text-brand-text-secondary hover:bg-hover hover:text-brand-text-primary transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {'Ver no manual'}
              </a>
            )}
            <button
              type="button"
              onClick={() => onFechar(modo === 'login' && naoMostrarMais)}
              data-testid="novidades-fechar"
              className={`px-4 py-3 sm:py-2 text-ui font-medium rounded-lg transition-colors min-h-touch sm:min-h-[36px] ${CLOSE_BUTTON_STYLE}`}
            >
              {'Fechar'}
            </button>
          </>
        }
      >
        {/* Lista de versões: só quando há mais de uma (ou no histórico, que tem busca). */}
        {(variasVersoes || modo === 'historico') && (
          <nav className="w-60 shrink-0 border-r border-border-light flex flex-col min-h-0" aria-label={'Versões'}>
            {modo === 'historico' && (
              <div className="p-3 border-b border-border-light">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted" />
                  <input
                    value={filtro}
                    onChange={(pE) => setFiltro(pE.target.value)}
                    placeholder={'Buscar nas versões'}
                    aria-label={'Buscar nas versões'}
                    className="input-field pl-8 py-1.5 text-ui-sm"
                  />
                </div>
              </div>
            )}
            <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {falhaDaLista && <li className="p-2 text-ui-sm text-warning" role="alert">{falhaDaLista}</li>}
              {!versoes && !falhaDaLista && (
                <li className="p-3 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-primary" /></li>
              )}
              {versoes && visiveis.length === 0 && (
                <li className="p-3 text-ui-sm text-brand-text-muted">{filtro ? 'Nenhuma versão com esse texto.' : 'Ainda não há notas de versão.'}</li>
              )}
              {visiveis.map((pV) => (
                <li key={pV.versao}>
                  <button
                    type="button"
                    onClick={() => setSelecionada(pV.versao)}
                    data-testid={`novidades-versao-${pV.versao}`}
                    aria-current={pV.versao === selecionada}
                    className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${pV.versao === selecionada
                      ? 'bg-brand-primary/10 ring-1 ring-inset ring-brand-primary/30'
                      : 'hover:bg-hover'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-ui-sm text-brand-text-primary">{`Versão ${pV.versao}`}</span>
                      <span className="text-ui-xs text-brand-text-muted tabular-nums">{dataDaNota(pV.data)}</span>
                    </div>
                    <p className="text-ui-xs text-brand-text-secondary line-clamp-2 mt-0.5">{pV.resumo}</p>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* A nota selecionada. */}
        <article className="flex-1 min-w-0 overflow-y-auto px-5 sm:px-7 py-5" onClick={aoClicarNoConteudo} data-testid="novidades-nota">
          {falhaDaNota && <p className="text-ui text-warning" role="alert">{falhaDaNota}</p>}
          {!nota && !falhaDaNota && selecionada && (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>
          )}
          {!selecionada && versoes && versoes.length === 0 && (
            <p className="py-16 text-center text-ui text-brand-text-muted">{'Ainda não há notas de versão.'}</p>
          )}
          {nota && (
            <>
              <header className="mb-4">
                <div className="flex items-center gap-2 text-ui-xs text-brand-text-muted">
                  <span className="rounded-full bg-brand-primary/15 text-brand-primary px-2 py-0.5 font-semibold">{`Versão ${nota.versao}`}</span>
                  <span className="tabular-nums">{dataDaNota(nota.data)}</span>
                  {variasVersoes && indice >= 0 && (
                    <span>{`· ${indice + 1} de ${versoes?.length}`}</span>
                  )}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-brand-text-primary">{nota.titulo}</h3>
                <p className="mt-1 text-ui text-brand-text-secondary">{nota.resumo}</p>
              </header>

              {mostrarCapa && (
                // Inteira (`object-contain`), nunca cortada nem ampliada: a capa é uma tela, e tela cortada não se lê.
                <img
                  src={nota.destaque}
                  alt={`Destaque da versão ${nota.versao}: ${nota.resumo}`}
                  className="mx-auto max-w-full max-h-80 object-contain rounded-xl border border-border-light mb-4"
                />
              )}

              {nota.aberturaHTML && (
                <div className={`${CLASSE_DO_CORPO_DA_AJUDA} mb-4`} dangerouslySetInnerHTML={{ __html: nota.aberturaHTML }} />
              )}

              {nota.grupos.map((pG) => (
                <section key={pG.grupo} className="mb-5" data-testid={`novidades-grupo-${pG.grupo}`}>
                  <h4 className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-ui-xs font-semibold ring-1 ring-inset ${SELO[pG.grupo]?.classe ?? ''}`}>
                      {SELO[pG.grupo]?.icone}
                      {pG.rotulo}
                    </span>
                  </h4>
                  <div className="space-y-3">
                    {pG.itens.map((pI) => (
                      <div key={pI.titulo} className="rounded-xl border border-border-light bg-muted-bg/40 px-4 py-3">
                        <div className="font-medium text-ui text-brand-text-primary mb-1">{pI.titulo}</div>
                        <div className={CLASSE_DO_CORPO_DA_AJUDA} dangerouslySetInnerHTML={{ __html: pI.html }} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </article>
      </XModalShell>

      {trecho && <XJanelaDeTrecho id={trecho.id} titulo={trecho.titulo} onFechar={() => setTrecho(null)} />}
    </>
  );
}
