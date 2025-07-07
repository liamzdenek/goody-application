# Goody Third-Party Gift Fulfillment Health Dashboard

A real-time dashboard providing visibility into vendor fulfillment performance for operations teams. Built with modern serverless architecture on AWS, this system generates realistic order lifecycle data and provides actionable insights on vendor reliability trends.

## 🚀 Live Demo

- **Dashboard**: https://d1fkw11r9my6ok.cloudfront.net
- **API**: https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod/

## 📊 System Overview

The dashboard monitors vendor fulfillment performance across 5 different vendor types, processing over 3,000+ orders with 21-day historical backfill. The system maintains 79.8% overall reliability through automated monitoring and real-time reporting.

### Key Features

- **Real-time Performance Metrics**: Monitor vendor reliability scores and order status
- **Trend Analysis**: 7-day rolling windows with historical context
- **Automated Reporting**: DynamoDB Stream-triggered report generation
- **Manual Refresh Control**: User-controlled data updates
- **Professional Interface**: Clean, data-focused design following Dropbox principles

## 🏗️ Architecture

Event-driven serverless architecture with clear separation of concerns:

```
CloudFront + S3 → API Gateway → Lambda Functions → DynamoDB
                                         ↓
                               EventBridge Scheduler
```

### Core Components

- **Frontend**: React SPA with TanStack Router and CSS modules
- **Backend**: Express APIs running on AWS Lambda with serverless-http
- **Data Processing**: Event-driven architecture with DynamoDB Streams
- **Infrastructure**: AWS CDK deployment with 42 resources
- **Monitoring**: Structured logging with correlation IDs

## 🛠️ Technology Stack

### Frontend
- React 18 with TypeScript
- TanStack Router (not React Router)
- CSS Modules (no frameworks)
- Vite build system

### Backend
- Node.js on AWS Lambda
- Express with serverless-http
- DynamoDB with GSI patterns
- Zod validation schemas

### Infrastructure
- AWS CDK with TypeScript
- Lambda functions (4 total)
- DynamoDB tables with TTL
- API Gateway + CloudFront
- EventBridge scheduling
- CloudWatch monitoring

### Development
- NX Monorepo workspace
- Single `dist/` build output
- Automated dependency management
- ESLint + Prettier

## 📂 Project Structure

```
packages/
├── shared/          # Common types and utilities
├── backend/         # Lambda functions and APIs
├── frontend/        # React dashboard application
└── infrastructure/  # AWS CDK deployment
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- AWS CLI configured with `lz-demos` profile
- NX CLI globally installed

### Development Setup

1. **Clone and Install**:
   ```bash
   git clone <repository-url>
   cd goody-application
   npm install
   ```

2. **Build All Packages**:
   ```bash
   npx nx run-many -t build
   ```

3. **Deploy Infrastructure**:
   ```bash
   npx nx deploy infrastructure
   ```

### Available Commands

- `npx nx build shared` - Build shared types package
- `npx nx build backend` - Build Lambda functions
- `npx nx build frontend` - Build React application
- `npx nx deploy infrastructure` - Deploy to AWS
- `npx nx lint [package]` - Run linting
- `npx nx test [package]` - Run tests

## 📊 Data Model

### Orders Table
- **Primary Key**: `orderId`
- **GSI**: `vendorIndex` (vendorId, createdAt)
- **GSI**: `statusIndex` (status, updatedAt)
- **TTL**: 30 days retention
- **Stream**: Triggers report generation

### Reports Table
- **Primary Key**: `vendorId`
- **Sort Key**: `date`
- **TTL**: 6 months retention
- **Purpose**: Pre-computed vendor performance metrics

### Vendors (Hardcoded)
- Premium Flowers (90% reliability)
- Tech Gadgets (85% reliability)
- Gourmet Food (95% reliability)
- Artisan Crafts (72% reliability)
- Books & Media (88% reliability)

## 🔄 Order Lifecycle

```
PLACED → SHIPPING_ON_TIME/DELAYED → ARRIVED/DAMAGED/CANCELLED
```

The system simulates realistic order progression with vendor-specific reliability patterns, updating every 5 minutes via EventBridge scheduling.

## 📈 Performance Metrics

### Deployment Performance
- **Initial Stack**: 8 minutes (468s)
- **Updates**: 35-45s average
- **Build Caching**: NX caches 3/5 tasks typically

### Lambda Performance
- **Data Backfill**: ~115ms execution, 91MB memory
- **Report Generator**: ~650ms execution, 237MB memory
- **API Handler**: <1s response time

### Data Processing
- **3,084 Orders**: Generated in historical backfill
- **5 Vendor Reports**: Auto-generated via streams
- **Event Latency**: Reports generated within seconds

## 🏥 Health Monitoring

### Health Check Endpoint
```bash
curl https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod/health
```

### CloudWatch Logs
```bash
# Check recent logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/GoodyDashboardStack-DataBackfillFunctionAB4732C3-wmgA86juPjmT \
  --profile lz-demos \
  --start-time $(date -d '10 minutes ago' +%s)000
