/**
 * XNavigatorView — o NAVEGADOR (`XViewTemplate.Navigator` — dono, 2026-10-26): a App que gerencia um conjunto de coisas,
 * no molde das configurações de um repositório do GitHub.
 *
 *   - à ESQUERDA, a lista do que se gerencia, em grupos (título opcional, separador entre um grupo e o seguinte); o
 *     elemento ativo tem a barra lateral e o negrito, não só a cor (WCAG 2.2 AA, 1.4.1);
 *   - à DIREITA, no painel maior, a App do elemento escolhido, aberta AQUI DENTRO: os modais dela ficam contidos na área
 *     do elemento (skill tootega-front §1);
 *   - o elemento com `createTitle` tem um botão "+" à direita da linha dele, que abre — contido na área do navegador — o
 *     formulário da App do elemento em inclusão, com Salvar e Cancelar; gravado, o elemento fica ativo e a tela dele se
 *     relê.
 *
 * Dentro de um AppX, o registro do nível (`{contexto}`) chega também à App de cada elemento. O elemento escolhido fica
 * no perfil do usuário; sem escolha, abre o padrão declarado (ou o primeiro). Genérico (CE-19): nada aqui conhece um
 * navegador concreto — a lista, os ícones e as Apps vêm do modelo, já podados pelos direitos do ator.
 */

import { useCallback, useMemo, useState, type JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, Plus } from 'lucide-react';
import { mensagemDeFalha, valoresPadraoDeFormulario } from '@core/lib';
import { api, ApiError } from '@core/lib/api';
import { comContexto } from '@core/lib/comContexto';
import { iconeLucide } from '@core/lib/iconeLucide';
import { prepararDadosParaGravar } from '@core/lib/prepararDadosParaGravar';
import { classeDeCorDoBotao } from '@core/lib/xButtonPalette';
import { useApplicationByName } from '@core/hooks/useApplication';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';
import { XApplicationMode, XButtonAction, XViewTemplate, type XApplication, type XNavigatorItem } from '@core/types';
import { XApplicationView } from './XApplicationView';
import { XDashboardView } from './XDashboardView';
import { XFormModal } from './XFormModal';
import { XTabbedFormModal } from './XTabbedFormModal';

export interface XNavigatorViewProps {
  application: XApplication;
  tabID: string;
  /** A chave do registro do nível do AppX, para o `{contexto}` das Apps dos elementos. Fora de um AppX, nulo. */
  registro?: string | null;
  /** Recorte com que a App do elemento ativo abre (o motivo do "precisa de você" que trouxe até aqui). */
  filtroInicial?: Record<string, string>;
}

