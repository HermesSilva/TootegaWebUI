/**
 * XFormModal - Form Modal within Tab Scope
 * 
 * Modal that renders creation/edit forms.
 * The modal stays within the Tab scope, allowing:
 * - Switching between tabs with the modal open
 * - Each tab having its own independent modal
 * - The modal covers only the tab area, not the entire screen
 * 
 * Features:
 * - Header with title and close button
 * - Content area with scroll
 * - Footer with Save/Cancel buttons
 * - Enter/exit animation
 * - Escape does NOT close (dono, 2026-10-17): only Cancelar/Fechar do
 */

import { useState, useCallback, useEffect, useMemo, type JSX } from 'react';
import { Save, Loader2, LogOut, FileDown } from 'lucide-react';
import { XApplicationMode, XButtonColor, XUIEditorType } from '@core/types';
import type { XFormView as XFormViewType, XRowAction } from '@core/types';
import { XFormView } from './XFormView';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { useMolduraDeModal, chaveDoQuadroDoFormulario, type QuadroDeModal } from '@core/hooks/useMolduraDeModal';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';
import { useDevice } from '@core/hooks/useDevice';
import { useRecalculoAoDigitar } from '@core/hooks/useRecalculoAoDigitar';
import { pisoDoFormularioPx, alturaDoCorpoPx, temCampoElastico, MODAL_MAX_PERCENT } from '@core/lib/formScale';
import { FormBusyProvider } from '@core/contexts/FormBusyContext';
import { FormValuesProvider } from '@core/contexts/FormValuesContext';
import { XFormBusyVeil } from './XFormBusyVeil';
import { XHint } from '@core/components/ui/XHint';
import { CLOSE_BUTTON_STYLE, aplicarTotaisAoVivo, aplicarValoresDirigidos, errosDoPrecoDoItem, getFieldValue, isVisible } from '@core/lib';
import { XBUTTON_PALETTE } from '@core/lib/xButtonPalette';

// ============================================================================
// Types
// ============================================================================

export interface XFormModalProps {
  formView: XFormViewType;
  mode: XApplicationMode;
  data: Record<string, unknown>;
  isOpen: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onSave: (pData: Record<string, unknown>) => void;
  onCancel: () => void;
  /** Ação por linha de uma grade embutida (o "Baixar" da parcela). Delegada ao XApplicationView. */
  onGridRowAction?: (pAction: XRowAction, pRow: Record<string, unknown>) => void;
  /**
   * Baixar ESTE documento em PDF. Presente ⇒ o rodapé ganha o botão; ausente ⇒ nada muda.
   *
   * Existe para o visualizador que é um RELATÓRIO (a conferência da nota): quem o lê na tela costuma
   * querer o papel — para arquivar, imprimir ou mandar ao contador —, e sem isto teria de tirar
   * captura de tela do que é, por natureza, um documento.
   */
  onExportPDF?: () => void;
  /** O PDF está sendo gerado: o botão espera, em vez de aceitar um segundo clique. */
  isExportingPDF?: boolean;
  /**
   * Erros POR CAMPO que o servidor devolveu na gravação (campo → texto), dono 2026-10-12: marcam o
   * campo no formulário, com a frase embaixo — o diálogo mostra a lista, e aqui ela vira a marca.
   */
  serverErrors?: Record<string, string>;
  /** A chave do registro aberto: resolve o `{id}` do `recalcEndpoint`. Ausente na inclusão. */
  recordID?: string;
}

// ============================================================================
// Component
// ============================================================================