```

### Data Validation
```bash
# Count orders
aws dynamodb scan \
  --table-name GoodyDashboardStack-GoodyOrders7B4321AE-1AW2E75YVYWG5 \
  --profile lz-demos \
  --select COUNT

# Count reports
aws dynamodb scan \
  --table-name GoodyDashboardStack-GoodyReports496FB776-1GN9M97BI6NDT \
  --profile lz-demos \
  --select COUNT
```

## 🌟 Key Design Decisions

### Event-Driven Architecture
- **DynamoDB Streams** trigger real-time report generation
- **EventBridge** orchestrates order simulation and processing
- **Serverless** architecture with automatic scaling

### Data Retention Strategy
- **Orders**: 30-day TTL for operational data
- **Reports**: 6-month TTL for historical analysis
- **Vendors**: Persistent master data

### Performance Optimization
- **GSI Patterns** for efficient DynamoDB queries
- **CDN Distribution** via CloudFront
- **Pre-computed Reports** for fast dashboard loading

## 🔧 API Endpoints

### Dashboard & Health
- `GET /health` - System health check
- `GET /api/dashboard` - Dashboard summary
- `GET /dashboard/summary` - Alias for dashboard

### Vendors
- `GET /api/vendors` - All vendors with performance
- `GET /api/vendors/{id}/report` - Vendor-specific performance

### Orders
- `GET /api/orders` - Order listing with filters
- `GET /api/orders/recent` - Recent activity feed

### Reports
- `GET /api/reports` - Vendor performance reports

## 🚦 System Status

### ✅ Operational Components
- Infrastructure: 42/42 AWS resources deployed
- Data Layer: 3,084 orders + 5 vendor reports
- Event Processing: DynamoDB Streams → Report Generation
- API Layer: All endpoints validated and working
- Frontend: React dashboard (in development)

### 📊 Current Metrics
- **Overall Reliability**: 79.8%
- **Total Orders**: 3,084 (21-day backfill)
- **Vendor Reports**: 5 active reports
- **System Health**: All dependencies operational

## 🔗 AWS Resources

### CloudFormation Stack
- **Name**: GoodyDashboardStack
- **Region**: us-west-2
- **ARN**: `arn:aws:cloudformation:us-west-2:129013835758:stack/GoodyDashboardStack/8573eb10-5b3b-11f0-8dc0-02723cabd28d`

### Key Resources
- **API Gateway**: `6q0ywxpbhh.execute-api.us-west-2.amazonaws.com`
- **CloudFront**: `d1fkw11r9my6ok.cloudfront.net`
- **Orders Table**: `GoodyDashboardStack-GoodyOrders7B4321AE-1AW2E75YVYWG5`
- **Reports Table**: `GoodyDashboardStack-GoodyReports496FB776-1GN9M97BI6NDT`
- **Event Bus**: `GoodyOrderEvents`

## 📖 Documentation

- [`ARCHITECTURE_DIAGRAM.md`](./ARCHITECTURE_DIAGRAM.md) - Detailed system architecture
- [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) - Presentation script and talking points
- [`PLAN.md`](./PLAN.md) - Detailed implementation plan
- [`memory-bank/`](./memory-bank/) - Comprehensive project documentation

## 🤝 Contributing

This is a demonstration project showcasing modern serverless architecture and rapid delivery capabilities. The system demonstrates:

- **Production-ready engineering** with comprehensive monitoring
- **Event-driven architecture** with real-time processing
- **Cloud-native design** with automatic scaling
- **Modern development practices** with TypeScript and NX

## 📄 License

This project is a technical demonstration and portfolio piece.