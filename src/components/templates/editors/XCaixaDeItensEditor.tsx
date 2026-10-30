/**
 * XCaixaDeItensEditor — a CAIXA DE ITENS (dono, 2026-10-26): o campo cujo valor é uma lista de registros escolhidos
 * (os participantes de um projeto), mostrados como pastilhas — o rótulo e um "x" que tira o registro da lista — sob um
 * cabeçalho com o título do campo e, à direita, o "+" que abre o seletor para acrescentar. É a forma curta da grade de
 * itens (`XItemsGridEditor`) para a lista em que só importa QUEM está nela, não as colunas de cada um.
 *
 * Genérico (CE-19): o rótulo da pastilha sai do campo que o modelo declara (`lookupDisplayField`; sem ele, a primeira
 * coluna de `gridColumns`; sem colunas, `text`); o seletor é o mesmo da grade — `itemPickerEndpoint`, `pickerTitle`,
 * `pickerSearchFields`, `pickerColumns`, `pickerContextBindings` — e o registro escolhido vira um item da lista pelos
 * `fieldBindings`. O repetido (pela chave do primeiro binding) não entra. Só-leitura: sem "+" e sem "x".
 *
 * Opt in por campo: `XUIEditorModel.customEditorName = "XCaixaDeItensEditor"`.
 */

import { useContext, useMemo, useState, type JSX } from 'react';
import { Plus, X } from 'lucide-react';
import { FormValuesContext } from '@core/contexts/FormValuesContext';
import type { XEditorProps } from './XEditor';
import { XEditorLabel } from './XEditorLabel';
import { XItemPickerDialog } from './XItemPickerDialog';
import { XRecordPickerDialog } from './XRecordPickerDialog';
import { getFieldValue } from '@core/lib';
import { XBUTTON_PALETTE } from '@core/lib/xButtonPalette';
import { XButtonColor } from '@core/types';

type Item = Record<string, unknown>;

function paraItens(pValor: unknown): Item[] {
  if (Array.isArray(pValor))
    return pValor as Item[];
  if (typeof pValor === 'string' && pValor.trim()) {
    try {
      const lista: unknown = JSON.parse(pValor);
      if (Array.isArray(lista))
        return lista as Item[];
    } catch {
      /* não é JSON: lista vazia */
    }
  }
  return [];
}

