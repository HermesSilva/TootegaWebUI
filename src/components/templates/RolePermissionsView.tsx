/**
 * RolePermissionsView — generic READ-ONLY form-tab that shows a role's permissions, grouped by App.
 *
 * Data-driven (CE-19): knows no business App. The role detail is loaded by the modal itself via the
 * tab form's LoadEndpoint (/sys/roles/manage/{id}) into formData: { Nome, Nivel, QtdePermissoes,
 * Aplicacoes: [{ Aplicacao, Direitos: [...] }] }. This component only renders what came — no fetch.
 *
 * It replaces the old grid column that dumped 100+ permission names on one line, illegible. Here the
 * same information is a readable list: one card per application, its rights as chips.
 */

import { type JSX } from 'react';
import { Shield, ShieldCheck, AppWindow } from 'lucide-react';
import { getFieldValue } from '@core/lib';
import type { XFormTabComponentProps } from './XFormTabComponentRegistry';

interface Grupo {
  aplicacao: string;
  direitos: string[];
}

function lerGrupos(pDados: unknown): Grupo[] {
  if (!Array.isArray(pDados)) return [];
  return pDados.map((g) => {
    const r = g as Record<string, unknown>;
    const direitos = getFieldValue(r, 'Direitos');
    return {
      aplicacao: String(getFieldValue(r, 'Aplicacao') ?? ''),
      direitos: Array.isArray(direitos) ? direitos.map((d) => String(d)) : [],
    };
  });
}

export function RolePermissionsView({ formData }: XFormTabComponentProps): JSX.Element {
  const nome = String(getFieldValue(formData, 'Nome') ?? '');
  const nivel = String(getFieldValue(formData, 'Nivel') ?? '');
  const qtde = Number(getFieldValue(formData, 'QtdePermissoes') ?? 0);
  const grupos = lerGrupos(getFieldValue(formData, 'Aplicacoes'));

  return (
    <div className="p-4 space-y-4">
      {/* Cabeçalho do papel */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-light bg-gradient-to-r from-brand-primary/5 to-transparent">
        <span className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0 ring-1 ring-brand-primary/20">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <div className="text-ui font-semibold text-brand-text-primary truncate">{nome}</div>
          <div className="text-ui-xs text-brand-text-muted">
            {nivel} · {qtde} {qtde === 1 ? 'permissão' : 'permissões'}
          </div>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="py-10 text-center text-ui-sm text-brand-text-muted border border-border-light rounded-lg">
          {'Este papel não concede nenhuma permissão'}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[26rem] overflow-y-auto pr-1">
          {grupos.map((g) => (
            <div key={g.aplicacao} className="border border-border-light rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted-bg/60 border-b border-border-light/60">
                <AppWindow className="w-4 h-4 text-brand-primary/70 shrink-0" />
                <span className="text-ui-sm font-semibold text-brand-text-primary truncate">{g.aplicacao}</span>
                <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-ui-xs font-semibold tabular-nums bg-brand-primary/10 text-brand-primary shrink-0">
                  {g.direitos.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                {g.direitos.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-ui-xs bg-hover text-brand-text-secondary border border-border-light/60"
                  >
                    <Shield className="w-3 h-3 text-brand-primary/60" />
                    {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
