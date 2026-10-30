/**
 * XImageUploadEditor — editor genérico de IMAGEM (XUIEditorType.ImageUpload = 28).
 *
 * Mostra a prévia do que está guardado, troca por outra imagem e REMOVE. O valor ligado ao campo é o
 * conteúdo em Base64 (sem o prefixo `data:`); a remoção manda o sentinela `-`, que o Base64 nunca produz
 * (o alfabeto dele não tem hífen). Campo vazio continua significando "não mexi" — o formulário é salvo
 * inteiro a cada edição, e não escolher arquivo é o estado normal.
 *
 * Não deixa o usuário errar: `accept` e `maxSizeBytes` vêm do MODELO DO BACK (CE-19) e o editor recusa o
 * arquivo fora da regra na hora da escolha — em vez de aceitá-lo e estourar depois, montando o documento.
 */

import { useCallback, useState, type JSX } from 'react';
import { Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { useSeletorDeArquivo } from '@core/hooks/useSeletorDeArquivo';
import { XEditorLabel } from './XEditorLabel';

/** Mandado ao back quando o usuário remove a imagem. Ver XUIEditorModel.SentinelaRemocao. */
const SENTINELA_REMOCAO = '-';

interface XImageUploadEditorProps {
  editor: XDataEditor;
  value: unknown;
  onChange: (pValue: unknown) => void;
  error?: string;
  disabled?: boolean;
}

function lerBase64(pArquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(leitor.error);
    leitor.onload = () => {
      const resultado = String(leitor.result ?? '');
      const virgula = resultado.indexOf(',');
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
    };
    leitor.readAsDataURL(pArquivo);
  });
}

/** "image/png,image/jpeg" → "PNG, JPEG": o accept é para a máquina; a recusa, para quem lê. */
function tiposLegiveis(pAccept: string): string {
  return pAccept
    .split(',')
    .map((pT) => pT.trim().split('/').pop() ?? '')
    .filter(Boolean)
    .map((pT) => pT.replace('.', '').toUpperCase())
    .join(', ');
}

/** O `accept` do modelo ("image/png,image/jpeg") aceita este arquivo? */
function tipoAceito(pArquivo: File, pAccept: string): boolean {
  if (!pAccept) return true;

  return pAccept
    .split(',')
    .map((pT) => pT.trim().toLowerCase())
    .some((pTipo) => {
      if (pTipo.endsWith('/*')) return pArquivo.type.toLowerCase().startsWith(pTipo.slice(0, -1));
      if (pTipo.startsWith('.')) return pArquivo.name.toLowerCase().endsWith(pTipo);
      return pArquivo.type.toLowerCase() === pTipo;
    });
}

export function XImageUploadEditor({
  editor,
  value,
  onChange,
  error,
  disabled,
}: XImageUploadEditorProps): JSX.Element {
  const [recusa, setRecusa] = useState('');

  const accept = (editor.editor as { accept?: string }).accept ?? '';
  const tetoBytes = Number((editor.editor as { maxSizeBytes?: number }).maxSizeBytes ?? 0);

  // O valor do campo é Base64; o sentinela de remoção não é imagem nenhuma.
  const base64 = typeof value === 'string' && value !== SENTINELA_REMOCAO ? value : '';
  const previa = base64 ? `data:image;base64,${base64}` : '';

  const processar = useCallback(
    async (arquivo: File) => {
      if (!tipoAceito(arquivo, accept)) {
        setRecusa(`Arquivo não aceito. Tipos permitidos: ${tiposLegiveis(accept)}.`);
        return;
      }

      if (tetoBytes > 0 && arquivo.size > tetoBytes) {
        const limite = Math.round(tetoBytes / 1024 / 1024);
        setRecusa(`O arquivo passa do limite de ${`${limite} MB`}.`);
        return;
      }

      setRecusa('');
      onChange(await lerBase64(arquivo));
    },
    [accept, tetoBytes, onChange],
  );

  // O input vive dentro de um <label>: quem abre o dialogo e o navegador, nao `abrir()`. O hook
  // colhe a ESCOLHA mesmo assim, e zera o valor do input — e o que permite reescolher o MESMO
  // arquivo depois de uma recusa por tipo ou tamanho. Sem `onCancelar`: cancelar nao muda nada.
  const seletor = useSeletorDeArquivo({
    onEscolher: (pArquivos) => { void processar(pArquivos[0]); },
  });

  const aoRemover = useCallback(() => {
    setRecusa('');
    onChange(SENTINELA_REMOCAO);
  }, [onChange]);

  const removida = value === SENTINELA_REMOCAO;

  return (
    <div className="flex flex-col gap-1">
      <XEditorLabel title={editor.title} isRequired={editor.editor?.isRequired} />

      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-24 h-16 shrink-0 rounded border overflow-hidden
            border-[hsl(var(--border))] bg-[hsl(var(--input))]"
        >
          {previa && !removida ? (
            <img src={previa} alt={editor.title} className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon size={20} className="opacity-40" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <label
            className={`inline-flex items-center gap-2 px-3 min-h-[44px] rounded border cursor-pointer
              border-[hsl(var(--border))] bg-[hsl(var(--input))] hover:bg-[hsl(var(--accent))]
              ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <Upload size={16} />
            <span className="text-sm">{'Escolher arquivo'}</span>
            <input
              type="file"
              className="hidden"
              accept={accept || undefined}
              disabled={disabled}
              onChange={seletor.aoMudar}
            />
          </label>

          {previa && !removida ? (
            <button
              type="button"
              onClick={aoRemover}
              disabled={disabled}
              title={'Remover'}
              className="inline-flex items-center gap-2 px-3 min-h-[44px] rounded border
                border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] disabled:opacity-60"
            >
              <Trash2 size={16} className="text-red-500" />
              <span className="text-sm">{'Remover'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {recusa ? <span className="text-xs text-red-500">{recusa}</span> : null}
      {!recusa && error ? <span className="text-xs text-red-500">{error}</span> : null}
      {!recusa && !error && editor.editor?.hintText ? (
        <span className="text-xs opacity-70">{(editor.editor.hintText ?? '')}</span>
      ) : null}
    </div>
  );
}
