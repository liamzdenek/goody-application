import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { apiClient } from '../services/api';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/ui/DataTable';
import type { DashboardSummaryResponse, VendorListResponse } from '@goody/shared';
import styles from './DashboardOverview.module.css';

export function DashboardOverview() {
  const [dashboardData, setDashboardData] = useState<DashboardSummaryResponse | null>(null);
  const [vendorsData, setVendorsData] = useState<VendorListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch both dashboard summary and all vendors
      const [dashboard, vendors] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.getVendors({ limit: 100 }) // Get all vendors for dashboard
      ]);
      
      setDashboardData(dashboard);
      setVendorsData(vendors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error Loading Dashboard</h2>
          <p>{error}</p>
          <button onClick={handleRefresh} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData || !vendorsData) {
    return null;
  }

  const formatTrend = (value: number, isPercentage = false) => {
    const sign = value > 0 ? '↑' : value < 0 ? '↓' : '→';
    const prefix = value > 0 ? '+' : '';
    const suffix = isPercentage ? '%' : '';
    return `${sign} ${prefix}${value}${suffix}`;
  };

  const getTrendClass = (value: number) => {
    if (value > 0) return styles.trendUp;
    if (value < 0) return styles.trendDown;
    return styles.trendStable;
  };

  return (
    <div className={styles.container}>
      {/* Metric Cards */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title="OVERALL RELIABILITY"
          value={`${dashboardData.current.overallReliability}%`}
          trend={formatTrend(dashboardData.trends.reliabilityTrend, true)}
          trendClass={getTrendClass(dashboardData.trends.reliabilityTrend)}
        />
        <MetricCard
          title="ACTIVE ORDERS"
          value={dashboardData.current.totalActiveOrders.toString()}
          trend={formatTrend(dashboardData.trends.activeOrdersTrend)}
          trendClass={getTrendClass(dashboardData.trends.activeOrdersTrend)}
        />
        <MetricCard
          title="DELAYED ORDERS"
          value={dashboardData.current.totalDelayedOrders.toString()}
          trend={formatTrend(dashboardData.trends.delayedOrdersTrend)}
          trendClass={getTrendClass(-dashboardData.trends.delayedOrdersTrend)} // Negative is good for delays
        />
        <MetricCard
          title="AT RISK VENDORS"
          value={dashboardData.current.atRiskVendors.toString()}
          trend={formatTrend(dashboardData.trends.atRiskVendorsTrend)}
          trendClass={getTrendClass(-dashboardData.trends.atRiskVendorsTrend)} // Negative is good for at-risk
        />
      </div>

      {/* Vendor Performance Table */}
      <div className={styles.vendorSection}>
        <div className={styles.sectionHeader}>
          <h2>VENDOR PERFORMANCE (Last 7 Days)</h2>
          <div className={styles.actions}>
            <button onClick={handleRefresh} className={styles.actionButton}>
              ↻ Refresh
            </button>
            <Link to="/orders/recent" className={styles.actionButton}>
              Recent Updates
            </Link>
            <button className={styles.actionButton}>
              📊 Export Report
            </button>
          </div>
        </div>

        {vendorsData.vendors && vendorsData.vendors.length > 0 ? (
          <DataTable
            columns={[
              { key: 'name', label: 'Vendor Name', width: '25%' },
              { key: 'reliabilityScore', label: 'Score', width: '15%' },
              { key: 'totalOrders', label: 'Orders', width: '15%' },
              { key: 'onTimePercentage', label: 'On Time', width: '15%' },
              { key: 'issueCount', label: 'Issues', width: '15%' },
              { key: 'trend', label: 'Trend', width: '15%' },
            ]}
            data={vendorsData.vendors.map(vendor => ({
              ...vendor,
              name: (
                <Link
                  to="/vendors/$vendorId"
                  params={{ vendorId: vendor.vendorId }}
                  className={styles.vendorLink}
                >
                  <span className={`${styles.statusIndicator} ${styles[vendor.riskLevel]}`}>
                    {vendor.riskLevel === 'low' ? '🟢' : vendor.riskLevel === 'medium' ? '🟡' : '🔴'}
                  </span>
                  {vendor.name}
                </Link>
              ),
              reliabilityScore: `${vendor.reliabilityScore}%`,
              onTimePercentage: `${vendor.onTimePercentage}%`,
              trend: (
                <span className={getTrendClass(vendor.trendPercentage)}>
                  {formatTrend(vendor.trendPercentage, true)}
                </span>
              ),
            }))}
          />
        ) : (
          <div className={styles.noData}>
            <p>No vendor data available. This might be because:</p>
            <ul>
              <li>The API endpoint is not responding correctly</li>
              <li>No vendors are configured in the system</li>
              <li>There's a network connectivity issue</li>
            </ul>
            <button onClick={handleRefresh} className={styles.retryButton}>
              Retry Loading Data
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className={styles.bottomActions}>
        <Link to="/orders" className={styles.primaryButton}>
          View All Orders
        </Link>
        <button className={styles.secondaryButton}>
          Export Report
        </button>
      </div>
    </div>
  );
}