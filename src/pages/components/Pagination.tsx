import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [6, 12, 24];

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalItems === 0) return null;

  const startIdx = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with window around current page
  const pageNumbers: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <nav className="pagination-bar" aria-label="Intelligence signals pagination">
      <div className="pagination-summary">
        <span className="pagination-info">
          SHOWING <strong className="text-coral">{startIdx}–{endIdx}</strong> OF{' '}
          <strong>{totalItems}</strong> SIGNALS
        </span>
        <div className="page-size-selector">
          <span className="text-muted">PAGE SIZE:</span>
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              id={`btn-page-size-${size}`}
              className={`page-size-btn ${pageSize === size ? 'active' : ''}`}
              onClick={() => onPageSizeChange(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          id="btn-page-first"
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          aria-label="First page"
        >
          &laquo; First
        </button>

        <button
          type="button"
          id="btn-page-prev"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          &lsaquo; Prev
        </button>

        <div className="pagination-pages">
          {startPage > 1 && (
            <>
              <button
                type="button"
                className="page-pill"
                onClick={() => onPageChange(1)}
              >
                1
              </button>
              {startPage > 2 && <span className="pagination-ellipsis">...</span>}
            </>
          )}

          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              id={`btn-page-${p}`}
              className={`page-pill ${p === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
              <button
                type="button"
                className="page-pill"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          id="btn-page-next"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          Next &rsaquo;
        </button>

        <button
          type="button"
          id="btn-page-last"
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="Last page"
        >
          Last &raquo;
        </button>
      </div>
    </nav>
  );
};
