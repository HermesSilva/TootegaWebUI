import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@core/lib';

// Example interface for dashboard stats - customize based on your API
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  revenue: number;
}

// Example query keys factory
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  recentActivity: () => [...dashboardKeys.all, 'recent-activity'] as const,
};

/**
 * Example hook for fetching dashboard statistics
 * This demonstrates the pattern for TanStack Query v5 with TypeScript
 */
export function useDashboardStats(): UseQueryResult<DashboardStats> {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async (): Promise<DashboardStats> => {
      // In production, this would call the real API:
      // return api.get<DashboardStats>('/dashboard/stats');
      
      // Simulated data for development
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        totalUsers: 1247,
        activeUsers: 892,
        totalOrders: 3456,
        revenue: 125890.50,
      };
    },
  });
}

/**
 * Generic data fetching hook template
 * Use this pattern for creating new query hooks
 */
export function useApiQuery<T>(
  key: readonly string[],
  endpoint: string
): UseQueryResult<T> {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.get<T>(endpoint, signal),
  });
}
