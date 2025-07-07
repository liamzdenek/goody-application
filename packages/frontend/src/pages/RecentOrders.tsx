import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { apiClient, RecentOrderResponse } from '../services/api';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/ui/DataTable';
import styles from './RecentOrders.module.css';
import type { Order, OrderStatus } from '@goody/shared';

export function RecentOrders() {
  const [recentData, setRecentData] = useState<RecentOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(24); // hours

  const fetchRecentOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.getRecentOrders({
        hours: timeRange,
        limit: 50
      });
      
      setRecentData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentOrders();
  }, [timeRange]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading recent orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error Loading Recent Orders</h2>
          <p>{error}</p>
          <button onClick={fetchRecentOrders} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!recentData) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>No Data Available</h2>
          <p>Unable to load recent order data.</p>
        </div>
      </div>
    );
  }

  const { recentActivity, orders, summary } = recentData;

  // Prepare order table data
  const orderColumns = [
    { key: 'orderId', label: 'Order ID' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'status', label: 'Status' },
    { key: 'giftType', label: 'Gift Type' },
    { key: 'updateType', label: 'Update Type' },
    { key: 'updatedAt', label: 'Updated' },
    { key: 'description', label: 'Description' }
  ];

  const orderData = orders.map(order => ({
    orderId: (
      <Link 
        to="/vendors/$vendorId" 
        params={{ vendorId: order.vendorId }}
        className={styles.orderLink}
      >
        {order.orderId.substring(0, 8)}...
      </Link>
    ),
    vendor: order.vendorName || order.vendorId,
    status: (
      <span className={`${styles.status} ${styles[`status${order.status}`]}`}>
        {order.status.replace(/_/g, ' ')}
      </span>
    ),
    giftType: order.giftType,
    updateType: (
      <span className={`${styles.updateType} ${styles[`update${order.updateType}`]}`}>
        {order.updateType.replace(/_/g, ' ')}
      </span>
    ),
    updatedAt: new Date(order.updatedAt).toLocaleString(),
    description: order.updateDescription || '-'
  }));

  const getUpdateTypeIcon = (type: string) => {
    switch (type) {
      case 'new_order': return '📦';
      case 'status_change': return '🔄';
      case 'delivery_update': return '🚚';
      case 'issue_reported': return '⚠️';
      default: return '📋';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Recent Order Updates</h1>
          <p>Real-time view of order activity across all vendors</p>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.timeRangeSelector}>
            <label>Time Range:</label>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className={styles.select}
            >
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={72}>Last 3 Days</option>
            </select>
          </div>
          
          <button onClick={fetchRecentOrders} className={styles.refreshButton}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Activity Summary */}
      <div className={styles.activitySummary}>
        <h2>Activity Summary ({timeRange}h)</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            title="Total Updates"
            value={recentActivity.updatesLastHour.toString()}
            trend="📊"
          />
          <MetricCard
            title="Status Changes"
            value={recentActivity.statusChanges.toString()}
            trend="🔄"
          />
          <MetricCard
            title="Issues Reported"
            value={recentActivity.issuesReported.toString()}
            trend="⚠️"
          />
          <MetricCard
            title="Arrivals Confirmed"
            value={recentActivity.arrivalsConfirmed.toString()}
            trend="✅"
          />
        </div>
      </div>

      {/* Update Type Breakdown */}
      <div className={styles.updateBreakdown}>
        <h2>Update Type Breakdown</h2>
        <div className={styles.updateTypeGrid}>
          {Object.entries(summary.updateTypeBreakdown).map(([type, count]) => (
            <div key={type} className={styles.updateTypeItem}>
              <span className={styles.updateTypeIcon}>
                {getUpdateTypeIcon(type)}
              </span>
              <div className={styles.updateTypeInfo}>
                <span className={styles.updateTypeLabel}>
                  {type.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className={styles.updateTypeCount}>{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className={styles.statusBreakdown}>
        <h2>Status Distribution</h2>
        <div className={styles.statusGrid}>
          {Object.entries(summary.statusBreakdown).map(([status, count]) => (
            <div key={status} className={styles.statusItem}>
              <span className={styles.statusLabel}>
                {status.replace(/_/g, ' ')}
              </span>
              <span className={styles.statusCount}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className={styles.recentOrders}>
        <h2>Recent Order Updates</h2>
        {orderData.length > 0 ? (
          <DataTable
            columns={orderColumns}
            data={orderData}
          />
        ) : (
          <div className={styles.emptyState}>
            No recent order updates in the selected time range
          </div>
        )}
      </div>
    </div>
  );
}