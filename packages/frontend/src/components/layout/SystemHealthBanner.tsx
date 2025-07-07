import { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import type { DashboardSummaryResponse } from '@goody/shared';
import styles from './SystemHealthBanner.module.css';

export function SystemHealthBanner() {
  const [systemHealth, setSystemHealth] = useState<DashboardSummaryResponse['systemHealth'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getDashboardSummary();
      setSystemHealth(data.systemHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch system health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
  }, []);

  if (loading) {
    return (
      <div className={`${styles.banner} ${styles.loading}`}>
        <div className={styles.content}>
          <span>Loading system status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.banner} ${styles.error}`}>
        <div className={styles.content}>
          <span className={styles.status}>System Status: ERROR</span>
          <span className={styles.message}>Unable to fetch system health: {error}</span>
        </div>
      </div>
    );
  }

  if (!systemHealth) {
    return null;
  }

  const statusClass = systemHealth.status === 'healthy' ? styles.healthy : 
                     systemHealth.status === 'degraded' ? styles.degraded : styles.unhealthy;

  const freshnessClass = systemHealth.dataFreshness === 'fresh' ? styles.fresh :
                        systemHealth.dataFreshness === 'stale' ? styles.stale : styles.critical;

  return (
    <div className={`${styles.banner} ${statusClass}`}>
      <div className={styles.content}>
        <div className={styles.statusSection}>
          <span className={styles.status}>
            System Status: {systemHealth.status.toUpperCase()}
          </span>
        </div>
        
        <div className={styles.freshnessSection}>
          <span className={`${styles.freshness} ${freshnessClass}`}>
            Data: {systemHealth.dataFreshness} (Updated {systemHealth.lastUpdateMinutesAgo}min ago)
          </span>
        </div>
        
        {systemHealth.issues.length > 0 && (
          <div className={styles.issuesSection}>
            <span className={styles.issues}>
              Issues: {systemHealth.issues.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}