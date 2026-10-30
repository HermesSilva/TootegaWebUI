/**
 * XItemsGridEditor — generic items grid for a form field whose value is a LIST of row objects (the
 * items of an invoice, the addresses of a person, the partners of a company). Framework-level (Core),
 * named by capability, never by any application (CE-19): the columns come entirely from the field
 * model (XUIEditorModel.gridColumns), so any App reuses it by declaring the columns in the back-end.
 *
 * The value is an array of plain objects; each column edits one property (by fieldName). The editor
 * stores the array back via onChange, and prepareDataForSave carries it into the POST payload under
 * the field name — no per-App front code.
 *
 * Cell types: `text`, `number`, `date`, `checkbox` and `combo` (options declared in the model).
 * SOMENTE-LEITURA (editor.isReadOnly): sem acrescentar, sem remover, células travadas — é como se
 * mostra dado que vem de fora (as atividades econômicas e os sócios, que a Receita entrega).
 *
 * Opt in per field via XUIEditorModel.customEditorName = "XItemsGridEditor".
 */

import { useContext, useMemo, useRef, useState, type JSX } from 'react';
import { FormValuesContext } from '@core/contexts/FormValuesContext';
import { Plus, Trash2, Loader2, AlertCircle, HandCoins, Play, Search, X, type LucideIcon } from 'lucide-react';
import type { XEditorProps } from './XEditor';
import { XEditorLabel } from './XEditorLabel';
import { XItemPickerDialog } from './XItemPickerDialog';
import { XRecordPickerDialog } from './XRecordPickerDialog';
import { CLASSE_TEXTO_OCULTO, FORMATO_DATA, XPlaceholderDeData } from './XPlaceholderDeData';
import { XCurrencyCell } from './XCurrencyCell';
import { useCepLookup } from '@core/hooks/useCepLookup';
import type { XUIGridColumn } from '@core/types';
import { formatCEP, formatCNAE, formatDocument, formatPhone, getFieldValue } from '@core/lib';
import { acoesVisiveisNaLinha, acaoDesabilitadaNaLinha, isTruthy } from '@core/lib/visibility';
import {
  descontoDoPrecoDoItem, mensagemDoPrecoDoItem, precoDoItemAtivo, precoDoItemExibido, precoDoItemInformado,
  precoDoItemValido,
} from '@core/lib/precoDoItem';
import { XBUTTON_PALETTE } from '@core/lib/xButtonPalette';
import { XButtonColor } from '@core/types';

// Ícones das ações de linha da grade embutida. Mapa pequeno (as ações declaram `icon` por nome, como
// o XButtonBar) — hoje só "Baixar" (hand-coins); o fallback é um "play" neutro.
const ICON_ACAO: Record<string, LucideIcon> = { 'hand-coins': HandCoins };

type Row = Record<string, unknown>;

// Célula EDITÁVEL: campo de verdade, com moldura — a borda é o convite a digitar.
const cellClass =
  'w-full h-editor px-2 text-ui rounded-md border border-border bg-brand-surface ' +
  'text-brand-text-primary focus:outline-none focus:border-brand-primary';

// Célula SÓ-LEITURA: TEXTO, sem moldura (dono, 2026-09-13). Mantém-se a distinção por COR que o dono
// pediu em 2026-07-14 (tom secundário) — o que sai é a BORDA e o FUNDO de input, não a cor.
//
// Por que mudou: uma grade cujas colunas são todas travadas — a aba "Empresas" do Perfil de Acesso, as
// parcelas de Contas a Receber, as atividades da Receita — desenhava uma caixinha de input por célula,
// e o resultado lia como um formulário empilhado, não como uma grade. A moldura promete edição que não
// existe: ela convida a clicar num campo que não aceita digitação. Célula que só exibe é texto.
//
// `h-editor` permanece para a linha travada ter a MESMA altura da editável — grade mista (Pedido:
// produto travado, quantidade editável) não pode ter fileiras de alturas diferentes.
const cellReadOnly =
  'w-full h-editor px-2 text-ui flex items-center ' +
  'text-brand-text-secondary truncate';
const cellClassOf = (pTravada: boolean): string => (pTravada ? cellReadOnly : cellClass);

/** Tipos numéricos que a grade edita como moeda/decimal (mesmo comportamento do XCurrencyEditor). */
const NUMERICOS_MOEDA = ['currency', 'number'];

/**
 * A COLUNA DE BOTÕES NÃO ROLA NA HORIZONTAL (dono, 2026-09-20).
 *
 * Grade larga (a de itens do Pedido é a maior) rola de lado, e as colunas de ação — o "Novo" no
 * cabeçalho, a lixeira e as ações de linha — iam embora junto com o conteúdo: para remover uma
 * linha era preciso primeiro rolar até o fim. A ação pertence à LINHA INTEIRA, não à última
 * coluna do dado, então ela fica colada na direita enquanto o dado desliza por baixo.
 *
 * Regra do TEMPLATE, não da App (CE-19): vale para toda grade embutida, a de hoje e a que ainda não
 * existe — nenhuma App declara isto.
 *
 * O fundo OPACO é parte da mecânica, não enfeite: célula colada com fundo transparente deixa o
 * conteúdo que passa por baixo aparecer através dela. Por isso o corpo leva `brand-surface` (a cor
 * da grade) e o cabeçalho, `muted-bg` (a dele). A borda à esquerda marca onde o dado termina.
 */
const COLUNA_FIXA_CORPO = 'sticky right-0 z-[1] bg-brand-surface border-l border-border';

/** O mesmo, no cabeçalho: ele já é `sticky top-0`, e o canto precisa ficar ACIMA das duas faixas. */
const COLUNA_FIXA_CABECALHO = 'sticky right-0 z-[2] border-l border-border';

/**
 * LARGURA DAS COLUNAS: proporção declarada, NÃO percentual absoluto (dono, 2026-09-13).
 *
 * O `Width` do modelo diz o peso RELATIVO de cada coluna; aqui ele é normalizado para ocupar 100% do
 * espaço disponível. Declarar `18, 8, 6` ou `60, 27, 20` dá o mesmo resultado — o que importa é a
 * razão entre elas.
 *
 * Por que virou regra do TEMPLATE e não de cada App: o `width` ia cru para o `<th style>`, então a
 * grade só ficava proporcional se quem declarou tivesse somado ~100 de cabeça. Não havia nada que o
 * cobrasse — a regra vivia num COMENTÁRIO dentro de uma App do FIN. O resultado era o esperado: o
 * Pedido somava 100 e ficava certo; a aba "Empresas" do Perfil de Acesso somou 18+8+6 = 32 e as
 * colunas se espremeram num canto, com o resto da tabela vazio e o cabeçalho cortando o CNPJ.
 * Normalizando aqui, qualquer App — as de hoje e as que ainda não existem — fica proporcional sem
 * depender da aritmética de quem declarou.
 *
 * Coluna sem `width` (ou <= 0) recebe peso 1, para não sumir. Nenhuma largura declarada ⇒ devolve
 * `undefined` e o `<table>` distribui sozinho, que é o comportamento nativo correto.
 */
