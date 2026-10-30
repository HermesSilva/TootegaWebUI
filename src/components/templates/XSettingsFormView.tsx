/**
 * XSettingsFormView — o FORMULÁRIO DE CONFIGURAÇÃO (`XViewTemplate.SettingsForm` — dono, 2026-10-26).
 *
 * UM registro, o do contexto (a empresa corrente, ou o registro do nível do AppX pelo `{contexto}`), sem grade, sem
 * seleção e sem modal — como o formulário único —, mas FLUIDO: é a tela que um elemento de navegador abre (as
 * configurações da empresa, do projeto, do repositório), e por isso
 *   - o formulário ocupa só a largura que o back declara (`ModalWidth`, % da área — FE-3), nunca abaixo do piso dos
 *     editores (FE-9); sem declaração, a largura toda; no celular, sempre a largura toda (FE-0);
 *   - o **Salvar** vem logo abaixo dos campos, e num formulário longo fica preso ao pé da área visível;
 *   - o Salvar só fica ativo quando algum campo difere do que foi carregado (desfazer a mudança o desliga de novo).
 *
 * 100% dirigido pelo modelo (CE-19): o formulário é o `XFormView` declarado no back; contido na área da App (nunca
 * overlay). Os campos recusados pelo servidor ficam marcados, todos de uma vez.
 *
 * ┌─────────────────────────────────────────────────┐
 * │  Título                                          │
 * ├─────────────────────────────────────────────────┤
 * │  ┌ Formulário (ModalWidth % da área) ┐           │
 * │  │ seções + editores                 │           │
 * │  └─────────────────────── [Salvar] ──┘           │
 * └─────────────────────────────────────────────────┘
 */

import { useState, useCallback, useEffect, useMemo, type CSSProperties, type JSX } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Save, Loader2, LogOut, SlidersHorizontal } from 'lucide-react';
import { XCartaoDeRegistro } from '@core/components/painel/elementos/XCartaoDeRegistro';
import { XButtonAction } from '@core/types';
import type { XApplication, XFormView as XFormViewType } from '@core/types';
import { api, ApiError } from '@core/lib/api';
import { CLOSE_BUTTON_CLASS } from '@core/lib';
import { classeDeCorDoBotao } from '@core/lib/xButtonPalette';
import { MODAL_MAX_PERCENT, pisoDoFormularioPx } from '@core/lib/formScale';
import { prepararDadosParaGravar } from '@core/lib/prepararDadosParaGravar';
import { XFormView } from './XFormView';

/**
 * O registro como comparação: a mesma forma serializada ⇒ nada mudou. Compara-se o que SERIA gravado (o preparo de
 * gravação normaliza a caixa — o servidor manda `nome`, o editor grava `Nome` — e o tipo do combo); comparar o bruto
 * deixaria o Salvar ligado depois de o usuário desfazer a alteração.
 */
const assinatura = (pDados: Record<string, unknown>, pFormView: XFormViewType): string =>
  JSON.stringify(prepararDadosParaGravar(pDados, pFormView));

/**
 * `useQueryClient` LANÇA sem `QueryClientProvider` acima; aqui a ausência é legítima (o formulário pode montar sem
 * ele, como nos testes). Sem cliente, a releitura do AppX depois de gravar só não acontece.
 */
function useQueryClientOpcional(): QueryClient | null {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- o try/catch não ramifica a ordem dos hooks: useQueryClient
    // é sempre chamado; o catch só trata a ausência do provider.
    return useQueryClient();
  } catch {
    return null;
  }
}

export interface XSettingsFormViewProps {
  application: XApplication;
  tabID: string;
  onClose?: () => void;
}

