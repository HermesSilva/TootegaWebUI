/**
 * XCardListView — a LISTA DE CARTÕES (`XViewTemplate.CardList` — dono, 2026-10-26).
 *
 * CADA registro da consulta num cartão, com o formulário da App aberto dentro dele e editável no lugar — sem grade, sem
 * seleção, sem modal de edição. É a tela de um elemento de navegador que gerencia POUCOS registros (os projetos de uma
 * Empresa):
 *   - a lista vem da consulta de sempre (`dataView.dataEndpoint`), em levas de `cardList.pageSize`; havendo mais, a tela
 *     diz quantos faltam e oferece "Mostrar mais";
 *   - o cabeçalho do cartão sai da LINHA da consulta (`subtitleField` em destaque, `titleField` depois — o código e o
 *     nome), e nunca se corta;
 *   - o cartão carrega o SEU registro de `formView.loadEndpoint` (`{id}` pela `dataView.keyField`) e grava com PUT em
 *     `formView.saveEndpoint`; o **Salvar só aparece quando algum campo difere do carregado** (desfazer a mudança o
 *     esconde de novo), e grava só aquele cartão;
 *   - gravado, o cartão relê o registro e a lista se relê (o cabeçalho acompanha o que mudou); dentro de um AppX, o
 *     cabeçalho e os registros dele também;
 *   - os campos recusados pelo servidor ficam marcados, todos de uma vez, no cartão que gravou;
 *   - os cartões fluem num WrapPanel (`XWrapPanel`), o padrão dos painéis de uma área SubAppX: da esquerda para a
 *     direita, cada um na largura declarada (`formView.modalWidth`, % da área), quebrando linha quando ela acaba.
 *
 * A inclusão não é daqui: é o "+" do elemento de navegador que abre esta App (`XNavigatorItem.createTitle`), com o
 * mesmo formulário em modo de inclusão. 100% dirigido pelo modelo (CE-19); contido na área da App (nunca overlay).
 *
 * ┌─────────────────────────────────────────────────┐
 * │  Título                                          │
 * ├─────────────────────────────────────────────────┤
 * │  ┌ CÓDIGO  Nome ─────────────────────────────┐   │
 * │  │ seções + editores                          │   │
 * │  │                                  [Salvar]  │   │  ← só com alteração
 * │  └────────────────────────────────────────────┘   │
 * │  ┌ CÓDIGO  Nome ─────────────────────────────┐   │
 * │  …                                                │
 * └─────────────────────────────────────────────────┘
 */

import { useState, useCallback, useEffect, useId, useMemo, type CSSProperties, type JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, LogOut, LayoutList } from 'lucide-react';
import { XButtonAction, XButtonColor, type XApplication, type XFormView as XFormViewType, type XQueryRequest, type XRowAction } from '@core/types';
import { api, ApiError } from '@core/lib/api';
import { CLOSE_BUTTON_CLASS, acoesVisiveisNaLinha, getFieldValue, mensagemDeFalha } from '@core/lib';
import { iconeLucide } from '@core/lib/iconeLucide';
import { classeDeCorDoBotao, XBUTTON_PALETTE } from '@core/lib/xButtonPalette';
import { useAppX } from '@core/hooks/useAppX';
import { MODAL_MAX_PERCENT, pisoDoFormularioPx } from '@core/lib/formScale';
import { prepararDadosParaGravar } from '@core/lib/prepararDadosParaGravar';
import { useApplicationData } from '@core/hooks/useApplication';
import { XWrapPanel } from '@core/components/painel/elementos/XWrapPanel';
import { XCartaoDeRegistro } from '@core/components/painel/elementos/XCartaoDeRegistro';
import { XFormView } from './XFormView';

/**
 * O registro como comparação: a mesma forma serializada ⇒ nada mudou. Compara-se o que SERIA gravado (o preparo de
 * gravação normaliza a caixa — o servidor manda `codigo`, o editor grava `Codigo` — e o tipo do combo); comparar o
 * bruto faria o Salvar ficar depois de o usuário desfazer a alteração.
 */
