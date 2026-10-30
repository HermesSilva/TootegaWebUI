/**
 * AccessMatrixEditor — generic form-tab component that edits a "user → companies" whitelist.
 *
 * Data-driven (CE-19): it knows no business App. Endpoints come from the tab model:
 *   - tab.lookupEndpoint  POST { searchText, maxResults } → [{ sYSxUsuarioID, nome, email }]
 *       (used only on Create, to pick the target user)
 *   - tab.dataEndpoint    GET  {userId}/companies → [{ sYSxPessoaID, nome, documento, marcada, ativo }]
 *
 * It writes the selection back onto the shared form data (SYSxUsuarioID + empresaIDs); the parent
 * modal posts the aggregate in one request. Unchecking everything ⇒ the user keeps access to all.
 */

import { useState, useCallback, useEffect, useMemo, type JSX } from 'react';
import { Loader2, Check, Search, UserRound, Building2, Info } from 'lucide-react';
import { XApplicationMode } from '@core/types';
import { api } from '@core/lib/api';
import { getFieldValue, formatDocument } from '@core/lib';
import type { XFormTabComponentProps } from './XFormTabComponentRegistry';

interface UsuarioItem {
  id: string;
  nome: string;
  email: string;
}

interface EmpresaItem {
  id: number;
  nome: string;
  documento: string;
  marcada: boolean;
}

function lerUsuarios(pDados: unknown[]): UsuarioItem[] {
  return pDados.map((u) => ({
    id: String(getFieldValue(u as Record<string, unknown>, 'SYSxUsuarioID') ?? ''),
    nome: String(getFieldValue(u as Record<string, unknown>, 'Nome') ?? ''),
    email: String(getFieldValue(u as Record<string, unknown>, 'Email') ?? ''),
  }));
}

function lerEmpresas(pDados: unknown[]): EmpresaItem[] {
  return pDados.map((e) => ({
    id: Number(getFieldValue(e as Record<string, unknown>, 'SYSxPessoaID') ?? 0),
    nome: String(getFieldValue(e as Record<string, unknown>, 'Nome') ?? ''),
    documento: String(getFieldValue(e as Record<string, unknown>, 'Documento') ?? ''),
    marcada: getFieldValue(e as Record<string, unknown>, 'Marcada') === true,
  }));
}

