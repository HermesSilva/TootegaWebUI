/**
 * XExportDialog - Modal de Exportação de Dados
 * 
 * Dialog para seleção de formato e opções de exportação.
 * Permite escolher:
 * - Formato (Excel, PDF, CSV)
 * - Intervalo de páginas ou todos os registros
 * - Orientação (Portrait/Landscape) para PDF
 * - Colunas a exportar
 * 
 * Features:
 * - Preview do nome do arquivo
 * - Validação de intervalo de páginas
 * - Loading state durante exportação
 * - Fecha só pelo botão (Esc não fecha modal — dono, 2026-10-17)
 */

import { useState, useCallback, useEffect, useMemo, type JSX } from 'react';
import { Download, FileCode, FileSpreadsheet, FileText, FileType, Loader2, Check } from 'lucide-react';
import { XExportFormat, XExportOrientation, type XExportConfig, type XExportRequest, type XFilterInfo, type XSortInfo, XFilterLogicalOperator } from '@core/types';
import { XModalShell } from './XModalShell';
import { getIntlLocale } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

export interface XExportDialogProps {
  config: XExportConfig;
  isOpen: boolean;
  isExporting?: boolean;
  totalRecords: number;
  totalPages: number;
  currentFilters: XFilterInfo[];
  currentSort: XSortInfo[];
  logicalOperator: XFilterLogicalOperator;
  pageSize: number;
  onExport: (pRequest: XExportRequest) => void;
  onCancel: () => void;
}

// ============================================================================
// Format Icons
// ============================================================================

const formatIcons: Record<XExportFormat, typeof FileSpreadsheet> = {
  [XExportFormat.Excel]: FileSpreadsheet,
  [XExportFormat.PDF]: FileText,
  [XExportFormat.CSV]: FileType,
  [XExportFormat.Markdown]: FileCode,
};

const formatLabels: Record<XExportFormat, string> = {
  [XExportFormat.Excel]: 'Excel',
  [XExportFormat.PDF]: 'PDF',
  [XExportFormat.CSV]: 'CSV',
  [XExportFormat.Markdown]: 'Markdown',
};

// O que cada formato serve — o usuário escolhe pelo destino do arquivo, não pela extensão.
const formatDescriptionKeys: Record<XExportFormat, string> = {
  [XExportFormat.Excel]: 'Planilha Excel (.xlsx) com formatação',
  [XExportFormat.PDF]: 'Documento PDF pronto para impressão',
  [XExportFormat.CSV]: 'Arquivo CSV para importação em outros sistemas',
  [XExportFormat.Markdown]: 'Texto (.md) para colar em chamado, incidente ou revisão de código',
};

// ============================================================================
// Component
// ============================================================================

