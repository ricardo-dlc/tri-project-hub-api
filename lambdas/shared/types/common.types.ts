// Common types used across multiple features
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationOptions {
  limit?: number;
  nextToken?: string;
  defaultLimit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    nextToken?: string;
    hasMore: boolean;
    count: number;
  };
}