/**
 * XIpAddressesEditor — IP-specialized variant of XMultiValueEditor.
 *
 * Same inline preview + modal list, but each IPv4 row gets:
 *   - an IPv4/IPv6 tag, and
 *   - a "ping" button that validates reachability from the BROWSER (the relevant vantage
 *     point for a LAN station). Browsers cannot send ICMP, so this is a TCP-connect probe
 *     to the agent port via fetch(no-cors): a connect (or a fast RST) = host up; a timeout
 *     = unreachable. Only works from an http origin (mixed content blocks http from https).
 *
 * Opt in per field via XUIEditorModel.CustomEditorName = "XIpAddressesEditor".
 */

import { useState, useCallback, type JSX } from 'react';
import { Network, List, X, Radio, Check, Loader2 } from 'lucide-react';
import { XModalShell } from '../XModalShell';
import type { XEditorProps } from './XEditor';
import { XEditorLabel } from './XEditorLabel';
import { parseList, isIPv4, isIPv6, multiValueInputClass } from './XMultiValueEditor';

// Port probed to validate reachability — the station agent's LAN server.
const PING_PORT = 47654;
const PING_TIMEOUT_MS = 2500;

type PingState = 'idle' | 'pinging' | 'up' | 'down';

export function XIpAddressesEditor({ editor, value }: XEditorProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [pings, setPings] = useState<Record<string, PingState>>({});

  const items = parseList(value);
  const primary = items.find(isIPv4) ?? items[0] ?? '';
  const title = editor.title ? (editor.title ?? '') : 'Endereços IP';
  const canPing = window.location.protocol === 'http:'; // http MJPEG port; https blocks mixed content

    // Link-local IPv6 (fe80::) needs a zone/scope id the browser can't supply -> not pingable.
    const isLinkLocalV6 = (pAddr: string) => /^fe80:/i.test(pAddr);
    const isPingable = (pAddr: string) => canPing && (isIPv4(pAddr) || (isIPv6(pAddr) && !isLinkLocalV6(pAddr)));

  const ping = useCallback(async (pIp: string) => {
    if (!canPing) return;
    // IPv6 literals must be bracketed in a URL host.
    const host = isIPv6(pIp) ? `[${pIp}]` : pIp;
    setPings((p) => ({ ...p, [pIp]: 'pinging' }));
    const t0 = Date.now();
    let up = false;
    try {
      // Opaque response: we only care whether the TCP connection succeeds.
      await fetch(`http://${host}:${PING_PORT}/`, { mode: 'no-cors', signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
      up = true;
    } catch {
      // Fast reject (connection refused/RST) means the host answered -> up. A reject at the
      // timeout means no response -> down.
      up = (Date.now() - t0) < PING_TIMEOUT_MS - 200;
    }
    setPings((p) => ({ ...p, [pIp]: up ? 'up' : 'down' }));
  }, [canPing]);

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
            {items.map((ip, i) => {
              const tag = isIPv4(ip) ? 'IPv4' : isIPv6(ip) ? 'IPv6' : '';
              const st = pings[ip] ?? 'idle';
              return (
                <li
                  key={`${ip}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-hover"
                >
                  <span className="flex-1 text-ui text-brand-text-primary font-mono break-all">{ip}</span>
                  <span className="text-ui-xs tracking-wide text-brand-text-secondary">{tag}</span>
                  {isPingable(ip) && (
                    <button
                      type="button"
                      onClick={() => ping(ip)}
                      disabled={st === 'pinging'}
                      title={'Ping'}
                      aria-label={'Ping'}
                      className="flex items-center justify-center min-h-touch min-w-touch rounded border border-border hover:bg-hover disabled:opacity-50"
                    >
                      {st === 'pinging' ? <Loader2 size={14} className="animate-spin text-brand-text-secondary" />
                        : st === 'up' ? <Check size={14} className="text-success" />
                        : st === 'down' ? <X size={14} className="text-danger" />
                        : <Radio size={14} className="text-brand-text-secondary" />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </XModalShell>
      )}
    </>
  );
}
