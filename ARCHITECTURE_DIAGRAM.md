# Goody Dashboard - System Architecture

## High-Level Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React Dashboard<br/>TanStack Router<br/>CSS Modules]
        CDN[CloudFront CDN<br/>Global Distribution]
        S3[S3 Static Hosting<br/>Frontend Assets]
    end

    subgraph "API Layer"
        APIGW[API Gateway<br/>REST Endpoints]
        LAMBDA[Lambda Functions<br/>Express + serverless-http]
    end

    subgraph "Data Processing Layer"
        SIMULATOR[Order Simulator<br/>EventBridge Schedule]
        REPORTER[Report Generator<br/>Stream Processor]
        BACKFILL[Data Backfill<br/>Historical Data]
    end

    subgraph "Data Layer"
        ORDERS[(DynamoDB Orders<br/>TTL: 30 days)]
        REPORTS[(DynamoDB Reports<br/>TTL: 6 months)]
        STREAMS[DynamoDB Streams<br/>Real-time Events]
    end

    subgraph "Event Layer"
        EVENTBUS[EventBridge<br/>GoodyOrderEvents]
        SCHEDULE[5-min Schedule<br/>Order Generation]
    end

    subgraph "Monitoring"
        CLOUDWATCH[CloudWatch Logs<br/>Structured Logging]
        HEALTH[Health Checks<br/>Dependency Status]
    end

    %% Frontend Flow
    S3 --> UI
    CDN --> S3
    UI --> APIGW

    %% API Flow
    APIGW --> LAMBDA
    LAMBDA --> ORDERS
    LAMBDA --> REPORTS

    %% Data Processing Flow
    SCHEDULE --> EVENTBUS
    EVENTBUS --> SIMULATOR
    SIMULATOR --> ORDERS
    
    ORDERS --> STREAMS
    STREAMS --> REPORTER
    REPORTER --> REPORTS

    BACKFILL --> ORDERS

    %% Monitoring Flow
    LAMBDA --> HEALTH

    %% Styling
    classDef frontend fill:#e1f5fe,color:#000,stroke:#000,stroke-width:2px
    classDef api fill:#f3e5f5,color:#000,stroke:#000,stroke-width:2px
    classDef data fill:#e8f5e8,color:#000,stroke:#000,stroke-width:2px
    classDef event fill:#fff3e0,color:#000,stroke:#000,stroke-width:2px
    classDef monitor fill:#fce4ec,color:#000,stroke:#000,stroke-width:2px

    class UI,CDN,S3 frontend
    class APIGW,LAMBDA api
    class ORDERS,REPORTS,STREAMS data
    class EVENTBUS,SCHEDULE,SIMULATOR,REPORTER,BACKFILL event
    class CLOUDWATCH,HEALTH monitor
```

## Event-Driven Data Flow

```mermaid
sequenceDiagram
    participant Schedule as EventBridge Schedule
    participant OrderSim as Order Simulator
    participant OrdersDB as Orders Table
    participant Stream as DynamoDB Stream
    participant ReportGen as Report Generator
    participant ReportsDB as Reports Table
    participant Dashboard as Dashboard API

    Note over Schedule, ReportsDB: Automated Order Generation & Reporting

    Schedule->>+OrderSim: Trigger every 5 minutes
    OrderSim->>+OrdersDB: Create/Update Orders
    OrdersDB->>+Stream: Stream Record Changes
    Stream->>+ReportGen: Process Order Events
    ReportGen->>+ReportsDB: Update Vendor Reports
    ReportGen->>ReportGen: Calculate Reliability Metrics
    
    Note over Dashboard, ReportsDB: Real-time Dashboard Updates
    
    Dashboard->>+OrdersDB: Query Recent Orders
    Dashboard->>+ReportsDB: Query Vendor Performance
    Dashboard-->>Dashboard: Aggregate System Health
```

## API Architecture

```mermaid
graph LR
    subgraph "Client Requests"
        BROWSER[Browser/Frontend]
        CURL[curl/Testing]
    end

    subgraph "AWS API Gateway"
        GATEWAY[API Gateway<br/>CORS Enabled<br/>us-west-2]
    end

    subgraph "Lambda Functions"
        MAIN[Main API Handler<br/>Express Server<br/>serverless-http]
    end

    subgraph "API Endpoints"
        HEALTH["/health<br/>System Status"]
        DASHBOARD["/api/dashboard<br/>System Summary"]
        VENDORS["/api/vendors<br/>Vendor List"]
        VENDOR_DETAIL["/api/vendors/:id/report<br/>Vendor Performance"]
        ORDERS["/api/orders<br/>Order Management"]
        RECENT["/api/orders/recent<br/>Recent Activity"]
        REPORTS["/api/reports<br/>Performance Reports"]
    end

    subgraph "Data Sources"
        ORDERS_TABLE[(Orders Table<br/>3,084 records)]
        REPORTS_TABLE[(Reports Table<br/>5 vendor reports)]
        VENDORS_DATA[Hardcoded Vendors<br/>5 vendor types]
    end

    BROWSER --> GATEWAY
    CURL --> GATEWAY
    GATEWAY --> MAIN
    
    MAIN --> HEALTH
    MAIN --> DASHBOARD
    MAIN --> VENDORS
    MAIN --> VENDOR_DETAIL
    MAIN --> ORDERS
    MAIN --> RECENT
    MAIN --> REPORTS

    HEALTH --> ORDERS_TABLE
    HEALTH --> REPORTS_TABLE
    DASHBOARD --> ORDERS_TABLE
    DASHBOARD --> REPORTS_TABLE
    VENDORS --> VENDORS_DATA
    VENDORS --> REPORTS_TABLE
    VENDOR_DETAIL --> REPORTS_TABLE
    ORDERS --> ORDERS_TABLE
    RECENT --> ORDERS_TABLE
    REPORTS --> REPORTS_TABLE

    %% Styling
    classDef client fill:#e3f2fd,color:#000
    classDef aws fill:#fff3e0,color:#000
    classDef lambda fill:#e8f5e8,color:#000
    classDef endpoint fill:#f3e5f5,color:#000
    classDef data fill:#fce4ec,color:#000

    class BROWSER,CURL client
    class GATEWAY aws
    class MAIN lambda
    class HEALTH,DASHBOARD,VENDORS,VENDOR_DETAIL,ORDERS,RECENT,REPORTS endpoint
    class ORDERS_TABLE,REPORTS_TABLE,VENDORS_DATA data
