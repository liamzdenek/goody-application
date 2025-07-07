import { Outlet, Link, useLocation } from '@tanstack/react-router';
import { SystemHealthBanner } from './SystemHealthBanner';
import styles from './RootLayout.module.css';

export function RootLayout() {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/orders/recent', label: 'Recent Orders', icon: '🔄' },
    { path: '/orders', label: 'All Orders', icon: '📦' }
  ];

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>GOODY FULFILLMENT HEALTH DASHBOARD</h1>
          <nav className={styles.navigation}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navLink} ${location.pathname === item.path ? styles.navLinkActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={styles.headerActions}>
            <button
              className={styles.refreshButton}
              onClick={() => window.location.reload()}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>
      
      <SystemHealthBanner />
      
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}