const assinatura = (pDados: Record<string, unknown>, pFormView: XFormViewType): string =>
  JSON.stringify(prepararDadosParaGravar(pDados, pFormView));

export interface XCardListViewProps {
  application: XApplication;
  tabID: string;
  onClose?: () => void;
}

export function XCardListView({ application, tabID, onClose }: XCardListViewProps): JSX.Element {
  const lista = application.cardList;
  const formView = application.formView;
  const leva = lista?.pageSize || 50;
  const [limite, setLimite] = useState(leva);
  const requisicao = useMemo<XQueryRequest>(() => ({ filters: [], sort: [], page: 1, pageSize: limite }), [limite]);
  const consulta = useApplicationData({ endpoint: application.dataView.dataEndpoint, request: requisicao, enabled: !!lista });
  const { refetch } = consulta;
  const queryClient = useQueryClient();
  // Dentro de um AppX, a ação de linha que LEVA A UM NÍVEL (o "Abrir repositório") aparece no cabeçalho do cartão; as
  // demais ações de linha não entram no cartão — ele é sob medida, e elas vivem na App do menu.
  const appX = useAppX();
  const acoesDeNivel = useMemo(
    () => (application.dataView.rowActions ?? []).filter((pA) => !!pA.openLevel && !!appX?.temNivel(pA.openLevel)),
    [application.dataView.rowActions, appX]);

  const registros = consulta.data?.records ?? [];
  const total = consulta.data?.totalRecords ?? 0;

  // Gravou um cartão: a lista se relê (o cabeçalho do cartão vem dela) e, dentro de um AppX, o cabeçalho e a lista de
  // registros dele podem ter mudado (o nome do projeto): o AppX os relê.
  const aoGravar = useCallback(() => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['painel-resumo'] });
    void queryClient.invalidateQueries({ queryKey: ['painel-contextos'] });
  }, [refetch, queryClient]);

  const titulo = formView.title || application.title;

  // O cartão no tamanho que os dados pedem (FE-3/FE-9): o percentual declarado da área, nunca abaixo do piso dos
  // editores; sem declaração, a largura toda. No celular, sempre a largura toda (FE-0).
  const largura = useMemo<CSSProperties | undefined>(() => {
    if (!formView.modalWidth)
      return undefined;
    const percentual = Math.min(formView.modalWidth, MODAL_MAX_PERCENT);
    return { '--largura-do-cartao': `max(${percentual}%, ${pisoDoFormularioPx(formView)}px)` } as CSSProperties;
  }, [formView]);

  return (
    <div className="relative flex flex-col h-full bg-brand-surface" data-tab-id={tabID} data-application-id={application.id}>
      <div className="flex items-center px-2 sm:px-4 py-2 border-b border-border-light bg-brand-surface min-h-row gap-2">
        <span className="text-ui font-medium text-brand-fg">{titulo}</span>
        <div className="flex-1 min-w-[8px]" />
        {onClose && (
          <button type="button" onClick={onClose} aria-label={'Fechar'} className={CLOSE_BUTTON_CLASS}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{'Fechar'}</span>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-2 sm:px-4 py-3">
        {!lista ? (
          <Orientacao
            titulo="Esta lista de cartões veio sem a declaração dos cartões"
            texto={`A App '${application.name}' está marcada como lista de cartões, mas o modelo que chegou não traz a lista (cardList). É defeito da declaração no back.`}
          />
        ) : consulta.isError ? (
          <Orientacao titulo={`'${titulo}' não pôde ser listado`} texto={mensagemDeFalha(consulta.error, `listar '${titulo}'`)} />
        ) : consulta.isLoading ? (
          <div className="flex items-center gap-2 text-brand-muted" aria-busy="true">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-ui">{'Carregando…'}</span>
          </div>
        ) : registros.length === 0 ? (
          <p role="status" className="text-ui text-brand-text-secondary">{application.dataView.emptyMessage || 'Nenhum registro encontrado'}</p>
        ) : (
          // Os cartões fluem e quebram linha (WrapPanel — o padrão dos painéis de uma área SubAppX, dono 2026-10-26).
          <XWrapPanel as="ul" aria-label={titulo}>
            {registros.map((pRegistro) => {
              const chave = String(getFieldValue(pRegistro, application.dataView.keyField) ?? '');
              return (
                <li key={chave} className="w-full sm:w-[var(--largura-do-cartao,100%)] max-w-full" style={largura}>
                  <CartaoDoRegistro
                    application={application}
                    chave={chave}
                    titulo={String(getFieldValue(pRegistro, lista.titleField) ?? '')}
                    subtitulo={lista.subtitleField ? String(getFieldValue(pRegistro, lista.subtitleField) ?? '') : ''}
                    aoGravar={aoGravar}
                    acoes={acoesVisiveisNaLinha(acoesDeNivel, pRegistro)}
                    aoAbrirNivel={(pAcao) => appX?.irPara(pAcao.openLevel!, chave)}
                  />
                </li>
              );
            })}
          </XWrapPanel>
        )}

        {lista && total > registros.length && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <span className="text-ui-sm text-brand-text-secondary">{`Mostrando ${registros.length} de ${total}`}</span>
            <button
              type="button"
              onClick={() => setLimite((pLimite) => pLimite + leva)}
              className="h-8 inline-flex items-center justify-center rounded-lg px-3 text-ui border border-border text-brand-text-primary bg-brand-background hover:bg-hover transition-colors"
            >
              {'Mostrar mais'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface CartaoDoRegistroProps {
  application: XApplication;
  /** A chave do registro (a `keyField` da linha): resolve o `{id}` da carga e da gravação. */
  chave: string;
  titulo: string;
  subtitulo: string;
  aoGravar: () => void;
  /** As ações desta linha que levam a um nível do AppX (já filtradas pela linha e pelo modelo podado). */
  acoes: XRowAction[];
  aoAbrirNivel: (pAcao: XRowAction) => void;
}

/** Um cartão: o cabeçalho da linha, o formulário do registro e o Salvar, que só existe quando há o que gravar. */
function CartaoDoRegistro({ application, chave, titulo, subtitulo, aoGravar, acoes, aoAbrirNivel }: CartaoDoRegistroProps): JSX.Element {
  const formView = application.formView;
  const idDoTitulo = useId();
  const [dados, setDados] = useState<Record<string, unknown>>({});
  // O registro como chegou do servidor: é contra ele que o cartão sabe se há o que gravar.
  const [carregado, setCarregado] = useState(() => assinatura({}, formView));
  const [carregando, setCarregando] = useState(true);
  const [gravando, setGravando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  // Os campos recusados pelo servidor, marcados no cartão (dono, 2026-10-12: a validação marca TODOS os campos).
  const [erros, setErros] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setFalha(null);
    try {
      const registro = await api.get<Record<string, unknown>>(formView.loadEndpoint.replace('{id}', chave));
      setDados(registro ?? {});
      setCarregado(assinatura(registro ?? {}, formView));
    } catch (erro) {
      setFalha(mensagemDeFalha(erro, `abrir '${titulo}'`));
    } finally {
      setCarregando(false);
    }
  }, [formView, chave, titulo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const alterar = useCallback((pCampo: string, pValor: unknown, pVinculos?: Record<string, unknown>) => {
    setDados((pAnterior) => ({ ...pAnterior, ...(pVinculos ?? {}), [pCampo]: pValor }));
    // Mexeu no campo recusado: a marca sai dele (as dos outros ficam até a próxima gravação).
    setErros((pAnterior) => {
      if (!(pCampo in pAnterior))
        return pAnterior;
      const { [pCampo]: _corrigido, ...resto } = pAnterior;
      return resto;
    });
  }, []);

  const gravar = useCallback(async () => {
    setGravando(true);
    setErros({});
    try {
      const destino = formView.saveEndpoint.includes('{id}')
        ? formView.saveEndpoint.replace('{id}', chave)
        : `${formView.saveEndpoint}/${chave}`;
      await api.put(destino, prepararDadosParaGravar(dados, formView));
      // Relê para reexibir o que o servidor consolidou — e o que foi gravado vira a nova referência do Salvar.
      await carregar();
      aoGravar();
    } catch (erro) {
      // O diálogo já lista os erros (api.ts); aqui cada campo recusado fica marcado, com a mesma frase embaixo.
      if (erro instanceof ApiError && erro.fieldErrors.length > 0)
        setErros(Object.fromEntries(erro.fieldErrors.map((pE) => [pE.field, pE.messages.join('\n')])));
      console.error('Save error:', erro);
    } finally {
      setGravando(false);
    }
  }, [formView, chave, dados, carregar, aoGravar]);

  // Há o que gravar só quando algum campo difere do que foi carregado.
  const alterado = !carregando && !falha && assinatura(dados, formView) !== carregado;

  return (
    // A moldura é a comum dos cartões da área SubAppX (borda expressiva, faixa de cabeçalho): o mesmo molde do
    // formulário de configuração.
    <XCartaoDeRegistro
      titulo={titulo}
      subtitulo={subtitulo}
      icone={LayoutList}
      idDoTitulo={idDoTitulo}
      registro={chave}
      complemento={acoes.length > 0 ? (
        <div className="flex items-center gap-1">
          {acoes.map((pAcao) => {
            const Icone = iconeLucide(pAcao.icon);
            return (
              <button
                key={pAcao.name}
                type="button"
                onClick={() => aoAbrirNivel(pAcao)}
                title={pAcao.title}
                className={`h-6 inline-flex items-center gap-1 rounded-md px-2 text-ui-xs font-medium transition-colors
                  ${XBUTTON_PALETTE[pAcao.color ?? XButtonColor.Default] ?? ''}`}
              >
                {Icone && <Icone size={12} aria-hidden="true" />}
                <span>{pAcao.title}</span>
              </button>
            );
          })}
        </div>
      ) : undefined}
    >
      <>
        {carregando ? (
          <div className="flex items-center gap-2 text-brand-muted" aria-busy="true">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-ui">{'Carregando…'}</span>
          </div>
        ) : falha ? (
          <p role="alert" className="text-ui text-brand-text-secondary">{falha}</p>
        ) : (
          <XFormView formView={formView} data={dados} onChange={alterar} errors={erros} />
        )}

        {alterado && (
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => void gravar()}
              disabled={gravando}
              className={`h-10 sm:h-8 inline-flex items-center justify-center gap-2 rounded-lg transition-colors px-3
                disabled:opacity-50 disabled:cursor-not-allowed ${classeDeCorDoBotao(XButtonAction.Save, undefined) ?? ''}`}
            >
              {gravando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="text-ui">{'Salvar'}</span>
            </button>
          </div>
        )}
      </>
    </XCartaoDeRegistro>
  );
}

/** Orientação no lugar da lista: diz o que aconteceu e o que fazer (erro mudo é defeito). */
function Orientacao({ titulo, texto }: { titulo: string; texto: string }): JSX.Element {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div role="status" className="max-w-[560px] flex flex-col items-center text-center gap-2">
        <LayoutList size={28} className="text-brand-primary" aria-hidden="true" />
        <p className="text-ui font-semibold text-brand-text-primary">{titulo}</p>
        <p className="text-ui-sm text-brand-text-secondary">{texto}</p>
      </div>
    </div>
  );
}
