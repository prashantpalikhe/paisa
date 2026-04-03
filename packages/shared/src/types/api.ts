/**
 * Standard API response shapes.
 * All endpoints return one of these formats for consistency.
 */

/** Successful response with data */
export interface ApiResponse<T> {
  data: T;
}

/** Successful paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

/** Error response */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ApiFieldError[];
  };
}

/** Field-level validation error */
export interface ApiFieldError {
  field: string;
  message: string;
}

/** Pagination query params */
export interface PaginationQuery {
  page?: number;
  perPage?: number;
}

/** Sort query params */
export interface SortQuery {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
