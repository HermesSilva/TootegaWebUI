/**
 * XFormView - Formulário com Grid de 32 Colunas
 * 
 * Renderiza um formulário baseado no modelo XFormView.
 * Utiliza grid de 32 colunas para layout preciso:
 * - 32 colunas = largura total
 * - 16 colunas = 50%
 * - 8 colunas = 25%
 * - 4 colunas = 12.5%
 * 
 * Suporta:
 * - Múltiplas seções com títulos
 * - Seções colapsáveis
 * - Campos organizados por linha e coluna
 * - Validação de campos obrigatórios
 */

import { useState, useCallback, useMemo, type JSX } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type {
  XFormView as XFormViewType,
  XFormSection,
  XFormField,
  XDataEditor,
  XRowAction,
} from '@core/types';
import { XEditor } from './editors/XEditor';
import { useDevice } from '@core/hooks';
import { getFieldValue, isVisible, matchRules } from '@core/lib';
import { FormValuesProvider } from '@core/contexts/FormValuesContext';
import { ehCampoElastico } from '@core/lib/formScale';

// ============================================================================
// Types
// ============================================================================

export interface XFormViewProps {
  formView: XFormViewType;
  data: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  onChange: (pFieldName: string, pValue: unknown, pBindings?: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  isReadOnly?: boolean;
  /** Ação por linha de uma grade embutida (o "Baixar" da parcela). Delegada ao pai; ver XEditorProps. */
  onGridRowAction?: (pAction: XRowAction, pRow: Record<string, unknown>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TOTAL_COLUMNS = 32;

// ============================================================================
// Helper Functions
// ============================================================================

function getIcon(pIconName: string): LucideIcon | null {
  if (!pIconName)
    return null;

  // Convert kebab-case to PascalCase
  const pascalCase = pIconName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[pascalCase] || null;
}

/**
 * Groups fields by row for rendering.
 */
function groupFieldsByRow(pFields: XFormField[]): Map<number, XFormField[]> {
  const groups = new Map<number, XFormField[]>();

  for (const field of pFields) {
    const row = field.row;
    if (!groups.has(row))
      groups.set(row, []);

    groups.get(row)!.push(field);
  }

  // Sort fields within each row by order
  for (const [row, fields] of groups)
    groups.set(row, fields.sort((a, b) => a.order - b.order));

  return groups;
}

/**
 * Editor type constants (matching backend XUIEditorType enum)
 */
const EditorType = {
  Text: 1,
  TextArea: 2,
  Number: 3,
  Date: 4,
  DateTime: 5,
  Time: 6,
  Boolean: 7,
  ComboBox: 8,
  RadioButton: 9,
  Checkbox: 10,
  FileUpload: 11,
  ColorPicker: 12,
  DataLookup: 13,
  AutoComplete: 14,
  Password: 15,
  Email: 16,
  Phone: 17,
  Currency: 18,
  CPF: 19,
  CNPJ: 20,
  CEP: 21,
  Slider: 22,
  Rating: 23,
  Hidden: 24,
  Percent: 25,
  URL: 26,
} as const;

/**
 * Campo que ABSORVE a sobra vertical do formulário (FE-11): a grade de itens e todo campo que o
 * MODELO declarou `fillsHeight`. São os únicos que cedem altura sem perder função — encolhidos, rolam
 * por dentro e continuam servindo; um campo comum tem altura de linha e não cede nada (FE-7).
 *
 * A identificação é por CAPACIDADE declarada (o motor reconhecendo o seu próprio editor genérico, ou
 * o modelo dizendo-o), nunca por App e nunca inferida do tipo do editor — uma observação de três
 * linhas no meio de um cadastro é TextArea igual, e esticá-la comeria o formulário (CE-19).
 *
 * A regra vive em `@core/lib/formScale`, com as demais medidas: quem DISTRIBUI a sobra é este
 * arquivo, mas quem precisa TER sobra para distribuir é o modal, e duas definições divergiriam.
 */
const ehElastico = ehCampoElastico;

/**
 * A largura mínima de cada tipo de editor vive em `@core/lib/formScale` (fonte única, FE-8) e NÃO é
 * aplicada aqui como `min-width` do item do grid: num grid de trilhas `1fr`, isso empurraria o grid,
 * que empurraria o card — o conteúdo ditando a dimensão, exatamente o que FE-1/FE-6 proíbem.
 *
 * Onde o mínimo age: no PISO do modal (FE-9), calculado pelos modais a partir do mesmo módulo. Aqui o
 * campo ocupa EXATAMENTE as colunas que o modelo lhe deu, e o excesso trunca dentro dele.
 */

// ============================================================================
// FormSection Component
// ============================================================================

interface FormSectionProps {
  section: XFormSection;
  data: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  onChange: (pFieldName: string, pValue: unknown, pBindings?: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  isReadOnly?: boolean;
  fieldGap: number;
  /** Esta seção hospeda o campo elástico e deve absorver a sobra vertical do corpo (FE-11). */
  isElastic?: boolean;
  onGridRowAction?: (pAction: XRowAction, pRow: Record<string, unknown>) => void;
}

function FormSection({
  section,
  data,
  originalData,
  onChange,
  errors,
  isReadOnly,
  fieldGap,
  isElastic,
  onGridRowAction,
}: FormSectionProps): JSX.Element | null {
  const [isCollapsed, setIsCollapsed] = useState(section.isCollapsed);
  const { isMobile } = useDevice();

  const IconComponent = getIcon(section.icon);

  // Campos condicionais (XFormField.visibleWhen, CE-19) e campos ocultos (EditorType.Hidden, que só
  // transportam dado) saem da renderização. O valor de um campo escondido permanece no formulário —
  // esconder é decisão de apresentação, não descarte de dado.
  const camposVisiveis = useMemo(
    () => section.fields.filter((f) =>
      f.editor.editor.editorType !== EditorType.Hidden && isVisible(f.visibleWhen, data)),
    [section.fields, data]);

  const rowGroups = useMemo(() => groupFieldsByRow(camposVisiveis), [camposVisiveis]);
  const sortedRows = useMemo(() =>
    Array.from(rowGroups.keys()).sort((a, b) => a - b),
    [rowGroups]
  );

  const handleToggle = useCallback(() => {
    if (section.isCollapsible)
      setIsCollapsed((prev) => !prev);
  }, [section.isCollapsible]);

  // SEÇÃO SEM CAMPO VISÍVEL NÃO SE DESENHA (2026-10-11): quando toda regra de visibilidade da seção
  // reprova — o frete do autônomo com transportadora CNPJ —, sobrava um cabeçalho pendurado sobre o
  // nada. A seção é dos campos; sem campo, não há seção. Fica depois de todos os hooks de propósito.
  if (section.fields.length > 0 && camposVisiveis.length === 0)
    return null;

  return (
    <div className={`mb-4 last:mb-0 ${isElastic ? 'flex-1 min-h-0 flex flex-col' : 'shrink-0'}`}>
      {/* Cabeçalho da seção: a linha corre da esquerda e o título fecha à DIREITA. Assim ele nunca
          se alinha com os rótulos dos campos, que começam à esquerda — não há como confundir um com
          o outro. A faixa é rasa de propósito: um divisor não deve gastar altura de formulário. */}
      {section.showHeader && section.title && (
        <div
          className={`
            shrink-0 flex items-center gap-2 -mt-2 mb-2
            ${section.isCollapsible ? 'cursor-pointer select-none' : ''}
          `}
          onClick={handleToggle}
          role={section.isCollapsible ? 'button' : undefined}
          tabIndex={section.isCollapsible ? 0 : undefined}
          onKeyDown={(e) => {
            if (section.isCollapsible && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              handleToggle();
            }
          }}
        >
          {/* A linha vem antes do título e é visível de ponta a ponta: uma cunha que nasce cheia na
              margem esquerda e afina até virar um filete de 1px ao encostar no título. É a ESPESSURA
              que varia, não a cor — assim o divisor continua legível em toda a extensão. */}
          <div
            className="flex-1 h-0.5 bg-brand-primary/40"
            style={{ clipPath: 'polygon(0 0, 100% calc(50% - 0.25px), 100% calc(50% + 0.25px), 0 100%)' }}
          />

          {section.isCollapsible && (
            isCollapsed
              ? <ChevronRight className="w-3 h-3 text-brand-text-muted" />
              : <ChevronDown className="w-3 h-3 text-brand-text-muted" />
          )}
          {IconComponent && (
            <IconComponent className="w-3.5 h-3.5 text-brand-primary" />
          )}
          <h3 className="text-xs font-medium leading-tight text-brand-primary">
            {(section.title ?? '')}
          </h3>
        </div>
      )}

      {/* Section Content — UMA árvore por dispositivo. Até 2026-10-12 as duas (coluna do celular e
          grade de 32 colunas) iam ao DOM e o CSS escondia uma (`sm:hidden` / `hidden sm:grid`): cada
          campo nascia DUAS vezes com o mesmo id, e o navegador acusava "Duplicate form field id in
          the same form" — 30 vezes no Pedido. O tipo de dispositivo é decidido uma vez, no boot, e
          é por ele (não pela largura da janela) que o resto da casca se desenha; aqui é o mesmo. */}
      {!isCollapsed && isMobile && (
          <div className="flex flex-col gap-4 w-full">
            {sortedRows.map((rowIndex) => {
              const rowFields = rowGroups.get(rowIndex) || [];
              return rowFields.map((field) => (
                <div
                  key={field.editor.id}
                  className="w-full"
                  data-tour={`form-field-${field.editor.fieldName}`}
                  // Pelo BINDING do campo, não pelo rótulo: o rótulo vem do back (CE-19). O teste
                  // e2e alcança `field-Agencia` e busca o input dentro dele.
                  data-testid={`field-${field.editor.fieldName}`}
                >
                  <FormField
                    editor={field.editor}
                    value={getFieldValue(data, field.editor.fieldName)}
                    displayValue={field.editor.editor.displayValueField
                      ? getFieldValue(data, field.editor.editor.displayValueField)
                      : undefined}
                    originalValue={getFieldValue(originalData, field.editor.fieldName)}
                    onChange={onChange}
                    error={errors?.[field.editor.fieldName]}
                    isReadOnly={isReadOnly || field.editor.editor.isReadOnly
                      || matchRules(field.readOnlyWhen, data)}
                    onGridRowAction={onGridRowAction}
                  />
                </div>
              ));
            })}
          </div>
      )}

      {/* Tablet/Desktop: 32-column grid */}
      {!isCollapsed && !isMobile && (
          <div
            className={`grid pl-2 ${isElastic ? 'flex-1 min-h-0' : ''}`}
            style={{
              gridTemplateColumns: `repeat(${TOTAL_COLUMNS}, 1fr)`,
              // Seção elástica (FE-11): a linha que hospeda o campo elástico recebe TODA a sobra
              // vertical (`1fr`); as demais mantêm a altura de linha (`auto`). Sem isto, o grid
              // esticado distribuiria a sobra por todas as trilhas e afastaria os campos entre si.
              gridTemplateRows: isElastic
                ? sortedRows
                    .map((pLinha) =>
                      (rowGroups.get(pLinha) ?? []).some(ehElastico) ? 'minmax(0, 1fr)' : 'auto')
                    .join(' ')
                : undefined,
              gap: `${fieldGap}px`,
              rowGap: `${Math.max(fieldGap * 0.6 - 2, 6)}px`,
            }}
          >
            {sortedRows.map((rowIndex) => {
              const rowFields = rowGroups.get(rowIndex) || [];

              return rowFields.map((field) => {
                return (
                  // `min-w-0`: a trilha do grid é `1fr`, e sem isto o conteúdo do item (texto longo)
                  // definiria a largura mínima da trilha — o conteúdo esticando o layout (FE-1).
                  <div
                    key={field.editor.id}
                    // `group x-campo-elastico`: marca que ESTE campo tem altura de onde ceder. O
                    // editor elástico (a grade de itens) lê a marca para trocar o seu teto fixo pela
                    // altura que o modal lhe deu — sem a marca ele não teria como distinguir "estou
                    // num corpo de altura declarada" de "estou em fluxo normal" (FE-11).
                    //
                    // `flex flex-col` (e não só `h-full`): o item é filho de um GRID, e a altura do
                    // filho dele — a grade, que se declara `h-full` — só resolve contra uma altura
                    // DEFINIDA. Em cadeia de percentuais sobre trilha `1fr` o `height:100%` degenera
                    // para `auto`, a grade cresce com as linhas e o corte aparece no rodapé. Como
                    // container flex, o item passa altura REAL ao filho, e aí a grade cede.
                    className={`min-w-0 ${ehElastico(field) ? 'group x-campo-elastico h-full min-h-0 flex flex-col' : ''}`}
                    style={{ gridColumn: `span ${field.colSpan}` }}
                    data-tour={`form-field-${field.editor.fieldName}`}
                    // Ver o ramo mobile acima: mesma chave, pelo binding do campo.
                    data-testid={`field-${field.editor.fieldName}`}
                  >
                    <FormField
                      editor={field.editor}
                      value={getFieldValue(data, field.editor.fieldName)}
                      displayValue={field.editor.editor.displayValueField
                        ? getFieldValue(data, field.editor.editor.displayValueField)
                        : undefined}
                      originalValue={getFieldValue(originalData, field.editor.fieldName)}
                      onChange={onChange}
                      error={errors?.[field.editor.fieldName]}
                      isReadOnly={isReadOnly || field.editor.editor.isReadOnly
                        || matchRules(field.readOnlyWhen, data)}
                      onGridRowAction={onGridRowAction}
                    />
                  </div>
                );
              });
            })}
          </div>
      )}
    </div>
  );
}

// ============================================================================
// FormField Component
// ============================================================================

interface FormFieldProps {
  editor: XDataEditor;
  value: unknown;
  /** Texto do valor (lookup): o que se mostra ao carregar o registro, em vez da chave. */
  displayValue?: unknown;
  originalValue?: unknown;
  onChange: (pFieldName: string, pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  isReadOnly?: boolean;
  onGridRowAction?: (pAction: XRowAction, pRow: Record<string, unknown>) => void;
}

function FormField({
  editor,
  value,
  displayValue,
  originalValue,
  onChange,
  error,
  isReadOnly,
  onGridRowAction,
}: FormFieldProps): JSX.Element {
  const handleChange = useCallback(
    (pValue: unknown, pBindings?: Record<string, unknown>) => {
      onChange(editor.fieldName, pValue, pBindings);
    },
    [editor.fieldName, onChange]
  );

  return (
    <XEditor
      editor={editor}
      value={value}
      displayValue={displayValue}
      originalValue={originalValue}
      onChange={handleChange}
      error={error}
      disabled={isReadOnly}
      onGridRowAction={onGridRowAction}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function XFormView({
  formView,
  data,
  originalData,
  onChange,
  errors,
  isReadOnly,
  onGridRowAction,
}: XFormViewProps): JSX.Element {
  const sortedSections = useMemo(() =>
    [...formView.sections].sort((a, b) => a.order - b.order),
    [formView.sections]
  );

  // FE-11: a seção que hospeda o campo elástico (grade de itens) absorve a sobra vertical do corpo —
  // e, encolhendo, evita que o CORPO DO MODAL role. Só a PRIMEIRA delas é elástica: duas seções
  // disputando a mesma sobra dariam a cada uma metade do espaço, e nenhuma ficaria utilizável.
  const secaoElasticaID = useMemo(() => {
    const secao = sortedSections.find((pS) => pS.fields.some(ehElastico));
    return secao?.id;
  }, [sortedSections]);

  return (
    // Os VALORES do formulário à disposição dos editores (pickerContextBindings), fornecidos AQUI, onde o
    // formulário existe — e não só pelos modais (dono, 2026-10-28): o cartão do AppX (XCardListView), o
    // formulário de configuração e o formulário único desenham este mesmo XFormView sem modal, e o seletor
    // da Caixa de itens saía sem o projeto do cartão — a busca voltava vazia ("Nenhum item encontrado").
    <FormValuesProvider valores={data}>
    {/* Com campo elástico o corpo vira uma COLUNA de altura plena: as seções comuns ficam com a sua
        altura (FE-7, vertical rígido) e a elástica fica com o resto. Sem ele, o formulário segue em
        fluxo normal, exatamente como antes. */}
    <div
      className={`px-3 sm:px-6 py-3 sm:py-4 w-full overflow-x-hidden
        ${secaoElasticaID ? 'h-full flex flex-col min-h-0' : ''}`}
      style={{
        maxHeight: formView.maxHeight > 0 ? `${formView.maxHeight}px` : undefined,
        overflowY: formView.maxHeight > 0 ? 'auto' : undefined,
      }}
    >
      {sortedSections.map((section) => (
        <FormSection
          key={section.id}
          section={section}
          data={data}
          originalData={originalData}
          onChange={onChange}
          errors={errors}
          isReadOnly={isReadOnly || formView.isReadOnly}
          fieldGap={formView.fieldGap}
          isElastic={section.id === secaoElasticaID}
          onGridRowAction={onGridRowAction}
        />
      ))}
    </div>
    </FormValuesProvider>
  );
}
