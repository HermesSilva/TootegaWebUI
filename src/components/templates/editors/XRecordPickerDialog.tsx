/**
 * XRecordPickerDialog — busca GENÉRICA de registro (CE-19).
 *
 * Vários critérios em cima, uma grade de resultados embaixo, e o registro escolhido volta inteiro ao
 * chamador. Não conhece App nenhuma: o endpoint, os critérios e as colunas vêm do MODELO do back
 * (`pickerEndpoint`, `pickerSearchFields`, `pickerColumns`).
 *
 * Por que os critérios são VÁRIOS, e não um campo de pesquisa livre: quem procura um cliente ou tem
 * o documento na mão, ou lembra do nome — e são buscas diferentes (trecho de dígitos × trecho de
 * texto). Num campo único, o back teria de adivinhar o que foi digitado; declarados, cada um viaja
 * em `filters` com o nome que o próprio back deu.
 *
 * **Duas molduras, um corpo.** Chamado de um botão (o "Novo" da grade de itens), ele é um DIÁLOGO:
 * `XModalShell` com `variant="inline"` — contido na área de quem o abriu, nunca cobrindo a página nem
 * as abas (diretiva do dono).
 *
 * Chamado da LUPA de um campo, ele é um POPOVER ancorado ao campo — abaixo dele; sem espaço, acima, à
 * direita ou à esquerda, nessa ordem (dono, 2026-10-23) —, e o cabeçalho é alça de ARRASTO, nas duas
 * molduras. Duas razões para o popover, as duas
 * observadas em tela: como diálogo, ele nascia dentro do `relative` do próprio input — ficava atrás
 * da grade e **cobria o campo que o abriu**, escondendo justamente o que o usuário estava
 * preenchendo. O popover ancora nas coordenadas do campo (por isso `position: fixed` — nenhum
 * ancestral com `overflow` o corta), fica acima de tudo pelo `ZIndexManager` e deixa o campo à
 * vista. Não é overlay: não escurece nada, não cobre a página, e fecha ao clicar fora ou no Esc.
 */

