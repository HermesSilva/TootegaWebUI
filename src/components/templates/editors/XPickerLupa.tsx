/**
 * XPickerLupa — a LUPA de busca de registro, uma vez só, para qualquer editor.
 *
 * O botão dentro do campo e o diálogo que ele abre eram escritos dentro do editor de documento; a
 * grade de itens tinha o seu próprio caminho. Cada editor que ganhasse busca reescreveria os mesmos
 * três pedaços — o botão, o estado de aberto/fechado e a aplicação do registro escolhido —, e é
 * assim que dois campos que fazem a mesma coisa passam a se comportar diferente.
 *
 * Aqui a lupa é UMA: quem quiser busca declara `pickerEndpoint` no modelo (CE-19) e monta este
 * componente. O diálogo continua sendo o `XRecordPickerDialog`, que já é genérico; o que faltava era
 * a porta de entrada dele.
 *
 * Não conhece App nenhuma: endpoint, título, critérios e colunas vêm todos do modelo do back.
 */

import { useRef, useState, type JSX } from 'react';
import { Search } from 'lucide-react';
import type { XUIEditorModel } from '@core/types';
import { selecaoDoPicker, type SelecaoDoPicker } from '@core/lib/pickerSelecao';
import { XRecordPickerDialog } from './XRecordPickerDialog';

interface XPickerLupaProps {
  /** O modelo do editor — é dele que saem endpoint, título, critérios, colunas e vínculos. */
  editorModel: XUIEditorModel;
  /** Desliga o botão (campo desabilitado ou só-leitura). */
  disabled?: boolean;
  /**
   * O registro escolhido, já traduzido em "valor do campo" + "campos do formulário".
   * O item cru vai junto para quem precisar de algo que os vínculos não cobrem.
   */
  onSelect: (pSelecao: SelecaoDoPicker, pItem: Record<string, unknown>) => void;
}

/** Existe lupa? Só quando o modelo diz para onde ela busca. */
export function temPicker(pEditorModel: XUIEditorModel): boolean {
  return !!pEditorModel.pickerEndpoint;
}

export function XPickerLupa({ editorModel, disabled, onSelect }: XPickerLupaProps): JSX.Element | null {
  const [aberto, setAberto] = useState(false);

  const botaoRef = useRef<HTMLButtonElement>(null);

  // A ÂNCORA do painel é o CAMPO, não a lupa (dono, 2026-10-17): o popover nasce alinhado à esquerda
  // do campo e na largura dele. A lupa vive dentro do `relative` do campo, então o pai dela é o
  // próprio campo — ancorar no botão punha o painel colado à direita, deslocado do que ele lista.
  const campoRef = useRef<HTMLElement | null>(null);

  if (!temPicker(editorModel))
    return null;

  const alternar = (): void => {
    campoRef.current = botaoRef.current?.parentElement ?? botaoRef.current;
    setAberto((pAtual) => !pAtual);
  };

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        disabled={disabled}
        title={'Pesquisar'}
        aria-label={'Pesquisar'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-brand-text-muted hover:text-brand-primary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Search className="w-4 h-4" />
      </button>

      {aberto && (
        <XRecordPickerDialog
          ancora={campoRef}
          endpoint={editorModel.pickerEndpoint!}
          title={editorModel.pickerTitle}
          searchFields={editorModel.pickerSearchFields}
          searchPlaceholder={editorModel.pickerSearchPlaceholder}
          columns={editorModel.pickerColumns}
          onSelect={(pItem) => {
            onSelect(selecaoDoPicker(pItem, editorModel), pItem);
            setAberto(false);
          }}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}