export function XSettingsFormView({ application, tabID, onClose }: XSettingsFormViewProps): JSX.Element {
  const formView = application.formView;

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  // O registro como chegou do servidor: é contra ele que o Salvar sabe se há o que gravar.
  const [carregado, setCarregado] = useState(() => assinatura({}, formView));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Os campos recusados pelo servidor, marcados no formulário (dono, 2026-10-12: a validação marca TODOS os campos).
  const [erros, setErros] = useState<Record<string, string>>({});
  const queryClient = useQueryClientOpcional();

  const load = useCallback(async () => {
    if (!formView.loadEndpoint)
      return;

    setIsLoading(true);
    try {
      const detail = await api.get<Record<string, unknown>>(formView.loadEndpoint);
      setFormData(detail ?? {});
      setCarregado(assinatura(detail ?? {}, formView));
    } catch (error) {
      // O erro global (ErrorContext) já avisa; aqui o formulário só fica com o que tinha.
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [formView]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = useCallback((pFieldName: string, pValue: unknown, pBindings?: Record<string, unknown>) => {
    setFormData((prev) => ({ ...prev, ...(pBindings ?? {}), [pFieldName]: pValue }));
    // Mexeu no campo recusado: a marca sai dele (as dos outros ficam até a próxima gravação).
    setErros((prev) => {
      if (!(pFieldName in prev))
        return prev;
      const { [pFieldName]: _corrigido, ...resto } = prev;
      return resto;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!formView.saveEndpoint)
      return;

    setIsSaving(true);
    setErros({});
    try {
      // PUT: o registro é o do contexto (a empresa corrente, ou o do nível do AppX pelo {contexto}). Preparado como
      // todo formulário do modelo: o combo de enumerado liga texto, e o contrato espera número.
      await api.put(formView.saveEndpoint, prepararDadosParaGravar(formData, formView));
      // Relê para reexibir o que o servidor consolidou — e o que foi gravado vira a nova referência do Salvar.
      await load();
      // Dentro de um AppX, o cabeçalho e a lista de registros podem ter mudado (o nome do projeto): o AppX os relê.
      void queryClient?.invalidateQueries({ queryKey: ['painel-resumo'] });
      void queryClient?.invalidateQueries({ queryKey: ['painel-contextos'] });
    } catch (error) {
      // O diálogo já lista os erros (api.ts); aqui cada campo recusado fica marcado, com a mesma frase embaixo.
      if (error instanceof ApiError && error.fieldErrors.length > 0)
        setErros(Object.fromEntries(error.fieldErrors.map((pE) => [pE.field, pE.messages.join('\n')])));
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [formView.saveEndpoint, formData, load, queryClient]);

  // Há o que gravar só quando algum campo difere do que foi carregado.
  const alterado = assinatura(formData, formView) !== carregado;
  const podeSalvar = alterado && !isSaving && !isLoading;

  // Largura do formulário (FE-3/FE-9): o percentual declarado da área, nunca abaixo do piso dos editores.
  const largura = useMemo<CSSProperties | undefined>(() => {
    if (!formView.modalWidth)
      return undefined;
    const percentual = Math.min(formView.modalWidth, MODAL_MAX_PERCENT);
    return { '--largura-do-formulario': `max(${percentual}%, ${pisoDoFormularioPx(formView)}px)` } as CSSProperties;
  }, [formView]);

  const fechar = onClose ? (
    <button type="button" onClick={onClose} aria-label={'Fechar'} className={CLOSE_BUTTON_CLASS}>
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">{'Fechar'}</span>
    </button>
  ) : undefined;

  return (
    <div className="relative flex flex-col h-full bg-brand-surface" data-tab-id={tabID} data-application-id={application.id}>
      <div className="flex-1 min-h-0 overflow-auto px-2 sm:px-4 py-3">
        <div className="w-full sm:w-[var(--largura-do-formulario,100%)] max-w-full" style={largura} data-testid="formulario-de-configuracao">
          {/* O registro do contexto num CARTÃO, no mesmo molde dos cartões da lista (dono, 2026-10-26): borda expressiva,
              faixa de cabeçalho com o título, e o Salvar que só aparece quando há o que gravar. */}
          <XCartaoDeRegistro titulo={formView.title || application.title} icone={SlidersHorizontal} complemento={fechar}>
            <>
              {isLoading ? (
                <div className="flex items-center gap-2 text-brand-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-ui">{'Carregando…'}</span>
                </div>
              ) : (
                <XFormView formView={formView} data={formData} onChange={handleChange} errors={erros} />
              )}

              {/* Logo abaixo dos campos; num formulário longo, preso ao pé da área visível. Não há Cancelar: sair sem
                  gravar é trocar de elemento ou de aba. */}
              {alterado && (
                <div className="sticky bottom-0 flex items-center justify-end gap-2 pt-2 bg-brand-surface">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!podeSalvar}
                    className={`h-10 sm:h-8 inline-flex items-center justify-center gap-2 rounded-lg transition-colors px-3
                      disabled:opacity-50 disabled:cursor-not-allowed ${classeDeCorDoBotao(XButtonAction.Save, undefined) ?? ''}`}
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="text-ui">{'Salvar'}</span>
                  </button>
                </div>
              )}
            </>
          </XCartaoDeRegistro>
        </div>
      </div>
    </div>
  );
}