import { useCallback, useState, useEffect, useMemo, useRef, type JSX, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import type { XUIGridColumn, XUIPickerSearchField } from '@core/types';
import { useLookupSearch } from '@core/hooks/useApplication';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { usePosicaoFlutuante } from '@core/hooks/usePosicaoFlutuante';
import { useMolduraDeModal } from '@core/hooks/useMolduraDeModal';
import { XModalShell } from '../XModalShell';
import { formatCurrency, formatDocument, formatNumber } from '@core/lib';

interface XRecordPickerDialogProps {
  /** Endpoint de busca: `POST { searchText, maxResults, filters } → { items: [...] }`. */
  endpoint: string;
  /** Título do diálogo, escrito no back. Vazio ⇒ o título padrão do picker. */
  title?: string;
  /** Critérios de busca. Vazio ⇒ um campo de pesquisa livre (`searchText`). */
  searchFields?: XUIPickerSearchField[];
  /**
   * Texto-guia da pesquisa livre, escrito no back: um campo só, sem rótulo, não diz por onde ele
   * procura, e "CNPJ / CPF ou Nome" é o que impede supor que ali só cabe o número.
   */
  searchPlaceholder?: string;
  /** Colunas da grade. Vazio ⇒ uma coluna com o `text` do contrato de lookup. */
  columns?: XUIGridColumn[];
  /** Chamado com o item escolhido, inteiro — quem chamou decide o que aproveitar dele. */
  onSelect: (pItem: Record<string, unknown>) => void;
  /**
   * LIGA A SELEÇÃO MÚLTIPLA (dono, 2026-09-20): uma coluna de check na frente da grade, a seleção
   * sobrevive à filtragem, e um botão confirma devolvendo TUDO que estiver marcado.
   *
   * É um FLAG, e desligado por padrão: todo picker de hoje escolhe um registro só e continua
   * exatamente como era — a coluna não aparece, o clique escolhe e fecha, e o `onSelect` é o único
   * caminho de saída.
   */
  multiSelect?: boolean;
  /**
   * Filtros FIXOS que viajam em TODA busca (e nas opções dos critérios combinados), somados ao que o
   * usuário digita. Vêm do formulário pelos `pickerContextBindings` do modelo (dono, 2026-10-17): o
   * documento do destinatário já escolhido, a operação. Ausente ou vazio ⇒ nada muda.
   */
  fixedFilters?: Record<string, string>;
  /**
   * Chamado com TODOS os itens marcados, ao confirmar. Só faz sentido com
   * <see cref="multiSelect"/> ligado.
   *
   * Contrato PRÓPRIO, e não um `onSelect` que passa a receber lista: os chamadores de hoje esperam
   * UM item, e mudar a assinatura deles em nome de um modo que não usam é preço que não precisa ser
   * pago.
   */
  onSelectMany?: (pItens: Record<string, unknown>[]) => void;
  /** Fecha sem escolher. */
  onClose: () => void;
  /**
   * O campo que abriu a busca. Presente ⇒ POPOVER ancorado abaixo dele; ausente ⇒ diálogo contido,
   * que é o caso de quem abre por botão (a grade de itens).
   */
  ancora?: React.RefObject<HTMLElement | null>;
}

/** Espera antes de consultar: o usuário digita, não dispara uma busca por tecla. */
const ESPERA_MS = 300;

/** Coluna única de recurso, quando o modelo não declarou nenhuma. */
const COLUNA_PADRAO: XUIGridColumn[] = [{ fieldName: 'text', title: '', editorType: 'text', width: 100 }];

/**
 * O valor de uma célula do resultado.
 *
 * O contrato de lookup tem três posições FIXAS — `group`, `text` e `detail` — e um dicionário
 * `columns` para o que passar disso (`XLookupResultItem.Columns`, no back). Uma coluna declarada
 * procura primeiro no item, e cai no dicionário quando não a encontra lá: é como o
 * `XComboBoxEditor` já lê as colunas dele, e é o que permite ao seletor de produto mostrar unidade e
 * saldo sem que o contrato ganhe uma quarta posição fixa a cada dado novo.
 */
function valorDaCelula(pItem: Record<string, unknown>, pCampo: string): unknown {
  if (pCampo in pItem)
    return pItem[pCampo];

  const extras = pItem.columns as Record<string, unknown> | undefined;
  return extras?.[pCampo];
}

/**
 * Valor da célula conforme o tipo declarado. O dado chega CRU do back (é assim que ele vive) e a
 * máscara é apresentação — mesma regra do resto da plataforma.
 */
function formatarCelula(pValor: unknown, pTipo: string | undefined): string {
  const texto = String(pValor ?? '').trim();
  if (texto === '')
    return '—';

  if (pTipo === 'document')
    return formatDocument(texto);

  // NUMBER e CURRENCY são COISAS DIFERENTES, e aqui caíam no mesmo formatador (corrigido em
  // 2026-09-20). Dinheiro tem duas casas SEMPRE; quantidade tem as que o dado tiver — um saldo de 2
  // unidades saía "2,00", precisão que ninguém contou. É a mesma distinção que a
  // XReadOnlyListEditor já fazia, e usa os MESMOS formatadores dela.
  if (pTipo === 'currency') {
    const numero = Number(texto);
    return Number.isNaN(numero) ? texto : formatCurrency(numero);
  }

  if (pTipo === 'number') {
    const numero = Number(texto);
    return Number.isNaN(numero) ? texto : formatNumber(numero);
  }

  return texto;
}

/** Só os caracteres do documento: a máscara é da tela, o filtro vai cru para o back. */
function soCaracteres(pTexto: string): string {
  return pTexto.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** Largura desejada do popover; encolhe quando a tela não a comporta. */
const LARGURA_POPOVER = 560;

/** Distância mínima entre o painel arrastado e a borda da janela, em pixels. */
const MARGEM = 8;

/**
 * A COLUNA DO CHECK NÃO ROLA NA HORIZONTAL (dono, 2026-09-20). Grade larga rola de lado, e uma
 * caixa de seleção que sai da tela obriga a rolar de volta para marcar cada linha — a marcação
 * pertence à LINHA INTEIRA, não à primeira coluna do dado.
 *
 * O fundo OPACO é parte da mecânica, não enfeite: célula colada com fundo transparente deixa o
 * conteúdo passar por baixo e aparecer através dela.
 */
const COLUNA_CHECK = 'sticky left-0 z-[1] bg-brand-surface border-r border-border';

interface XCriterioCombinadoProps {
  criterio: XUIPickerSearchField;
  valor: string;
  /** Os filtros fixos do formulário — as opções dependem deles (as notas DO destinatário). */
  filtros: Record<string, string>;
  onChange: (pValor: string) => void;
}

/**
 * Critério COMBINADO (dono, 2026-10-17): uma lista de opções carregada do `optionsEndpoint` do
 * critério, com os filtros fixos do formulário. Componente próprio porque cada critério precisa da
 * sua consulta, e um hook não se chama dentro do `map` dos critérios.
 *
 * A opção vazia é sempre a primeira e significa "sem este filtro" — o rótulo vem do back
 * (`placeholder`): "Todas as notas do destinatário" diz o que acontece sem escolha.
 */
function XCriterioCombinado({ criterio, valor, filtros, onChange }: XCriterioCombinadoProps): JSX.Element {
  const { data, isLoading } = useLookupSearch({
    endpoint: criterio.optionsEndpoint ?? '',
    searchText: '',
    filters: Object.keys(filtros).length > 0 ? filtros : undefined,
    minLength: 0,
  });
  const opcoes = data?.items ?? [];

  return (
    <select
      value={valor}
      onChange={(pEvento) => onChange(pEvento.target.value)}
      data-testid={`picker-criterio-${criterio.fieldName}`}
      className="w-full h-editor px-2 rounded-md border border-border bg-brand-surface text-ui text-brand-text-primary focus:outline-none focus:border-brand-primary"
    >
      <option value="">{isLoading ? 'Buscando...' : (criterio.placeholder ?? '')}</option>
      {opcoes.map((pOpcao) => (
        <option key={String(pOpcao.value ?? '')} value={String(pOpcao.value ?? '')}>
          {String(pOpcao.text ?? '')}
        </option>
      ))}
    </select>
  );
}

export function XRecordPickerDialog({
  endpoint, title, searchFields, searchPlaceholder, columns, onSelect, onSelectMany, onClose, ancora,
  multiSelect = false, fixedFilters,
}: XRecordPickerDialogProps): JSX.Element {

  const criterios = useMemo(() => searchFields ?? [], [searchFields]);
  const colunas = columns && columns.length > 0 ? columns : COLUNA_PADRAO;

  /**
   * OS ITENS MARCADOS, guardados INTEIROS e por chave — não só os identificadores.
   *
   * A seleção TEM de sobreviver à filtragem (dono, 2026-09-20): marca-se um produto, digita-se
   * outro termo, marca-se mais um, e ao confirmar os dois voltam. Guardar só o id não bastaria — o
   * item que saiu do resultado não está mais em `itens`, e não haveria de onde tirar o dado dele.
   *
   * Um `Map` (e não um array) porque a pergunta que a grade faz a cada linha é "este está marcado?",
   * e ela a faz uma vez por linha desenhada.
   */
  const [marcados, setMarcados] = useState<Map<string, Record<string, unknown>>>(new Map());

  /** O que está digitado, por critério (ou em `''` quando a busca é de campo único). */
  const [valores, setValores] = useState<Record<string, string>>({});
  const [comEspera, setComEspera] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => setComEspera(valores), ESPERA_MS);
    return () => clearTimeout(timer);
  }, [valores]);

  // Critério vazio não vira filtro: mandar `{ documento: '' }` faria o back filtrar por "contém
  // vazio", que casa com tudo — e o filtro do outro campo se perderia no meio do cadastro inteiro.
  //
  // Os filtros FIXOS do formulário entram ANTES dos critérios: o que o usuário digita no diálogo
  // nunca é sobreposto pelo contexto, mas o contexto viaja sempre — inclusive na busca de campo
  // único, que antes não mandava `filters` nenhum.
  const fixos = useMemo((): Record<string, string> => {
    const saida: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(fixedFilters ?? {}))
      if ((valor ?? '').trim().length > 0)
        saida[chave] = valor.trim();
    return saida;
  }, [fixedFilters]);

  const filtros = useMemo(() => {
    const saida: Record<string, string> = { ...fixos };
    for (const criterio of criterios) {
      const valor = (comEspera[criterio.fieldName] ?? '').trim();
      if (valor.length > 0)
        saida[criterio.fieldName] = valor;
    }
    return saida;
  }, [criterios, comEspera, fixos]);

  const { data, isLoading } = useLookupSearch({
    endpoint,
    // Busca de campo único usa `searchText`; a de vários critérios manda tudo em `filters`.
    searchText: criterios.length > 0 ? '' : (comEspera[''] ?? ''),
    filters: Object.keys(filtros).length > 0 ? filtros : undefined,
    // Zero de propósito: o diálogo ABRE listando, em vez de exigir três letras para mostrar algo.
    minLength: 0,
  });

  const itens = data?.items ?? [];

  // --- Seleção múltipla ------------------------------------------------------------------------

  /**
   * A chave do item. O `value` do contrato de lookup é o identificador de verdade
   * (<c>XLookupResultItem.Value</c>); o índice NÃO serve, porque muda a cada filtragem — e é
   * justamente atravessar a filtragem que esta seleção promete.
   */
  const chaveDoItem = useCallback((pItem: Record<string, unknown>): string =>
    String(pItem.value ?? pItem[colunas[0].fieldName] ?? ''), [colunas]);

  const alternar = useCallback((pItem: Record<string, unknown>) => {
    const chave = chaveDoItem(pItem);
    setMarcados((pAtual) => {
      const novo = new Map(pAtual);
      if (novo.has(chave))
        novo.delete(chave);
      else
        novo.set(chave, pItem);
      return novo;
    });
  }, [chaveDoItem]);

  const confirmar = useCallback(() => {
    onSelectMany?.([...marcados.values()]);
    onClose();
  }, [marcados, onSelectMany, onClose]);

  // --- Popover: posição, fechamento por Esc e por clique fora ---------------------------------

  const ehPopover = !!ancora;
  const painelRef = useRef<HTMLDivElement>(null);
  // Moldura comum a todo diálogo (dono, 2026-10-25): borda, brilho e redimensionar pelas bordas. O painel
  // é posto por top/left (ancorado), não centrado; o arrasto continua o dele, pelo cabeçalho.
  const moldura = useMolduraDeModal({ ref: painelRef, posicionamento: 'ancorado', larguraMinima: 240, alturaMinima: 140 });
  const campoRef = useMemo(() => ancora ?? { current: null }, [ancora]);
  const [zIndex] = useState(() => ZIndexManager.next());

  /**
   * ARRASTADO pelo usuário (dono, 2026-10-23): o painel pode tapar justamente o que se quer ver ao
   * lado do campo, e quem decide onde ele fica passa a ser o usuário. Depois de arrastado, ele para
   * de acompanhar o campo — senão a próxima rolagem o devolveria ao lugar de onde foi tirado.
   */
  const [arrastado, setArrastado] = useState<{ top: number; left: number } | null>(null);
  const arrasto = useRef<{ x: number; y: number; top: number; left: number; largura: number; altura: number } | null>(null);

  // ONDE abre (dono, 2026-10-23): abaixo do campo; não coube ⇒ acima, direita, esquerda. A regra é a
  // mesma das listas de lookup (usePosicaoFlutuante), medida sobre o painel real.
  //
  // NA LARGURA DO CAMPO, alinhado à esquerda dele (dono, 2026-10-17): o painel é a continuação do
  // campo que o abriu, e um campo largo (a operação, com CFOP e natureza nas colunas) ganha um painel
  // largo. A largura padrão vale só como PISO, para campo estreito (um documento) não espremer as
  // colunas; a janela é o teto.
  const larguraDoPainel = useCallback(
    (pCampo: DOMRect): number => Math.min(Math.max(pCampo.width, LARGURA_POPOVER), window.innerWidth - 16), []);
  const { posicao } = usePosicaoFlutuante(ehPopover, campoRef, painelRef, {
    largura: larguraDoPainel,
    desligado: arrastado !== null,
  });

  const iniciarArrasto = useCallback((pEvento: ReactPointerEvent<HTMLDivElement>) => {
    const painel = painelRef.current;
    // O botão de fechar não arrasta: capturar o ponteiro ali engoliria o clique.
    if (!painel || pEvento.button !== 0 || (pEvento.target as HTMLElement).closest('button'))
      return;

    const r = painel.getBoundingClientRect();
    arrasto.current = { x: pEvento.clientX, y: pEvento.clientY, top: r.top, left: r.left, largura: r.width, altura: r.height };
    pEvento.currentTarget.setPointerCapture(pEvento.pointerId);
    pEvento.preventDefault();
  }, []);

  const arrastar = useCallback((pEvento: ReactPointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a)
      return;

    // Não sai da janela: um painel arrastado para fora não teria mais por onde ser pego de volta.
    const limitar = (pValor: number, pMaximo: number): number => Math.max(MARGEM, Math.min(pValor, pMaximo));
    setArrastado({
      left: limitar(a.left + pEvento.clientX - a.x, window.innerWidth - a.largura - MARGEM),
      top: limitar(a.top + pEvento.clientY - a.y, window.innerHeight - a.altura - MARGEM),
    });
  }, []);

  const terminarArrasto = useCallback((pEvento: ReactPointerEvent<HTMLDivElement>) => {
    arrasto.current = null;
    if (pEvento.currentTarget.hasPointerCapture(pEvento.pointerId))
      pEvento.currentTarget.releasePointerCapture(pEvento.pointerId);
  }, []);

  useEffect(() => {
    if (!ehPopover)
      return;

    const aoTeclar = (pEvento: KeyboardEvent): void => {
      if (pEvento.key === 'Escape')
        onClose();
    };

    // Clique fora fecha — mas NÃO quando é no próprio campo/lupa: ali o clique já é o de fechar, e
    // fechar duas vezes reabriria o painel no mesmo gesto.
    const aoClicar = (pEvento: MouseEvent): void => {
      const alvo = pEvento.target as Node;
      if (painelRef.current?.contains(alvo) || ancora?.current?.contains(alvo))
        return;

      onClose();
    };

    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('mousedown', aoClicar);

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoClicar);
    };
  }, [ehPopover, ancora, onClose]);

  const aoDigitar = (pCampo: string, pValor: string, pTipo?: string): void => {
    setValores((pAtual) => ({
      ...pAtual,
      [pCampo]: pTipo === 'document' ? soCaracteres(pValor) : pValor,
    }));
  };

  // O botão de confirmar, UM SÓ para os dois ramos da busca (pesquisa livre e critérios declarados):
  // duplicá-lo seria deixar dois lugares para divergir na próxima mexida.
  const botaoConfirmar = multiSelect ? (
    <button
      type="button"
      onClick={confirmar}
      disabled={marcados.size === 0}
      data-testid="picker-confirmar"
      className="h-editor px-4 rounded-md bg-brand-primary text-white text-ui font-medium whitespace-nowrap
                 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {/* A CONTA no rótulo: é o único lugar onde a seleção acumulada por várias filtragens fica
          visível — marcou três, filtrou, e os três continuam lá. */}
      {marcados.size > 0 ? `Confirmar (${marcados.size})` : 'Confirmar'}
    </button>
  ) : null;

  const corpo = (
      <div className={ehPopover ? 'p-3 space-y-3' : 'p-4 space-y-3 sm:min-w-[38rem]'}>
        {/* Critérios: um campo por critério declarado, lado a lado; sem nenhum, a pesquisa livre. */}
        {criterios.length > 0 ? (
          <div className="flex items-end gap-2">
          <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: `repeat(${criterios.length}, minmax(0, 1fr))` }}>
            {criterios.map((pCriterio, pIndice) => (
              <label key={pCriterio.fieldName} className="block">
                <span className="block mb-1 text-ui-xs font-medium text-brand-text-secondary">
                  {(pCriterio.title ?? '')}
                </span>
                {pCriterio.editorType === 'combo' && pCriterio.optionsEndpoint ? (
                  <XCriterioCombinado
                    criterio={pCriterio}
                    valor={valores[pCriterio.fieldName] ?? ''}
                    filtros={fixos}
                    onChange={(pValor) => aoDigitar(pCriterio.fieldName, pValor)}
                  />
                ) : (
                <input
                  autoFocus={pIndice === 0}
                  value={valores[pCriterio.fieldName] ?? ''}
                  placeholder={pCriterio.placeholder}
                  onChange={(pEvento) => aoDigitar(pCriterio.fieldName, pEvento.target.value, pCriterio.editorType)}
                  className="w-full h-editor px-3 rounded-md border border-border bg-brand-surface text-ui text-brand-text-primary focus:outline-none focus:border-brand-primary"
                />
                )}
              </label>
            ))}
          </div>
          {botaoConfirmar}
          </div>
        ) : (
          // O botão de confirmar fica NA MESMA LINHA da busca (dono, 2026-09-20) — não num rodapé:
          // o diálogo é busca + grade, e a ação que o encerra fica onde o olho já está.
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
              <input
                autoFocus
                value={valores[''] ?? ''}
                onChange={(pEvento) => aoDigitar('', pEvento.target.value)}
                placeholder={searchPlaceholder && searchPlaceholder.trim() !== '' ? searchPlaceholder : 'Pesquisar...'}
                className="w-full h-editor pl-9 pr-3 rounded-md border border-border bg-brand-surface text-ui text-brand-text-primary focus:outline-none focus:border-brand-primary"
              />
            </div>
            {botaoConfirmar}
          </div>
        )}

        {/* border-separate (não collapse): é o que faz o cabeçalho fixo funcionar sem sobrepor a
            primeira linha. O fundo do cabeçalho é SÓLIDO, senão as linhas apareceriam através dele. */}
        <div className={`overflow-auto rounded-lg border border-border ${ehPopover ? 'max-h-[260px] min-h-[120px]' : 'max-h-[420px] min-h-[240px]'}`}>
          <table className="w-full border-separate border-spacing-0 text-ui">
            <thead>
              <tr>
                {multiSelect && (
                  // z-20: o cabeçalho já é sticky-top e a coluna é sticky-left — o CANTO precisa ficar
                  // acima das duas faixas, senão some sob uma delas ao rolar nos dois eixos.
                  <th className="sticky top-0 left-0 z-20 bg-brand-surface border-b border-r border-border px-3 py-2 w-10" />
                )}
                {colunas.map((pColuna) => (
                  <th
                    key={pColuna.fieldName}
                    style={pColuna.width ? { width: `${pColuna.width}%` } : undefined}
                    className={`sticky top-0 z-10 bg-brand-surface border-b border-border px-3 py-2 font-medium text-brand-text-secondary whitespace-nowrap ${
                      pColuna.editorType === 'currency' || pColuna.editorType === 'number' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {(pColuna.title ?? '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={colunas.length + (multiSelect ? 1 : 0)} className="px-3 py-4 text-center text-brand-text-muted">
                    {'Buscando...'}
                  </td>
                </tr>
              )}
              {!isLoading && itens.length === 0 && (
                <tr>
                  <td colSpan={colunas.length + (multiSelect ? 1 : 0)} className="px-3 py-4 text-center text-brand-text-muted">
                    {'Nenhum item encontrado'}
                  </td>
                </tr>
              )}
              {itens.map((pItem, pIndice) => {
                // Item DESABILITADO (ex.: produto sem preço vigente): fica esmaecido e não é selecionável
                // — o back o marca com isDisabled, e a seleção é ignorada aqui (o clique não escolhe nada).
                const desabilitado = pItem.isDisabled === true;
                const chave = chaveDoItem(pItem);
                const marcado = marcados.has(chave);
                return (
                <tr
                  key={String(pItem[colunas[0].fieldName] ?? pItem.value ?? pIndice)}
                  // MODO MÚLTIPLO: o clique na linha ALTERNA a marcação — a linha inteira vira área de
                  // clique do check, alvo maior e menos precisão exigida. O diálogo só fecha pelo botão
                  // Confirmar (ou pelo duplo-clique abaixo).
                  onClick={desabilitado ? undefined : () => (multiSelect ? alternar(pItem) : onSelect(pItem))}
                  // DUPLO-CLIQUE escolhe DIRETO, e NÃO mexe na seleção (dono, 2026-09-20). O navegador
                  // dispara os dois `click` do gesto antes do `dblclick`, então eles já alternaram a
                  // linha duas vezes — o que a devolve ao estado inicial, e é por isso que o atalho
                  // sai limpo: não é preciso desfazer nada.
                  onDoubleClick={desabilitado || !multiSelect ? undefined : () => { onSelect(pItem); onClose(); }}
                  // Pelo ÍNDICE, como a grade da App (`grid-row-<i>`), mas com prefixo PRÓPRIO: este
                  // diálogo sobrepõe a grade de quem o abriu, e um testid comum faria o teste casar
                  // com as duas listas ao mesmo tempo.
                  data-testid={`picker-row-${pIndice}`}
                  aria-disabled={desabilitado}
                  className={desabilitado
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-hover'}
                >
                  {multiSelect && (
                    <td className={`border-b border-border-light px-3 py-2 text-center ${COLUNA_CHECK}`}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={desabilitado}
                        // A linha inteira já alterna; aqui só se impede o clique de subir e alternar
                        // DUAS vezes (a do check e a da linha), que se anulariam.
                        onClick={(pEvento) => pEvento.stopPropagation()}
                        onChange={() => alternar(pItem)}
                        aria-label={`Selecionar ${String(valorDaCelula(pItem, colunas[0].fieldName) ?? '')}`}
                        data-testid={`picker-check-${pIndice}`}
                        className="h-4 w-4 accent-brand-primary cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  )}
                  {colunas.map((pColuna) => (
                    <td
                      key={pColuna.fieldName}
                      className={`border-b border-border-light px-3 py-2 text-brand-text-primary ${
                        pColuna.editorType === 'currency' || pColuna.editorType === 'number'
                          ? 'text-right whitespace-nowrap tabular-nums'
                          : ''
                      }`}
                    >
                      {formatarCelula(valorDaCelula(pItem, pColuna.fieldName), pColuna.editorType)}
                    </td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
  );

  // POPOVER: ancorado ao campo, abaixo dele. Sem véu e sem cobrir o input — quem está preenchendo
  // continua vendo o que preencheu.
  if (ehPopover) {
    // O painel vai por PORTAL para o `body`. Não é para cobrir nada — é para que a ancoragem não
    // dependa da árvore: um ancestral com `transform` (um modal animado, por exemplo) passa a ser o
    // bloco de contenção de tudo que é `fixed`, e o painel apareceria deslocado do campo, sem que
    // nada no código deste componente tivesse mudado.
    // Arrastado ⇒ onde o usuário largou; senão, o lado que o posicionamento escolheu. Antes da
    // primeira medida o painel fica invisível, para não piscar fora do lugar.
    const estilo: React.CSSProperties = arrastado
      ? { top: arrastado.top, left: arrastado.left, width: posicao.largura, maxHeight: posicao.maxHeight, zIndex }
      : {
          top: posicao.top, bottom: posicao.bottom, left: posicao.left, width: posicao.largura,
          maxHeight: posicao.maxHeight, zIndex, opacity: posicao.medido ? undefined : 0,
        };

    return createPortal(
      <div
        ref={painelRef}
        role="dialog"
        aria-label={title ? (title ?? '') : 'Selecionar item'}
        data-lado={arrastado ? 'arrastado' : posicao.lado}
        style={estilo}
        // A rolagem é do CORPO, não do cartão: num cartão que rola, as alças de redimensionar (absolutas)
        // rolariam junto com o conteúdo e sumiriam da borda — e o cabeçalho, que é a alça de arrasto, também.
        className="x-moldura-modal fixed flex flex-col overflow-hidden rounded-lg bg-brand-surface animate-in fade-in zoom-in-95 duration-150 transition-none will-change-transform"
      >
        {moldura.alcasDeRedimensionar}
        {/* O cabeçalho é a ALÇA de arrasto (dono, 2026-10-23). */}
        <div
          data-testid="picker-alca"
          onPointerDown={iniciarArrasto}
          onPointerMove={arrastar}
          onPointerUp={terminarArrasto}
          onPointerCancel={terminarArrasto}
          className="shrink-0 flex items-center justify-between px-3 pt-3 cursor-move select-none touch-none"
        >
          <span className="text-ui font-medium text-brand-text-primary truncate">
            {title ? (title ?? '') : 'Selecionar item'}
          </span>
          <button
            type="button"
            onClick={onClose}
            title={'Cancelar'}
            aria-label={'Cancelar'}
            className="p-1 rounded-md text-brand-text-muted hover:text-brand-text-primary hover:bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">{corpo}</div>
      </div>,
      document.body
    );
  }

  return (
    <XModalShell
      title={title ? (title ?? '') : 'Selecionar item'}
      closeLabel={'Cancelar'}
      onClose={onClose}
      size="lg"
      variant="inline"
      draggable
    >
      {corpo}
    </XModalShell>
  );
}
