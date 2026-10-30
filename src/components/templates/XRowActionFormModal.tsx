/**
 * XRowActionFormModal — modal GENÉRICO de coleta de uma ação de linha.
 *
 * Uma ação de linha pode precisar de dados antes de executar: o cancelamento de uma nota fiscal, por
 * exemplo, exige um motivo e uma justificativa. Quem declara esses campos é o BACK, no modelo da ação
 * (`XRowAction.fields`); este modal os renderiza com o editor genérico e devolve o que se preencheu —
 * o front não conhece App nenhuma (CE-19).
 *
 * A validação sai do próprio modelo do campo: obrigatoriedade (`isRequired`) e tamanho mínimo/máximo
 * (`minLength`/`maxLength`). É assim que a regra do leiaute fiscal — "a justificativa tem de 15 a 255
 * caracteres" — vira comportamento de tela, em vez de uma recusa do Fisco depois.
 *
 * CONTIDO NA APLICAÇÃO (`inline`, o padrão do XModalShell), como todo modal de App: ele nasce de uma
 * ação sobre a grade e fica dentro da área da aba, sem cobrir o cabeçalho nem o menu.
 *
 * O RÓTULO de cada campo é do EDITOR (`XEditorLabel`, dentro do XEditor): quem o repetisse aqui
 * mostraria o nome do campo duas vezes.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileText } from 'lucide-react';

import type { XRowAction, XDataEditor } from '@core/types';
import { XButtonColor, XUIEditorType } from '@core/types';
import { XEditor } from './editors/XEditor';
import { XModalShell } from './XModalShell';
import { XJanelaDocumento } from './XJanelaDocumento';
import { CLOSE_BUTTON_STYLE, XBUTTON_PALETTE, resolverTokenDeFiltro, getFieldValue } from '@core/lib';
import { useRecalculoAoDigitar } from '@core/hooks/useRecalculoAoDigitar';

interface XRowActionFormModalProps {
  action: XRowAction;
  /** Chave da linha que abriu a ação — injetada em `{id}` dos endpoints de lookup dos campos. */
  rowID?: string;
  /**
   * Chave do registro-PAI quando a ação nasce de uma grade de detalhe (a nota, dona das cartas). Resolve o
   * `{id}` do documento de apoio; ausente, o `{id}` é a própria linha.
   */
  parentID?: string;
  /**
   * Dados da LINHA que abriu a ação. Um campo com `fieldBindings` cujo `sourceField` é uma coluna da
   * linha nasce preenchido com ela — é o que faz a baixa de um boleto já abrir com o "Valor pago" = o
   * saldo da parcela da linha, sem combo (a App de boletos não pergunta a parcela: a linha É a parcela).
   */
  rowData?: Record<string, unknown>;
  /**
   * Valores INICIAIS vindos do back (o `loadEndpoint` da ação, que quem abre o modal já buscou). Sobrepõem
   * o default e a linha: é o que faz a "Nova" carta de correção nascer com o texto da última autorizada.
   */
  initialValues?: Record<string, unknown>;
  /**
   * Erros POR CAMPO devolvidos pelo servidor (`ApiError.fieldErrors`): marcam o editor com a frase do back
   * mesmo sem o usuário tê-lo tocado — validação de formulário marca todos os campos (dono, 2026-10-12).
   */
  serverErrors?: Record<string, string>;
  isBusy?: boolean;
  onSubmit: (pValues: Record<string, unknown>) => void;
  onCancel: () => void;
}

/** Valor "preenchido"? Cadeia vazia e nulo não são; zero e falso, sim. */
function temValor(pValor: unknown): boolean {
  if (pValor === null || pValor === undefined)
    return false;

  if (typeof pValor === 'string')
    return pValor.trim().length > 0;

  return true;
}

