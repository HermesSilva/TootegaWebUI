/**
 * XMultiValueEditor — generic read-only editor for a field holding a LIST of values
 * (JSON-array string or delimited), e.g. IP addresses, MAC addresses, aliases.
 *
 * Shows the first value inline (preferring an IPv4-looking entry when present) with the
 * field label and a "+N" button INSIDE the input that opens a modal listing every value.
 * Framework-level (Core) — named by capability, not by any specific application.
 *
 * Opt in per field via XUIEditorModel.CustomEditorName = "XMultiValueEditor".
 */

import { useState, type JSX } from 'react';
import { Network, List } from 'lucide-react';
import { XModalShell } from '../XModalShell';
import type { XEditorProps } from './XEditor';
import { XEditorLabel } from './XEditorLabel';

export function parseList(pValue: unknown): string[] {
  if (Array.isArray(pValue)) return pValue.map((v) => String(v)).filter(Boolean);
  if (typeof pValue === 'string' && pValue.trim()) {
    try {
      const arr = JSON.parse(pValue);
      if (Array.isArray(arr)) return arr.map((v) => String(v)).filter(Boolean);
    } catch {
      /* not JSON — fall back to delimiter split */
    }
    return pValue.split(/[,;\s]+/).filter(Boolean);
  }
  return [];
}

export const isIPv4 = (pAddr: string): boolean => /^(\d{1,3}\.){3}\d{1,3}$/.test(pAddr);
export const isIPv6 = (pAddr: string): boolean => pAddr.includes(':') && /^[0-9a-fA-F:]+$/.test(pAddr);

export const multiValueInputClass =
  'w-full h-editor px-3 text-ui rounded-lg border border-border bg-brand-surface ' +
  'text-brand-text-primary focus:outline-none';

export function XMultiValueEditor({ editor, value }: XEditorProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const items = parseList(value);
  const primary = items.find(isIPv4) ?? items[0] ?? '';
  const title = editor.title ? (editor.title ?? '') : 'Endereços IP';

  return (
    <>
      <XEditorLabel title={editor.title} />
      <div className="relative">
        <Network
          size={15}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-text-secondary pointer-events-none"
        />
        <input
          type="text"
          readOnly
          value={primary || '—'}
          title={items.join(', ')}
           className={multiValueInputClass + ' pl-8 ' + (items.length > 1 ? 'pr-16 ' : '') + 'cursor-default'}
        />
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 h-[28px] px-2 rounded-md border border-border bg-brand-surface text-brand-text-secondary hover:bg-brand-hover text-xs whitespace-nowrap"
            title={'Ver todos'}
          >
            <List size={14} />
            +{items.length - 1}
          </button>
        )}
      </div>

      {open && (
        <XModalShell
          variant="inline"
          size="sm"
          closeLabel={'Fechar'}
          onClose={() => setOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <Network size={16} className="text-brand-primary shrink-0" />
              {title}
            </span>
          }
        >
          <ul className="p-2">
            {items.length === 0 && (
              <li className="px-3 py-2 text-ui text-brand-text-secondary">{'—'}</li>
            )}
            {items.map((val, i) => (
              <li
                key={`${val}-${i}`}
                className="flex items-center px-3 py-2 rounded hover:bg-hover"
              >
                <span className="text-ui text-brand-text-primary font-mono break-all">{val}</span>
              </li>
            ))}
          </ul>
        </XModalShell>
      )}
    </>
  );
}
