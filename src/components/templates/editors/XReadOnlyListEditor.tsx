/**
 * XReadOnlyListEditor — uma lista de linhas COMO NUM RELATÓRIO: só leitura, crescendo com o conteúdo.
 *
 * Nasce da conferência da nota (dono, 2026-09-17), onde as duas listas — Itens e Tributos por item —
 * saíam **embaralhadas, uma por cima da outra**. A causa não era estilo: elas usavam o
 * `XItemsGridEditor`, que é a grade de EDIÇÃO do pedido e por isso reclama a sobra vertical
 * (`flex-1`) além de um piso de altura. Uma só num formulário funciona; duas na mesma tela disputam o
 * mesmo espaço e se sobrepõem — e ainda trazem a maquinaria de edição (linha em branco, ações de
 * linha, botão de incluir, células editáveis) para um lugar onde não se edita nada.
 *
 * Conferir não é editar. Aqui a lista **ocupa a altura das linhas que tem**, sem piso, sem teto e sem
 * `flex-1`: várias cabem uma abaixo da outra, na ordem em que o relatório as declara. Vazia, diz que
 * está vazia em uma linha, sem reservar o retângulo de uma grade que não existe.
 *
 * **Genérico, sem uma linha de App** (CE-19): as colunas vêm do modelo (`editor.gridColumns`), como
 * na grade — a App só troca o `customEditorName`. Os tipos numéricos (`currency`, `number`,
 * `integer`) alinham à direita e são formatados pela mesma fonte única do resto do produto, para o
 * mesmo valor não aparecer de duas formas em duas telas.
 *
 * **RODAPÉ DE TOTAIS** (dono, 2026-11-08 — os custos da nota): o valor pode chegar como objeto
 * `{ linhas, totais }` em vez da lista pura. `totais` é UMA linha, com os mesmos nomes de coluna, e
 * vira o rodapé da tabela, em negrito. Quem soma é o BACK — o front não sabe se a coluna se soma
 * simples ou multiplicada pela quantidade, e não tem de saber (CE-19). Coluna ausente no objeto de
 * totais fica em branco no rodapé (não com travessão: ali o vazio é "não se soma", não "falta dado").
 *
 * **ELÁSTICA quando o modelo declara `fillsHeight`** (dono, 2026-11-08): a lista ocupa a altura que o
 * formulário lhe der e ROLA SÓ O CORPO — o cabeçalho e o rodapé de totais ficam presos às bordas, e o
 * resto do formulário não se move. Sem a declaração, segue medindo o próprio conteúdo, como sempre.
 *
 * **CÉLULA QUE SE DIGITA, quando a LINHA a libera** (dono, 2026-11-10 — o preço de venda nos custos da nota).
 * A lista continua sendo de leitura; a exceção é a coluna numérica que declara `editableWhenRowField`: na linha
 * em que esse campo é verdadeiro, a célula vira a entrada de moeda do resto do produto (`XCurrencyCell`). O
 * rodapé nunca se digita. Ao digitar, a lista devolve o valor inteiro (`{ linhas, totais }`) com a célula
 * trocada e o nome da coluna na lista `alterados` DA LINHA — é por ela que o back distingue o que o usuário
 * digitou do que ele mesmo calculou, e a devolve no recálculo para a marca não se perder. Apagar a célula tira
 * a coluna de `alterados`: a linha volta ao valor calculado. Quem recalcula as demais colunas e o rodapé é o
 * back (`recalcEndpoint`); aqui não há conta.
 *
 * **CAIXA DE MARCAR POR LINHA, COM "MARCAR TODAS" NO CABEÇALHO** (dono, 2026-11-10). A coluna `checkbox` que
 * declara `editableWhenRowField` vira uma caixa de marcar nas linhas que a liberam (as demais ficam em branco, e
 * o rodapé também). O cabeçalho dela ganha uma caixa que marca e desmarca TODAS as linhas liberadas de uma vez:
 * marcada quando todas estão, em estado intermediário quando só algumas. A marca é o valor da célula (verdadeiro
 * ou falso) — não entra em `alterados`, que é só das células digitadas.
 */

import type { JSX } from 'react';

import type { XEditorProps } from './XEditor';
import type { XUIGridColumn } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { XCurrencyCell } from './XCurrencyCell';
import { formatCurrency, formatDate, formatDecimal, formatDocument, formatNumber, getFieldValue } from '@core/lib';

type Linha = Record<string, unknown>;

/** O valor do campo já entendido: as linhas e, quando o back as mandou, a linha de totais. */
interface Conteudo {
  linhas: Linha[];
  totais?: Linha;
}