export function XExportDialog({
  config,
  isOpen,
  isExporting,
  totalRecords,
  totalPages,
  currentFilters,
  currentSort,
  logicalOperator,
  pageSize,
  onExport,
  onCancel,
}: XExportDialogProps): JSX.Element | null {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------


  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Fixed ID for CSS selector compatibility (useId generates problematic IDs like ':r0:')
  const modalID = 'export-dialog';
  const [format, setFormat] = useState<XExportFormat>(config.defaultFormat);
  const [exportAll, setExportAll] = useState(true);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(totalPages || 1);
  const [orientation, setOrientation] = useState<XExportOrientation>(config.orientation);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // ---------------------------------------------------------------------------
  // Reset state when dialog opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      setFormat(config.defaultFormat);
      setExportAll(true);
      setFromPage(1);
      setToPage(totalPages || 1);
      setOrientation(config.orientation);
      setSelectedColumns(
        config.columns.filter(c => c.includeInExport).map(c => c.fieldName)
      );
    }
  }, [isOpen, config, totalPages]);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const estimatedRecords = useMemo(() => {
    if (exportAll) return totalRecords;
    const pages = Math.max(0, toPage - fromPage + 1);
    return Math.min(pages * pageSize, totalRecords);
  }, [exportAll, fromPage, toPage, pageSize, totalRecords]);

  const isValidRange = useMemo(() => {
    if (exportAll) return true;
    return fromPage >= 1 && toPage >= fromPage && toPage <= totalPages;
  }, [exportAll, fromPage, toPage, totalPages]);

  const canExport = useMemo(() => {
    return isValidRange && selectedColumns.length > 0 && !isExporting;
  }, [isValidRange, selectedColumns.length, isExporting]);

  // As colunas que o usuário pode marcar. Nem toda coluna exportável aparece aqui: o back declara
  // colunas do ARQUIVO que a grade não tem (extras, que nascem desmarcadas) e colunas que saem
  // sempre (isVisible = false), e essas últimas não se oferecem para desmarcar.
  const painelColumns = useMemo(
    () => config.columns.filter(c => c.isVisible).sort((a, b) => a.order - b.order),
    [config.columns]
  );

  const painelSelectedCount = useMemo(
    () => painelColumns.filter(c => selectedColumns.includes(c.fieldName)).length,
    [painelColumns, selectedColumns]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleExport = useCallback(() => {
    if (!canExport) return;

    const request: XExportRequest = {
      format,
      fromPage: exportAll ? 0 : fromPage,
      toPage: exportAll ? 0 : toPage,
      pageSize,
      filters: currentFilters,
      logicalOperator,
      sort: currentSort,
      selectedColumns,
      orientation: format === XExportFormat.PDF ? orientation : undefined,
    };

    onExport(request);
  }, [
    canExport,
    format,
    exportAll,
    fromPage,
    toPage,
    pageSize,
    currentFilters,
    logicalOperator,
    currentSort,
    selectedColumns,
    orientation,
    onExport,
  ]);

  // Esc não fecha (regra do XModalShell); aqui só o Enter exporta.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canExport)
        handleExport();
    },
    [canExport, handleExport]
  );

  const toggleColumn = useCallback((fieldName: string) => {
    setSelectedColumns(prev =>
      prev.includes(fieldName)
        ? prev.filter(f => f !== fieldName)
        : [...prev, fieldName]
    );
  }, []);

  // "Selecionar todas" e "Limpar" agem sobre o PAINEL. A coluna que sai sempre (invisível) não é
  // afetada por nenhum dos dois — ela não está em jogo.
  const selectAllColumns = useCallback(() => {
    setSelectedColumns(prev => [
      ...prev.filter(f => !painelColumns.some(c => c.fieldName === f)),
      ...painelColumns.map(c => c.fieldName),
    ]);
  }, [painelColumns]);

  const deselectAllColumns = useCallback(() => {
    setSelectedColumns(prev => prev.filter(f => !painelColumns.some(c => c.fieldName === f)));
  }, [painelColumns]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  // `size="lg"`: as duas colunas do corpo precisam de largura. O teto de 90% da área do App continua
  // valendo (XModalShell), e em janela estreita o leiaute volta a empilhar sozinho.
  return (
    <XModalShell
      variant="inline"
      size="lg"
      closeLabel={'Cancelar'}
      onClose={onCancel}
      data-tour="export-dialog"
      subtitle={`${totalRecords.toLocaleString(getIntlLocale())} registros disponíveis`}
      title={
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-bg shrink-0">
            <Download className="h-5 w-5 text-info" />
          </span>
          <span className="whitespace-nowrap">{config.title || 'Exportar Dados'}</span>
        </span>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={isExporting}
            className="rounded-lg px-4 py-2 text-ui font-medium text-brand-text-primary hover:bg-hover transition-colors disabled:opacity-50 min-h-touch sm:min-h-[36px]"
          >
            {'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-ui font-medium text-white hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-touch sm:min-h-[36px]"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {'Exportando...'}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {'Exportar'}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="p-4 sm:p-5" data-modal-id={modalID} onKeyDown={handleKeyDown}>
        {/* DUAS COLUNAS a partir do desktop: à esquerda as escolhas curtas (formato, alcance,
            orientação), à direita a lista de colunas — a única parte longa. Empilhado, o diálogo
            passava de 700px de altura e empurrava o botão de exportar para fora da vista, enquanto a
            lista mostrava quatro de dezoito itens numa janelinha. No celular volta a ser uma coluna,
            que é o que cabe. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-5 lg:gap-6">

          <div className="space-y-5">
          {/* Format Selection */}
          <div data-tour="export-format-selector">
            <h3 className="text-ui-xs font-semibold tracking-wide text-brand-text-muted mb-2">
              {'Formato'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {config.availableFormats.map(fmt => {
                const Icon = formatIcons[fmt];
                const isSelected = format === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    aria-pressed={isSelected}
                    className={`
                      relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all
                      ${isSelected
                        ? 'border-brand-primary bg-info-bg ring-1 ring-brand-primary'
                        : 'border-border hover:border-brand-text-muted hover:bg-muted-bg'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${isSelected ? 'text-brand-primary' : 'text-brand-text-muted'}`} />
                    <span className={`text-ui font-medium ${isSelected ? 'text-brand-primary' : 'text-brand-text-secondary'}`}>
                      {formatLabels[fmt]}
                    </span>
                    {isSelected && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-brand-primary" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-ui-xs text-brand-text-muted">
              {formatDescriptionKeys[format]}
            </p>
          </div>

          {/* Page Range */}
          <div data-tour="export-page-range">
            <h3 className="text-ui-xs font-semibold tracking-wide text-brand-text-muted mb-2">
              {'Registros'}
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="exportRange"
                  checked={exportAll}
                  onChange={() => setExportAll(true)}
                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-ui text-brand-text-primary">
                  {`Todos (${totalRecords.toLocaleString(getIntlLocale())})`}
                </span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="exportRange"
                  checked={!exportAll}
                  onChange={() => setExportAll(false)}
                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-ui text-brand-text-primary">
                  {'Intervalo de páginas'}
                </span>
              </label>
              
              {/* O intervalo só ocupa espaço quando é o escolhido. */}
              {!exportAll && (
                <div className="ml-6 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={fromPage}
                    onChange={e => setFromPage(Math.max(1, parseInt(e.target.value) || 1))}
                    aria-label={'Página'}
                    className="w-16 rounded-md border border-border px-2 min-h-editor text-ui bg-brand-surface text-brand-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                  />
                  <span className="text-ui text-brand-text-secondary">{'até'}</span>
                  <input
                    type="number"
                    min={fromPage}
                    max={totalPages}
                    value={toPage}
                    onChange={e => setToPage(Math.max(fromPage, parseInt(e.target.value) || fromPage))}
                    aria-label={'até'}
                    className="w-16 rounded-md border border-border px-2 min-h-editor text-ui bg-brand-surface text-brand-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                  />
                  <span className="text-ui-xs text-brand-text-muted">
                    {'de'} {totalPages}
                  </span>
                </div>
              )}

              {!isValidRange && !exportAll && (
                <p className="ml-6 text-ui-xs text-danger">
                  {'Intervalo inválido'}
                </p>
              )}
            </div>
          </div>

          {/* PDF Orientation — só o PDF tem papel, então só ele pergunta. */}
          {format === XExportFormat.PDF && (
            <div data-tour="export-orientation">
              <h3 className="text-ui-xs font-semibold tracking-wide text-brand-text-muted mb-2">
                {'Orientação'}
              </h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="orientation"
                    checked={orientation === XExportOrientation.Portrait}
                    onChange={() => setOrientation(XExportOrientation.Portrait)}
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-ui text-brand-text-primary">{'Retrato'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="orientation"
                    checked={orientation === XExportOrientation.Landscape}
                    onChange={() => setOrientation(XExportOrientation.Landscape)}
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-ui text-brand-text-primary">{'Paisagem'}</span>
                </label>
              </div>
            </div>
          )}
          </div>
          {/* fim da coluna das escolhas */}

          {/* Column Selection */}
          {painelColumns.length > 0 && (
            <div data-tour="export-column-selector" className="flex flex-col min-h-0">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h3 className="text-ui-xs font-semibold tracking-wide text-brand-text-muted">
                  {'Colunas'}
                  <span className="ml-1.5 normal-case tracking-normal text-brand-text-secondary">
                    {painelSelectedCount}/{painelColumns.length}
                  </span>
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={selectAllColumns}
                    className="text-ui-xs text-brand-primary hover:text-brand-primary-dark"
                  >
                    {'Selecionar todas'}
                  </button>
                  <span className="text-border" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={deselectAllColumns}
                    className="text-ui-xs text-brand-primary hover:text-brand-primary-dark"
                  >
                    {'Limpar'}
                  </button>
                </div>
              </div>

              {/* A lista ganha a altura da coluna inteira, em vez da janelinha de quatro linhas que
                  obrigava a rolar dezoito colunas de quatro em quatro. */}
              <div className="flex-1 min-h-0 max-h-[19rem] overflow-y-auto rounded-lg border border-border p-1.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
                  {painelColumns.map(col => {
                    const marcada = selectedColumns.includes(col.fieldName);
                    return (
                      <label
                        key={col.fieldName}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-hover ${
                          marcada ? 'text-brand-text-primary' : 'text-brand-text-secondary'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => toggleColumn(col.fieldName)}
                          className="h-4 w-4 shrink-0 rounded text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="text-ui truncate">{(col.title ?? '')}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* O que vai sair, numa linha só. É uma conferência antes do clique — quem já decidiu não
            lê um parágrafo, bate o olho em quatro números. */}
        <p className="mt-4 pt-3 border-t border-border-light text-ui-xs text-brand-text-secondary">
          {`${estimatedRecords.toLocaleString(getIntlLocale())} registro(s) · ${formatLabels[format]} · ${selectedColumns.length} coluna(s)`}
          {format === XExportFormat.PDF
            && ` · ${orientation === XExportOrientation.Landscape ? 'paisagem' : 'retrato'}`}
        </p>
      </div>
    </XModalShell>
  );
}