export function XNavigatorView({ application, tabID, registro = null, filtroInicial }: XNavigatorViewProps): JSX.Element {
  const grupos = useMemo(() => (application.navigator?.groups ?? []).filter((pG) => pG.items.length > 0), [application.navigator]);
  const elementos = useMemo(() => grupos.flatMap((pG) => pG.items), [grupos]);
  // O elemento escolhido fica no perfil do usuário, por navegador.
  const [escolhido, guardarEscolhido] = usePreferenciaDoUsuario<string>(`navegador.${application.name}.elemento`, '');
  // O elemento cujo "+" está aberto, e a versão da tela do elemento ativo (sobe quando uma inclusão grava: a tela relê).
  const [inclusao, setInclusao] = useState<XNavigatorItem | null>(null);
  const [versao, setVersao] = useState(0);

  const ativo: XNavigatorItem | undefined =
    elementos.find((pI) => pI.key === escolhido)
    ?? elementos.find((pI) => pI.key === application.navigator?.defaultItem)
    ?? elementos[0];

  const aoIncluir = useCallback((pItem: XNavigatorItem) => {
    setInclusao(null);
    guardarEscolhido(pItem.key);
    setVersao((pVersao) => pVersao + 1);
  }, [guardarEscolhido]);

  if (!application.navigator)
    return (
      <Orientacao
        titulo="Este painel de gerência veio sem a lista de elementos"
        texto={`A App '${application.name}' está marcada como navegador, mas o modelo que chegou não traz o navegador. É defeito da declaração no back.`}
      />
    );

  if (!ativo)
    return (
      <Orientacao
        titulo="Nenhum elemento deste painel de gerência está disponível para você"
        texto={`'${application.title}' reúne telas a que o seu papel não dá acesso. Peça ao administrador da conta um papel que inclua ao menos uma delas.`}
      />
    );

  return (
    // Posicionado: o diálogo de inclusão pelo "+" fica contido na área do navegador (skill tootega-front §1).
    <div className="relative flex-1 flex flex-col md:flex-row gap-4 min-h-[420px]">
      <nav aria-label={application.title} className="md:w-60 shrink-0">
        {grupos.map((pGrupo, pIndice) => (
          <div key={`${pIndice}:${pGrupo.title}`} className={pIndice > 0 ? 'mt-2 pt-2 border-t border-border-light' : ''}>
            {pGrupo.title && (
              <p className="px-3 pt-1 pb-1.5 text-ui-xs font-semibold text-brand-text-secondary">{pGrupo.title}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {pGrupo.items.map((pItem) => (
                <li key={pItem.key} className="relative">
                  <ElementoDaLista item={pItem} ativo={pItem.key === ativo.key} aoEscolher={() => guardarEscolhido(pItem.key)} />
                  {pItem.createTitle && (
                    <BotaoDeInclusao item={pItem} aoAbrir={() => setInclusao(pItem)} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <TelaDoElemento
        key={`${ativo.key}:${registro ?? ''}:${versao}`}
        item={ativo}
        registro={registro}
        tabID={tabID}
        filtroInicial={filtroInicial}
      />

      {inclusao && (
        <InclusaoPeloElemento
          item={inclusao}
          registro={registro}
          aoCancelar={() => setInclusao(null)}
          aoGravar={() => aoIncluir(inclusao)}
        />
      )}
    </div>
  );
}

interface ElementoDaListaProps {
  item: XNavigatorItem;
  ativo: boolean;
  aoEscolher: () => void;
}

/** Uma linha da lista. Ativa: barra à esquerda, fundo e negrito — a cor não é a única pista. */
function ElementoDaLista({ item, ativo, aoEscolher }: ElementoDaListaProps): JSX.Element {
  const Icone = iconeLucide(item.icon);
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-current={ativo ? 'page' : undefined}
      className={`relative w-full flex items-center gap-2.5 pl-4 ${item.createTitle ? 'pr-10' : 'pr-3'} py-1.5 rounded-md text-left text-ui-sm whitespace-nowrap
        transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary
        ${ativo ? 'bg-hover font-semibold text-brand-text-primary' : 'text-brand-text-secondary hover:bg-hover hover:text-brand-text-primary'}`}
    >
      <span aria-hidden="true" className={`absolute left-0 top-1 bottom-1 w-1 rounded-full ${ativo ? 'bg-brand-primary' : 'bg-transparent'}`} />
      {Icone && <Icone size={16} className="shrink-0" aria-hidden="true" />}
      <span>{item.title}</span>
    </button>
  );
}

interface BotaoDeInclusaoProps {
  item: XNavigatorItem;
  aoAbrir: () => void;
}

/** O "+" à direita da linha do elemento: a cor é a de Criar (paleta semântica, §2-bis); o nome é o `createTitle`. */
function BotaoDeInclusao({ item, aoAbrir }: BotaoDeInclusaoProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-label={item.createTitle}
      title={item.createTitle}
      className={`absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-md
        transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary
        ${classeDeCorDoBotao(XButtonAction.Create, undefined) ?? ''}`}
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  );
}

interface InclusaoPeloElementoProps {
  item: XNavigatorItem;
  registro: string | null;
  aoCancelar: () => void;
  aoGravar: () => void;
}

/**
 * O diálogo do "+": o formulário da App do elemento em inclusão (POST no `saveEndpoint`), com Salvar e Cancelar, contido
 * na área do navegador. Gravado, invalida as consultas de dados (a tela do elemento relê) e avisa o navegador.
 */
function InclusaoPeloElemento({ item, registro, aoCancelar, aoGravar }: InclusaoPeloElementoProps): JSX.Element | null {
  const modelo = useApplicationByName(item.applicationName);
  const app = useMemo(() => (modelo.data ? comContexto(modelo.data, registro) : null), [modelo.data, registro]);
  // O registro novo nasce com o que o back declarou em `defaultValue` (CE-19) — inclusive o `{contexto}`, que o
  // `comContexto` já trocou pela chave do nível: o campo do projeto entra preenchido e some do diálogo (dono,
  // 2026-10-26: dentro do projeto só se cria repositório daquele projeto). Memorizado: o modal recarrega quando a
  // referência muda, e um objeto novo por render apagaria o que o usuário digita.
  const dadosIniciais = useMemo(() => (app ? valoresPadraoDeFormulario(app.formView, app.tabbedFormView) : {}), [app]);
  const [gravando, setGravando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const gravar = useCallback(async (pDados: Record<string, unknown>) => {
    if (!app)
      return;

    setGravando(true);
    setErros({});
    try {
      const destino = app.tabbedFormView?.saveEndpoint || app.formView.saveEndpoint;
      await api.post(destino, prepararDadosParaGravar(pDados, app.formView, app.tabbedFormView));
      // A tela do elemento lista o que acabou de entrar; dentro de um AppX, o cabeçalho e os registros dele também.
      await queryClient.invalidateQueries({ queryKey: ['app-data'] });
      void queryClient.invalidateQueries({ queryKey: ['painel-resumo'] });
      void queryClient.invalidateQueries({ queryKey: ['painel-contextos'] });
      aoGravar();
    } catch (erro) {
      // O diálogo já lista os erros (api.ts); aqui cada campo recusado fica marcado, com a mesma frase embaixo.
      if (erro instanceof ApiError && erro.fieldErrors.length > 0)
        setErros(Object.fromEntries(erro.fieldErrors.map((pE) => [pE.field, pE.messages.join('\n')])));
      console.error('Save error:', erro);
    } finally {
      setGravando(false);
    }
  }, [app, queryClient, aoGravar]);

  if (modelo.isError)
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-brand-surface/90" role="dialog" aria-label={item.createTitle}>
        <div className="flex flex-col items-center gap-3">
          <Orientacao titulo={`'${item.createTitle}' não pôde abrir`} texto={mensagemDeFalha(modelo.error, `abrir '${item.createTitle}'`)} />
          <button type="button" onClick={aoCancelar} className="h-8 px-3 rounded-lg text-ui border border-border text-brand-text-primary bg-brand-background hover:bg-hover">
            {'Fechar'}
          </button>
        </div>
      </div>
    );

  if (!app)
    return null;

  if (app.tabbedFormView)
    return (
      <XTabbedFormModal
        formView={app.tabbedFormView}
        mode={XApplicationMode.Create}
        data={dadosIniciais}
        isOpen
        isSaving={gravando}
        onSave={(pDados) => void gravar(pDados)}
        onCancel={aoCancelar}
        serverErrors={erros}
      />
    );

  return (
    <XFormModal
      formView={app.formView}
      mode={XApplicationMode.Create}
      data={dadosIniciais}
      isOpen
      isSaving={gravando}
      onSave={(pDados) => void gravar(pDados)}
      onCancel={aoCancelar}
      serverErrors={erros}
    />
  );
}

interface TelaDoElementoProps {
  item: XNavigatorItem;
  registro: string | null;
  tabID: string;
  filtroInicial?: Record<string, string>;
}

/** A App do elemento, no painel maior: o modelo podado vem por nome, e o registro do AppX entra nos endpoints. */
function TelaDoElemento({ item, registro, tabID, filtroInicial }: TelaDoElementoProps): JSX.Element {
  const modelo = useApplicationByName(item.applicationName);
  const comRegistro = useMemo(() => (modelo.data ? comContexto(modelo.data, registro) : null), [modelo.data, registro]);

  if (modelo.isError)
    return <Orientacao titulo={`'${item.title}' não pôde ser aberto`} texto={mensagemDeFalha(modelo.error, `abrir '${item.title}'`)} />;

  if (!comRegistro)
    return <div className="flex-1 min-h-[200px] rounded-lg bg-brand-surface border border-border-light animate-pulse" aria-busy="true" />;

  // Painel: o conteúdo já é feito de cartões, e vai sem moldura nem rolagem própria.
  if (comRegistro.viewTemplate === XViewTemplate.Dashboard)
    return (
      <div className="relative flex-1 min-w-0 flex flex-col">
        <XDashboardView application={comRegistro} tabID={tabID} embutido />
      </div>
    );

  return (
    // A área posicionada é a do elemento: os modais dele ficam contidos aqui (skill tootega-front §1).
    <div className="relative flex-1 min-w-0 min-h-[420px] flex flex-col rounded-lg border border-border-light bg-brand-surface overflow-hidden">
      <XApplicationView application={comRegistro} tabID={tabID} filtroInicial={filtroInicial} />
    </div>
  );
}

/** Orientação no lugar do navegador ou do elemento: diz o que aconteceu e o que fazer (erro mudo é defeito). */
function Orientacao({ titulo, texto }: { titulo: string; texto: string }): JSX.Element {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div role="status" className="max-w-[560px] flex flex-col items-center text-center gap-2">
        <Compass size={28} className="text-brand-primary" aria-hidden="true" />
        <p className="text-ui font-semibold text-brand-text-primary">{titulo}</p>
        <p className="text-ui-sm text-brand-text-secondary">{texto}</p>
      </div>
    </div>
  );
}