function larguraNormalizada(pColunas: XUIGridColumn[]): (pColuna: XUIGridColumn) => string | undefined {
  const peso = (pC: XUIGridColumn): number => (typeof pC.width === 'number' && pC.width > 0 ? pC.width : 0);
  const total = pColunas.reduce((pAcc, pC) => pAcc + peso(pC), 0);

  if (total <= 0) return () => undefined;

  // Colunas sem peso entram com 1 para continuarem visíveis; o total cresce junto, senão a soma
  // passaria de 100% e a última coluna vazaria da tabela.
  const semPeso = pColunas.filter((pC) => peso(pC) === 0).length;
  const divisor = total + semPeso;

  return (pColuna) => `${((peso(pColuna) || 1) / divisor) * 100}%`;
}

function toRows(pValue: unknown): Row[] {
  if (Array.isArray(pValue)) return pValue as Row[];
  if (typeof pValue === 'string' && pValue.trim()) {
    try {
      const arr = JSON.parse(pValue);
      if (Array.isArray(arr)) return arr as Row[];
    } catch {
      /* not JSON — treat as empty */
    }
  }
  return [];
}

function novaLinha(pColunas: XUIGridColumn[]): Row {
  const row: Row = {};
  for (const c of pColunas) {
    if (c.editorType === 'number' || c.editorType === 'integer' || c.editorType === 'currency') row[c.fieldName] = 0;
    else if (c.editorType === 'checkbox') row[c.fieldName] = false;
    else if (c.editorType === 'combo') row[c.fieldName] = c.options?.[0]?.value ?? '';
    else row[c.fieldName] = '';
  }
  return row;
}

/** Data ISO (o back serializa DateTime como ISO) → `yyyy-MM-dd`, que é o que o input date aceita. */
function paraDataInput(pValor: unknown): string {
  const texto = String(pValor ?? '');
  if (!texto || texto.startsWith('0001-01-01')) return '';
  return texto.slice(0, 10);
}

/** Tipos de célula cujo dado é guardado CRU e apenas EXIBIDO com máscara. */
// `plate` (2026-10-11): placa de veículo — guarda 7 posições cruas em maiúsculas e exibe com hífen
// depois das três letras (AAA-9999 no padrão antigo, AAA-9A99 na Mercosul), a máscara única de digitação.
const MASCARADOS = ['document', 'phone', 'cep', 'cnae', 'plate'];

function formatarPlaca(pCrua: string): string {
  return pCrua.length > 3 ? `${pCrua.slice(0, 3)}-${pCrua.slice(3)}` : pCrua;
}

// A placa VALIDA O TIPO DE CARACTERE POR POSIÇÃO enquanto se digita (dono, 2026-10-11): letra nas três
// primeiras, dígito na quarta, letra OU dígito na quinta (é o que distingue a Mercosul), dígito nas duas
// últimas. O que não cabe na posição é descartado na hora — "5645645" não entra; o sistema não deixa o
// usuário errar e depois reclamar. Cobre os dois padrões: AAA9999 (antigo) e AAA9A99 (Mercosul).
const LETRA = /[A-Z]/;
const DIGITO = /[0-9]/;
const CLASSE_POR_POSICAO: RegExp[] = [LETRA, LETRA, LETRA, DIGITO, /[A-Z0-9]/, DIGITO, DIGITO];

function limparPlaca(pTexto: string): string {
  let placa = '';
  for (const c of pTexto.toUpperCase()) {
    if (placa.length === 7) break;
    if (CLASSE_POR_POSICAO[placa.length].test(c))
      placa += c;
  }
  return placa;
}

/**
 * Máscara de exibição da célula. O documento do sócio chega mascarado da própria Receita
 * (`***844381**`) — sem dígitos suficientes, o formatador o devolve intacto, que é o certo.
 *
 * `phone` é tolerante de propósito: a coluna "Valor" de contato guarda telefone OU endereço
 * eletrônico, conforme o tipo da linha. Só se mascara o que é telefone (só dígitos); um e-mail
 * atravessa sem ser tocado.
 */
/**
 * Ao digitar, a máscara é retirada e guarda-se o dado cru. Cada tipo tem o seu alfabeto: CEP, CNAE e
 * telefone são dígitos; documento aceita alfanumérico (o CNPJ de 2026 tem letras) e o asterisco do
 * documento mascarado do sócio. A célula `phone` que contenha letra ou arroba é endereço eletrônico
 * — passa inteira.
 */
function limpar(pTipo: string, pTexto: string): string {
  if (pTipo === 'phone' && /[A-Za-z@]/.test(pTexto))
    return pTexto;

  if (pTipo === 'document')
    return pTexto.replace(/[^0-9A-Za-z*]/g, '').toUpperCase();

  if (pTipo === 'plate')
    return limparPlaca(pTexto);

  return pTexto.replace(/\D/g, '');
}

function mascarar(pTipo: string, pValor: unknown): string {
  const texto = String(pValor ?? '');
  if (!texto) return '';

  switch (pTipo) {
    case 'document':
      return formatDocument(texto);
    case 'cep':
      return formatCEP(texto);
    case 'cnae':
      return formatCNAE(texto);
    case 'phone':
      return /^\d+$/.test(texto) ? formatPhone(texto) : texto;
    case 'plate':
      return formatarPlaca(texto);
    default:
      return texto;
  }
}

/**
 * Célula de CEP COM busca (a coluna declara `lookupEndpoint`): além de mascarar, consulta o endereço
 * ao completar os oito dígitos e preenche as COLUNAS-IRMÃS da mesma linha (`fieldBindings`). Enquanto
 * a consulta roda, um spinner aparece na célula e o formulário inteiro fica ocupado (véu — via
 * useCepLookup). Reusa exatamente o mesmo hook do campo de formulário (XCEPEditor).
 */