/**
 * Aceita a lista pronta, o objeto `{ linhas, totais }` (rodapé) ou o JSON de qualquer um dos dois —
 * mesma tolerância da grade. As chaves do objeto se leem sem caixa: o corpo chega em camelCase.
 */
function conteudoDe(pValor: unknown): Conteudo {
  let valor = pValor;

  if (typeof valor === 'string' && valor.trim()) {
    try {
      valor = JSON.parse(valor);
    } catch {
      /* não é JSON: vale como lista vazia */
      return { linhas: [] };
    }
  }

  if (Array.isArray(valor))
    return { linhas: valor as Linha[] };

  if (valor && typeof valor === 'object') {
    const objeto = valor as Linha;
    const linhas = getFieldValue(objeto, 'linhas');
    const totais = getFieldValue(objeto, 'totais');

    return {
      linhas: Array.isArray(linhas) ? (linhas as Linha[]) : [],
      totais: totais && typeof totais === 'object' && !Array.isArray(totais) ? (totais as Linha) : undefined,
    };
  }

  return { linhas: [] };
}

/** Numérico alinha à DIREITA — é o que deixa a coluna de valores comparável linha a linha. */
function ehNumerica(pColuna: XUIGridColumn): boolean {
  return pColuna.editorType === 'currency'
    || pColuna.editorType === 'number'
    || pColuna.editorType === 'integer';
}

/**
 * A célula já formatada. Usa os MESMOS formatadores do resto do produto (fonte única): moeda sem o
 * símbolo, data no formato do usuário, documento com máscara. Valor ausente vira travessão — a
 * ausência fica visível, em vez de a célula parecer cortada.
 */
function textoDaCelula(pLinha: Linha, pColuna: XUIGridColumn): string {
  const valor = getFieldValue(pLinha, pColuna.fieldName);

  if (valor === null || valor === undefined || valor === '')
    return '—';

  switch (pColuna.editorType) {
    case 'currency':
      return formatCurrency(Number(valor));
    case 'number':
      // Casas declaradas na coluna (`decimalPlaces`) valem FIXAS: "20,00" e "20,01" alinham na coluna; sem
      // declaração, o número sai com até duas casas, sem zeros à direita, como sempre.
      return pColuna.decimalPlaces && pColuna.decimalPlaces > 0
        ? formatDecimal(Number(valor), pColuna.decimalPlaces)
        : formatNumber(Number(valor));
    case 'integer':
      return String(valor);
    case 'date':
      return formatDate(valor);
    case 'document':
      return formatDocument(String(valor));
    case 'checkbox':
      return valor === true ? 'Sim' : 'Não';
    default:
      return String(valor);
  }
}

/** A chave que a linha JÁ usa para o campo (o corpo chega em camelCase); sem ela, o nome como o modelo o declara. */
function chaveNaLinha(pLinha: Linha, pCampo: string): string {
  return Object.keys(pLinha).find((pChave) => pChave.toLowerCase() === pCampo.toLowerCase()) ?? pCampo;
}

/** Coluna de MARCAR: `checkbox` que a linha libera. É a que ganha a caixa "marcar todas" no cabeçalho. */
function ehDeMarcar(pColuna: XUIGridColumn): boolean {
  return Boolean(pColuna.editableWhenRowField) && pColuna.editorType === 'checkbox';
}

/** A linha libera a célula desta coluna (`editableWhenRowField` verdadeiro nela). */
function linhaLibera(pLinha: Linha, pColuna: XUIGridColumn): boolean {
  return Boolean(pColuna.editableWhenRowField)
    && getFieldValue(pLinha, pColuna.editableWhenRowField as string) === true;
}

/** A célula aceita digitação: coluna numérica com `editableWhenRowField`, e a linha diz que sim. */
function ehEditavel(pLinha: Linha, pColuna: XUIGridColumn): boolean {
  return (pColuna.editorType === 'currency' || pColuna.editorType === 'number') && linhaLibera(pLinha, pColuna);
}

/** A linha com a caixa da coluna marcada ou desmarcada. Não muda a linha recebida. */
function linhaMarcada(pLinha: Linha, pColuna: XUIGridColumn, pMarcada: boolean): Linha {
  return { ...pLinha, [chaveNaLinha(pLinha, pColuna.fieldName)]: pMarcada };
}

/**
 * A linha com a célula trocada e a coluna marcada (ou desmarcada, se a célula foi apagada) em `alterados`.
 * Não muda a linha recebida.
 */
