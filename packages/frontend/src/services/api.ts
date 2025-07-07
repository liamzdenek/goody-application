import type {
  DashboardSummaryResponse,
  VendorListResponse,
  VendorReportResponse,
  OrdersListResponse,
  OrdersListRequest,
  VendorListRequest,
  Order,
  OrderStatus
} from '@goody/shared';

// Define missing types for recent orders API
export interface RecentOrderParams {
  limit?: number;
  cursor?: string;
  hours?: number;
}

export interface RecentOrderResponse {
  recentActivity: {
    updatesLastHour: number;
    statusChanges: number;
    issuesReported: number;
    arrivalsConfirmed: number;
  };
  orders: Array<Order & {
    vendorName?: string;
    previousStatus?: OrderStatus;
    updateType: 'status_change' | 'new_order' | 'delivery_update' | 'issue_reported';
    updateDescription?: string;
  }>;
  nextCursor?: string;
  hasMore: boolean;
  summary: {
    totalRecentUpdates: number;
    timeRangeHours: number;
    statusBreakdown: Record<OrderStatus, number>;
    updateTypeBreakdown: {
      status_change: number;
      new_order: number;
      delivery_update: number;
      issue_reported: number;
    };
  };
}

export class ApiClient {
  private baseUrl = 'https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async getDashboardSummary(date?: string): Promise<DashboardSummaryResponse> {
    const params = date ? `?date=${date}` : '';
    return this.request<DashboardSummaryResponse>(`/dashboard/summary${params}`);
  }

  async getVendors(params?: Partial<VendorListRequest>): Promise<VendorListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.append('date', params.date);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.order) searchParams.append('order', params.order);
    
    const query = searchParams.toString();
    return this.request<VendorListResponse>(`/api/vendors${query ? `?${query}` : ''}`);
  }

  async getVendorReport(vendorId: string, date?: string): Promise<VendorReportResponse> {
    const params = date ? `?date=${date}` : '';
    return this.request<VendorReportResponse>(`/api/vendors/${vendorId}/report${params}`);
  }

  async getOrders(params?: Partial<OrdersListRequest>): Promise<OrdersListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.vendorId) searchParams.append('vendorId', params.vendorId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.dateFrom) searchParams.append('startDate', params.dateFrom);
    if (params?.dateTo) searchParams.append('endDate', params.dateTo);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.cursor) searchParams.append('cursor', params.cursor);
    
    const query = searchParams.toString();
    return this.request<OrdersListResponse>(`/api/orders${query ? `?${query}` : ''}`);
  }

  async getRecentOrders(params?: RecentOrderParams): Promise<RecentOrderResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.cursor) searchParams.append('cursor', params.cursor);
    if (params?.hours) searchParams.append('hours', params.hours.toString());
    
    const query = searchParams.toString();
    return this.request<RecentOrderResponse>(`/api/orders/recent${query ? `?${query}` : ''}`);
  }

  async getHealth() {
    return this.request('/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();