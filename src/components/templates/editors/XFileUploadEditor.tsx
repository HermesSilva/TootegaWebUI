/**
 * XFileUploadEditor - File upload editor
 *
 * Reads a picked file as base64 (no data: prefix) into the bound field, and emits the
 * file name + size as bindings so sibling fields (e.g. fileName) can be auto-filled.
 * Used by the Tool Releases app to upload the agent installer (Enroller) for auto-update.
 */

import { useCallback, useState, type JSX } from 'react';
import { Upload, FileCheck } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { useSeletorDeArquivo } from '@core/hooks/useSeletorDeArquivo';
import { XEditorLabel } from './XEditorLabel';

interface XFileUploadEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
}

function readAsBase64(pFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(pFile);
  });
}

/**
 * Extracts the 4-part FileVersion from a Windows PE by scanning for the VS_FIXEDFILEINFO
 * signature (0xFEEF04BD). Returns "" when not found / not a PE. Mirrors the backend reader.
 */
async function readPeFileVersion(pFile: File): Promise<string> {
  try {
    const buf = new Uint8Array(await pFile.arrayBuffer());
    // little-endian 0xFEEF04BD = BD 04 EF FE
    for (let i = 0; i + 16 <= buf.length; i++) {
      if (buf[i] === 0xbd && buf[i + 1] === 0x04 && buf[i + 2] === 0xef && buf[i + 3] === 0xfe) {
        const dv = new DataView(buf.buffer, i + 8, 8);
        const ms = dv.getUint32(0, true);
        const ls = dv.getUint32(4, true);
        const v = `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`;
        if (v !== '0.0.0.0') return v;
      }
    }
  } catch {
    /* ignore — backend re-reads authoritatively */
  }
  return '';
}

export function XFileUploadEditor({
  editor,
  onChange,
  error,
  disabled,
}: XFileUploadEditorProps): JSX.Element {
  const [fileName, setFileName] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Binding target field names (overridable). Defaults match the Tool Releases form.
  const fileNameField =
    (editor.editor as { fileNameField?: string }).fileNameField ?? 'fileName';
  const versionField =
    (editor.editor as { versionField?: string }).versionField ?? 'version';

  const processar = useCallback(
    async (pArquivo: File) => {
      setBusy(true);
      try {
        const base64 = await readAsBase64(pArquivo);
        const version = await readPeFileVersion(pArquivo);
        setFileName(pArquivo.name);
        const bindings: Record<string, unknown> = { [fileNameField]: pArquivo.name };
        if (version) bindings[versionField] = version;
        onChange(base64, bindings);
      } finally {
        setBusy(false);
      }
    },
    [onChange, fileNameField, versionField],
  );

  // O input vive dentro de um <label>: quem abre o diálogo é o navegador, não `abrir()`. O hook
  // colhe a ESCOLHA mesmo assim — é por isso que ele não exige abertura por código quando o
  // `change` traz arquivo. Sem `onCancelar`: cancelar aqui deixa o campo como estava, que é o certo.
  const seletor = useSeletorDeArquivo({
    onEscolher: (pArquivos) => { void processar(pArquivos[0]); },
  });

  return (
    <div className="flex flex-col gap-1">
      <XEditorLabel title={editor.title} isRequired={editor.editor?.isRequired} />
      <label
        className={`flex items-center gap-2 px-3 min-h-[44px] rounded border cursor-pointer
          border-[hsl(var(--border))] bg-[hsl(var(--input))] hover:bg-[hsl(var(--accent))]
          ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {fileName ? <FileCheck size={18} className="text-green-500" /> : <Upload size={18} />}
        <span className="truncate text-sm">
          {busy ? '…' : fileName || '—'}
        </span>
        <input
          type="file"
          className="hidden"
          disabled={disabled || busy}
          onChange={seletor.aoMudar}
        />
      </label>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </div>
  );
}