function XCepCell({
  pColuna, pValor, pTravada, pClasse, pOnCru, pOnPreencher,
}: {
  pColuna: XUIGridColumn;
  pValor: unknown;
  pTravada: boolean;
  pClasse: string;
  pOnCru: (pDigitos: string) => void;
  pOnPreencher: (pPatch: Record<string, unknown>) => void;
}): JSX.Element {
  const { buscando, naoEncontrado, consultar, limpar } = useCepLookup(pColuna.lookupEndpoint);

  const disparar = (pDigitos: string): void => {
    if (pDigitos.length !== 8)
      return;
    void consultar(pDigitos, (pResposta) => {
      const patch: Record<string, unknown> = {};
      for (const b of pColuna.fieldBindings ?? []) {
        // Leitura TOLERANTE A CAIXA da resposta: a chave chega camelCase do back e o sourceField do
        // modelo pode não bater a caixa exata (SYSxCidadeID vira "sYSxCidadeID" na serialização). Sem
        // isto, a FK da cidade não era copiada e o endereço salvava sem cidade.
        const v = getFieldValue(pResposta, b.sourceField);
        if (v != null && v !== '')
          patch[b.targetField] = v;
      }
      if (Object.keys(patch).length > 0)
        pOnPreencher(patch);
    });
  };

  const soDigitos = (pTexto: string): string => pTexto.replace(/\D/g, '').slice(0, 8);

  return (
    <div className="relative">
      <input
        type="text"
        value={formatCEP(String(pValor ?? ''))}
        disabled={pTravada}
        onChange={(e) => {
          const d = soDigitos(e.target.value);
          limpar();
          pOnCru(d);
          if (d.length === 8)
            disparar(d);
        }}
        onBlur={(e) => disparar(soDigitos(e.target.value))}
        title={naoEncontrado ? 'CEP não encontrado — preencha o endereço manualmente.' : undefined}
        className={`${pClasse} pr-7 ${naoEncontrado ? 'border-warning' : ''}`}
      />
      {buscando ? (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted animate-spin" />
      ) : naoEncontrado ? (
        <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warning" />
      ) : null}
    </div>
  );
}

/**
 * Célula com LUPA para escolher um registro do catálogo — hoje a cidade do endereço, quando o CEP não
 * a resolve. Mostra o valor (o nome já exibido pela coluna) e um botão de busca que abre o
 * XRecordPickerDialog no endpoint da coluna (pickerEndpoint). Ao selecionar, aplica os fieldBindings da
 * coluna copiando value/columns do item para os campos da linha (SYSxCidadeID, Cidade, UF, IBGE) — a
 * FK é sempre gravada, nunca texto solto. Contida na área do App (o diálogo é inline, §1 da skill front).
 */
