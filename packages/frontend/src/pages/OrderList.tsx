import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { apiClient } from '../services/api';
import { DataTable } from '../components/ui/DataTable';
import styles from './OrderList.module.css';
import type { OrdersListResponse, Order, OrderStatus, GiftType } from '@goody/shared';

interface FilterState {
  vendorId: string;
  status: OrderStatus | '';
  giftType: GiftType | '';
  dateFrom: string;
  dateTo: string;
  isDelayed: boolean | null;
}

export function OrderList() {
  const [ordersData, setOrdersData] = useState<OrdersListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    vendorId: '',
    status: '',
    giftType: '',
    dateFrom: '',
    dateTo: '',
    isDelayed: null
  });
  const [vendors, setVendors] = useState<Array<{ vendorId: string; name: string }>>([]);

  const fetchOrders = async (cursor?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        limit: 25,
        cursor
      };
      
      // Add filters if they have values
      if (filters.vendorId) params.vendorId = filters.vendorId;
      if (filters.status) params.status = filters.status;
      if (filters.giftType) params.giftType = filters.giftType;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.isDelayed !== null) params.isDelayed = filters.isDelayed;
      
      const response = await apiClient.getOrders(params);
      setOrdersData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await apiClient.getVendors({ limit: 100 });
      setVendors(response.vendors.map(v => ({ vendorId: v.vendorId!, name: v.name! })));
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      vendorId: '',
      status: '',
      giftType: '',
      dateFrom: '',
      dateTo: '',
      isDelayed: null
    });
  };

  const loadMore = () => {
    if (ordersData?.nextCursor) {
      fetchOrders(ordersData.nextCursor);
    }
  };

  if (loading && !ordersData) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error Loading Orders</h2>
          <p>{error}</p>
          <button onClick={() => fetchOrders()} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!ordersData) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>No Data Available</h2>
          <p>Unable to load order data.</p>
        </div>
      </div>
    );
  }

  const { orders, hasMore, nextCursor, summary } = ordersData;

  // Prepare order table data
  const orderColumns = [
    { key: 'orderId', label: 'Order ID' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'status', label: 'Status' },
    { key: 'giftType', label: 'Gift Type' },
    { key: 'giftValue', label: 'Value' },
    { key: 'createdAt', label: 'Created' },
    { key: 'estimatedDelivery', label: 'Est. Delivery' },
    { key: 'actualDelivery', label: 'Actual Delivery' },
    { key: 'isDelayed', label: 'Delayed' }
  ];

  const orderData = orders.map(order => {
    const vendor = vendors.find(v => v.vendorId === order.vendorId);
    
    return {
      orderId: (
        <Link 
          to="/vendors/$vendorId" 
          params={{ vendorId: order.vendorId }}
          className={styles.orderLink}
        >
          {order.orderId.substring(0, 12)}...
        </Link>
      ),
      vendor: vendor?.name || order.vendorId,
      status: (
        <span className={`${styles.status} ${styles[`status${order.status}`]}`}>
          {order.status.replace(/_/g, ' ')}
        </span>
      ),
      giftType: (
        <span className={styles.giftType}>
          {order.giftType}
        </span>
      ),
      giftValue: `$${(order.giftValue / 100).toFixed(2)}`,
      createdAt: new Date(order.createdAt).toLocaleDateString(),
      estimatedDelivery: order.estimatedDelivery 
        ? new Date(order.estimatedDelivery).toLocaleDateString() 
        : '-',
      actualDelivery: order.actualDelivery 
        ? new Date(order.actualDelivery).toLocaleDateString() 
        : '-',
      isDelayed: order.isDelayed ? (
        <span className={styles.delayedBadge}>Yes</span>
      ) : (
        <span className={styles.onTimeBadge}>No</span>
      )
    };
  });

  const statusOptions: OrderStatus[] = [
    'PLACED', 'SHIPPING_ON_TIME', 'SHIPPING_DELAYED', 
    'ARRIVED', 'LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER'
  ];

  const giftTypeOptions: GiftType[] = ['flowers', 'tech', 'food', 'apparel'];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>All Orders</h1>
          <p>Comprehensive order browsing with filtering and pagination</p>
        </div>
        
        <button onClick={() => fetchOrders()} className={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className={styles.summaryStats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total Orders</span>
          <span className={styles.statValue}>{summary.total}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Active Orders</span>
          <span className={styles.statValue}>
            {(summary.statusBreakdown.PLACED || 0) +
             (summary.statusBreakdown.SHIPPING_ON_TIME || 0) +
             (summary.statusBreakdown.SHIPPING_DELAYED || 0)}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Delayed Orders</span>
          <span className={styles.statValue}>{summary.statusBreakdown.SHIPPING_DELAYED || 0}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Completed Orders</span>
          <span className={styles.statValue}>
            {(summary.statusBreakdown.ARRIVED || 0) +
             (summary.statusBreakdown.LOST || 0) +
             (summary.statusBreakdown.DAMAGED || 0) +
             (summary.statusBreakdown.UNDELIVERABLE || 0) +
             (summary.statusBreakdown.RETURN_TO_SENDER || 0)}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <h2>Filters</h2>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label>Vendor:</label>
            <select 
              value={filters.vendorId} 
              onChange={(e) => handleFilterChange('vendorId', e.target.value)}
              className={styles.select}
            >
              <option value="">All Vendors</option>
              {vendors.map(vendor => (
                <option key={vendor.vendorId} value={vendor.vendorId}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Status:</label>
            <select 
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className={styles.select}
            >
              <option value="">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Gift Type:</label>
            <select 
              value={filters.giftType} 
              onChange={(e) => handleFilterChange('giftType', e.target.value)}
              className={styles.select}
            >
              <option value="">All Types</option>
              {giftTypeOptions.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Delayed:</label>
            <select 
              value={filters.isDelayed === null ? '' : filters.isDelayed.toString()} 
              onChange={(e) => handleFilterChange('isDelayed', e.target.value === '' ? null : e.target.value === 'true')}
              className={styles.select}
            >
              <option value="">All Orders</option>
              <option value="true">Delayed Only</option>
              <option value="false">On Time Only</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Date From:</label>
            <input 
              type="date" 
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className={styles.dateInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label>Date To:</label>
            <input 
              type="date" 
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className={styles.dateInput}
            />
          </div>
        </div>
        
        <div className={styles.filterActions}>
          <button onClick={clearFilters} className={styles.clearButton}>
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className={styles.ordersTable}>
        <h2>Orders ({orders.length} of {summary.total})</h2>
        {orderData.length > 0 ? (
          <>
            <DataTable
              columns={orderColumns}
              data={orderData}
            />
            
            {/* Pagination */}
            <div className={styles.pagination}>
              <div className={styles.paginationInfo}>
                Showing {orders.length} of {summary.total} orders
              </div>
              {hasMore && (
                <button
                  onClick={loadMore}
                  className={styles.loadMoreButton}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            No orders found matching the current filters
          </div>
        )}
      </div>
    </div>
  );
}