export function XCaixaDeItensEditor({ editor, value, onChange, disabled }: XEditorProps): JSX.Element {
  const modelo = editor.editor;
  const itens = useMemo(() => paraItens(value), [value]);
  const travado = disabled === true || modelo.isReadOnly === true;

  // O campo do item que dá o rótulo da pastilha: o declarado, senão a primeira coluna, senão o `text` do lookup.
  const campoDoRotulo = modelo.lookupDisplayField || modelo.gridColumns?.[0]?.fieldName || 'text';
  const rotulo = (pItem: Item): string => String(getFieldValue(pItem, campoDoRotulo) ?? '');

  // A chave que diz se um registro já está na lista: o primeiro `fieldBinding` (value → SYSxUsuarioID).
  const campoChave = (modelo.fieldBindings ?? [])[0]?.targetField;

  const pickerEndpoint = modelo.itemPickerEndpoint ?? '';
  const [pickerAberto, setPickerAberto] = useState(false);

  // O que o seletor leva do formulário (pickerContextBindings): o valor corrente de cada campo vinculado vira filtro fixo.
  const { valores: valoresDoFormulario } = useContext(FormValuesContext);
  const filtrosDoContexto = useMemo((): Record<string, string> => {
    const saida: Record<string, string> = {};
    for (const vinculo of modelo.pickerContextBindings ?? []) {
      const valor = String(getFieldValue(valoresDoFormulario, vinculo.sourceField) ?? '').trim();
      if (valor.length > 0 && valor !== '0')
        saida[vinculo.targetField] = valor;
    }
    return saida;
  }, [modelo.pickerContextBindings, valoresDoFormulario]);

  const itemDoRegistro = (pRegistro: Item): Item => {
    const novo: Item = {};
    for (const vinculo of modelo.fieldBindings ?? [])
      novo[vinculo.targetField] = pRegistro[vinculo.sourceField];
    return novo;
  };

  const jaNaLista = (pItem: Item): boolean =>
    !!campoChave && itens.some((pI) => String(getFieldValue(pI, campoChave) ?? '') === String(getFieldValue(pItem, campoChave) ?? ''));

  const acrescentar = (pRegistros: Item[]): void => {
    const novos = pRegistros.map(itemDoRegistro).filter((pItem) => !jaNaLista(pItem));
    if (novos.length > 0)
      onChange([...itens, ...novos]);
    setPickerAberto(false);
  };

  const remover = (pIndice: number): void => onChange(itens.filter((_, pI) => pI !== pIndice));

  const seletor = pickerAberto && pickerEndpoint && (
    (modelo.pickerColumns?.length ?? 0) > 0 ? (
      <XRecordPickerDialog
        endpoint={pickerEndpoint}
        title={modelo.pickerTitle}
        searchFields={modelo.pickerSearchFields}
        searchPlaceholder={modelo.pickerSearchPlaceholder}
        columns={modelo.pickerColumns}
        multiSelect={modelo.pickerMultiSelect === true}
        fixedFilters={filtrosDoContexto}
        onSelect={(pRegistro) => acrescentar([pRegistro])}
        onSelectMany={acrescentar}
        onClose={() => setPickerAberto(false)}
      />
    ) : (
      <XItemPickerDialog
        endpoint={pickerEndpoint}
        fixedFilters={filtrosDoContexto}
        onSelect={(pRegistro) => acrescentar([pRegistro])}
        onClose={() => setPickerAberto(false)}
      />
    )
  );

  const tituloDoMais = modelo.pickerTitle || 'Adicionar';

  return (
    // A caixa tem borda e fundo como um campo de texto (dono, 2026-10-26), com o cabeçalho levemente destacado.
    <div className="flex flex-col rounded-lg border border-border bg-brand-surface overflow-hidden" data-testid="caixa-de-itens" data-campo={editor.fieldName}>
      {/* Cabeçalho: o título do campo à esquerda e o "+" à direita (verde de Criar, paleta semântica). */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-hover border-b border-border [&>span]:mb-0 [&>label]:mb-0">
        <XEditorLabel title={editor.title} isRequired={modelo.isRequired} />
        {!travado && pickerEndpoint && (
          <button
            type="button"
            onClick={() => setPickerAberto(true)}
            aria-label={tituloDoMais}
            title={tituloDoMais}
            className={`h-6 w-6 inline-flex items-center justify-center rounded-md transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${XBUTTON_PALETTE[XButtonColor.Create]}`}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* As pastilhas fluem e quebram linha; cada uma leva o rótulo e o "x" que a tira da lista. */}
      {itens.length === 0 ? (
        <p className="px-2.5 py-2 text-ui-sm text-brand-text-secondary">{modelo.placeholderText || 'Nenhum item.'}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 px-2.5 py-2" aria-label={editor.title}>
          {itens.map((pItem, pIndice) => {
            const texto = rotulo(pItem);
            return (
              <li
                key={`${campoChave ? String(getFieldValue(pItem, campoChave) ?? '') : ''}:${pIndice}`}
                className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full border border-border bg-brand-surface text-ui-sm text-brand-text-primary whitespace-nowrap"
              >
                <span>{texto}</span>
                {!travado && (
                  <button
                    type="button"
                    onClick={() => remover(pIndice)}
                    aria-label={`Remover ${texto}`}
                    title={`Remover ${texto}`}
                    className="h-4 w-4 inline-flex items-center justify-center rounded-full bg-brand-text-secondary text-brand-surface hover:bg-red-600 transition-colors"
                  >
                    <X size={10} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {seletor}
    </div>
  );
}
