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
 */

import type { JSX } from 'react';

import type { XEditorProps } from './XEditor';
import type { XUIGridColumn } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
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

export function XReadOnlyListEditor({ editor, value }: XEditorProps): JSX.Element {
  const colunas = editor.editor.gridColumns ?? [];
  const { linhas, totais } = conteudoDe(value);
  const largura = larguraNormalizada(colunas);
  const elastica = editor.editor.fillsHeight === true;

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
                {colunas.map((pColuna) => (
                  <th
                    key={pColuna.fieldName}
                    className={`px-2 py-1.5 font-medium text-brand-text-secondary whitespace-nowrap
                      bg-muted-bg border-b border-border ${ehNumerica(pColuna) ? 'text-right' : 'text-left'}
                      ${elastica ? 'sticky top-0 z-[1]' : ''}`}
                    style={{ width: largura(pColuna) }}
                  >
                    {(pColuna.title ?? '')}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border-light">
              {linhas.map((pLinha, pIndice) => (
                <tr key={pIndice} className="align-top">
                  {colunas.map((pColuna) => (
                    <td
                      key={pColuna.fieldName}
                      className={`px-2 py-1.5 text-brand-text-primary
                        ${ehNumerica(pColuna) ? 'text-right tabular-nums whitespace-nowrap' : 'text-left break-words'}`}
                    >
                      {textoDaCelula(pLinha, pColuna)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            {totais && (
              <tfoot>
                <tr data-testid="lista-totais" className="border-t-2 border-border bg-muted-bg">
                  {colunas.map((pColuna) => {
                    const valor = getFieldValue(totais, pColuna.fieldName);
                    const vazio = valor === null || valor === undefined || valor === '';
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