function XCidadePickerCell({
  pColuna, pValor, pTravada, pClasse, pOnPreencher,
}: {
  pColuna: XUIGridColumn;
  pValor: unknown;
  pTravada: boolean;
  pClasse: string;
  pOnPreencher: (pPatch: Record<string, unknown>) => void;
}): JSX.Element {
  const [aberto, setAberto] = useState(false);

  const aoSelecionar = (pItem: Record<string, unknown>): void => {
    const patch: Record<string, unknown> = {};
    for (const b of pColuna.fieldBindings ?? []) {
      // O item traz `value`/`text` no topo e o resto em `columns`; a leitura é tolerante a caixa.
      const extras = (pItem.columns as Record<string, unknown> | undefined) ?? {};
      const v = getFieldValue(pItem, b.sourceField) ?? getFieldValue(extras, b.sourceField);
      if (v != null && v !== '')
        patch[b.targetField] = v;
    }
    if (Object.keys(patch).length > 0)
      pOnPreencher(patch);
    setAberto(false);
  };

  // LIMPAR (2026-10-11): a lupa genérica também desfaz a escolha — todo alvo dos vínculos volta a nulo,
  // e o back lê "sem registro" (no elemento veicular: proprietário = a própria empresa). Só aparece com
  // valor e com a célula destravada.
  const temValor = pValor !== null && pValor !== undefined && String(pValor) !== '';
  const limparEscolha = (): void => {
    const patch: Record<string, unknown> = {};
    for (const b of pColuna.fieldBindings ?? [])
      patch[b.targetField] = null;
    if (Object.keys(patch).length > 0)
      pOnPreencher(patch);
  };
  // O botão da cidade manteve o título histórico; a lupa genérica leva o título que o back declarou.
  const tituloDaBusca = pColuna.editorType === 'citypicker' ? 'Procurar cidade' : (pColuna.pickerTitle || 'Procurar');

  return (
    <div className="relative">
      <input type="text" value={String(pValor ?? '')} readOnly disabled={pTravada} className={`${pClasse} ${temValor && !pTravada ? 'pr-12' : 'pr-7'}`} />
      {!pTravada && temValor && (
        <button
          type="button"
          onClick={limparEscolha}
          title="Limpar"
          aria-label="Limpar"
          className="absolute right-6 top-1/2 -translate-y-1/2 p-0.5 text-brand-text-muted hover:text-brand-text"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {!pTravada && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          title={tituloDaBusca}
          aria-label={tituloDaBusca}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-brand-text-muted hover:text-brand-text"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      )}
      {aberto && (
        <XRecordPickerDialog
          endpoint={pColuna.pickerEndpoint ?? ''}
          title={pColuna.pickerTitle || 'Selecionar'}
          columns={pColuna.pickerColumns}
          onSelect={aoSelecionar}
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  );
}

export function XItemsGridEditor({ editor, value, onChange, disabled, onGridRowAction, error }: XEditorProps): JSX.Element {
  // Os valores do FORMULÁRIO (somente leitura): o picker manda alguns como filtro, e as colunas condicionais e o
  // modo preço-do-item os consultam — tipicamente o contexto que o formulário buscou ao abrir (contextEndpoint).
  const { valores: valoresDoFormulario } = useContext(FormValuesContext);
  const verdadeiroNoFormulario = (pCampo: string | undefined): boolean =>
    Boolean(pCampo) && isTruthy(getFieldValue(valoresDoFormulario, pCampo ?? ''));

  // Coluna CONDICIONAL (visibleWhenField): só existe quando o campo do formulário é verdadeiro — sem ele, a grade
  // é a de sempre, sem cabeçalho nem célula da coluna.
  const colunas = (editor.editor.gridColumns ?? [])
    .filter((pColuna) => !pColuna.visibleWhenField || verdadeiroNoFormulario(pColuna.visibleWhenField));
  const rows = toRows(value);

  // Só-leitura FIXA (readOnly) ou CONDICIONAL (readOnlyWhenField): o desconto, por exemplo, deixa de se digitar
  // quando passa a sair do preço do item.
  const colunaSoLeitura = (pColuna: XUIGridColumn): boolean =>
    Boolean(pColuna.readOnly) || verdadeiroNoFormulario(pColuna.readOnlyWhenField);

  // Larguras proporcionais ao que o modelo declarou (ver larguraNormalizada). No MODO TABELA a
  // proporção é sobre todas as colunas; no modo cartão, sobre as da mesma fileira — cada fileira é
  // uma faixa independente e se distribui por si.
  const larguraDaColuna = larguraNormalizada(colunas);

  // Sempre o array MAIS NOVO. A consulta de CEP da célula resolve depois de um `await`: quando o
  // preenchimento chega, o dígito recém-digitado já mudou o estado. Fechar sobre `rows` do render
  // inicial sobrescreveria esse dígito — a ref garante que o merge use a linha atual.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const travada = Boolean(disabled) || editor.editor.isReadOnly;

  // Quantas fileiras cada item ocupa. Uma ⇒ tabela comum; mais de uma ⇒ o item vira um bloco com os
  // campos distribuídos, cada um com o seu rótulo (nenhum cabeçalho descreveria duas fileiras).
  const linhasDoItem = colunas.reduce((maior, c) => Math.max(maior, (c.row ?? 0) + 1), 1);

  /**
   * A escrita usa a chave que a LINHA já tem (o back serializa camelCase: `codigo`, `principal`),
   * caindo no `fieldName` do modelo (PascalCase) quando a linha é nova. Sem isso, editar uma linha
   * carregada criaria uma segunda chave (`Codigo` ao lado de `codigo`) e o valor original ficaria.
   */
  const chaveDaLinha = (pLinha: Row, pCampo: string): string => {
    if (Object.prototype.hasOwnProperty.call(pLinha, pCampo))
      return pCampo;

    const alvo = pCampo.toLowerCase();
    for (const chave in pLinha)
      if (chave.toLowerCase() === alvo)
        return chave;

    return pCampo;
  };

  // Cálculo de preço líquido de linha (XUIGridPricing), quando o modelo o declara: dirigido por NOME
  // de coluna (CE-19 — nenhuma App aqui dentro). Arredonda meio-para-longe-do-zero, como o back.
  const pricing = editor.editor.pricing;

  // Modo PREÇO-DO-ITEM (dono, 2026-10-27): declarado no modelo e ligado pelo formulário, o desconto sai do preço
  // negociado da linha. As regras moram em `precoDoItem` — as mesmas que o Salvar consulta.
  const modoPrecoDoItem = precoDoItemAtivo(pricing, valoresDoFormulario);
  const campoPrecoDoItem = pricing?.itemPriceField ?? '';

  const arredondar2 = (pValor: number): number => {
    const sinal = pValor < 0 ? -1 : 1;
    return (sinal * Math.round(Math.abs(pValor) * 100 + 1e-9)) / 100;
  };

  /**
   * Aplica o cálculo a UMA linha (in-place) e a devolve. Tudo em nível de LINHA: total(bruto) =
   * quantidade × preço unitário. `pCampoAlterado` diz o que o usuário mexeu: o PREÇO FINAL é o inverso
   * (desconto = total − preçoFinal); QUALQUER outro campo — ou a criação da linha (`''`) — recalcula o
   * preço final a partir do desconto (preçoFinal = total − desconto). Trava sempre 0 ≤ preçoFinal ≤
   * total e 0 ≤ desconto ≤ total. O desconto é o TOTAL da linha (o que se grava).
   */
  const aplicarPricing = (pLinha: Row, pCampoAlterado: string): Row => {
    if (!pricing) return pLinha;

    const numero = (pCampo: string): number => Number(getFieldValue(pLinha, pCampo)) || 0;
    const gravar = (pCampo: string, pValor: number): void => {
      pLinha[chaveDaLinha(pLinha, pCampo)] = pValor;
    };

    const unitario = numero(pricing.unitPriceField);
    const quantidade = numero(pricing.quantityField);
    const bruto = arredondar2(unitario * quantidade);

    if (modoPrecoDoItem) {
      // (unitário − preço item) × quantidade; vazio ou inválido ⇒ zero. O desconto é só-leitura neste modo.
      const desconto = Math.min(descontoDoPrecoDoItem(pLinha, pricing), bruto);
      gravar(pricing.discountField, desconto);
      gravar(pricing.netTotalField, arredondar2(bruto - desconto));
    } else if (pCampoAlterado.toLowerCase() === pricing.netTotalField.toLowerCase()) {
      // Digitou o preço final (total líquido da linha): trava em [0, bruto] e deriva o desconto.
      const liquido = Math.min(Math.max(numero(pricing.netTotalField), 0), bruto);
      gravar(pricing.netTotalField, liquido);
      gravar(pricing.discountField, arredondar2(bruto - liquido));
    } else {
      // Digitou desconto/quantidade (ou linha nova): desconto em [0, bruto], e o preço final sai dele.
      const desconto = Math.min(Math.max(numero(pricing.discountField), 0), bruto);
      gravar(pricing.discountField, desconto);
      gravar(pricing.netTotalField, arredondar2(bruto - desconto));
    }

    // Total BRUTO da linha (só-leitura): quantidade × preço unitário, sem desconto — o vProd da NF-e.
    if (pricing.grossTotalField)
      gravar(pricing.grossTotalField, bruto);

    return pLinha;
  };

  // Diferença de linha (XUIGridDifference): `resultado = minuendo − subtraendo`, recalculado a cada
  // digitação em qualquer dos dois. Separado do pricing porque aqui o NEGATIVO é a informação —
  // numa correção de estoque, "contado − sistema = −8" quer dizer que faltam oito.
  const difference = editor.editor.difference;

  const aplicarDiferenca = (pLinha: Row): Row => {
    if (!difference) return pLinha;

    const numero = (pCampo: string): number => Number(getFieldValue(pLinha, pCampo)) || 0;

    pLinha[chaveDaLinha(pLinha, difference.resultField)] =
      arredondar2(numero(difference.minuendField) - numero(difference.subtrahendField));

    return pLinha;
  };

  /**
   * Os cálculos de linha, na ordem: o comercial (quando declarado) e depois a diferença. Uma grade
   * pode declarar os dois, nenhum, ou só um — e quem não declara nada não paga nada.
   */
  const aplicarCalculos = (pLinha: Row, pCampoAlterado: string): Row =>
    aplicarDiferenca(aplicarPricing(pLinha, pCampoAlterado));

  /**
   * A linha que veio do banco não traz o preço do item, só o desconto. Antes de mexer nela (na quantidade, por
   * exemplo), fixa-se o preço que aquele desconto representa — calculado sobre a linha ANTES da mudança, porque é
   * com a quantidade antiga que o desconto gravado foi dado. Daí em diante o desconto sai do preço. Não quando o que
   * se mexe É o preço do item: esvaziá-lo é "sem desconto", e rederivá-lo desfaria a escolha do vendedor.
   */
  const fixarPrecoDoItem = (pLinha: Row, pCampoAlterado: string): Row => {
    if (!modoPrecoDoItem || !pricing || pCampoAlterado.toLowerCase() === campoPrecoDoItem.toLowerCase()
      || precoDoItemInformado(pLinha, pricing))
      return pLinha;

    const derivado = precoDoItemExibido(pLinha, pricing);
    return derivado === null ? pLinha : { ...pLinha, [chaveDaLinha(pLinha, campoPrecoDoItem)]: derivado };
  };

  const atualizar = (pIndice: number, pCampo: string, pValor: unknown): void => {
    const proximas = rows.map((r, i) => {
      if (i !== pIndice)
        return r;
      const base = fixarPrecoDoItem(r, pCampo);
      return aplicarCalculos({ ...base, [chaveDaLinha(base, pCampo)]: pValor }, pCampo);
    });
    onChange(proximas);
  };

  /**
   * Preenche VÁRIOS campos de uma linha de uma vez (a consulta de CEP devolve logradouro/bairro/cidade/
   * UF juntos). Aplica cada campo respeitando a chave real da linha e recalcula o preço uma única vez.
   */
  const atualizarVarios = (pIndice: number, pPatch: Record<string, unknown>): void => {
    const proximas = rowsRef.current.map((r, i) => {
      if (i !== pIndice)
        return r;
      const nova: Row = fixarPrecoDoItem({ ...r }, '');
      for (const campo in pPatch)
        nova[chaveDaLinha(nova, campo)] = pPatch[campo];
      return aplicarCalculos(nova, '');
    });
    onChange(proximas);
  };

  const remover = (pIndice: number): void => onChange(rows.filter((_, i) => i !== pIndice));

  // "Novo": com um seletor declarado (itemPickerEndpoint), abre o diálogo de busca; sem ele,
  // acrescenta uma linha vazia (comportamento das demais grades).
  const pickerEndpoint = editor.editor.itemPickerEndpoint ?? '';
  const [pickerAberto, setPickerAberto] = useState(false);

  // O que o picker leva do FORMULÁRIO (pickerContextBindings): o valor corrente de cada campo
  // vinculado vira um filtro fixo da busca. Campo vazio não vira filtro — mandar `{ nota: '' }`
  // faria o back filtrar por "vazio". Quem declara o que viaja é o back (CE-19).
  const filtrosDoContexto = useMemo((): Record<string, string> => {
    const saida: Record<string, string> = {};
    for (const vinculo of editor.editor.pickerContextBindings ?? []) {
      const valor = String(getFieldValue(valoresDoFormulario, vinculo.sourceField) ?? '').trim();
      if (valor.length > 0 && valor !== '0')
        saida[vinculo.targetField] = valor;
    }
    return saida;
  }, [editor.editor.pickerContextBindings, valoresDoFormulario]);

  const adicionar = (): void => {
    if (pickerEndpoint)
      setPickerAberto(true);
    else
      onChange([...rows, aplicarCalculos(novaLinha(colunas), '')]);
  };

  // Item escolhido no diálogo → uma linha nova, com os bindings copiando value/text/group do resultado
  // para as colunas declaradas (ex.: value → STQxProdutoID, text → ProdutoDescricao).
  /** Uma linha nova a partir do item escolhido, com os `fieldBindings` do modelo aplicados. */
  const linhaDoItem = (pItem: Record<string, unknown>): Row => {
    const nova = novaLinha(colunas);
    for (const binding of editor.editor.fieldBindings ?? [])
      nova[binding.targetField] = pItem[binding.sourceField];
    // Com o preço unitário já ligado, o preço final nasce = preço unitário (sem desconto).
    return aplicarCalculos(nova, '');
  };

  const aoSelecionarItem = (pItem: Record<string, unknown>): void => {
    onChange([...rows, linhaDoItem(pItem)]);
    setPickerAberto(false);
  };

  /**
   * VÁRIOS de uma vez (picker com `pickerMultiSelect`), IGNORANDO os que já estão na grade.
   *
   * O repetido não é intenção, é defeito: numa correção de estoque, duas linhas do mesmo produto são
   * duas contagens conflitantes do MESMO saldo, e o documento nasceria num estado que o back recusa.
   * Silenciosamente ignorado, e não recusado: quem marcou dez itens numa lista longa não precisa ser
   * informado de que um deles já estava lá — o resultado é o que ele queria de qualquer forma.
   *
   * A CHAVE é o primeiro `fieldBinding` (por convenção, o identificador do registro: `value` →
   * `STQxProdutoID`). Sem binding declarado não há como saber o que torna duas linhas "a mesma",
   * e aí todas entram — o template não inventa identidade que o modelo não declarou.
   */
  const aoSelecionarVarios = (pItens: Record<string, unknown>[]): void => {
    const campoChave = (editor.editor.fieldBindings ?? [])[0]?.targetField;

    const jaNaGrade = new Set(
      campoChave ? rows.map((pLinha) => String(getFieldValue(pLinha, campoChave) ?? '')) : []);

    const novas: Row[] = [];
    for (const item of pItens) {
      const linha = linhaDoItem(item);
      const chave = campoChave ? String(linha[campoChave] ?? '') : '';

      if (campoChave && jaNaGrade.has(chave))
        continue;

      jaNaGrade.add(chave);
      novas.push(linha);
    }

    if (novas.length > 0)
      onChange([...rows, ...novas]);

    setPickerAberto(false);
  };

  function celula(pColuna: XUIGridColumn, pLinha: Row, pIndice: number): JSX.Element {
    // Leitura TOLERANTE A CAIXA: o modelo nomeia o campo em PascalCase (é o nome da propriedade C#),
    // mas a linha chega do back em camelCase. Mesma regra do resto do motor (getFieldValue).
    const valor = getFieldValue(pLinha, pColuna.fieldName);

    // Trava a célula quando a grade inteira está travada OU quando ESTA coluna é só-leitura (o número,
    // o produto e o preço unitário não se digitam — vêm de fora ou do cálculo).
    const celTravada = travada || colunaSoLeitura(pColuna);

    // Número de ordem do item: a POSIÇÃO da linha (1, 2, 3…), não um valor gravado — sempre começa em 1.
    // O servidor numera igual ao gravar; a tela mostra o mesmo ao vivo (dono, 2026-07-15).
    if (pColuna.isRowNumber)
      return (
        <div className={`${cellReadOnly} justify-end`}>{pIndice + 1}</div>
      );

    if (pColuna.editorType === 'checkbox')
      return (
        <input
          type="checkbox"
          checked={Boolean(valor)}
          disabled={celTravada}
          onChange={(e) => atualizar(pIndice, pColuna.fieldName, e.target.checked)}
          className="accent-brand-primary w-4 h-4"
        />
      );

    if (pColuna.editorType === 'combo')
      return (
        <select
          value={String(valor ?? '')}
          disabled={celTravada}
          onChange={(e) => atualizar(pIndice, pColuna.fieldName, e.target.value)}
          className={cellClassOf(celTravada)}
        >
          {(pColuna.options ?? []).map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {(opcao.text ?? '')}
            </option>
          ))}
        </select>
      );

    if (pColuna.editorType === 'date') {
      const dataDaCelula = paraDataInput(valor);

      return (
        <span className="relative block">
          <input
            type="date"
            value={dataDaCelula}
            disabled={celTravada}
            onChange={(e) => atualizar(pIndice, pColuna.fieldName, e.target.value)}
            className={`peer ${cellClassOf(celTravada)} ${dataDaCelula === '' ? CLASSE_TEXTO_OCULTO : ''}`}
          />
          {/* Mesmo placeholder do editor de data (dd/mm/aaaa) — a célula não fala outra língua. */}
          <XPlaceholderDeData visivel={dataDaCelula === ''} texto={FORMATO_DATA} recuo="left-2" />
        </span>
      );
    }

    // Célula CEP COM busca (a coluna declara lookupEndpoint): mascara, consulta o endereço e preenche
    // as colunas-irmãs da mesma linha. Sem endpoint, cai no ramo de mascarados comum (abaixo).
    if (pColuna.editorType === 'cep' && pColuna.lookupEndpoint)
      return (
        <XCepCell
          pColuna={pColuna}
          pValor={valor}
          pTravada={celTravada}
          pClasse={cellClassOf(celTravada)}
          pOnCru={(d) => atualizar(pIndice, pColuna.fieldName, d)}
          pOnPreencher={(patch) => atualizarVarios(pIndice, patch)}
        />
      );

    // Célula com LUPA de registro: a coluna declara pickerEndpoint. Somente leitura no texto (o valor é
    // a FK, não se digita); a lupa abre a busca e os fieldBindings gravam FK e exibição na linha.
    // `citypicker` é o nome histórico (cidade do endereço); `picker` é o genérico (2026-10-11: o
    // proprietário do elemento veicular). A mesma célula serve aos dois.
    if ((pColuna.editorType === 'citypicker' || pColuna.editorType === 'picker') && pColuna.pickerEndpoint)
      return (
        <XCidadePickerCell
          pColuna={pColuna}
          pValor={valor}
          pTravada={celTravada}
          pClasse={cellClassOf(celTravada)}
          pOnPreencher={(patch) => atualizarVarios(pIndice, patch)}
        />
      );

    // Célula mascarada: EXIBE com máscara e GUARDA cru (dígitos), como o resto da plataforma. O
    // documento do sócio, que já vem mascarado da Receita, é preservado como está.
    if (MASCARADOS.includes(pColuna.editorType))
      return (
        <input
          type="text"
          value={mascarar(pColuna.editorType, valor)}
          disabled={celTravada}
          onChange={(e) => atualizar(pIndice, pColuna.fieldName, limpar(pColuna.editorType, e.target.value))}
          className={cellClassOf(celTravada)}
        />
      );

    // Moeda/decimal: MESMA edição do XCurrencyEditor (formata, alinha à direita, SEM spin). A célula
    // cuida do formato/foco/blur; a só-leitura fica com cor distinta. Grava número (0 quando limpo).
    // PREÇO DO ITEM no modo ligado: mostra o informado ou, na linha que veio do banco, o preço que o desconto
    // gravado representa; vazio grava vazio (sem desconto, e não "R$ 0,00"); fora da regra, a célula fica marcada
    // com a frase que diz o limite e o que fazer.
    if (modoPrecoDoItem && pricing && pColuna.fieldName.toLowerCase() === campoPrecoDoItem.toLowerCase())
      return (
        <XCurrencyCell
          value={precoDoItemExibido(pLinha, pricing)}
          decimalPlaces={pColuna.decimalPlaces || undefined}
          disabled={travada}
          readOnly={colunaSoLeitura(pColuna)}
          invalido={precoDoItemValido(pLinha, pricing) ? undefined : mensagemDoPrecoDoItem(pLinha, pricing)}
          onChange={(n) => atualizar(pIndice, pColuna.fieldName, n)}
        />
      );

    if (NUMERICOS_MOEDA.includes(pColuna.editorType))
      return (
        <XCurrencyCell
          value={valor}
          // Casas decimais declaradas na coluna; 0/ausente ⇒ o padrão da célula, que é DUAS (moeda).
          // Quantidade de peça inteira se lê "25", não "25,00" — e as duas casas que nunca variam
          // são duas casas que o operador confere à toa.
          decimalPlaces={pColuna.decimalPlaces || undefined}
          disabled={travada}
          readOnly={colunaSoLeitura(pColuna)}
          onChange={(n) => atualizar(pIndice, pColuna.fieldName, n ?? 0)}
        />
      );

    // Inteiro COM separador de milhar (dono, 2026-10-11): tara de 9.000 kg e capacidade de 30.000 kg se
    // leem no locale, não como "30000". É a MESMA célula numérica com zero casas (máscara única do
    // template, dono 2026-10-12): o ponto é milhar e a vírgula corta o que vier depois — inteiro não
    // tem decimal. Só-leitura → texto com cor distinta. Grava número (0 quando limpo).
    if (pColuna.editorType === 'integer')
      return (
        <XCurrencyCell
          value={valor}
          decimalPlaces={0}
          disabled={travada}
          readOnly={colunaSoLeitura(pColuna)}
          onChange={(n) => atualizar(pIndice, pColuna.fieldName, n ?? 0)}
        />
      );

    // Texto (e demais). Travado ⇒ TEXTO, não `<input disabled>`: um input desabilitado continua
    // desenhando a caixa, que é justamente a moldura que a célula só-leitura não deve ter.
    if (celTravada) return <div className={cellReadOnly}>{String(valor ?? '')}</div>;

    return (
      <input
        type="text"
        value={String(valor ?? '')}
        onChange={(e) => atualizar(pIndice, pColuna.fieldName, e.target.value)}
        className={cellClass}
      />
    );
  }

  /**
   * O botão de criar, VERDE com o "+" (dono, 2026-09-17).
   *
   * Vive DENTRO do cabeçalho da tabela, na última coluna — a que já pertence ao "Remover" de cada
   * linha. Antes ele era um "Incluir" neutro pendurado ABAIXO da grade, e numa grade alta caía sob a
   * dobra: o operador procurava por ele. No cabeçalho ele está onde a leitura da grade começa, e
   * rola junto com ela nunca — o `thead` é `sticky`.
   *
   * A cor vem da paleta semântica (XButtonColor.Create), não de classe escrita à mão: criar é criar
   * em qualquer lugar do produto, e o operador reconhece a ação pela cor antes de ler o rótulo.
   *
   * Grade TRAVADA (só-leitura) não o mostra — sem coluna de remover, não há onde criar.
   */
  const botaoNovo = !travada && (
    <button
      type="button"
      onClick={adicionar}
      title={'Novo'}
      // Com `pickerEndpoint` este botão ABRE O PICKER (é assim que o item do pedido entra, trazendo o
      // preço vigente); sem ele, acrescenta linha vazia. O e2e precisa de um alvo estável para os dois.
      data-testid="grid-item-novo"
      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-ui font-medium whitespace-nowrap ${XBUTTON_PALETTE[XButtonColor.Create]}`}
    >
      <Plus size={15} />
      {'Novo'}
    </button>
  );

  // O diálogo do botão "Novo". Com COLUNAS declaradas no modelo (pickerColumns), usa o picker
  // genérico e mostra o que a App pediu; sem elas, cai no XItemPickerDialog, cujas colunas são as do
  // PRODUTO (Código/Descrição/Unidade/Saldo/Preço) — o formato que o pedido de venda pede.
  //
  // A distinção existe porque as colunas de produto estavam CRAVADAS no diálogo: qualquer outra grade
  // que reusasse o mesmo botão herdava "Unidade", "Saldo" e "Preço" com traços no lugar do dado, por
  // mais que o back mandasse outra coisa (observado na aba Empresas dos Perfis de Acesso, 2026-09-13).
  // Quem declara o que a linha significa é o modelo do back (CE-19), não este componente.
  const dialogSeletor = pickerAberto && pickerEndpoint && (
    (editor.editor.pickerColumns?.length ?? 0) > 0 ? (
      <XRecordPickerDialog
        endpoint={pickerEndpoint}
        title={editor.editor.pickerTitle}
        searchFields={editor.editor.pickerSearchFields}
        searchPlaceholder={editor.editor.pickerSearchPlaceholder}
        columns={editor.editor.pickerColumns}
        multiSelect={editor.editor.pickerMultiSelect === true}
        fixedFilters={filtrosDoContexto}
        onSelect={aoSelecionarItem}
        onSelectMany={aoSelecionarVarios}
        onClose={() => setPickerAberto(false)}
      />
    ) : (
      <XItemPickerDialog
        endpoint={pickerEndpoint}
        fixedFilters={filtrosDoContexto}
        onSelect={aoSelecionarItem}
        onClose={() => setPickerAberto(false)}
      />
    )
  );

  const botaoRemover = (pIndice: number): JSX.Element => (
    <button
      type="button"
      onClick={() => remover(pIndice)}
      className="text-brand-text-secondary hover:text-red-500"
      title={'Remover'}
    >
      <Trash2 size={15} />
    </button>
  );

  // AÇÕES POR LINHA (grade embutida): declaradas no back (gridRowActions) e delegadas ao pai por
  // onGridRowAction — a grade não executa. Aparecem MESMO em leitura (independem de `travada`): é o
  // "Baixar" na linha da parcela num formulário de leitura. Sem ações ou sem handler ⇒ nada.
  const acoesLinha = (onGridRowAction ? editor.editor.gridRowActions : undefined) ?? [];
  const temAcoes = acoesLinha.length > 0;

  const botoesAcao = (pLinha: Row): JSX.Element => (
    <div className="flex items-center justify-center gap-1">
      {acoesVisiveisNaLinha(acoesLinha, pLinha).map((pAcao) => {
        const desabilitado = acaoDesabilitadaNaLinha(pAcao, pLinha);
        const IconeAcao = ICON_ACAO[pAcao.icon] ?? Play;
        return (
          <button
            key={pAcao.name}
            type="button"
            disabled={desabilitado}
            onClick={() => onGridRowAction?.(pAcao, pLinha)}
            title={pAcao.title}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-ui-xs
                       text-brand-text-primary hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <IconeAcao size={13} />
            <span className="hidden sm:inline">{pAcao.title}</span>
          </button>
        );
      })}
    </div>
  );

  const vazio = (
    <div className="px-2 py-3 text-center text-brand-text-secondary">{'Nenhum item encontrado'}</div>
  );

  // O ERRO do campo da grade (validação do Salvar ou do servidor), embaixo dela, como em todo editor: a grade
  // recusada fica marcada com a frase que diz o quê e o que fazer.
  const mensagemDeErro = error && (
    <p role="alert" className="mt-1 shrink-0 text-ui-xs text-danger">{error}</p>
  );

  // ---------------------------------------------------------------------------------------------
  // MODO MULTI-LINHA: o item ocupa VÁRIAS fileiras (o modelo declara XUIGridColumn.Row). Cada campo
  // leva o seu rótulo em cima, porque um cabeçalho de tabela não descreveria duas fileiras. É o que
  // permite um cadastro largo (endereço) caber sem espremer campo nenhum.
  // ---------------------------------------------------------------------------------------------
  if (linhasDoItem > 1) {
    return (
      <div className="w-full">
        {/* A grade multi-linha NÃO tem cabeçalho de tabela (cada campo leva o rótulo em cima), então
            aqui a faixa equivalente é a linha do rótulo — e é nela que o botão de criar fica, à
            direita, na mesma altura em que ele aparece na grade em tabela. */}
        <div className="flex items-end justify-between gap-2">
          <XEditorLabel title={editor.title} />
          {botaoNovo && <div className="mb-1">{botaoNovo}</div>}
        </div>

        <div className={`rounded-lg border divide-y divide-border ${error ? 'border-danger' : 'border-border'}`}>
          {rows.length === 0 && vazio}

          {/* Os MESMOS testids do modo tabela (`item-row-<i>`, `item-cell-<i>-<campo>`): o e2e fala com
              a célula pelo campo, e não pode depender de qual dos dois leiautes o modelo escolheu. Sem
              eles, a grade de endereços da Pessoa — multi-linha — era inalcançável (corrida de
              2026-09-22, flow 96). */}
          {rows.map((row, indice) => (
            <div key={indice} className="p-2 flex items-start gap-2" data-testid={`item-row-${indice}`}>
              <div className="flex-1 space-y-1.5">
                {Array.from({ length: linhasDoItem }, (_, linha) => {
                  const daFileira = colunas.filter((c) => (c.row ?? 0) === linha);
                  // Proporção DENTRO da fileira: cada uma ocupa a largura inteira por si só.
                  const larguraNaFileira = larguraNormalizada(daFileira);
                  return (
                  <div key={linha} className="flex gap-2">
                    {daFileira
                      .map((c) => (
                        <div key={c.fieldName} style={{ width: larguraNaFileira(c) }} data-testid={`item-cell-${indice}-${c.fieldName}`}>
                          <div className="text-ui-xs text-brand-text-secondary mb-0.5 truncate">
                            {(c.title ?? '')}
                          </div>
                          {celula(c, row, indice)}
                        </div>
                      ))}
                  </div>
                  );
                })}
              </div>

              {!travada && <div className="pt-5">{botaoRemover(indice)}</div>}
            </div>
          ))}
        </div>

        {mensagemDeErro}
        {dialogSeletor}
      </div>
    );
  }

  // MODO TABELA (uma fileira por item): o padrão de sempre.
  return (
    // A grade é o campo ELÁSTICO do formulário (FE-11). `flex-1 min-h-0` (e não `h-full`): o pai
    // elástico é um container FLEX, então a grade absorve a altura dele como ITEM — altura real,
    // que não depende de percentual resolver. Fora do modo elástico o pai não é flex, `flex-1` não
    // tem efeito e valem o piso e o teto de baixo. Um caso não estorva o outro.
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <div className="shrink-0">
        <XEditorLabel title={editor.title} />
      </div>

      {/* Área de trabalho: `flex-1` faz a grade ABSORVER a sobra vertical do formulário — é ela que
          cede quando a janela encolhe, de modo que o corpo do modal não precise rolar (FE-11). O
          piso de 140px garante que a grade vazia continue sendo uma grade. Passou do que cabe, rola
          por dentro: muitos itens à vista sem esticar o modal (dono, 2026-07-14).

          O TETO segue a ALTURA DO MODAL, não um número fixo (dono, 2026-08-28). Em contexto elástico
          — o campo que o XFormView marcou com `x-campo-elastico`, dentro de um card de altura plena —
          o teto é REMOVIDO (max-h-none): a grade é `flex-1` e ocupa toda a altura que o pai flex lhe
          deu, rolando nas LINHAS. Sobrepor com max-height:100% NÃO bastava: 100% e 420px são do mesmo
          grupo de propriedade, e qual vence depende da ordem na folha de estilo, não da string — o
          420px ganhava e cortava a grade no rodapé (o defeito visto em 2026-08-28).
          Fora do contexto elástico o 420px continua valendo: sem altura de pai, ele impede a grade de
          inchar sem propósito. */}
      <div className={`flex-1 overflow-auto rounded-lg border min-h-[140px] max-h-[420px] group-[.x-campo-elastico]:max-h-none ${error ? 'border-danger' : 'border-border'}`}>
        <table className="w-full border-collapse text-ui">
          {/* Cabeçalho FIXO e OPACO. Com `sticky` + `border-collapse`, o fundo tem de ir em CADA
              `<th>` (não no `<tr>`): a célula colada não herda o fundo da linha de forma confiável, e
              as linhas da grade transpareciam por baixo do título ao rolar. Cor própria (`muted-bg`,
              a mesma do rodapé do modal) para o cabeçalho se distinguir do corpo (`brand-surface`),
              com borda inferior fechando a faixa. */}
          <thead className="sticky top-0 z-[1]">
            <tr>
              {colunas.map((c) => (
                <th
                  key={c.fieldName}
                  className="px-2 py-1.5 text-left font-medium text-brand-text-secondary whitespace-nowrap bg-muted-bg border-b border-border"
                  style={{ width: larguraDaColuna(c) }}
                >
                  {(c.title ?? '')}
                </th>
              ))}
              {temAcoes && <th className={`px-2 py-1.5 bg-muted-bg border-b border-border ${COLUNA_FIXA_CABECALHO}`} />}
              {/* A coluna do "Remover" hospeda o botão de criar no CABEÇALHO (dono, 2026-09-17).
                  Largura AUTOMÁTICA (e não os 10 de antes): a célula tem de caber o botão, e um
                  `w-10` o espremeria contra a borda. `text-right` o encosta na direita da grade. */}
              {!travada && (
                <th className={`px-2 py-1 text-right bg-muted-bg border-b border-border ${COLUNA_FIXA_CABECALHO}`}>
                  <div className="flex justify-end">{botaoNovo}</div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={colunas.length + (travada ? 0 : 1) + (temAcoes ? 1 : 0)}
                  className="px-2 py-3 text-center text-brand-text-secondary"
                >
                  {'Nenhum item encontrado'}
                </td>
              </tr>
            )}
            {rows.map((row, indice) => (
              // Linha e célula identificadas pelo ÍNDICE e pelo NOME DA COLUNA: é como o e2e afirma o
              // que a linha ficou valendo (ex.: o preço unitário que veio do cadastro) sem depender da
              // ordem visual das colunas nem do texto formatado.
              <tr key={indice} className="border-t border-border" data-testid={`item-row-${indice}`}>
                {colunas.map((c) => (
                  <td key={c.fieldName} className="px-1.5 py-1" data-testid={`item-cell-${indice}-${c.fieldName}`}>
                    {celula(c, row, indice)}
                  </td>
                ))}
                {temAcoes && (
                  <td className={`px-1.5 py-1 whitespace-nowrap ${COLUNA_FIXA_CORPO}`}>{botoesAcao(row)}</td>
                )}
                {!travada && (
                  <td className={`px-1.5 py-1 text-center ${COLUNA_FIXA_CORPO}`}>{botaoRemover(indice)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mensagemDeErro}
      {dialogSeletor}
    </div>
  );
}