```

## Database Schema & Access Patterns

### Core Tables

**Orders Table**
- Primary Key: `orderId`
- Attributes: `vendorId`, `customerId`, `status`, `createdAt`, `updatedAt`, `ttl`, `correlationId`
- GSI: `vendorIndex` (vendorId, createdAt) - for vendor-specific queries
- GSI: `statusIndex` (status, updatedAt) - for status-based filtering
- TTL: 30 days retention

**Reports Table**
- Primary Key: `vendorId`
- Sort Key: `date`
- Attributes: `totalOrders`, `arrivedOrders`, `reliability`, `recentIssues`, `ttl`, `createdAt`
- TTL: 6 months retention

**Vendors (Hardcoded)**
- Static data: `vendorId`, `name`, `category`, `baseReliability`
- 5 vendor types: Premium Flowers, Tech Gadgets, Gourmet Food, Artisan Crafts, Books & Media

### Query Patterns
- **Dashboard Summary**: Scan Reports table for all vendor performance
- **Vendor Performance**: Query Reports by vendorId for specific vendor details
- **Recent Orders**: Query Orders statusIndex for latest activity
- **Order History**: Query Orders vendorIndex for vendor-specific order history
- **Health Check**: Count operations on both tables for system status

### Data Flow
```
Orders → DynamoDB Stream → Report Generator → Reports Table
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DEV[Local Development<br/>NX Monorepo]
        BUILD[Build Process<br/>TypeScript + esbuild]
    end

    subgraph "CI/CD Pipeline"
        NX[NX Build System<br/>Dependency Management]
        CDK[AWS CDK<br/>Infrastructure as Code]
    end

    subgraph "AWS Cloud - us-west-2"
        subgraph "Compute"
            LAMBDA_FUNCS[4 Lambda Functions<br/>512MB-1024MB]
        end
        
        subgraph "Storage"
            DDB[2 DynamoDB Tables<br/>Pay-per-request]
            S3_BUCKET[S3 Bucket<br/>Static Assets]
        end
        
        subgraph "Networking"
            CF[CloudFront<br/>Global CDN]
            API_GW[API Gateway<br/>Regional]
        end
        
        subgraph "Events & Monitoring"
            EB[EventBridge<br/>Order Events Bus]
            CW[CloudWatch<br/>Logs & Metrics]
        end
    end

    subgraph "External Access"
        USERS[Operations Team<br/>Dashboard Users]
        API_CLIENTS[API Clients<br/>curl/Postman]
    end

    DEV --> BUILD
    BUILD --> NX
    NX --> CDK
    CDK --> LAMBDA_FUNCS
    CDK --> DDB
    CDK --> S3_BUCKET
    CDK --> CF
    CDK --> API_GW
    CDK --> EB
    CDK --> CW

    USERS --> CF
    CF --> S3_BUCKET
    USERS --> API_GW
    API_CLIENTS --> API_GW
    API_GW --> LAMBDA_FUNCS
    LAMBDA_FUNCS --> DDB
    LAMBDA_FUNCS --> EB
    LAMBDA_FUNCS --> CW

    %% Styling
    classDef dev fill:#e8f5e8
    classDef cicd fill:#e3f2fd
    classDef aws fill:#fff3e0
    classDef external fill:#fce4ec

    class DEV,BUILD dev
    class NX,CDK cicd
    class LAMBDA_FUNCS,DDB,S3_BUCKET,CF,API_GW,EB,CW aws
    class USERS,API_CLIENTS external
```

## Technology Stack

```mermaid
mindmap
  root((Goody Dashboard<br/>Tech Stack))
    Frontend
      React 18
      TypeScript
      TanStack Router
      CSS Modules
      Vite
    Backend
      Node.js
      Express
      serverless-http
      TypeScript
      Zod Validation
    Data
      DynamoDB
      DynamoDB Streams
      TTL Policies
      GSI Patterns
    Infrastructure
      AWS CDK
      CloudFormation
      Lambda
      API Gateway
      CloudFront
      S3
      EventBridge
      CloudWatch
    Development
      NX Monorepo
      ESLint
      Prettier
      esbuild
    Monitoring
      Structured Logging
      Correlation IDs
      Health Checks
      CloudWatch Logs
```

## Key Architectural Decisions

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
- **Lambda Cold Start Mitigation** with proper memory allocation

### Operational Excellence
- **Correlation IDs** for request tracing
- **Structured Logging** for debugging
- **Health Checks** for system monitoring
- **Infrastructure as Code** for reproducible deployments

## Live System Details

- **API Gateway**: https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod/
- **CloudFront**: https://d1fkw11r9my6ok.cloudfront.net
- **Stack ARN**: arn:aws:cloudformation:us-west-2:129013835758:stack/GoodyDashboardStack/8573eb10-5b3b-11f0-8dc0-02723cabd28d
- **Region**: us-west-2
- **Resources**: 42 AWS resources deployed
- **Data**: 3,084 orders, 5 vendor reports generated