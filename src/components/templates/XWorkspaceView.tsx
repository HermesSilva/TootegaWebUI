/**
 * XWorkspaceView — o AppX (painel de trabalho, `XViewTemplate.Workspace` — dono, 2026-10-25), em NÍVEIS.
 *
 * Montado na moldura `XPainelDeTrabalho`:
 *   1. cabeçalho com os níveis (no ANVIL, Empresa › Projeto): clicar no NOME de um nível mostra os SubAppX dele; a
 *      SETA ao lado troca o registro do nível. O nível ativo é o título; os de cima são migalhas; os de baixo que já
 *      têm registro vêm depois do título. "Voltar" refaz o caminho percorrido;
 *   2. uma aba por SubAppX do nível ativo (já podados pelo back), com contador, e a faixa "precisa de você";
 *   3. no corpo, o SubAppX da aba ativa, aberto aqui dentro, com o marcador `{contexto}` trocado pela chave do registro
 *      do nível (só no nível do provedor; o da empresa corrente já vem recortado pela posse).
 *
 * Regras do AppX (skill tootega-front, "Vocabulário: App, AppX e SubAppX"): de dentro dele só se abre um SubAppX dele —
 * o link `[[app:X]]` para App do menu fica texto (`AppXContext`, `resolvedorDoAppX`). Abre no nível mais baixo que
 * tiver registro e, sem registro abaixo, no nível acima (RX-11). O nível só por navegação (o Repositório) não entra
 * nessa conta: aparece quando o usuário abre um registro dele (a ação de linha `openLevel`), e a lista dele é a do
 * registro do nível de cima.
 *
 * Genérico (CE-19): nada aqui conhece um AppX concreto. O SubAppX escolhido fica no perfil do usuário, por nível; o
 * SubAppX de dashboard vai embutido, sem moldura. O resumo se rebusca ao voltar o foco, no intervalo declarado e
 * depois que um SubAppX grava.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { api, getCurrentCompanyID, mensagemDeFalha } from '@core/lib';
import { registrarResolvedorDoAppX, type XResolvedorDoAppX } from '@core/lib/resolvedorDoAppX';
import { comContexto } from '@core/lib/comContexto';
import { AppXContext, type XNavegacaoDoAppX } from '@core/contexts/AppXContext';
import { useApplicationByName } from '@core/hooks/useApplication';
import { useCompany } from '@core/hooks/useCompany';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';
import { useTabs } from '@core/hooks/useTabs';
import {
  XViewTemplate,
  XWorkspaceContextSource,
  XWorkspaceTone,
  type XApplication,
  type XWorkspaceContextOption,
  type XWorkspaceLevel,
  type XWorkspaceSection,
  type XWorkspaceSummary,
} from '@core/types';
import { XBuscaDoPainel, XEncaixesDoPainel, XPainelDeTrabalho, type XOpcaoDaBusca } from '@core/components/painel/moldura';
import type { XEscolhaNoCabecalho, XMigalhaDoPainel, XTomDoPainel } from '@core/components/painel/elementos';
import { XApplicationView } from './XApplicationView';
import { XDashboardView } from './XDashboardView';
import { XNavigatorView } from './XNavigatorView';

export interface XWorkspaceViewProps {
  application: XApplication;
  tabID: string;
  onClose?: () => void;
  /** A chave do registro que o AppX acompanha no nível mais baixo do provedor (vem da aba). */
  registroInicial?: string;
}

const TOM: Record<XWorkspaceTone, XTomDoPainel> = {
  [XWorkspaceTone.Neutral]: 'neutro',
  [XWorkspaceTone.Info]: 'info',
  [XWorkspaceTone.Success]: 'sucesso',
  [XWorkspaceTone.Warning]: 'aviso',
  [XWorkspaceTone.Danger]: 'perigo',
};

/** Chave do resumo no cache: o AppX, o nível, o registro e a empresa corrente (que muda o que o back devolve). */
export const chaveDoResumo = (pPainel: string, pNivel: string, pRegistro: string | null): readonly unknown[] =>
  ['painel-resumo', pPainel, pNivel, pRegistro ?? '', getCurrentCompanyID() ?? 0];

