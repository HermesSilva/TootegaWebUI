/**
 * SelectionMatrixEditor — generic form-tab component that edits a CHECKBOX SELECTION over a list
 * served by the back end.
 *
 * Data-driven (CE-19): it knows no business App. Everything comes from the tab model —
 *   - tab.dataEndpoint  GET {id}/... → [{ <keyField>, nome, <descricao?>, marcada|concedido }]
 *   - tab.name          picks which form field holds the selection (see _Perfis below)
 *
 * It writes the selection back onto the shared form data; the parent modal posts the whole
 * aggregate in one request. Selecting nothing is meaningful, not empty — the `nota` text spells out
 * what it means, instead of leaving the user guessing.
 *
 * Distinct from AccessMatrixEditor, which is bound to a USER (it owns a user picker and the
 * {userId} route token). This one is bound to whatever row the modal already has open.
 */

import { useState, useCallback, useEffect, useMemo, type JSX } from 'react';
import { Loader2, Check, Search, Info } from 'lucide-react';
import { api } from '@core/lib/api';
import { getFieldValue } from '@core/lib';
import type { XFormTabComponentProps } from './XFormTabComponentRegistry';

/** One selectable row. `id` is string-typed here and converted back on save by the perfil. */
interface ItemSelecionavel {
  id: string;
  nome: string;
  /** Secondary line: the CNPJ of a company, the menu group of a program. May be empty. */
  detalhe: string;
  marcado: boolean;
}

/**
 * Per-tab wiring. The tab NAME is the contract between back and front: the back declares a tab
 * called "programas" or "empresas", and this table says which form field carries its selection,
 * which server field is the key, and what the texts are. Adding a new selection tab is adding one
 * entry here — never a new component.
 */
interface PerfilDeSelecao {
  /** Form-data field that holds the selected ids (posted with the aggregate). */
  campoSelecao: string;
  /** Server field holding the row key. */
  campoChave: string;
  /** Server field holding the secondary line (empty string ⇒ no secondary line). */
  campoDetalhe: string;
  /** Server boolean field that seeds the initial selection. */
  campoMarcado: string;
  busca: string;
  vazio: string;
  /** Explains what selecting NOTHING means — silence here is what makes users guess. */
  nota: string;
}

const _Perfis: Record<string, PerfilDeSelecao> = {
  programas: {
    campoSelecao: 'programaIDs',
    campoChave: 'SYSxAplicacaoID',
    campoDetalhe: 'Grupo',
    campoMarcado: 'Concedido',
    busca: 'Buscar programa…',
    vazio: 'Nenhum programa disponível',
    nota: 'Sem nenhum programa marcado, o perfil não dá acesso a tela alguma.',
  },
};

// A aba "Empresas" dos Perfis de Acesso NÃO usa este componente: ela virou uma GRADE com diálogo de
// busca (XItemsGridEditor + itemPickerEndpoint), como a aba de itens do Pedido — o operador procura a
// empresa e ela vira uma linha, em vez de percorrer uma lista de caixas (dono, 2026-09-13). A matriz
// continua servindo listas CURTAS e FECHADAS, como o catálogo de programas.

function lerItens(pDados: unknown[], pPerfil: PerfilDeSelecao): ItemSelecionavel[] {
  return pDados.map((i) => {
    const linha = i as Record<string, unknown>;
    return {
      id: String(getFieldValue(linha, pPerfil.campoChave) ?? ''),
      nome: String(getFieldValue(linha, 'Nome') ?? ''),
      detalhe: String(getFieldValue(linha, pPerfil.campoDetalhe) ?? ''),
      marcado: getFieldValue(linha, pPerfil.campoMarcado) === true,
    };
  });
}