function linhaAlterada(pLinha: Linha, pColuna: XUIGridColumn, pValor: number | null): Linha {
  const chaveDosAlterados = chaveNaLinha(pLinha, 'alterados');
  const anteriores = Array.isArray(pLinha[chaveDosAlterados]) ? (pLinha[chaveDosAlterados] as unknown[]).map(String) : [];
  const semEsta = anteriores.filter((pNome) => pNome.toLowerCase() !== pColuna.fieldName.toLowerCase());

  return {
    ...pLinha,
    [chaveNaLinha(pLinha, pColuna.fieldName)]: pValor,
    [chaveDosAlterados]: pValor === null ? semEsta : [...semEsta, pColuna.fieldName],
  };
}

/** Largura percentual declarada pelo modelo, normalizada — a mesma regra da grade de itens. */
function larguraNormalizada(pColunas: XUIGridColumn[]): (pColuna: XUIGridColumn) => string | undefined {
  const peso = (pC: XUIGridColumn): number => (typeof pC.width === 'number' && pC.width > 0 ? pC.width : 0);
  const total = pColunas.reduce((pAcc, pC) => pAcc + peso(pC), 0);

  if (total <= 0)
    return () => undefined;

  const semPeso = pColunas.filter((pC) => peso(pC) === 0).length;
  const divisor = total + semPeso;

  return (pColuna) => `${((peso(pColuna) || 1) / divisor) * 100}%`;
}