// O marcador `{contexto}` trocado pela chave do registro: mora em `lib`, porque o navegador também o usa.
export { comContexto };

/** Um passo do caminho percorrido dentro do AppX, para o "voltar" (RX-7). */
interface PassoDoCaminho {
  nivel: string;
  secao: string;
  registros: Record<string, string>;
}

export function XWorkspaceView({ application, tabID, registroInicial }: XWorkspaceViewProps): JSX.Element {
  const painel = application.workspace;
  const niveis: XWorkspaceLevel[] = useMemo(
    () => (painel?.levels ?? []).map((pN) => ({ ...pN, sections: [...pN.sections].sort((pA, pB) => pA.order - pB.order) })),
    [painel]);

  const queryClient = useQueryClient();
  const { definirSubtitulo, definirTitulo } = useTabs();
  const { company: empresa, companies: empresas, selectCompany } = useCompany();
  // O SubAppX escolhido, por nível, fica no perfil do usuário.
  const [secoesGuardadas, guardarSecoes] = usePreferenciaDoUsuario<Record<string, string>>(`painel.${application.name}.secoes`, {});
  const [nivelEscolhido, setNivelEscolhido] = useState<string | null>(null);
  // O registro escolhido pela seta, por nível do provedor.
  const [escolhidos, setEscolhidos] = useState<Record<string, string>>({});
  const [caminho, setCaminho] = useState<PassoDoCaminho[]>([]);
  // O clique num motivo de atenção abre o SubAppX COM o recorte dele; o nonce remonta o SubAppX para aplicá-lo.
  const [recorte, setRecorte] = useState<{ filtro?: Record<string, string>; nonce: number }>({ nonce: 0 });
  // Os encaixes das linhas 1 e 2, onde o SubAppX põe os seus minipainéis (`XNoPainel`). Estado, e não ref: o portal
  // precisa re-renderizar quando o elemento nasce.
  const [encaixeDaLinha1, setEncaixeDaLinha1] = useState<HTMLElement | null>(null);
  const [encaixeDaLinha2, setEncaixeDaLinha2] = useState<HTMLElement | null>(null);

  // OS REGISTROS DE CADA NÍVEL DO PROVEDOR (o primeiro é o padrão): é o que deixa o AppX abrir sem que a aba traga um —
  // como quando ele abre sozinho ao entrar — e o que alimenta a seta. A empresa corrente entra na chave: trocar de
  // empresa troca as listas. Com um nível do provedor ACIMA, a lista é a do registro dele (os repositórios do projeto
  // escolhido): a chave leva esse registro, e sem ele não há lista. Por isso os registros se resolvem de cima para
  // baixo, cada um com a lista que o de cima já trouxe ao cache.
  const niveisDoProvedor = useMemo(() => niveis.filter((pN) => pN.contextSource === XWorkspaceContextSource.Provider), [niveis]);
  // O último nível do provedor que abre sozinho: é o dele o registro que a aba traz.
  const ultimoDoProvedor = niveisDoProvedor.filter((pN) => !pN.onlyByNavigation).at(-1);
  const chaveDaLista = (pNivel: string, pAcima: string | null): readonly unknown[] =>
    ['painel-contextos', application.name, pNivel, pAcima ?? '', getCurrentCompanyID() ?? 0];

  /** O registro de um nível do provedor: o da seta, se está na lista; senão o que a aba trouxe; senão o primeiro. */
  const escolherRegistro = (pNivel: XWorkspaceLevel, pLista: XWorkspaceContextOption[] | undefined): string | null => {
    const escolhido = escolhidos[pNivel.key];
    if (escolhido && pLista?.some((pC) => pC.id === escolhido))
      return escolhido;
    // O nível só por navegação não ganha registro sozinho: só o que o usuário abriu.
    if (pNivel.onlyByNavigation)
      return null;
    if (registroInicial && pNivel === ultimoDoProvedor)
      return registroInicial;
    return pLista?.[0]?.id ?? null;
  };

  // `acimas[nivel]`: undefined ⇒ não há nível do provedor acima; null ⇒ há, sem registro (a lista fica vazia).
  const acimas: Record<string, string | null | undefined> = {};
  const registrosDoProvedor: Record<string, string | null> = {};
  for (const nivel of niveisDoProvedor) {
    const indice = niveis.indexOf(nivel);
    const superior = niveis.slice(0, indice).reverse().find((pN) => pN.contextSource === XWorkspaceContextSource.Provider);
    const acima = superior ? registrosDoProvedor[superior.key] ?? null : undefined;
    acimas[nivel.key] = acima;
    const lista = acima === null ? [] : queryClient.getQueryData<XWorkspaceContextOption[]>(chaveDaLista(nivel.key, acima ?? null));
    registrosDoProvedor[nivel.key] = escolherRegistro(nivel, lista);
  }

  const listas = useQueries({
    queries: niveisDoProvedor.map((pN) => {
      const acima = acimas[pN.key];
      return {
        queryKey: chaveDaLista(pN.key, acima ?? null),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.get<XWorkspaceContextOption[]>(
          `/sys/painel/${encodeURIComponent(application.name)}/contextos?nivel=${encodeURIComponent(pN.key)}` +
          (acima ? `&acima=${encodeURIComponent(acima)}` : ''),
          signal),
        enabled: acima !== null,
        staleTime: 60 * 1000,
        retry: false,
      };
    }),
  });
  const listaDe = (pNivel: XWorkspaceLevel): XWorkspaceContextOption[] | undefined =>
    acimas[pNivel.key] === null ? [] : listas[niveisDoProvedor.indexOf(pNivel)]?.data;
  // Só as listas que decidem onde o AppX abre: a do nível por navegação não segura a abertura.
  const listasCarregando = listas.some((pQ, pI) => !niveisDoProvedor[pI].onlyByNavigation && pQ.isLoading);
  const falhaDeLista = listas.find((pQ) => pQ.isError)?.error;

  /** O registro do nível: o da empresa corrente, o resolvido do provedor, ou '' no nível sem registro. */
  const registroDe = (pNivel: XWorkspaceLevel): string | null => {
    switch (pNivel.contextSource) {
      case XWorkspaceContextSource.CurrentCompany:
        return empresa ? String(empresa.sysxPessoaID) : null;
      case XWorkspaceContextSource.Provider:
        return registrosDoProvedor[pNivel.key] ?? null;
      default:
        return '';
    }
  };
  const temRegistro = (pNivel: XWorkspaceLevel): boolean => registroDe(pNivel) !== null;

  // O nível ativo: o escolhido, se ainda existe e tem registro; senão o mais BAIXO que abre sozinho e tem registro
  // (RX-11). Enquanto as listas carregam, não se decide — escolher o nível de cima agora o faria pular para baixo quando
  // elas chegassem.
  const daEscolha = niveis.find((pN) => pN.key === nivelEscolhido && temRegistro(pN));
  const nivelAtivo = daEscolha
    ?? (listasCarregando ? undefined : [...niveis].reverse().find((pN) => !pN.onlyByNavigation && temRegistro(pN)));
  const registro = nivelAtivo ? registroDe(nivelAtivo) : null;
  const registroDaRota = nivelAtivo?.contextSource === XWorkspaceContextSource.Provider ? registro : null;

  const resumo = useQuery({
    queryKey: chaveDoResumo(application.name, nivelAtivo?.key ?? '', registroDaRota),
    queryFn: ({ signal }) => api.get<XWorkspaceSummary>(
      `/sys/painel/${encodeURIComponent(application.name)}/resumo?nivel=${encodeURIComponent(nivelAtivo!.key)}` +
      (registroDaRota ? `&registro=${encodeURIComponent(registroDaRota)}` : ''),
      signal),
    enabled: !!nivelAtivo,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: painel && painel.refreshSeconds > 0 ? painel.refreshSeconds * 1000 : false,
    retry: false,
  });

  // Gravou num SubAppX (a grade dele foi invalidada) ⇒ contadores e atenção podem ter mudado, e as listas dos níveis
  // também (o repositório que acabou de nascer na aba Código já pode ser aberto).
  useEffect(() => queryClient.getQueryCache().subscribe((pEvento) => {
    if (pEvento.type === 'updated' && pEvento.action.type === 'invalidate' && pEvento.query.queryKey[0] === 'app-data') {
      void queryClient.invalidateQueries({ queryKey: ['painel-resumo', application.name] });
      void queryClient.invalidateQueries({ queryKey: ['painel-contextos', application.name] });
    }
  }), [queryClient, application.name]);

  // A aba da casca diz o NÍVEL e o registro dele: "Empresa - Construtora Horizonte", "Projeto - ANV (ANVIL)",
  // "Repositório - portal-web" (dono, 2026-10-26). O nome do registro vai discreto, ao lado do nível.
  const tituloDoRegistro = resumo.data?.header.title;
  useEffect(() => {
    if (tituloDoRegistro)
      definirSubtitulo(tabID, tituloDoRegistro);
  }, [definirSubtitulo, tabID, tituloDoRegistro]);
  const tituloDoNivel = nivelAtivo?.title;
  useEffect(() => {
    if (tituloDoNivel)
      definirTitulo(tabID, tituloDoNivel);
  }, [definirTitulo, tabID, tituloDoNivel]);

  const secoes = nivelAtivo?.sections ?? [];
  const ativa: XWorkspaceSection | undefined =
    secoes.find((pS) => pS.key === secoesGuardadas[nivelAtivo?.key ?? ''])
    ?? secoes.find((pS) => pS.key === nivelAtivo?.defaultSection)
    ?? secoes[0];

  // ── Navegação dentro do AppX ──────────────────────────────────────────────────────────────────────────────────
  const lembrar = (): void => {
    if (nivelAtivo && ativa)
      setCaminho((pC) => [...pC, { nivel: nivelAtivo.key, secao: ativa.key, registros: { ...escolhidos } }]);
  };

  const guardarSecao = (pNivel: string, pSecao: string): void =>
    guardarSecoes({ ...secoesGuardadas, [pNivel]: pSecao });

  /**
   * Vai a um nível — e, opcionalmente, a um registro dele (só no nível do provedor; os outros têm o registro da sessão)
   * e a um SubAppX dele, com recorte.
   */
  const irPara = (pNivel: string, pRegistro?: string, pSecao?: string, pFiltro?: Record<string, string>): void => {
    lembrar();
    setNivelEscolhido(pNivel);
    const destino = niveis.find((pN) => pN.key === pNivel);
    if (pRegistro && destino?.contextSource === XWorkspaceContextSource.Provider) {
      setEscolhidos((pE) => ({ ...pE, [pNivel]: pRegistro }));
      // Registro que a lista ainda não tem (acabou de nascer): a lista se relê, e o nível abre quando ele chegar.
      if (!listaDe(destino)?.some((pC) => pC.id === pRegistro))
        void queryClient.invalidateQueries({ queryKey: ['painel-contextos', application.name, pNivel] });
    }
    if (pSecao)
      guardarSecao(pNivel, pSecao);
    setRecorte((pAnterior) => ({ filtro: pFiltro, nonce: pAnterior.nonce + 1 }));
  };

  /** O motivo de atenção abre onde nasceu: no SubAppX dele, no nível dele e, se veio de outro registro, nele (RI-2). */
  const abrirMotivo = (pSecao: string, pRegistro?: string, pFiltro?: Record<string, string>): void => {
    const nivel = niveis.find((pN) => pN.sections.some((pS) => pS.key === pSecao));
    if (!nivel)
      return;
    if (nivel === nivelAtivo && !pRegistro)
      trocarSecao(pSecao, pFiltro);
    else
      irPara(nivel.key, pRegistro, pSecao, pFiltro);
  };

  const trocarSecao = (pChave: string, pFiltro?: Record<string, string>): void => {
    if (!nivelAtivo || (pChave === ativa?.key && !pFiltro))
      return;
    lembrar();
    guardarSecao(nivelAtivo.key, pChave);
    setRecorte((pAnterior) => ({ filtro: pFiltro, nonce: pAnterior.nonce + 1 }));
  };

  /** Troca o registro de um nível do provedor e mantém o SubAppX (RX-5). */
  const trocarRegistro = (pNivel: string, pID: string): void => {
    lembrar();
    setEscolhidos((pE) => ({ ...pE, [pNivel]: pID }));
  };

  const voltar = (): void => {
    const ultimo = caminho[caminho.length - 1];
    if (!ultimo)
      return;
    setCaminho((pC) => pC.slice(0, -1));
    setNivelEscolhido(ultimo.nivel);
    setEscolhidos(ultimo.registros);
    guardarSecao(ultimo.nivel, ultimo.secao);
    setRecorte((pAnterior) => ({ nonce: pAnterior.nonce + 1 }));
  };

  // RX-1: dentro do AppX, um link só abre um SubAppX dele (com o registro, se o link trouxer); o resto fica texto.
  const irParaRef = useRef(irPara);
  useEffect(() => { irParaRef.current = irPara; });
  const resolverDoAppX = useCallback<XResolvedorDoAppX>((pNomeApp, pRecorte, pRegistroID) => {
    for (const nivel of niveis) {
      const secao = nivel.sections.find((pS) => pS.applicationName.toLowerCase() === pNomeApp.toLowerCase());
      if (secao)
        return () => irParaRef.current(nivel.key, pRegistroID, secao.key, pRecorte);
    }
    return null;
  }, [niveis]);
  useEffect(() => registrarResolvedorDoAppX(tabID, resolverDoAppX), [tabID, resolverDoAppX]);
  // RI-5: Ctrl+K abre a busca de comando — só quando esta aba é a que está à frente (a casca marca a área do App).
  const [buscaAberta, setBuscaAberta] = useState(false);
  useEffect(() => {
    const aoTeclar = (pEvento: KeyboardEvent): void => {
      if (!(pEvento.ctrlKey || pEvento.metaKey) || pEvento.key.toLowerCase() !== 'k')
        return;
      const aFrente = document.querySelector('[data-app-area]')?.getAttribute('data-active-tab-id');
      if (aFrente && aFrente !== tabID)
        return;
      pEvento.preventDefault();
      setBuscaAberta(true);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [tabID]);

  // O que o SubAppX recebe para navegar sem sair do AppX (`useAppX`).
  const navegacao = useMemo<XNavegacaoDoAppX>(() => ({
    resolverLink: resolverDoAppX,
    irPara: (pNivel, pRegistro, pSecao, pRecorte) => irParaRef.current(pNivel, pRegistro, pSecao, pRecorte),
    temNivel: (pNivel) => niveis.some((pN) => pN.key === pNivel),
  }), [resolverDoAppX, niveis]);

  if (!painel || niveis.length === 0)
    return (
      <Orientacao
        titulo={painel ? 'Nenhuma aba deste painel está disponível para você' : 'Este painel veio sem a declaração dos níveis'}
        texto={painel
          ? `O painel '${application.title}' reúne Apps a que o seu papel não dá acesso. Peça ao administrador da conta um papel que inclua ao menos uma delas.`
          : `A App '${application.name}' está marcada como painel de trabalho, mas o modelo que chegou não traz o painel. É defeito da declaração no back.`}
      />
    );

  if (!nivelAtivo && listasCarregando)
    return <div className="h-full bg-brand-background animate-pulse" aria-busy="true" aria-label={`Carregando o painel '${application.title}'`} />;

  if (!nivelAtivo && falhaDeLista)
    return <Orientacao titulo="O painel não pôde ser aberto" texto={mensagemDeFalha(falhaDeLista, `listar os registros do painel '${application.title}'`)} />;

  if (!nivelAtivo) {
    const rotulo = (ultimoDoProvedor ?? niveis[niveis.length - 1]).contextLabel;
    return (
      <Orientacao
        titulo={`Você não participa de nenhum ${rotulo} nesta empresa`}
        texto={`Este painel mostra o trabalho de um ${rotulo} de que você participa. Quando você for incluído num ${rotulo}, ele aparece aqui; se trabalha em outra empresa, troque a empresa no alto da tela.`}
      />
    );
  }

  if (resumo.isError)
    return <Orientacao titulo="O painel não pôde ser aberto" texto={mensagemDeFalha(resumo.error, `abrir o painel '${application.title}'`)} />;

  const dados = resumo.data;
  const cabecalho = dados?.header;
  const status = cabecalho?.status;
  const indiceAtivo = niveis.indexOf(nivelAtivo);

  // A seta da EMPRESA CORRENTE (com mais de uma empresa): a mesma troca do seletor da casca — o cache cai, e o AppX
  // relê os registros e o resumo sob a empresa nova.
  const escolhaDaEmpresa: XEscolhaNoCabecalho | undefined = empresa && empresas.length > 1 ? {
    rotuloAcessivel: `${empresa.nome}: trocar de empresa`,
    opcoes: empresas.map((pE) => ({
      id: String(pE.sysxPessoaID),
      rotulo: pE.nome,
      detalhe: pE.razaoSocial && pE.razaoSocial !== pE.nome ? pE.razaoSocial : undefined,
    })),
    selecionada: String(empresa.sysxPessoaID),
    aoEscolher: (pID: string) => {
      const escolhida = empresas.find((pE) => String(pE.sysxPessoaID) === pID);
      if (escolhida && escolhida.sysxPessoaID !== empresa.sysxPessoaID)
        selectCompany(escolhida);
    },
  } : undefined;

  /** A seta de um nível: a lista do provedor (mais de um registro) ou a troca da empresa corrente. */
  const escolhaDoNivel = (pNivel: XWorkspaceLevel | undefined, pRotulo: string): XEscolhaNoCabecalho | undefined => {
    if (!pNivel)
      return undefined;
    if (pNivel.contextSource === XWorkspaceContextSource.CurrentCompany)
      return escolhaDaEmpresa;
    const lista = listaDe(pNivel);
    const atual = registroDe(pNivel);
    if (pNivel.contextSource !== XWorkspaceContextSource.Provider || !lista || lista.length < 2 || !atual)
      return undefined;
    return {
      rotuloAcessivel: `${pRotulo}: trocar de ${pNivel.contextLabel}`,
      opcoes: lista.map((pC) => ({ id: pC.id, rotulo: pC.label, detalhe: pC.detail || undefined })),
      selecionada: atual,
      aoEscolher: (pID: string) => trocarRegistro(pNivel.key, pID),
    };
  };

  const nivelDe = (pChave?: string): XWorkspaceLevel | undefined => niveis.find((pN) => pN.key === pChave);

  // Os níveis de cima (migalhas do resumo): o nome leva ao nível, se ele existe no modelo podado; senão é texto.
  const migalhas: XMigalhaDoPainel[] = (cabecalho?.breadcrumbs ?? []).map((pM) => {
    const nivel = nivelDe(pM.level);
    return {
      rotulo: pM.label,
      codigo: pM.isCode,
      escolha: pM.isCompany ? escolhaDaEmpresa : escolhaDoNivel(nivel, pM.label),
      aoAbrir: nivel && nivel !== nivelAtivo ? () => irPara(nivel.key) : undefined,
    };
  });

  // Os níveis de baixo, depois do título. Com registro: o nome desce ao nível. O nível SÓ POR NAVEGAÇÃO ainda sem
  // registro entra como o título do nível com a lista dos registros a abrir (os repositórios do projeto a que o usuário
  // tem acesso — dono, 2026-10-26): escolher um abre o nível nele. Sem nenhum, a lista diz que não há (o passo fica,
  // para a pessoa saber que não tem acesso a nenhum); enquanto a lista carrega, o passo espera.
  const migalhasAbaixo: XMigalhaDoPainel[] = niveis.slice(indiceAtivo + 1).flatMap((pN): XMigalhaDoPainel[] => {
    if (pN.contextSource !== XWorkspaceContextSource.Provider)
      return [{ rotulo: pN.title, aoAbrir: () => irPara(pN.key) }];
    if (temRegistro(pN)) {
      const rotulo = listaDe(pN)?.find((pC) => pC.id === registroDe(pN))?.label ?? pN.title;
      return [{ rotulo, escolha: escolhaDoNivel(pN, rotulo), aoAbrir: () => irPara(pN.key) }];
    }
    const lista = listaDe(pN);
    if (!pN.onlyByNavigation || !lista)
      return [];
    return [{
      rotulo: pN.title,
      escolha: {
        rotuloAcessivel: `${pN.title}: abrir um ${pN.contextLabel}`,
        opcoes: lista.map((pC) => ({ id: pC.id, rotulo: pC.label, detalhe: pC.detail || undefined })),
        vazio: `Você não tem acesso a nenhum ${pN.contextLabel} aqui.`,
        aoEscolher: (pID: string) => irPara(pN.key, pID),
      },
    }];
  });

  const titulo = cabecalho?.title ?? application.title;

  // As opções da busca de comando (RI-5): cada nível, cada aba de cada nível e cada registro dos níveis do provedor.
  const opcoesDaBusca: XOpcaoDaBusca[] = niveis.flatMap((pN) => [
    ...(pN === nivelAtivo ? [] : [{ id: `nivel-${pN.key}`, rotulo: pN.title, grupo: 'Níveis', aoEscolher: () => irPara(pN.key) }]),
    ...pN.sections.map((pS) => ({
      id: `aba-${pS.key}`, rotulo: pS.title, grupo: 'Abas', detalhe: pN.title,
      aoEscolher: () => (pN === nivelAtivo ? trocarSecao(pS.key) : irPara(pN.key, undefined, pS.key)),
    })),
    ...(pN.contextSource === XWorkspaceContextSource.Provider ? (listaDe(pN) ?? []) : []).map((pC) => ({
      id: `registro-${pN.key}-${pC.id}`, rotulo: pC.label, grupo: pN.title, detalhe: pC.detail || undefined,
      aoEscolher: () => irPara(pN.key, pC.id),
    })),
  ]);

  return (
    <AppXContext.Provider value={navegacao}>
      <XPainelDeTrabalho
        migalhas={migalhas}
        migalhasAbaixo={migalhasAbaixo}
        aoVoltar={caminho.length > 0 ? voltar : undefined}
        // Sem botão de busca no cabeçalho (dono, 2026-10-26): a busca de comando abre só pelo Ctrl+K.
        busca={buscaAberta && <XBuscaDoPainel opcoes={opcoesDaBusca} aoFechar={() => setBuscaAberta(false)} />}
        titulo={titulo}
        selo={cabecalho?.badge || undefined}
        status={status ? {
          rotulo: status.label,
          detalhe: status.detail || undefined,
          tom: TOM[status.tone] ?? 'neutro',
          progresso: status.progress ?? undefined,
        } : undefined}
        // O título é o nível ativo: o nome não leva a lugar nenhum; a seta ao lado troca o registro.
        escolhaDoTitulo={escolhaDoNivel(nivelAtivo, titulo)}
        abas={secoes.map((pS) => ({
          id: pS.key,
          rotulo: pS.title,
          contador: dados?.counters[pS.key],
          rotuloDoContador: pS.counterLabel || undefined,
        }))}
        extrasDaLinha1={<span ref={setEncaixeDaLinha1} data-encaixe-do-painel="1" className="flex items-center gap-2 empty:hidden" />}
        extrasDaLinha2={<span ref={setEncaixeDaLinha2} data-encaixe-do-painel="2" className="flex items-center gap-2 empty:hidden" />}
        abaAtiva={ativa?.key ?? ''}
        aoTrocarAba={(pChave) => trocarSecao(pChave)}
        aviso={dados && dados.notices.length > 0 && (
          <div role="status" className="flex flex-col gap-1 px-4 py-2.5 rounded-lg bg-warning-bg border border-warning/30 text-ui-sm text-brand-text-primary">
            {dados.notices.map((pAviso) => <span key={pAviso}>{pAviso}</span>)}
          </div>
        )}
        atencao={dados && dados.attention.length > 0 ? {
          titulo: painel.attentionTitle,
          itens: dados.attention.map((pI) => ({
            id: `${pI.sectionKey}:${pI.key}`,
            quantidade: pI.quantity,
            rotulo: pI.label,
            tom: TOM[pI.tone] ?? 'info',
          })),
          aoAbrir: (pID) => {
            const item = dados.attention.find((pI) => `${pI.sectionKey}:${pI.key}` === pID);
            // O motivo pode vir de outro nível e de outro registro (o projeto, somado na Empresa): abre lá (RI-2).
            if (item)
              abrirMotivo(item.sectionKey, item.contextID || undefined, Object.keys(item.filter).length > 0 ? item.filter : undefined);
          },
        } : undefined}
      >
        {ativa && (
          <XEncaixesDoPainel linha1={encaixeDaLinha1} linha2={encaixeDaLinha2}>
            <SubAppDaSecao
              key={`${nivelAtivo.key}:${ativa.key}:${registro ?? ''}:${recorte.nonce}`}
              secao={ativa}
              registro={registroDaRota}
              tabID={tabID}
              filtroInicial={recorte.filtro}
            />
          </XEncaixesDoPainel>
        )}
      </XPainelDeTrabalho>
    </AppXContext.Provider>
  );
}

interface SubAppDaSecaoProps {
  secao: XWorkspaceSection;
  registro: string | null;
  tabID: string;
  filtroInicial?: Record<string, string>;
}

/** O SubAppX no corpo do AppX: o modelo podado vem por nome, e o registro entra nos endpoints. */
function SubAppDaSecao({ secao, registro, tabID, filtroInicial }: SubAppDaSecaoProps): JSX.Element {
  const modelo = useApplicationByName(secao.applicationName);
  const comRegistro = useMemo(() => (modelo.data ? comContexto(modelo.data, registro) : null), [modelo.data, registro]);

  if (modelo.isError)
    return <Orientacao titulo={`A aba '${secao.title}' não pôde ser aberta`} texto={mensagemDeFalha(modelo.error, `abrir a aba '${secao.title}'`)} />;

  if (!comRegistro)
    return <div className="flex-1 min-h-[200px] rounded-lg bg-brand-surface border border-border-light animate-pulse" aria-busy="true" />;

  // Navegador (a Gerência — dono, 2026-10-26): a lista e a tela do elemento têm moldura própria; o registro do nível
  // chega também às Apps dos elementos.
  if (comRegistro.viewTemplate === XViewTemplate.Navigator)
    return <XNavigatorView application={comRegistro} tabID={tabID} registro={registro} filtroInicial={filtroInicial} />;

  // Dashboard: o conteúdo já é feito de cartões, e vai sem moldura nem rolagem própria — o painel rola.
  if (comRegistro.viewTemplate === XViewTemplate.Dashboard)
    return (
      <div className="relative flex-1 flex flex-col">
        <XDashboardView application={comRegistro} tabID={tabID} embutido />
      </div>
    );

  return (
    // A área posicionada é a do SubAppX: os modais dele ficam contidos aqui (skill tootega-front §1).
    <div className="relative flex-1 min-h-[420px] flex flex-col rounded-lg border border-border-light bg-brand-surface overflow-hidden">
      <XApplicationView application={comRegistro} tabID={tabID} filtroInicial={filtroInicial} />
    </div>
  );
}

/** Orientação no lugar do painel: diz o que aconteceu e o que fazer (erro mudo é defeito). */
function Orientacao({ titulo, texto }: { titulo: string; texto: string }): JSX.Element {
  return (
    <div className="h-full flex items-center justify-center p-6 bg-brand-background">
      <div role="status" className="max-w-[560px] flex flex-col items-center text-center gap-2">
        <Compass size={28} className="text-brand-primary" aria-hidden="true" />
        <p className="text-ui font-semibold text-brand-text-primary">{titulo}</p>
        <p className="text-ui-sm text-brand-text-secondary">{texto}</p>
      </div>
    </div>
  );
}
