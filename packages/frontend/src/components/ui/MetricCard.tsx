import styles from './MetricCard.module.css';

interface MetricCardProps {
  title: string;
  value: string;
  trend?: string;
  trendClass?: string;
}

export function MetricCard({ title, value, trend, trendClass }: MetricCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>{title}</div>
      <div className={styles.value}>{value}</div>
      {trend && (
        <div className={`${styles.trend} ${trendClass || ''}`}>
          {trend}
        </div>
      )}
    </div>
  );
}