export function AccessMatrixEditor({
  formData,
  onFormDataChange,
  isReadOnly,
  mode,
  tab,
}: XFormTabComponentProps): JSX.Element {
  const isCreate = mode === XApplicationMode.Create;

  const usuarioID = String(getFieldValue(formData, 'SYSxUsuarioID') ?? '');
  const usuarioNome = String(getFieldValue(formData, 'UsuarioNome') ?? '');
  const usuarioEmail = String(getFieldValue(formData, 'UsuarioEmail') ?? '');

  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');

  // Picker de usuário (só na criação).
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [resultados, setResultados] = useState<UsuarioItem[]>([]);
  const [buscandoUsuario, setBuscandoUsuario] = useState(false);
  const [nomeEscolhido, setNomeEscolhido] = useState('');

  const marcadas = useMemo(
    () => new Set<number>(((formData['empresaIDs'] as number[] | undefined) ?? []).map(Number)),
    [formData]
  );

  // Carrega as empresas ligáveis quando há usuário. Semeia a seleção a partir do "marcada" do
  // servidor apenas se o formulário ainda não tem empresaIDs (primeira carga / troca de usuário).
  useEffect(() => {
    if (!usuarioID || !tab.dataEndpoint) {
      setEmpresas([]);
      return;
    }

    let cancelado = false;
    setCarregando(true);

    api.get<unknown[]>(tab.dataEndpoint.replace('{userId}', usuarioID))
      .then((dados) => {
        if (cancelado) return;
        const lista = lerEmpresas(dados ?? []);
        setEmpresas(lista);
        if (formData['empresaIDs'] === undefined)
          onFormDataChange('empresaIDs', lista.filter((e) => e.marcada).map((e) => e.id));
      })
      .catch((erro) => console.error('AccessMatrixEditor companies load error:', erro))
      .finally(() => { if (!cancelado) setCarregando(false); });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioID, tab.dataEndpoint]);

  // Busca de usuários (debounce simples) na criação.
  useEffect(() => {
    if (!isCreate || !tab.lookupEndpoint) return;

    let cancelado = false;
    const handle = setTimeout(() => {
      setBuscandoUsuario(true);
      api.post<unknown[]>(tab.lookupEndpoint!, { searchText: buscaUsuario, maxResults: 50 })
        .then((dados) => { if (!cancelado) setResultados(lerUsuarios(dados ?? [])); })
        .catch((erro) => console.error('AccessMatrixEditor users lookup error:', erro))
        .finally(() => { if (!cancelado) setBuscandoUsuario(false); });
    }, 250);

    return () => { cancelado = true; clearTimeout(handle); };
  }, [isCreate, tab.lookupEndpoint, buscaUsuario]);

  const escolherUsuario = useCallback((pUsuario: UsuarioItem) => {
    setNomeEscolhido(`${pUsuario.nome}${pUsuario.email ? ` · ${pUsuario.email}` : ''}`);
    setResultados([]);
    setBuscaUsuario('');
    onFormDataChange('empresaIDs', undefined);   // reseta a seleção; recarrega e semeia pelo novo usuário
    onFormDataChange('SYSxUsuarioID', pUsuario.id);
  }, [onFormDataChange]);

  const alternar = useCallback((pID: number) => {
    const prox = new Set(marcadas);
    if (prox.has(pID)) prox.delete(pID); else prox.add(pID);
    onFormDataChange('empresaIDs', [...prox]);
  }, [marcadas, onFormDataChange]);

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((e) => e.nome.toLowerCase().includes(termo) || e.documento.includes(termo));
  }, [empresas, busca]);

  const marcarTodas = useCallback((pMarcar: boolean) => {
    if (pMarcar) {
      const uniao = new Set(marcadas);
      for (const e of empresasFiltradas) uniao.add(e.id);
      onFormDataChange('empresaIDs', [...uniao]);
    } else {
      const remover = new Set(empresasFiltradas.map((e) => e.id));
      onFormDataChange('empresaIDs', [...marcadas].filter((id) => !remover.has(id)));
    }
  }, [marcadas, empresasFiltradas, onFormDataChange]);

  const todasFiltradasMarcadas = empresasFiltradas.length > 0 && empresasFiltradas.every((e) => marcadas.has(e.id));
  const algumaFiltradaMarcada = empresasFiltradas.some((e) => marcadas.has(e.id));

  const bloqueado = isReadOnly;
  const nomeUsuario = usuarioNome || nomeEscolhido || usuarioEmail;

  return (
    <div className="p-4 space-y-4">
      {/* Cabeçalho do usuário / picker */}
      {isCreate && !usuarioID ? (
        <div>
          <label className="block text-ui-sm font-medium text-brand-text-secondary mb-1.5">
            {'Selecione o usuário'}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <input
              type="text"
              value={buscaUsuario}
              onChange={(e) => setBuscaUsuario(e.target.value)}
              placeholder={'Buscar usuário por nome ou e-mail…'}
              className="w-full pl-9 pr-3 min-h-editor text-ui border border-border rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              autoFocus
            />
          </div>
          <div className="mt-2 border border-border-light rounded-lg divide-y divide-border-light max-h-64 overflow-auto">
            {buscandoUsuario ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
              </div>
            ) : resultados.length === 0 ? (
              <div className="py-6 text-center text-ui-sm text-brand-text-muted">{'Nenhum usuário encontrado'}</div>
            ) : (
              resultados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => escolherUsuario(u)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-hover transition-colors"
                >
                  <UserRound className="w-4 h-4 text-brand-text-muted shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-ui font-medium text-brand-text-primary truncate">{u.nome}</span>
                    <span className="block text-ui-xs text-brand-text-muted truncate">{u.email}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-light bg-gradient-to-r from-brand-primary/5 to-transparent">
          <span className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0 ring-1 ring-brand-primary/20">
            <UserRound className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-ui font-semibold text-brand-text-primary truncate">{nomeUsuario}</div>
            {usuarioEmail && <div className="text-ui-xs text-brand-text-muted truncate">{usuarioEmail}</div>}
          </div>
        </div>
      )}

      {/* Lista de empresas */}
      {usuarioID && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </span>
              <span className="text-ui font-semibold text-brand-text-primary truncate">{'Empresas'}</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-ui-xs font-semibold tabular-nums bg-brand-primary/10 text-brand-primary shrink-0"
                title={`${marcadas.size} de ${empresas.length} selecionadas`}
              >
                {marcadas.size} / {empresas.length}
              </span>
            </div>
          </div>

          {/* Busca SEMPRE presente: o catálogo pode ter centenas de empresas. */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={'Buscar empresa por nome ou documento…'}
              className="w-full pl-9 pr-3 min-h-editor text-ui border border-border rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>

          {carregando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div className="py-10 text-center text-ui-sm text-brand-text-muted border border-border-light rounded-lg">{'Nenhuma empresa disponível'}</div>
          ) : (
            // Grade tabular (como a dos Apps): cabeçalho + linhas, área rolável p/ centenas de empresas.
            <div className="border border-border-light rounded-lg overflow-hidden">
              <div className="max-h-[19rem] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted-bg">
                    <tr className="text-ui-xs tracking-wider text-brand-text-secondary">
                      <th className="w-10 px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => !bloqueado && marcarTodas(!todasFiltradasMarcadas)}
                          disabled={bloqueado}
                          aria-label={'Marcar todas'}
                          className="inline-flex align-middle"
                        >
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                            ${todasFiltradasMarcadas ? 'bg-brand-primary border-brand-primary'
                              : algumaFiltradaMarcada ? 'bg-brand-primary/30 border-brand-primary'
                              : 'border-border-light'}`}>
                            {(todasFiltradasMarcadas || algumaFiltradaMarcada) && <Check className="w-3.5 h-3.5 text-white" />}
                          </span>
                        </button>
                      </th>
                      <th className="px-3 py-2.5 font-medium">{'Empresa'}</th>
                      <th className="px-3 py-2.5 font-medium">{'Documento'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {empresasFiltradas.map((e) => {
                      const ativa = marcadas.has(e.id);
                      return (
                        <tr
                          key={e.id}
                          onClick={() => !bloqueado && alternar(e.id)}
                          className={`transition-colors ${bloqueado ? '' : 'cursor-pointer'}
                            ${ativa ? 'bg-brand-primary/10 hover:bg-brand-primary/15' : 'hover:bg-hover'}`}
                        >
                          <td className="w-10 px-3 py-2.5 text-center align-middle">
                            <span className={`inline-flex w-5 h-5 rounded border-2 items-center justify-center align-middle transition-all
                              ${ativa ? 'bg-brand-primary border-brand-primary' : 'border-border-light'}`}>
                              {ativa && <Check className="w-3.5 h-3.5 text-white" />}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-ui font-medium text-brand-text-primary">{e.nome}</td>
                          <td className="px-3 py-2.5 text-ui-sm text-brand-text-muted tabular-nums whitespace-nowrap">{formatDocument(e.documento)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-muted-bg/60 border border-border-light/60 text-ui-xs text-brand-text-muted">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-primary/70" />
            <span>{'Sem empresas marcadas, o usuário terá acesso a todas.'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