export function SelectionMatrixEditor({
  formData,
  onFormDataChange,
  isReadOnly,
  tab,
}: XFormTabComponentProps): JSX.Element {
  const perfil = _Perfis[tab.name] ?? _Perfis['programas'];

  const [itens, setItens] = useState<ItemSelecionavel[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  // A seleção vive no formData (string-normalizada aqui, reconvertida ao gravar): o modal-pai posta
  // o agregado inteiro numa requisição só.
  const marcados = useMemo(
    () => new Set<string>(((formData[perfil.campoSelecao] as unknown[] | undefined) ?? []).map(String)),
    [formData, perfil.campoSelecao]
  );

  const registrar = useCallback((pIDs: string[]) => {
    onFormDataChange(perfil.campoSelecao, pIDs);
  }, [onFormDataChange, perfil]);

  // Carrega a lista. Na criação não há id ainda: o endpoint recebe o Guid vazio e o back devolve o
  // universo com nada marcado — é a mesma tela, sem caso especial.
  useEffect(() => {
    if (!tab.dataEndpoint) return;

    const id = String(getFieldValue(formData, 'SYSxPapelID') ?? '') || '00000000-0000-0000-0000-000000000000';

    let cancelado = false;
    setCarregando(true);
    setErro('');

    api.get<unknown[]>(tab.dataEndpoint.replace('{id}', id))
      .then((dados) => {
        if (cancelado) return;
        const lista = lerItens(dados ?? [], perfil);
        setItens(lista);
        // Semeia a seleção só na PRIMEIRA carga: depois disso quem manda é o que o usuário marcou,
        // e resemear apagaria a edição em curso.
        if (formData[perfil.campoSelecao] === undefined)
          registrar(lista.filter((i) => i.marcado).map((i) => i.id));
      })
      .catch((pErro: unknown) => {
        if (cancelado) return;
        // Erro MUDO é defeito (CE-21-quater): a falha diz a operação e o motivo, na tela, em vez de
        // deixar a lista vazia fingindo que não há nada a escolher.
        const motivo = pErro instanceof Error ? pErro.message : String(pErro);
        setErro(`Não foi possível carregar a lista (GET ${tab.dataEndpoint}): ${motivo}`);
      })
      .finally(() => { if (!cancelado) setCarregando(false); });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.dataEndpoint, tab.name]);

  const alternar = useCallback((pID: string) => {
    const prox = new Set(marcados);
    if (prox.has(pID)) prox.delete(pID); else prox.add(pID);
    registrar([...prox]);
  }, [marcados, registrar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((i) => i.nome.toLowerCase().includes(termo) || i.detalhe.toLowerCase().includes(termo));
  }, [itens, busca]);

  const marcarTodos = useCallback((pMarcar: boolean) => {
    if (pMarcar) {
      const uniao = new Set(marcados);
      for (const i of filtrados) uniao.add(i.id);
      registrar([...uniao]);
    } else {
      const remover = new Set(filtrados.map((i) => i.id));
      registrar([...marcados].filter((id) => !remover.has(id)));
    }
  }, [marcados, filtrados, registrar]);

  const todosMarcados = filtrados.length > 0 && filtrados.every((i) => marcados.has(i.id));
  const bloqueado = isReadOnly;

  return (
    <div className="p-4 space-y-3">
      {erro ? (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-subtle text-ui-sm text-warning-strong">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={perfil.busca}
          className="w-full pl-9 pr-3 min-h-editor text-ui border border-border rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
        />
      </div>

      <div className="flex items-center justify-between text-ui-sm text-brand-text-secondary">
        <span>{`${marcados.size} de ${itens.length} selecionado(s)`}</span>
        {!bloqueado && filtrados.length > 0 ? (
          <button
            type="button"
            onClick={() => marcarTodos(!todosMarcados)}
            className="text-brand-primary hover:underline"
          >
            {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        ) : null}
      </div>

      <div className="border border-border-light rounded-lg divide-y divide-border-light max-h-80 overflow-auto">
        {carregando ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-8 text-center text-ui-sm text-brand-text-muted">{perfil.vazio}</div>
        ) : (
          filtrados.map((item) => {
            const marcado = marcados.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={bloqueado}
                onClick={() => alternar(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-hover
                         transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center
                            ${marcado ? 'bg-brand-primary border-brand-primary' : 'border-border'}`}
                >
                  {marcado ? <Check className="w-3 h-3 text-white" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ui text-brand-text-primary truncate">{item.nome}</span>
                  {item.detalhe ? (
                    <span className="block text-ui-xs text-brand-text-muted truncate">
                      {item.detalhe}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* O que a seleção VAZIA significa. Sem esta linha, "nenhuma marcada" seria lido como
          "nenhuma permitida" — o oposto exato da regra, no caso das empresas. */}
      <div className="flex items-start gap-2 text-ui-xs text-brand-text-muted">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{perfil.nota}</span>
      </div>
    </div>
  );
}