export function XReadOnlyListEditor({ editor, value, onChange, disabled }: XEditorProps): JSX.Element {
  const colunas = editor.editor.gridColumns ?? [];
  const { linhas, totais } = conteudoDe(value);
  const largura = larguraNormalizada(colunas);
  const elastica = editor.editor.fillsHeight === true;

  // A célula digitada devolve o valor INTEIRO, no formato com rodapé: é o que o recálculo manda ao back.
  const alterarCelula = (pIndice: number, pColuna: XUIGridColumn, pValor: number | null): void => {
    // A célula avisa também ao PERDER O FOCO, com o valor que já tinha: passar por ela sem digitar não é
    // alteração, e não pode marcar a linha como digitada.
    const atual = getFieldValue(linhas[pIndice], pColuna.fieldName);
    const numeroAtual = atual === null || atual === undefined || atual === '' ? null : Number(atual);
    if (numeroAtual === pValor)
      return;

    const novas = linhas.map((pLinha, pI) => (pI === pIndice ? linhaAlterada(pLinha, pColuna, pValor) : pLinha));
    onChange(totais ? { linhas: novas, totais } : { linhas: novas });
  };

  // A caixa de UMA linha (pIndice) ou a do cabeçalho (pIndice nulo), que vale para todas as linhas liberadas.
  const marcar = (pColuna: XUIGridColumn, pMarcada: boolean, pIndice: number | null): void => {
    const novas = linhas.map((pLinha, pI) =>
      ((pIndice === null || pI === pIndice) && linhaLibera(pLinha, pColuna) ? linhaMarcada(pLinha, pColuna, pMarcada) : pLinha));
    onChange(totais ? { linhas: novas, totais } : { linhas: novas });
  };

  // O estado da caixa do cabeçalho: todas as linhas liberadas marcadas, algumas ou nenhuma.
  const estadoDoCabecalho = (pColuna: XUIGridColumn): { todas: boolean; algumas: boolean; liberadas: number } => {
    const liberadas = linhas.filter((pLinha) => linhaLibera(pLinha, pColuna));
    const marcadas = liberadas.filter((pLinha) => getFieldValue(pLinha, pColuna.fieldName) === true).length;
    return {
      todas: liberadas.length > 0 && marcadas === liberadas.length,
      algumas: marcadas > 0 && marcadas < liberadas.length,
      liberadas: liberadas.length,
    };
  };

  return (
    <div className={elastica ? 'w-full flex-1 min-h-0 flex flex-col' : 'w-full'}>
      <XEditorLabel title={editor.title} />

      {linhas.length === 0 ? (
        // Uma LINHA, não um retângulo: a lista vazia não reserva a altura de uma grade que não existe
        // — era parte do que fazia as duas listas se atropelarem.
        <div className="px-2 py-2 text-ui-sm text-brand-text-muted">{'Nenhum item'}</div>
      ) : (
        // Sem `flex-1` e sem altura mínima: a lista mede o próprio conteúdo, e por isso várias cabem
        // uma abaixo da outra. `overflow-x-auto` só protege a tabela estreita demais para as colunas.
        <div
          data-testid="lista-rolagem"
          className={`w-full rounded-lg border border-border ${elastica ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'}`}
        >
          <table className="w-full border-collapse text-ui">
            <thead>
              <tr>
                {colunas.map((pColuna) => {
                  const estado = ehDeMarcar(pColuna) ? estadoDoCabecalho(pColuna) : null;
                  return (
                    <th
                      key={pColuna.fieldName}
                      className={`px-2 py-1.5 font-medium text-brand-text-secondary whitespace-nowrap
                        bg-muted-bg border-b border-border
                        ${estado ? 'text-center' : ehNumerica(pColuna) ? 'text-right' : 'text-left'}
                        ${elastica ? 'sticky top-0 z-[1]' : ''}`}
                      style={{ width: largura(pColuna) }}
                    >
                      {estado ? (
                        // MARCAR TODAS: a caixa e o título são um rótulo só — clicar no texto também marca.
                        <label className="inline-flex items-center justify-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            data-testid={`marcar-todas-${pColuna.fieldName}`}
                            aria-label={`${pColuna.title ?? ''}: marcar ou desmarcar todas as linhas`}
                            checked={estado.todas}
                            // Intermediário (algumas marcadas) só existe como propriedade do elemento.
                            ref={(pCaixa) => { if (pCaixa) pCaixa.indeterminate = estado.algumas; }}
                            disabled={disabled || estado.liberadas === 0}
                            onChange={(pEvento) => marcar(pColuna, pEvento.target.checked, null)}
                            className="w-4 h-4 accent-brand-primary cursor-pointer disabled:cursor-not-allowed"
                          />
                          {(pColuna.title ?? '')}
                        </label>
                      ) : (pColuna.title ?? '')}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-border-light">
              {linhas.map((pLinha, pIndice) => (
                <tr key={pIndice} className="align-top">
                  {colunas.map((pColuna) => (ehDeMarcar(pColuna) ? (
                    // Caixa de marcar da linha; a linha que não a libera fica em branco.
                    <td key={pColuna.fieldName} className="px-2 py-1.5 text-center" data-testid={`celula-${pColuna.fieldName}-${pIndice}`}>
                      {linhaLibera(pLinha, pColuna) && (
                        <input
                          type="checkbox"
                          aria-label={`${pColuna.title ?? ''}, linha ${pIndice + 1}`}
                          checked={getFieldValue(pLinha, pColuna.fieldName) === true}
                          disabled={disabled}
                          onChange={(pEvento) => marcar(pColuna, pEvento.target.checked, pIndice)}
                          className="w-4 h-4 accent-brand-primary cursor-pointer disabled:cursor-not-allowed"
                        />
                      )}
                    </td>
                  ) : ehEditavel(pLinha, pColuna) ? (
                    // Célula que se digita: a mesma entrada de moeda da grade de itens, com folga menor para a
                    // linha não crescer além das vizinhas.
                    <td key={pColuna.fieldName} className="px-1 py-0.5" data-testid={`celula-${pColuna.fieldName}-${pIndice}`}>
                      <XCurrencyCell
                        value={getFieldValue(pLinha, pColuna.fieldName)}
                        decimalPlaces={pColuna.decimalPlaces || undefined}
                        disabled={disabled}
                        onChange={(pValor) => alterarCelula(pIndice, pColuna, pValor)}
                      />
                    </td>
                  ) : (
                    <td
                      key={pColuna.fieldName}
                      className={`px-2 py-1.5 text-brand-text-primary
                        ${ehNumerica(pColuna) ? 'text-right tabular-nums whitespace-nowrap' : 'text-left break-words'}`}
                    >
                      {textoDaCelula(pLinha, pColuna)}
                    </td>
                  )))}
                </tr>
              ))}
            </tbody>

            {totais && (
              <tfoot>
                <tr data-testid="lista-totais" className="border-t-2 border-border bg-muted-bg">
                  {colunas.map((pColuna) => {
                    const valor = getFieldValue(totais, pColuna.fieldName);
                    // A coluna de marcar não tem total: o rodapé dela fica em branco.
                    const vazio = valor === null || valor === undefined || valor === '' || ehDeMarcar(pColuna);
                    return (
                      <td
                        key={pColuna.fieldName}
                        className={`px-2 py-1.5 font-semibold text-brand-text-primary bg-muted-bg
                          ${ehNumerica(pColuna) ? 'text-right tabular-nums whitespace-nowrap' : 'text-left'}
                          ${elastica ? 'sticky bottom-0 z-[1] border-t-2 border-border' : ''}`}
                      >
                        {vazio ? '' : textoDaCelula(totais, pColuna)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
