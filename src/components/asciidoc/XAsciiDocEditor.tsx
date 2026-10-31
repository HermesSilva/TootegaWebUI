/**
 * XAsciiDocEditor — o adaptador de CAMPO do editor AsciiDoc: o que uma App declara com
 * `CustomEditorName = "XAsciiDocEditor"` (CE-19). Rótulo da plataforma em cima, o editor completo embaixo, ocupando
 * a altura que a seção lhe der.
 */

import { type JSX } from 'react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from '../templates/editors/XEditorLabel';
import { XEditorAsciiDoc } from './XEditorAsciiDoc';

interface XAsciiDocEditorProps {
  editor: XDataEditor;
  value: unknown;
  onChange: (pValue: string) => void;
  error?: string;
  disabled?: boolean;
}

export function XAsciiDocEditor({ editor, value, onChange, error, disabled = false }: XAsciiDocEditorProps): JSX.Element {
  const editorModel = editor.editor;
  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />
        {error && <span className="text-ui-xs text-danger">{error}</span>}
      </div>
      <div className="flex-1 min-h-[20rem]" id={editor.id}>
        <XEditorAsciiDoc valor={typeof value === 'string' ? value : ''} aoMudar={onChange} somenteLeitura={disabled || editorModel.isReadOnly === true} rotuloAcessivel={editor.title} />
      </div>
    </div>
  );
}