export function XFormModal({
  formView,
  mode,
  data: initialData,
  isOpen,
  isLoading,
  isSaving,
  onSave,
  onCancel,
  onGridRowAction,
  onExportPDF,
  isExportingPDF,
  serverErrors,
  recordID,
}: XFormModalProps): JSX.Element | null {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Fixed ID for CSS selector compatibility (useId generates problematic IDs like ':r0:')
  const modalID = 'form-modal';
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [modalZIndex, setModalZIndex] = useState(0);
  // Moldura comum a todo diálogo (dono, 2026-10-25): borda, brilho, ARRASTAR pelo cabeçalho e
  // redimensionar pelas bordas. Posição e tamanho ficam no PERFIL do usuário, por formulário, e voltam na
  // próxima abertura. No celular o modal é cheio (FE-0): nada se arrasta nem se restaura.
  const { isMobile: ehCelular } = useDevice();
  const [quadroSalvo, salvarQuadro] = usePreferenciaDoUsuario<QuadroDeModal | null>(
    chaveDoQuadroDoFormulario(formView.name || 'formulario'), null);
  const moldura = useMolduraDeModal({
    arrastavel: !ehCelular, redimensionavel: !ehCelular, aberto: isOpen,
    quadroSalvo: ehCelular ? null : quadroSalvo, aoMudarQuadro: salvarQuadro,
  });

  // ERROS DO SERVIDOR marcam os campos (dono, 2026-10-12): mesmo estado da validação local, então o
  // editor fica vermelho com a frase embaixo e a marca sai quando o campo muda.
  useEffect(() => {
    if (serverErrors && Object.keys(serverErrors).length > 0)
      setErrors((prev) => ({ ...prev, ...serverErrors }));
  }, [serverErrors]);

  // Todos os campos do formulário, achatados: é sobre eles que as regras de valor correm.
  const camposDoFormulario = useMemo(
    () => formView.sections.flatMap((pSecao) => pSecao.fields),
    [formView.sections]
  );

  // ---------------------------------------------------------------------------
  // Sync initial data
  // ---------------------------------------------------------------------------

  // A cópia do que veio do servidor acontece DURANTE A RENDERIZAÇÃO, não num efeito — e a diferença
  // não é estilo.
  //
  // Num efeito, a sequência é: o pai recebe o registro e re-renderiza ⇒ este componente pinta os
  // campos AINDA com o estado antigo (vazio) ⇒ só então o efeito corre e copia ⇒ segundo render, com
  // os valores. Existe, portanto, um instante em que o formulário está na tela, os campos existem, o
  // botão Salvar responde, e o estado interno está VAZIO. Salvar ali manda um corpo sem os campos
  // carregados: o `CaminhoClaude` some e o back recusa, o `Ativo` vai como falso e DESLIGA o que
  // estava ligado, o `Token` some. Nada disso aparece em uso rápido — aparece com rede lenta, e
  // aparecia na suíte de testes sob carga, onde o intervalo entre os dois renders se alarga.
  //
  // Ajustar estado durante o render é o padrão que o React documenta para derivar estado de prop
  // (o `setState` na renderização re-executa o componente ANTES de pintar, e nenhum frame
  // intermediário chega ao DOM). É isto que fecha a janela — o guarda no Salvar, abaixo, é a
  // segunda linha de defesa, não a correção.
  const [dadosCarregados, setDadosCarregados] = useState<Record<string, unknown> | null>(null);

  if (isOpen && initialData !== dadosCarregados) {
    setDadosCarregados(initialData);

    // Abre já com o rodapé fechado (subtotal/valor final), inclusive quando os itens vêm carregados.
    const inicial = { ...initialData };
    if (formView.pricing)
      aplicarTotaisAoVivo(inicial, formView.pricing);
    // Valores dirigidos por regra (CE-19): na ABERTURA só preenchem campo vazio — o formulário novo
    // nasce com o valor certo e o que já foi gravado permanece como está.
    aplicarValoresDirigidos(null, inicial, camposDoFormulario);
    setFormData(inicial);
    setErrors({});
    setIsDirty(false);
  }

  // Fechar solta a referência: reabrir o MESMO registro tem de recopiar, e sem isto a comparação
  // acima acharia que já estava sincronizado e deixaria a edição anterior na tela.
  if (!isOpen && dadosCarregados !== null)
    setDadosCarregados(null);

  useEffect(() => {
    if (isOpen)
      setModalZIndex(ZIndexManager.next());
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  // Largura do card (FE-3/FE-9): o percentual declarado, elevado pelo piso das larguras mínimas dos
  // editores da linha mais larga. `max()` do CSS resolve os dois em unidades diferentes (% e px) — é
  // o piso, e só ele, que pode ultrapassar o teto de 90%.
  const larguraDoCard = useMemo(() => {
    const percentual = Math.min(formView.modalWidth || MODAL_MAX_PERCENT, MODAL_MAX_PERCENT);
    return `max(${percentual}%, ${pisoDoFormularioPx(formView)}px)`;
  }, [formView]);

  const alturaDoCorpo = useMemo(() => alturaDoCorpoPx(formView), [formView]);

  // Campo elástico exige altura DEFINIDA: sem `ModalRows`/`MaxHeight` (FE-4) o card cresce com o
  // conteúdo, e o conteúdo de um campo elástico é ele próprio — `height: 100%` resolve para `auto` e
  // o campo encolhe até o texto, com a sobra vazia embaixo. O card assume então a altura plena que já
  // era o seu teto (FE-5), e a cascata do FE-11 passa a ter de onde ceder. Mesma regra do modal com
  // abas; formulário sem campo elástico segue com a altura do conteúdo, como sempre.
  const alturaPlena = useMemo(
    () => alturaDoCorpo === 0 && temCampoElastico(formView), [alturaDoCorpo, formView]);

  const title = useMemo(() => {
    switch (mode) {
      case XApplicationMode.Create:
        return (formView.createTitle ?? '') || 'Novo Registro';
      case XApplicationMode.Edit:
        return (formView.editTitle ?? '') || 'Editar Registro';
      case XApplicationMode.Detail:
        return (formView.viewTitle ?? '') || 'Visualizar Registro';
      default:
        return (formView.title ?? '');
    }
  }, [mode, formView]);

  const isReadOnly = mode === XApplicationMode.Detail;
  const showSaveButton = mode === XApplicationMode.Create || mode === XApplicationMode.Edit;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // RECÁLCULO enquanto se digita (formView.recalcEndpoint, dono 2026-10-25): a correção de preço refaz o
  // demonstrativo do lucro a cada valor digitado. Fonte única no `useRecalculoAoDigitar`, a mesma do modal
  // de ação de linha. Sem registro aberto (inclusão) o `{id}` não existe, e não há o que recalcular.
  const camposRecalculaveis = useMemo(
    () => camposDoFormulario.map((pCampo) => ({ fieldName: pCampo.editor.fieldName, editor: pCampo.editor.editor })),
    [camposDoFormulario]);
  const notificarRecalculo = useRecalculoAoDigitar({
    endpoint: formView.recalcEndpoint && recordID ? formView.recalcEndpoint.replace('{id}', recordID) : undefined,
    gatilhos: formView.recalcTriggerFields,
    espera: formView.recalcDelay,
    campos: camposRecalculaveis,
    valores: formData,
    aplicar: setFormData,
  });

  const handleFieldChange = useCallback((
    pFieldName: string,
    pValue: unknown,
    pBindings?: Record<string, unknown>
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [pFieldName]: pValue };

      // Apply bindings if any (from ComboBox/Lookup selections)
      if (pBindings)
        for (const [key, value] of Object.entries(pBindings))
          updated[key] = value;

      // Fechamento ao vivo do rodapé (subtotal/valor final), quando o formulário o declara (CE-19).
      if (formView.pricing)
        aplicarTotaisAoVivo(updated, formView.pricing);

      // Campo que o modelo preenche ao ENTRAR numa condição — a borda é medida contra `prev`, e é o
      // que faz o Tipo de Nota seguir o documento sem desfazer a escolha do operador.
      aplicarValoresDirigidos(prev, updated, camposDoFormulario);

      return updated;
    });

    // Clear error for this field
    if (errors[pFieldName])
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[pFieldName];
        return updated;
      });

    setIsDirty(true);
    notificarRecalculo(pFieldName);
  }, [errors, formView, camposDoFormulario, notificarRecalculo]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Obrigatoriedade só vale para campo VISÍVEL: um campo escondido por regra (o Nome do balcão, que
    // some quando há documento) ou do tipo Hidden não pode barrar a gravação. Mesmo critério de
    // visibilidade do XFormView — assim o front recusa ANTES de mandar (não deixa o usuário errar), em
    // vez de descobrir a falta no 400 do back.
    for (const section of formView.sections)
      for (const field of section.fields) {
        const visivel = field.editor.editor.editorType !== XUIEditorType.Hidden
          && isVisible(field.visibleWhen, formData);

        if (visivel && field.editor.editor.isRequired) {
          const value = getFieldValue(formData, field.editor.fieldName);
          if (value === undefined || value === null || value === '')
            newErrors[field.editor.fieldName] = `${field.editor.title} é obrigatório`;
        }
      }

    // O PREÇO DO ITEM fora da regra (igual ou maior que o unitário) não grava: o desconto sairia de um preço que a
    // regra recusa. A frase nomeia todos os itens de uma vez, no campo da grade.
    Object.assign(newErrors, errosDoPrecoDoItem(formView.sections.flatMap((pS) => pS.fields), formData));

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formView.sections, formData]);

  const handleSave = useCallback(() => {
    // Carregando ⇒ não há o que salvar. Gravar o formulário antes de ele receber o registro envia um
    // corpo sem os campos que o usuário não viu, e o servidor entende ausência como valor: apaga
    // texto e desliga booleano. Silencioso, porque a gravação "funciona".
    if (isLoading)
      return;

    if (!validateForm())
      return;

    // O rodapé calculado (subtotal e valor final) é PRÉVIA de tela, derivada do desconto geral —
    // nunca ENTRADA. O contrato do back aceita "desconto geral OU valor final, nunca os dois"
    // (XFechamentoDocumento); mandar o valor final derivado JUNTO com o desconto quebraria essa regra.
    // Por isso o que o back recalcula não vai no payload — ele é a fonte da verdade (CE-19).
    const payload = { ...formData };
    if (formView.pricing) {
      delete payload[formView.pricing.subtotalField];
      delete payload[formView.pricing.finalValueField];
    }

    onSave(payload);
  }, [isLoading, formData, formView.pricing, validateForm, onSave]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      // TODO: Could add confirmation dialog here
      // For now, just close
    }
    onCancel();
  }, [isDirty, onCancel]);

  // ESC NÃO FECHA O MODAL (dono, 2026-10-17): um formulário aberto pela barra de botões ou pela grade
  // só sai por Cancelar/Fechar — o Esc era um toque fora de hora que descartava o que estava sendo
  // digitado (um picker ou uma lista aberta por cima também o recebem). Só o Ctrl+S fica.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (showSaveButton && !isSaving && !isLoading)
        handleSave();
    }
  }, [handleSave, showSaveButton, isSaving, isLoading]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen)
    return null;

  return (
    <FormBusyProvider emInclusao={mode === XApplicationMode.Create}>
    <FormValuesProvider valores={formData}>
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: modalZIndex }}
      onKeyDown={handleKeyDown}
      data-tour="form-modal"
      data-modal-id={modalID}
    >
      {/* Backdrop - não fecha ao clicar para evitar perda de dados */}
      <div
        className="absolute inset-0 bg-black/40 sm:backdrop-blur-sm animate-in fade-in duration-200"
        role="presentation"
      />

      {/* Véu de ocupado: gravação em curso, ou trabalho demorado disparado por algum editor. */}
      <XFormBusyVeil isSaving={isSaving} />

      {/* Card centrado, de largura DETERMINADA (FE-1/FE-3): o percentual declarado pelo back sobre a
          área do App. O conteúdo não a altera — texto longo trunca dentro do campo (FE-6). O PISO das
          larguras mínimas dos editores (FE-9) pode elevá-la, e só ele ultrapassa o teto de 90%; nesse
          caso a área do App rola horizontalmente. Altura: ModalRows × altura-de-linha (FE-4), teto de
          90% com rolagem do corpo. No celular o modal é cheio e nada disto se aplica (FE-0). */}
      <div
        ref={moldura.ref}
        className={`
          x-moldura-modal relative w-full sm:w-[var(--x-modal-width)]
          flex flex-col bg-brand-surface
          animate-in fade-in duration-200 transition-none will-change-transform
          max-h-[90%] ${alturaPlena ? 'h-[90%]' : ''}
          rounded-2xl
        `}
        style={{
          '--x-modal-width': larguraDoCard,
        } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
      >
        {moldura.alcasDeRedimensionar}
        {/* Header. `shrink-0`: quem cede espaço num card de altura limitada é o CONTEÚDO (que rola),
            nunca a moldura — sem isto o título é comprimido por conteúdo alto. */}
        <div
          className={`shrink-0 flex items-center justify-between px-4 sm:px-6 py-2 sm:py-2.5 border-b border-border-light bg-brand-surface rounded-t-[14px] z-10 ${
            ehCelular ? '' : 'cursor-move select-none touch-none'}`}
          data-testid="form-alca-arrasto"
          {...moldura.alca}
        >
          <h2
            id="form-modal-title"
            className="text-base sm:text-lg font-semibold text-brand-text-primary whitespace-nowrap pr-2"
          >
            {title}
          </h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <XHint label={'Fechar'} shortcut="Esc" placement="left">
            <button
              type="button"
              onClick={handleCancel}
              aria-label={'Fechar'}
              className="p-2 rounded-lg hover:bg-hover transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <LogOut className="w-5 h-5 text-brand-text-muted" />
            </button>
            </XHint>
          </div>
        </div>

        {/* Corpo. Altura declarada (FE-4): ModalRows × altura-de-linha. Passou do teto de 90%, rola. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          data-corpo-do-modal
          style={alturaDoCorpo > 0 ? { height: `${alturaDoCorpo}px` } : undefined}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : (
            <XFormView
              formView={formView}
              data={formData}
              originalData={initialData}
              onChange={handleFieldChange}
              errors={errors}
              isReadOnly={isReadOnly}
              onGridRowAction={onGridRowAction}
            />
          )}
        </div>

        {/* Footer - Sticky at bottom on mobile */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5 border-t border-border-light bg-muted-bg rounded-b-[14px]">
          {/* EXPORTAR EM PDF — só quando quem abriu o modal declarou como fazê-lo. Cor de documento
              (a mesma do DANFE e da proposta na barra), à esquerda do Fechar: é ação sobre o
              conteúdo, não sobre o modal. */}
          {onExportPDF && (
            <XHint
              label={'Exportar em PDF'}
              body={'Baixa este relatório em PDF, para imprimir, arquivar ou enviar.'}
              tone="info"
            >
              <button
                type="button"
                onClick={onExportPDF}
                disabled={isExportingPDF || isLoading}
                className={`
                  inline-flex items-center justify-center gap-2 mr-auto
                  px-4 py-3 sm:py-2 text-ui font-medium rounded-lg
                  transition-colors min-h-[44px] sm:min-h-[36px]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${XBUTTON_PALETTE[XButtonColor.Document]}
                `}
              >
                <FileDown className="w-4 h-4" />
                {isExportingPDF ? 'Gerando…' : 'Exportar em PDF'}
              </button>
            </XHint>
          )}

          {/* Em leitura o botão é FECHAR: mesma cor e mesmo ícone do Fechar da App. Em edição é
              CANCELAR — ação neutra, que desfaz sem sair. Rótulos distintos, tratamentos distintos.
              O hint diz o que se perde: cancelar descarta alterações, e isso merece tom de aviso. */}
          <XHint
            label={isReadOnly ? 'Fechar' : 'Cancelar'}
            body={isReadOnly ? 'Encerra a consulta e retorna à listagem. Nada é alterado.' : 'Descarta as alterações não salvas e retorna à listagem.'}
            tone={isReadOnly ? 'info' : 'warning'}
            shortcut="Esc"
          >
          <button
            type="button"
            onClick={handleCancel}
            className={`
              inline-flex items-center justify-center gap-2
              px-4 py-3 sm:py-2 text-ui font-medium rounded-lg
              transition-colors min-h-[44px] sm:min-h-[36px]
              ${isReadOnly
                ? CLOSE_BUTTON_STYLE
                : 'text-brand-text-primary bg-brand-background hover:bg-hover border border-border'}
            `}
          >
            {isReadOnly && <LogOut className="w-4 h-4" />}
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </button>
          </XHint>

          {showSaveButton && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              data-testid="form-save"
              className="
                px-4 py-3 sm:py-2 text-ui font-medium rounded-lg
                text-white bg-brand-primary hover:bg-brand-primary-dark
                transition-colors flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
                min-h-[44px] sm:min-h-[36px]
              "
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {'Salvando...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {'Salvar'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
    </FormValuesProvider>
    </FormBusyProvider>
  );
}
