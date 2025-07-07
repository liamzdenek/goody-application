# Demo Script: Goody Third-Party Gift Fulfillment Health Dashboard

1. Introduction (1 minute)
2. Live Demo (2 minutes)
3. Technical Architecture & Implementation (1 minute)
4. Conclusion & Why Goody (1 minute)

## 1. Introduction (1 minute)
1. Hey Mark and the team at Goody, I'm Liam. I'm a hands-on Software Engineer with 14 years of experience and a track record of exceptional impact.
2. I'd love to work in Engineering at Goody.
3. Instead of sending a resume, I've built a functional demo that showcases both my technical skills and my understanding of the operational challenges that face Goody.
4. I've created a Third-Party Gift Fulfillment Health Dashboard that addresses a critical challenge faced by companies like Goody: maintaining visibility into vendor performance to contain fulfillment issues before they broadly impact customer experience.
5. In a line of business where third-party vendor reliability directly impacts customer satisfaction and brand reputation, this dashboard enables operations teams to monitor vendor health, identify performance degradation, and proactively manage vendor relationships.
6. I completed this end-to-end implementation in just one day, demonstrating my ability to rapidly deliver new capabilities.

## 2. Live Demo (2 minutes)
1. **Dashboard Overview**:
   - System Health
   - Highlighted key metrics (Reliability, At Risk Vendors)

2. **Vendor Details**
   - Real-time metrics contextualized to the vendor
   - Breakdown of concerning statuses
   - Recent order view filtered to just this vendor

3. **Recent Orders and Order Search**:
   - Event-driven architecture means that this shows a real time feed of order updates

4. Crawl/Walk/Run
   1. Crawl: Do we have problematic vendors? Do we see recurring types of issue?
   2. Walk: Let's target a few vendors for improvement, write down some thresholds
   3. Run: Let's automatically delist vendors with intolerably poor performance

5. Try it out CTA

## 3. Technical Architecture & Implementation (1 minute)

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

1. **Frontend**: React with TypeScript
2. **API**: Node.js Express APIs running on AWS Lambda with serverless-http for scalable operations
3. **Order Simulating**: Node.Js lambda running on a 5 minute schedule make changes to the data layer
4. **Order Storage**: DynamoDB tables for orders and reports with TTL-based retention
5. **Report Generation**: DynamoDB Streams trigger real-time report generation
6. **Backfill**: NodeJS Lambda generates 3 weeks of data
7. **Infrastructure**: CDK

I focused on building a cloud-native, event-driven solution that demonstrates both rapid delivery capability and production engineering standards, which I believe is necessary to succeed in a startup environment.

## 4. Conclusion & Why I'm a fit for Goody (1 minute)
1. **Why I'm a fit for Goody**:
   - I've showcased expertise in cloud-native architecture, event-driven systems, and full-stack development with modern best practices
   - I've demonstrated my ability to use engineering empirically. We need to be able to answer questions in order to justify next steps.
   - I've proven my ability to rapidly deliver production-quality solutions by leveraging AI.
   - I believe I wouldn't simply meet the bar at Goody, I will raise it

2. **Why I'm excited about Goody**:
   - I'm interested in working at a company that does good in the world.
   - I want to work in a high-paced environment where I can deliver extraordinary value with little red tape.
   - I believe I can accomplish my major learning goals while delivering exceptional impact on systems that real people use

3. I'm excited about the possibility of joining Goody and contributing to your mission of enabling meaningful human connection at scale.
4. Thank you for your consideration. I look forward to hearing back.
