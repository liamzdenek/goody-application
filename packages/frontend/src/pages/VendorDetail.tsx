import { useParams, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/ui/DataTable';
import styles from './VendorDetail.module.css';
import type { VendorReportResponse, OrdersListResponse, Order } from '@goody/shared';

export function VendorDetail() {
  const { vendorId } = useParams({ from: '/vendors/$vendorId' });
  const [vendorReport, setVendorReport] = useState<VendorReportResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendorData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch vendor report and recent orders
      const [reportResponse, ordersResponse] = await Promise.all([
        apiClient.getVendorReport(vendorId),
        apiClient.getOrders({ vendorId, limit: 20 })
      ]);
      
      setVendorReport(reportResponse);
      setRecentOrders(ordersResponse.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorData();
  }, [vendorId]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading vendor details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error Loading Vendor</h2>
          <p>{error}</p>
          <button onClick={fetchVendorData} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!vendorReport) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Vendor Not Found</h2>
          <p>The vendor with ID "{vendorId}" could not be found.</p>
          <Link to="/" className={styles.backLink}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { vendor, report } = vendorReport;
  const { current7d, previous7d, trends } = report;

  // Calculate trend indicators
  const getTrendIcon = (delta: number) => {
    if (delta > 0) return '↗️';
    if (delta < 0) return '↘️';
    return '→';
  };

  const getTrendClass = (delta: number) => {
    if (delta > 0) return styles.trendUp;
    if (delta < 0) return styles.trendDown;
    return styles.trendStable;
  };

  // Prepare order table data
  const orderColumns = [
    { key: 'orderId', label: 'Order ID' },
    { key: 'status', label: 'Status' },
    { key: 'giftType', label: 'Gift Type' },
    { key: 'orderValue', label: 'Value' },
    { key: 'placedAt', label: 'Placed' },
    { key: 'estimatedDelivery', label: 'Est. Delivery' },
    { key: 'actualDelivery', label: 'Actual Delivery' }
  ];

  const orderData = recentOrders.map(order => ({
    orderId: order.orderId.substring(0, 8) + '...',
    status: (
      <span className={`${styles.status} ${styles[`status${order.status}`]}`}>
        {order.status.replace(/_/g, ' ')}
      </span>
    ),
    giftType: order.giftType,
    orderValue: `$${(order.giftValue / 100).toFixed(2)}`,
    placedAt: new Date(order.createdAt).toLocaleDateString(),
    estimatedDelivery: order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString() : '-',
    actualDelivery: order.actualDelivery
      ? new Date(order.actualDelivery).toLocaleDateString()
      : '-'
  }));

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link to="/" className={styles.backLink}>
          ← Back to Dashboard
        </Link>
        <div className={styles.vendorInfo}>
          <h1>{vendor.name}</h1>
          <span className={styles.category}>{vendor.category}</span>
        </div>
        <button onClick={fetchVendorData} className={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title="Reliability Score"
          value={`${current7d.reliabilityScore}%`}
          trend={`${getTrendIcon(trends.reliabilityScoreDelta)} ${trends.reliabilityScoreDelta > 0 ? '+' : ''}${trends.reliabilityScoreDelta.toFixed(1)}%`}
          trendClass={getTrendClass(trends.reliabilityScoreDelta)}
        />
        <MetricCard
          title="Total Orders (7d)"
          value={current7d.totalOrders.toString()}
          trend={`${getTrendIcon(trends.volumeDelta)} ${trends.volumeDelta > 0 ? '+' : ''}${trends.volumeDelta}`}
          trendClass={getTrendClass(trends.volumeDelta)}
        />
        <MetricCard
          title="On-Time Delivery"
          value={`${current7d.onTimePercentage}%`}
          trend={`${getTrendIcon(trends.onTimePercentageDelta)} ${trends.onTimePercentageDelta > 0 ? '+' : ''}${trends.onTimePercentageDelta.toFixed(1)}%`}
          trendClass={getTrendClass(trends.onTimePercentageDelta)}
        />
        <MetricCard
          title="Issues (7d)"
          value={current7d.issueCount.toString()}
          trend={`${getTrendIcon(-trends.issueCountDelta)} ${trends.issueCountDelta > 0 ? '+' : ''}${trends.issueCountDelta}`}
          trendClass={getTrendClass(-trends.issueCountDelta)}
        />
      </div>

      {/* Order Status Breakdown */}
      <div className={styles.statusBreakdown}>
        <h2>Order Status Breakdown (Last 7 Days)</h2>
        <div className={styles.statusGrid}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Placed</span>
            <span className={styles.statusValue}>{current7d.statusCounts.PLACED}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Shipping On Time</span>
            <span className={styles.statusValue}>{current7d.statusCounts.SHIPPING_ON_TIME}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Shipping Delayed</span>
            <span className={styles.statusValue}>{current7d.statusCounts.SHIPPING_DELAYED}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Arrived</span>
            <span className={styles.statusValue}>{current7d.statusCounts.ARRIVED}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Lost</span>
            <span className={styles.statusValue}>{current7d.statusCounts.LOST}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Damaged</span>
            <span className={styles.statusValue}>{current7d.statusCounts.DAMAGED}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Undeliverable</span>
            <span className={styles.statusValue}>{current7d.statusCounts.UNDELIVERABLE}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Return to Sender</span>
            <span className={styles.statusValue}>{current7d.statusCounts.RETURN_TO_SENDER}</span>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className={styles.recentOrders}>
        <h2>Recent Orders</h2>
        {orderData.length > 0 ? (
          <DataTable
            columns={orderColumns}
            data={orderData}
          />
        ) : (
          <div className={styles.emptyState}>
            No recent orders found for this vendor
          </div>
        )}
      </div>
    </div>
  );
}