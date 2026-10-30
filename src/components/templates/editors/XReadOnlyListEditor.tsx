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
 */

import type { JSX } from 'react';

import type { XEditorProps } from './XEditor';
import type { XUIGridColumn } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { formatCurrency, formatDate, formatDocument, formatNumber, getFieldValue } from '@core/lib';

type Linha = Record<string, unknown>;

/** Aceita a lista pronta ou o JSON que o back serializou — mesma tolerância da grade. */
function linhasDe(pValor: unknown): Linha[] {
  if (Array.isArray(pValor))
    return pValor as Linha[];

  if (typeof pValor === 'string' && pValor.trim()) {
    try {
      const lista = JSON.parse(pValor);
      if (Array.isArray(lista))
        return lista as Linha[];
    } catch {
      /* não é JSON: vale como lista vazia */
    }
  }

  return [];
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
      return formatNumber(Number(valor));
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
  const linhas = linhasDe(value);
  const largura = larguraNormalizada(colunas);

  return (
    <div className="w-full">
      <XEditorLabel title={editor.title} />

      {linhas.length === 0 ? (
        // Uma LINHA, não um retângulo: a lista vazia não reserva a altura de uma grade que não existe
        // — era parte do que fazia as duas listas se atropelarem.
        <div className="px-2 py-2 text-ui-sm text-brand-text-muted">{'Nenhum item'}</div>
      ) : (
        // Sem `flex-1` e sem altura mínima: a lista mede o próprio conteúdo, e por isso várias cabem
        // uma abaixo da outra. `overflow-x-auto` só protege a tabela estreita demais para as colunas.
        <div className="w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-ui">
            <thead>
              <tr>
                {colunas.map((pColuna) => (
                  <th
                    key={pColuna.fieldName}
                    className={`px-2 py-1.5 font-medium text-brand-text-secondary whitespace-nowrap
                      bg-muted-bg border-b border-border ${ehNumerica(pColuna) ? 'text-right' : 'text-left'}`}
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
          </table>
        </div>
      )}
    </div>
  );
}
