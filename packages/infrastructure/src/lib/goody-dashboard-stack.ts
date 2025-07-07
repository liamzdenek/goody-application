import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

// Find the git root directory
function findGitRoot(startPath: string): string {
  let currentPath = startPath;
  while (currentPath !== '/') {
    if (fs.existsSync(path.join(currentPath, '.git'))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }
  throw new Error('Git root directory not found');
}

// Validate that a path exists and is not empty
function validatePath(pathToCheck: string, description: string): void {
  if (!fs.existsSync(pathToCheck)) {
    throw new Error(`${description} path does not exist: ${pathToCheck}`);
  }
  
  const stats = fs.statSync(pathToCheck);
  if (stats.isDirectory() && fs.readdirSync(pathToCheck).length === 0) {
    throw new Error(`${description} directory is empty: ${pathToCheck}`);
  }
}

const GIT_ROOT = findGitRoot(__dirname);
const BACKEND_PATH = path.join(GIT_ROOT, 'dist/packages/backend');
const FRONTEND_PATH = path.join(GIT_ROOT, 'dist/packages/frontend');

// Validate paths
validatePath(BACKEND_PATH, 'Backend');
validatePath(FRONTEND_PATH, 'Frontend');

export class GoodyDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the Orders table with GSIs
    const ordersTable = new dynamodb.Table(this, 'GoodyOrders', {
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes only
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // Enable streams for report generation
      timeToLiveAttribute: 'ttl', // Enable TTL for 30-day data retention
    });

    // Add GSI for vendor queries
    ordersTable.addGlobalSecondaryIndex({
      indexName: 'vendorIndex',
      partitionKey: { name: 'vendorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING }
    });

    // Add GSI for status queries
    ordersTable.addGlobalSecondaryIndex({
      indexName: 'statusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'updatedAt', type: dynamodb.AttributeType.STRING }
    });

    // Note: statusIndex above already provides status-based queries
    // Additional GSI for recent updates can be added later if needed

    // Create the Reports table
    const reportsTable = new dynamodb.Table(this, 'GoodyReports', {
      partitionKey: { name: 'vendorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes only
      timeToLiveAttribute: 'ttl', // Enable TTL for 6-month data retention
    });

    // Create EventBridge custom bus for order events
    const orderEventBus = new events.EventBus(this, 'OrderEventBus', {
      eventBusName: 'GoodyOrderEvents'
    });

    // Create the main API Lambda function
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'main.handler',
      code: lambda.Code.fromAsset(BACKEND_PATH, {
        exclude: ['order-simulator.js', 'report-generator.js', 'data-backfill.js']
      }),
      environment: {
        ORDERS_TABLE_NAME: ordersTable.tableName,
        REPORTS_TABLE_NAME: reportsTable.tableName,
        EVENT_BUS_NAME: orderEventBus.eventBusName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024
    });

    // Create the Order Simulator Lambda function
    const orderSimulatorFunction = new lambda.Function(this, 'OrderSimulatorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'packages/backend/src/order-simulator.handler',
      code: lambda.Code.fromAsset(BACKEND_PATH),
      environment: {
        ORDERS_TABLE_NAME: ordersTable.tableName,
        EVENT_BUS_NAME: orderEventBus.eventBusName
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512
    });

    // Create the Report Generator Lambda function
    const reportGeneratorFunction = new lambda.Function(this, 'ReportGeneratorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'packages/backend/src/report-generator.handler',
      code: lambda.Code.fromAsset(BACKEND_PATH),
      environment: {
        ORDERS_TABLE_NAME: ordersTable.tableName,
        REPORTS_TABLE_NAME: reportsTable.tableName
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024
    });

    // Create the Data Backfill Lambda function
    const dataBackfillFunction = new lambda.Function(this, 'DataBackfillFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'packages/backend/src/data-backfill.handler',
      code: lambda.Code.fromAsset(BACKEND_PATH),
      environment: {
        ORDERS_TABLE_NAME: ordersTable.tableName
      },
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024
    });

    // Grant permissions to Lambda functions
    ordersTable.grantReadWriteData(apiFunction);
    reportsTable.grantReadData(apiFunction);
    
    ordersTable.grantReadWriteData(orderSimulatorFunction);
    orderEventBus.grantPutEventsTo(orderSimulatorFunction);
    
    ordersTable.grantReadData(reportGeneratorFunction);
    reportsTable.grantReadWriteData(reportGeneratorFunction);
    
    ordersTable.grantReadWriteData(dataBackfillFunction);

    // Create EventBridge rule for order simulation (every 5 minutes)
    const orderSimulationRule = new events.Rule(this, 'OrderSimulationRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Triggers order simulation every 5 minutes'
    });
    
    orderSimulationRule.addTarget(new targets.LambdaFunction(orderSimulatorFunction));

    // Add DynamoDB Stream trigger for report generation
    reportGeneratorFunction.addEventSource(new eventsources.DynamoEventSource(ordersTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(5),
      retryAttempts: 3
    }));

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'GoodyDashboardApi', {
      restApiName: 'Goody Dashboard API',
      description: 'API for Goody Third-Party Gift Fulfillment Health Dashboard',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
      }
    });

    // Add proxy resource to API Gateway
    const proxyResource = api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(apiFunction),
      anyMethod: true
    });

    // Create S3 bucket for frontend
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
    frontendBucket.grantRead(originAccessIdentity);

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
        '/health': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Deploy frontend to S3
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(FRONTEND_PATH)],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*']
    });

    // Output the important resource information
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway'
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'URL of the CloudFront distribution'
    });

    new cdk.CfnOutput(this, 'OrdersTableName', {
      value: ordersTable.tableName,
      description: 'Name of the Orders DynamoDB table'
    });

    new cdk.CfnOutput(this, 'ReportsTableName', {
      value: reportsTable.tableName,
      description: 'Name of the Reports DynamoDB table'
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: orderEventBus.eventBusName,
      description: 'Name of the EventBridge custom event bus'
    });

    new cdk.CfnOutput(this, 'OrderSimulatorFunctionName', {
      value: orderSimulatorFunction.functionName,
      description: 'Name of the Order Simulator Lambda function'
    });

    new cdk.CfnOutput(this, 'DataBackfillFunctionName', {
      value: dataBackfillFunction.functionName,
      description: 'Name of the Data Backfill Lambda function'
    });
  }
}