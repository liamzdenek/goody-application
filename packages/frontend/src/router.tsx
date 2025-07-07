import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { RootLayout } from './components/layout/RootLayout';
import { DashboardOverview } from './pages/DashboardOverview';
import { VendorDetail } from './pages/VendorDetail';
import { RecentOrders } from './pages/RecentOrders';
import { OrderList } from './pages/OrderList';

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Dashboard overview route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardOverview,
});

// Vendor detail route
const vendorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vendors/$vendorId',
  component: VendorDetail,
});

// Recent orders route
const recentOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/recent',
  component: RecentOrders,
});

// Order list route
const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrderList,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  vendorDetailRoute,
  recentOrdersRoute,
  ordersRoute,
]);

// Create and export the router
export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}