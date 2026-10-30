/**
 * XPagination - Navegação de Páginas
 * 
 * Renderiza controles de paginação com informações de registros,
 * navegação entre páginas e seletor de tamanho de página.
 */

import { useMemo, useCallback, type JSX } from 'react';
import { ArrowLeftToLine, ArrowLeft, ArrowRight, ArrowRightToLine } from 'lucide-react';
import type { XPagination as XPaginationType } from '@core/types';

// ============================================================================
// Types
// ============================================================================

interface XPaginationProps {
  pagination: XPaginationType;
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (pPage: number) => void;
  onPageSizeChange: (pSize: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function XPagination({
  pagination,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: XPaginationProps): JSX.Element {

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const totalPages = useMemo(() => {
    return Math.ceil(totalItems / pageSize) || 1;
  }, [totalItems, pageSize]);

  const startItem = useMemo(() => {
    if (totalItems === 0) return 0;
    return (currentPage - 1) * pageSize + 1;
  }, [currentPage, pageSize, totalItems]);

  const endItem = useMemo(() => {
    return Math.min(currentPage * pageSize, totalItems);
  }, [currentPage, pageSize, totalItems]);

  const pageInfo = useMemo(() => {
    // Texto pt-BR direto (dono, 2026-08-03).
    return `Exibindo ${startItem} a ${endItem} de ${totalItems} registros`;
  }, [startItem, endItem, totalItems]);

  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = pagination.maxVisiblePages || 5;
    const half = Math.floor(maxVisible / 2);

    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxVisible - 1);

    // Ajusta início se final ultrapassou
    if (end - start + 1 < maxVisible)
      start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++)
      pages.push(i);

    return pages;
  }, [currentPage, totalPages, pagination.maxVisiblePages]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleFirstPage = useCallback(() => {
    if (currentPage > 1)
      onPageChange(1);
  }, [currentPage, onPageChange]);

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1)
      onPageChange(currentPage - 1);
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages)
      onPageChange(currentPage + 1);
  }, [currentPage, totalPages, onPageChange]);

  const handleLastPage = useCallback(() => {
    if (currentPage < totalPages)
      onPageChange(totalPages);
  }, [currentPage, totalPages, onPageChange]);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(Number(e.target.value));
  }, [onPageSizeChange]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!pagination.isEnabled)
    return <></>;

  const navButtonClass = `
    h-8 w-8 sm:h-7 sm:w-7 rounded-md flex items-center justify-center
    text-brand-text-secondary hover:bg-hover hover:text-brand-text-primary transition-colors
    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
  `;

  return (
    <div className="min-h-row flex flex-row items-center justify-between gap-2 px-3 sm:px-4 py-1 sm:py-0 bg-brand-surface border-t border-border-light">
      {/* Page Info — full sentence on desktop, compact counter on mobile */}
      <div className="flex items-center min-w-0">
        {pagination.showPageInfo && (
          <>
            <span className="hidden sm:block text-ui text-brand-text-secondary whitespace-nowrap">
              {pageInfo}
            </span>
            <span className="sm:hidden text-ui-sm text-brand-text-secondary whitespace-nowrap">
              {currentPage}/{totalPages} ({totalItems})
            </span>
          </>
        )}
      </div>

      {/* Page Navigation — compact, arrows kept close together */}
      <div className="flex items-center gap-0.5">
        {/* First Page */}
        {pagination.showFirstLastButtons && (
          <button
            type="button"
            onClick={handleFirstPage}
            disabled={currentPage === 1}
            className={navButtonClass}
            title={'Primeira página'}
            aria-label={'Primeira página'}
          >
            <ArrowLeftToLine className="w-[18px] h-[18px] sm:w-4 sm:h-4" strokeWidth={1.5} />
          </button>
        )}

        {/* Previous Page */}
        {pagination.showPrevNextButtons && (
          <button
            type="button"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className={navButtonClass}
            title={'Página anterior'}
            aria-label={'Página anterior'}
          >
            <ArrowLeft className="w-[18px] h-[18px] sm:w-4 sm:h-4" strokeWidth={1.5} />
          </button>
        )}

        {/* Page Numbers — single current-page badge on mobile, full list on desktop */}
        <div className="flex items-center gap-0.5 mx-0.5 sm:mx-1">
          {/* On mobile, show only current page indicator */}
          <span className="sm:hidden text-ui-sm font-medium text-brand-primary px-1.5">
            {currentPage}
          </span>

          {/* On desktop, show full pagination */}
          <div className="hidden sm:flex items-center gap-0.5">
            {visiblePages[0] > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onPageChange(1)}
                  className="
                    h-7 min-w-[28px] px-1.5 text-ui font-medium rounded-md
                    hover:bg-hover transition-colors
                    text-brand-text-secondary
                  "
                >
                  1
                </button>
                {visiblePages[0] > 2 && (
                  <span className="px-1 text-brand-text-muted">…</span>
                )}
              </>
            )}

            {visiblePages.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`
                  h-7 min-w-[28px] px-1.5 text-ui font-medium rounded-md transition-colors
                  ${page === currentPage
                    ? 'bg-brand-primary text-white'
                    : 'hover:bg-hover text-brand-text-secondary'
                  }
                `}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            ))}

            {visiblePages[visiblePages.length - 1] < totalPages && (
              <>
                {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-brand-text-muted">…</span>
                )}
                <button
                  type="button"
                  onClick={() => onPageChange(totalPages)}
                  className="
                    h-7 min-w-[28px] px-1.5 text-ui font-medium rounded-md
                    hover:bg-hover transition-colors
                    text-brand-text-secondary
                  "
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Next Page */}
        {pagination.showPrevNextButtons && (
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className={navButtonClass}
            title={'Próxima página'}
            aria-label={'Próxima página'}
          >
            <ArrowRight className="w-[18px] h-[18px] sm:w-4 sm:h-4" strokeWidth={1.5} />
          </button>
        )}

        {/* Last Page */}
        {pagination.showFirstLastButtons && (
          <button
            type="button"
            onClick={handleLastPage}
            disabled={currentPage === totalPages}
            className={navButtonClass}
            title={'Última página'}
            aria-label={'Última página'}
          >
            <ArrowRightToLine className="w-[18px] h-[18px] sm:w-4 sm:h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Page Size Selector — kept on the SAME line as the counter on mobile (label hidden) */}
      {pagination.showPageSizeSelector && (
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <label htmlFor="page-size" className="hidden sm:inline text-ui text-brand-text-secondary">
            {'Por página'}:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={handlePageSizeChange}
            aria-label={'Por página'}
            className="
              h-8 sm:h-7 pl-2 pr-7 text-ui-sm sm:text-ui rounded-md border border-border
              bg-brand-surface text-brand-text-primary
              focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
              appearance-none cursor-pointer
            "
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.4rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.25em 1.25em',
            }}
          >
            {pagination.pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