export function XRowActionFormModal({
  action,
  rowID,
  parentID,
  rowData,
  initialValues,
  serverErrors,
  isBusy = false,
  onSubmit,
  onCancel,
}: XRowActionFormModalProps): JSX.Element {

  // Os campos, com o `{id}` da linha resolvido nos endpoints de lookup/detalhe: um combo declarado
  // como "parcelas em aberto do título {id}" precisa do id da linha que abriu a ação. Sem isto o
  // endpoint iria com o literal `{id}` e o lookup falharia. Campo sem `{id}` no endpoint passa intacto.
  const campos = useMemo(() => {
    const fields = action.fields ?? [];
    if (!rowID)
      return fields;

    return fields.map((pCampo) => {
      const ed = pCampo.editor;
      if (!ed)
        return pCampo;

      const lookup = ed.lookupEndpoint?.includes('{id}') ? ed.lookupEndpoint.replace('{id}', rowID) : ed.lookupEndpoint;
      const detail = ed.detailEndpoint?.includes('{id}') ? ed.detailEndpoint.replace('{id}', rowID) : ed.detailEndpoint;
      if (lookup === ed.lookupEndpoint && detail === ed.detailEndpoint)
        return pCampo;

      return { ...pCampo, editor: { ...ed, lookupEndpoint: lookup, detailEndpoint: detail } };
    });
  }, [action.fields, rowID]);

  // A cor do botão de confirmar vem do PAPEL da ação (action.color), não fixa em vermelho: baixar um
  // título é ato positivo, não uma exclusão. Sem papel declarado, cai no neutro estável.
  const classeBotao = (action.color !== undefined && action.color !== XButtonColor.Default)
    ? (XBUTTON_PALETTE[action.color] ?? XBUTTON_PALETTE[XButtonColor.Default])
    : XBUTTON_PALETTE[XButtonColor.Default];

  // Valores INICIAIS a partir do que o back declarou em cada campo (CE-19): o DefaultValue, com os
  // tokens de data resolvidos AGORA (`@hoje` → a data corrente) pela fonte única. É o que faz a "Data"
  // da baixa já abrir preenchida, sem o modal conhecer a App. Campo sem default nasce vazio, como antes.
  //
  // Além do default, um campo pode NASCER da LINHA que abriu a ação: seus `fieldBindings` cujo
  // `sourceField` é uma coluna da linha (rowData) são copiados para ele. É o que preenche o "Valor pago"
  // com o saldo da parcela na App de boletos, onde a linha já é a parcela (sem combo).
  const valoresIniciais = useMemo(() => {
    const iniciais: Record<string, unknown> = {};
    for (const campo of action.fields ?? []) {
      const declarado = campo.editor?.defaultValue ?? '';
      if (declarado !== '')
        iniciais[campo.fieldName] = resolverTokenDeFiltro(declarado);

      if (rowData)
        for (const binding of campo.editor?.fieldBindings ?? []) {
          // Leitura TOLERANTE A CAIXA: o binding nomeia a coluna em PascalCase (SaldoAberto), mas a
          // linha chega em camelCase (saldoAberto) do serializador — getFieldValue casa os dois, como
          // o resto do motor. Sem isto o "Valor pago" não nascia preenchido.
          const valor = getFieldValue(rowData, binding.sourceField);
          if (valor !== undefined && valor !== null)
            iniciais[binding.targetField] = valor;
        }
    }

    // O que o back mandou para ESTA abertura (loadEndpoint) manda por último. Leitura TOLERANTE A CAIXA,
    // como a da linha: o campo se chama `Texto` e o corpo chega `texto` do serializador.
    if (initialValues)
      for (const campo of action.fields ?? []) {
        const valor = getFieldValue(initialValues, campo.fieldName);
        if (valor !== undefined && valor !== null)
          iniciais[campo.fieldName] = valor;
      }

    return iniciais;
  }, [action.fields, rowData, initialValues]);

  const [valores, setValores] = useState<Record<string, unknown>>(valoresIniciais);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});

  // O erro de cada campo, segundo o que o BACK declarou nele. Nenhuma regra vive aqui.
  const erros = useMemo(() => {
    const encontrados: Record<string, string> = {};

    for (const campo of campos) {
      const nome = campo.fieldName;
      const valor = valores[nome];
      const editor = campo.editor;
      const rotulo = (campo.title ?? '');

      if (editor?.isRequired && !temValor(valor)) {
        encontrados[nome] = `${rotulo} é obrigatório`;
        continue;
      }

      if (typeof valor === 'string') {
        const texto = valor.trim();

        if (editor?.minLength && texto.length > 0 && texto.length < editor.minLength) {
          encontrados[nome] = `${rotulo} deve ter no mínimo ${editor.minLength} caracteres`;
          continue;
        }

        if (editor?.maxLength && texto.length > editor.maxLength)
          encontrados[nome] = `${rotulo} deve ter no máximo ${editor.maxLength} caracteres`;
      }
    }

    return encontrados;
  }, [campos, valores]);

  const podeExecutar = Object.keys(erros).length === 0;

  // Ação SEM endpoint não executa nada: o modal é só para LER (visualizar o registro da linha). Some o
  // "Confirmar" e o único gesto é fechar.
  const somenteLeitura = !action.endpoint;

  // `pBindings`: campos-IRMÃOS que a seleção deste editor preenche (fieldBindings do back). É o que leva
  // o SALDO da parcela escolhida para "Valor pago", e o que a conta única pré-selecionada aplica. Sem
  // isto os bindings do lookup se perdiam neste modal (só o form principal os aplicava).
  // Campos alterados DEPOIS da última recusa do servidor: neles a marca do servidor sai (o usuário já
  // está corrigindo). Zera a cada recusa nova.
  const [corrigidosDesdeServidor, setCorrigidosDesdeServidor] = useState<Record<string, boolean>>({});
  useEffect(() => { setCorrigidosDesdeServidor({}); }, [serverErrors]);

  // Casamento TOLERANTE A CAIXA: o back nomeia o campo como a propriedade C# (`Texto`).
  const erroDoServidor = useCallback((pCampo: string): string | undefined => {
    if (!serverErrors)
      return undefined;
    const chave = Object.keys(serverErrors).find((pK) => pK.toLowerCase() === pCampo.toLowerCase());
    return chave ? serverErrors[chave] : undefined;
  }, [serverErrors]);

  // `{id}` é o registro-PAI (a nota, na carta de correção) e `{rowId}` a linha; sem pai declarado, o
  // `{id}` é a própria linha — o mesmo sentido que ele tem nos lookups deste modal.
  const resolverEndpoint = useCallback((pModelo: string) =>
    pModelo.replace('{id}', parentID ?? rowID ?? '').replace('{rowId}', rowID ?? ''), [parentID, rowID]);

  // RECÁLCULO enquanto se digita (recalcEndpoint): fonte única no `useRecalculoAoDigitar`, a mesma do
  // formulário da App.
  const notificarRecalculo = useRecalculoAoDigitar({
    endpoint: action.recalcEndpoint ? resolverEndpoint(action.recalcEndpoint) : undefined,
    gatilhos: action.recalcTriggerFields,
    espera: action.recalcDelay,
    campos: action.fields ?? [],
    valores,
    aplicar: setValores,
  });

  const alterar = useCallback((pCampo: XDataEditor, pValor: unknown, pBindings?: Record<string, unknown>) => {
    setValores((pAnterior) => ({ ...pAnterior, ...(pBindings ?? {}), [pCampo.fieldName]: pValor }));
    setTocados((pAnterior) => ({ ...pAnterior, [pCampo.fieldName]: true }));
    setCorrigidosDesdeServidor((pAnterior) => ({ ...pAnterior, [pCampo.fieldName]: true }));
    notificarRecalculo(pCampo.fieldName);
  }, [notificarRecalculo]);

  const submeter = useCallback(() => {
    // Mostra os erros dos campos que o usuário nem tocou — senão o botão "não faz nada" e ele não
    // descobre por quê.
    setTocados(Object.fromEntries(campos.map((pC) => [pC.fieldName, true])));

    if (podeExecutar)
      onSubmit(valores);
  }, [campos, podeExecutar, onSubmit, valores]);

  // Janela do documento de apoio aberta (endpoint já resolvido e título), ou nenhuma.
  const [janela, setJanela] = useState<{ endpoint: string; titulo: string } | null>(null);

  const temTextoLongo = campos.some((pCampo) => pCampo.editor?.editorType === XUIEditorType.TextArea);
  // Demonstrativo pede largura para rótulo, detalhe e valor caberem numa linha sem quebrar — o piso
  // grande (42rem) basta, e o dono o quis 25% mais estreito que o extragrande (2026-10-25).
  const temDemonstrativo = campos.some((pCampo) => pCampo.editor?.editorType === XUIEditorType.Statement);

  const titulo = action.formTitle || (action.title ?? '');
  const aviso = action.warningMessage ? (action.warningMessage ?? '') : '';

  // CONTIDO NA ÁREA DO APP (action.useAppArea, dono 2026-10-25): o diálogo sobe do quadro de quem chamou
  // (o card do formulário) para o PAINEL DA ABA do App (`[data-app-tab]`), por cima do formulário — sem sair
  // dele. NÃO para a área compartilhada (`[data-app-area]`), que é uma só para todas as abas: lá o diálogo
  // sobrevivia à troca de aba e aparecia por cima de outro App. Sem painel de aba marcado (outra casca),
  // vale a área; sem nenhum dos dois (teste, fora de aba), fica onde está. A âncora é um marcador invisível
  // no lugar de sempre, e o diálogo vai por portal (os eventos seguem a árvore do React, não a do DOM).
  const ancora = useRef<HTMLSpanElement>(null);
  // undefined = ainda não procurada (só a âncora se desenha, para o diálogo não nascer no lugar errado e
  // remontar); null = não há área; elemento = a área.
  const [areaDoApp, setAreaDoApp] = useState<HTMLElement | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (action.useAppArea)
      setAreaDoApp((ancora.current?.closest('[data-app-tab]') ?? ancora.current?.closest('[data-app-area]') ?? null) as HTMLElement | null);
  }, [action.useAppArea]);

  const dialogo = (
    <>
    <XModalShell
      // ARRASTÁVEL (dono, 2026-10-22): afasta-se o diálogo para ver a grade ou o documento por trás.
      draggable
      // Texto longo (área de texto) pede leitura confortável: o piso sobe para o tamanho grande. Ações
      // de campos curtos (motivo, valor, data) seguem no pequeno — um modal largo para dois campos
      // estreitos só espalha o olhar.
      size={temDemonstrativo || temTextoLongo ? 'lg' : 'sm'}
      title={titulo}
      closeLabel={'Fechar'}
      onClose={onCancel}
      footer={
        <>
          {/* "Fechar", não "Cancelar": num diálogo cujo objeto É cancelar a nota, um botão escrito
              "Cancelar" para DESISTIR diria o contrário do que faz. O mesmo rótulo de dispensa dos
              demais formulários da casa. */}
          <button
            type="button"
            onClick={onCancel}
            data-testid="rowaction-cancel"
            className={`px-4 py-3 sm:py-2 text-ui font-medium rounded-lg transition-colors
                        min-h-touch sm:min-h-[36px] ${CLOSE_BUTTON_STYLE}`}
          >
            {action.cancelTitle || 'Fechar'}
          </button>
          {/* "Confirmar", não o rótulo da ação: a ação pode chamar-se "Cancelar" (cancelar a nota), e um
              botão "Cancelar" ao lado de "Fechar" diria a mesma coisa duas vezes, com sentidos opostos.
              Quem diz o que está em jogo é o TÍTULO do modal e o aviso; o botão só confirma. */}
          {!somenteLeitura && (
          <button
            type="button"
            onClick={submeter}
            disabled={isBusy}
            // Distinto do `form-save` do formulário: aqui o que se confirma é uma AÇÃO sobre um
            // registro (lançar custo, cancelar nota), não a gravação de um formulário.
            data-testid="rowaction-confirm"
            className={`inline-flex items-center gap-2 px-4 py-3 sm:py-2 text-ui font-semibold rounded-lg
                       shadow-sm transition-colors min-h-touch sm:min-h-[36px]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-brand-primary/40 ${classeBotao}`}
          >
            {'Confirmar'}
          </button>
          )}
        </>
      }
    >
      <div className="px-4 sm:px-5 py-4 space-y-3">
        {/* Os campos numa grade de 32 colunas, como o painel de edição da grade: o campo que declara
            colSpan divide a linha com os vizinhos; o que não declara (colSpan 1, o padrão) ocupa a
            linha inteira, como sempre ocupou aqui. */}
        {/* O aviso que o usuário não pode deixar de ler — o back diz se existe, e qual é. Discreto no
            tamanho, firme na cor: é uma faixa, não um bloco de texto. */}
        {aviso && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-ui-sm text-brand-text-primary leading-snug">{aviso}</p>
          </div>
        )}

        <div className="grid gap-x-3 gap-y-3" style={{ gridTemplateColumns: 'repeat(32, minmax(0, 1fr))' }}>
        {campos.map((pCampo) => {
          const nome = pCampo.fieldName;
          // O erro LOCAL (regra declarada no editor) vale depois de tocado; o do SERVIDOR vale até o
          // usuário mexer naquele campo — é a marca que diz onde a recusa aconteceu.
          const erro = (tocados[nome] ? erros[nome] : undefined)
            ?? (corrigidosDesdeServidor[nome] ? undefined : erroDoServidor(nome));

          // Sem rótulo aqui: o editor já desenha o dele (XEditorLabel), com o asterisco do obrigatório.
          // displayValue = o texto de um lookup preenchido por LIGAÇÃO (a conta que veio do boleto):
          // sem ele, o combo mostraria a chave crua em vez do nome da conta.
          const textoExibicao = pCampo.editor?.displayValueField
            ? valores[pCampo.editor.displayValueField]
            : undefined;
          // Invólucro só para o testid, com a MESMA chave do formulário (`field-<binding>`): assim o
          // teste e2e alcança um campo do mesmo jeito, sem saber se está num formulário ou numa ação
          // de linha. Div comum, e NÃO `display:contents`: o pai espaça os filhos com `space-y-3`, que
          // é margem entre IRMÃOS — sob `contents` o filho deixa de ser irmão e o espaçamento sumiria.
          // DOCUMENTO DE APOIO declarado no campo (o DANFE da nota ao escrever a carta de correção): botão à
          // direita, na altura do rótulo. Abre a janela flutuante; não mexe no valor do campo.
          const documento = pCampo.editor?.documentEndpoint
            ? {
                endpoint: resolverEndpoint(pCampo.editor.documentEndpoint),
                botao: pCampo.editor.documentButtonTitle || 'Ver documento',
                titulo: pCampo.editor.documentWindowTitle || pCampo.editor.documentButtonTitle || 'Documento',
              }
            : null;

          return (
            <div
              key={pCampo.id ?? nome}
              data-testid={`field-${nome}`}
              className={documento ? 'relative' : undefined}
              style={{ gridColumn: `span ${pCampo.colSpan > 1 ? Math.min(pCampo.colSpan, 32) : 32}` }}
            >
              {documento && (
                <button
                  type="button"
                  onClick={() => setJanela({ endpoint: documento.endpoint, titulo: documento.titulo })}
                  className={`absolute right-0 -top-0.5 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 text-ui-xs
                              font-medium rounded-md transition-colors ${XBUTTON_PALETTE[XButtonColor.Document]}`}
                  data-testid={`documento-${nome}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {documento.botao}
                </button>
              )}
              <XEditor
                editor={pCampo}
                value={valores[nome]}
                displayValue={textoExibicao}
                onChange={(pValor, pBindings) => alterar(pCampo, pValor, pBindings)}
                error={erro}
                disabled={isBusy}
              />
            </div>
          );
        })}
        </div>
      </div>
    </XModalShell>

    {/* A janela do documento de apoio: IRMÃ do diálogo, no mesmo quadro (o pai posicionado), por cima
        dele e sem bloqueá-lo — lê-se o documento enquanto se escreve. */}
    {janela && (
      <XJanelaDocumento titulo={janela.titulo} endpoint={janela.endpoint} onClose={() => setJanela(null)} />
    )}
    </>
  );

  if (!action.useAppArea)
    return dialogo;

  return (
    <>
      <span ref={ancora} hidden />
      {areaDoApp === undefined ? null : areaDoApp ? createPortal(dialogo, areaDoApp) : dialogo}
    </>
  );
}
