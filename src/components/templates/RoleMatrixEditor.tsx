/**
 * RoleMatrixEditor — generic form-tab component that edits a member's ROLES (RBAC N:N).
 *
 * Data-driven (CE-19): knows no business App. The member comes from the selected grid row (edit
 * mode); there is no user picker. Endpoints come from the tab model:
 *   - tab.dataEndpoint  GET {userId}/roles → [{ sYSxPapelID, nome, atribuido }]
 *       (roles available to the tenant's plan, each flagged if the member already has it)
 *
 * Include/exclude are IMMEDIATE (one request each), like a switch — not deferred to the modal save:
 *   - POST   {base}/{userId}/roles           { SYSxPapelID }   → include
 *   - DELETE {base}/{userId}/roles/{papelID}                   → exclude
 * The base is derived from dataEndpoint (drops the trailing "/roles"). A role outside the plan is
 * refused by the back with an orange business warning (CE-20).
 */

import { useState, useCallback, useEffect, useMemo, type JSX } from 'react';
import { Loader2, Check, ShieldCheck, Info } from 'lucide-react';
import { api } from '@core/lib/api';
import { getFieldValue } from '@core/lib';
import type { XFormTabComponentProps } from './XFormTabComponentRegistry';

interface PapelItem {
  id: string;
  nome: string;
  atribuido: boolean;
}

function lerPapeis(pDados: unknown[]): PapelItem[] {
  return pDados.map((p) => ({
    id: String(getFieldValue(p as Record<string, unknown>, 'SYSxPapelID') ?? ''),
    nome: String(getFieldValue(p as Record<string, unknown>, 'Nome') ?? ''),
    atribuido: getFieldValue(p as Record<string, unknown>, 'Atribuido') === true,
  }));
}

export function RoleMatrixEditor({ formData, isReadOnly, tab }: XFormTabComponentProps): JSX.Element {
  const usuarioID = String(getFieldValue(formData, 'SYSxUsuarioID') ?? '');
  const usuarioNome = String(getFieldValue(formData, 'UsuarioNome') ?? getFieldValue(formData, 'Nome') ?? '');

  const [papeis, setPapeis] = useState<PapelItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  // Base dos endpoints de include/exclude: o dataEndpoint é ".../{userId}/roles" — tira o "/roles".
  const base = useMemo(() => (tab.dataEndpoint ?? '').replace(/\/\{userId\}\/roles$/, ''), [tab.dataEndpoint]);

  const carregar = useCallback(() => {
    if (!usuarioID || !tab.dataEndpoint) {
      setPapeis([]);
      return;
    }
    setCarregando(true);
    api.get<unknown[]>(tab.dataEndpoint.replace('{userId}', usuarioID))
      .then((dados) => setPapeis(lerPapeis(dados ?? [])))
      .catch((e) => console.error('RoleMatrixEditor roles load error:', e))
      .finally(() => setCarregando(false));
  }, [usuarioID, tab.dataEndpoint]);

  useEffect(() => { carregar(); }, [carregar]);

  const alternar = useCallback(async (pPapel: PapelItem) => {
    if (isReadOnly || salvando) return;
    setSalvando(pPapel.id);
    setErro('');
    try {
      if (pPapel.atribuido)
        await api.delete(`${base}/${usuarioID}/roles/${pPapel.id}`);
      else
        await api.post(`${base}/${usuarioID}/roles`, { SYSxPapelID: pPapel.id });
      // Otimista: reflete a troca sem recarregar tudo.
      setPapeis((prev) => prev.map((p) => (p.id === pPapel.id ? { ...p, atribuido: !p.atribuido } : p)));
    } catch (e) {
      // A mensagem de negócio (papel fora do plano etc.) já é exibida pela camada de API; aqui só
      // reverte visualmente recarregando a verdade do servidor.
      console.error('RoleMatrixEditor toggle error:', e);
      setErro('Não foi possível alterar o papel. Verifique o plano do assinante.');
      carregar();
    } finally {
      setSalvando(null);
    }
  }, [base, usuarioID, isReadOnly, salvando, carregar]);

  const marcados = papeis.filter((p) => p.atribuido).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-light bg-gradient-to-r from-brand-primary/5 to-transparent">
        <span className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0 ring-1 ring-brand-primary/20">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <div className="text-ui font-semibold text-brand-text-primary truncate">{usuarioNome}</div>
          <div className="text-ui-xs text-brand-text-muted">{marcados} de {papeis.length} papéis</div>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
        </div>
      ) : papeis.length === 0 ? (
        <div className="py-10 text-center text-ui-sm text-brand-text-muted border border-border-light rounded-lg">
          {'Nenhum papel disponível no plano do assinante'}
        </div>
      ) : (
        <div className="border border-border-light rounded-lg overflow-hidden">
          <div className="max-h-[19rem] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-muted-bg">
                <tr className="text-ui-xs tracking-wider text-brand-text-secondary">
                  <th className="w-10 px-3 py-2.5 text-center" />
                  <th className="px-3 py-2.5 font-medium">{'Papel'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {papeis.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => alternar(p)}
                    className={`transition-colors ${isReadOnly ? '' : 'cursor-pointer'}
                      ${p.atribuido ? 'bg-brand-primary/10 hover:bg-brand-primary/15' : 'hover:bg-hover'}`}
                  >
                    <td className="w-10 px-3 py-2.5 text-center align-middle">
                      {salvando === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-brand-primary inline-block align-middle" />
                      ) : (
                        <span className={`inline-flex w-5 h-5 rounded border-2 items-center justify-center align-middle transition-all
                          ${p.atribuido ? 'bg-brand-primary border-brand-primary' : 'border-border-light'}`}>
                          {p.atribuido && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ui font-medium text-brand-text-primary">{p.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {erro && <div className="text-ui-xs text-warning">{erro}</div>}

      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted-bg/60 border border-border-light/60 text-ui-xs text-brand-text-muted">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-primary/70" />
        <span>{'Só aparecem os papéis que o plano do assinante habilita. Marcar/desmarcar tem efeito imediato.'}</span>
      </div>
    </div>
  );
}
