# Goody Third-Party Gift Fulfillment Health Dashboard

## Project Overview
A real-time dashboard providing visibility into vendor fulfillment performance for Goody's operations team. The system generates realistic order lifecycle data with historical backfill and provides actionable insights on vendor reliability trends.

## Core Requirements
- **Purpose**: Monitor vendor fulfillment performance and identify issues before they impact customer experience
- **Users**: Goody operations team (internal use, no authentication required)
- **Data**: 21-day historical backfill + ongoing simulated order lifecycle data
- **Update Pattern**: Manual refresh only (user-controlled data updates)
- **Deployment**: AWS cloud-native architecture using CDK

## Success Criteria
1. Dashboard shows real-time vendor performance metrics
2. Historical trend analysis with 7-day rolling windows
3. Actionable alerts for underperforming vendors
4. Realistic data simulation for demonstration purposes
5. Clean, professional interface following Dropbox design principles

## Technical Foundation
- **Architecture**: 12-Factor app principles
- **Frontend**: React with TanStack Router, CSS modules
- **Backend**: Serverless Lambda functions, DynamoDB, API Gateway
- **Infrastructure**: AWS CDK deployment
- **Monorepo**: NX workspace structure
- **Validation**: Zod schemas throughout

## Data Retention Policy
- **Orders**: Delete after 30 days
- **Reports**: Keep for 6 months
- **Vendors**: Persistent master data

## Reliability Scoring Algorithm
Simple percentage calculation: (ARRIVED orders / total completed orders) * 100

## Key Constraints
- Demo application (no real vendor integrations)
- No authentication/authorization required
- Manual data refresh only
- Cloud-native deployment only (no local development)