# Operations Guide

## Deployed AWS Resources

### API Gateway
- **URL**: https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod/
- **Stack Output**: GoodyDashboardStack.ApiUrl

### CloudFront Distribution
- **URL**: https://d1fkw11r9my6ok.cloudfront.net
- **Stack Output**: GoodyDashboardStack.CloudFrontUrl

### Lambda Functions

#### Data Backfill Function
- **Name**: GoodyDashboardStack-DataBackfillFunctionAB4732C3-wmgA86juPjmT
- **Purpose**: Generate 21-day historical order data
- **Timeout**: 15 minutes
- **Memory**: 1024 MB
- **Status**: ✅ Validated - Successfully generated 3,084 orders

#### Order Simulator Function  
- **Name**: GoodyDashboardStack-OrderSimulatorFunctionE9E5293D-lnazX88QM6AF
- **Purpose**: Simulate new orders every 5 minutes via EventBridge
- **Timeout**: 5 minutes
- **Memory**: 512 MB
- **Status**: ⏳ Ready for testing

#### Report Generator Function
- **Name**: GoodyDashboardStack-ReportGeneratorFunction9B206FD-eutln7mWQEqc
- **Purpose**: Process DynamoDB Stream events and generate vendor reports
- **Timeout**: 5 minutes
- **Memory**: 1024 MB
- **Status**: ✅ Validated - Generated 5 vendor reports automatically

#### Main API Function
- **Name**: GoodyDashboardStack-GoodyDashboardApi[ID]
- **Purpose**: REST API for dashboard frontend
- **Timeout**: 1 minute
- **Memory**: 512 MB
- **Status**: ⏳ Ready for testing

### DynamoDB Tables

#### Orders Table
- **Name**: GoodyDashboardStack-GoodyOrders7B4321AE-1AW2E75YVYWG5
- **Records**: 3,084 orders (validated)
- **Indexes**: 
  - vendorIndex (vendorId, createdAt)
  - statusIndex (status, updatedAt)
- **Stream**: Enabled → triggers Report Generator
- **TTL**: 30 days on ttl attribute

#### Reports Table
- **Name**: GoodyDashboardStack-GoodyReports496FB776-1GN9M97BI6NDT
- **Records**: 5 vendor reports (validated)
- **Partition Key**: vendorId
- **Sort Key**: date
- **TTL**: 6 months on ttl attribute

### EventBridge
- **Event Bus**: GoodyOrderEvents
- **Schedule**: 5-minute rule triggering Order Simulator
- **Status**: ✅ Configured

### CloudFormation Stack
- **Name**: GoodyDashboardStack
- **ARN**: arn:aws:cloudformation:us-west-2:129013835758:stack/GoodyDashboardStack/8573eb10-5b3b-11f0-8dc0-02723cabd28d
- **Resources**: 42/42 successfully deployed
- **Region**: us-west-2
- **AWS Profile**: lz-demos

## Deployment Process

### NX Build System
- **Deploy Command**: `npx nx deploy infrastructure`
- **Dependency Chain**: shared:build → backend:build-with-dependencies → frontend:build → infrastructure:deploy
- **Build Time**: ~1 minute
- **Deployment Time**: ~45 seconds (updates), ~8 minutes (initial)

### Build Configuration
- **Backend Build**: Bundle mode with esbuild for Lambda compatibility
- **Dependency Installation**: Automated npm install --production in dist directory
- **Artifact Path**: dist/packages/backend/packages/backend/src/ (contains individual Lambda handlers)

## Monitoring and Logs

### CloudWatch Log Groups
- `/aws/lambda/GoodyDashboardStack-DataBackfillFunctionAB4732C3-wmgA86juPjmT`
- `/aws/lambda/GoodyDashboardStack-ReportGeneratorFunction9B206FD-eutln7mWQEqc`
- `/aws/lambda/GoodyDashboardStack-OrderSimulatorFunctionE9E5293D-lnazX88QM6AF`
- `/aws/lambda/[API Function Name]`

### Log Analysis Commands
```bash
# Check data backfill logs
aws logs filter-log-events --log-group-name /aws/lambda/GoodyDashboardStack-DataBackfillFunctionAB4732C3-wmgA86juPjmT --profile lz-demos --start-time $(date -d '10 minutes ago' +%s)000

# Check report generator logs  
aws logs filter-log-events --log-group-name /aws/lambda/GoodyDashboardStack-ReportGeneratorFunction9B206FD-eutln7mWQEqc --profile lz-demos --start-time $(date -d '10 minutes ago' +%s)000
```

## Data Validation

### DynamoDB Record Counts
```bash
# Count orders
aws dynamodb scan --table-name GoodyDashboardStack-GoodyOrders7B4321AE-1AW2E75YVYWG5 --profile lz-demos --select COUNT

# Count reports  
aws dynamodb scan --table-name GoodyDashboardStack-GoodyReports496FB776-1GN9M97BI6NDT --profile lz-demos --select COUNT
```

### Expected Results
- **Orders Table**: 3,084 records (21 days × ~147 orders/day average)
- **Reports Table**: 5 records (one per vendor)

## System Status

### ✅ Validated Components
1. **Data Backfill**: Successfully generated realistic historical data
2. **DynamoDB Stream**: Automatically triggered report generation  
3. **Report Generator**: Generated accurate vendor performance metrics
4. **Infrastructure**: All 42 AWS resources deployed successfully

### ⏳ Pending Validation
1. **API Endpoints**: Health check and data retrieval
2. **Order Simulator**: EventBridge-triggered order generation
3. **Frontend Integration**: React dashboard consumption

### 🔍 Known Issues
- Report Generator dashboard summary has vendorId key error (minor, vendor reports work correctly)
- GSI limitations required removal of recentUpdatesIndex (functionality covered by statusIndex)

## Performance Metrics

### Deployment Performance
- **Initial Stack**: 468s (8 minutes)
- **Updates**: 35-45s average
- **Build Caching**: NX caches 3/5 tasks typically

### Lambda Performance
- **Data Backfill**: ~115ms execution, 91MB memory usage
- **Report Generator**: ~650ms execution, 237MB memory usage
- **Function Cold Starts**: ~500ms initialization

### Data Processing
- **3,084 Orders**: Processed in single backfill execution
- **5 Vendor Reports**: Generated automatically via stream
- **Event-Driven Latency**: Reports generated within seconds of data insertion