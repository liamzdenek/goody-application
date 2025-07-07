import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
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

export class ZillowDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the DynamoDB table
    const agentsTable = new dynamodb.Table(this, 'ZillowAgents', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY // For demo purposes only
    });

    // Add GSIs for each segment type
    agentsTable.addGlobalSecondaryIndex({
      indexName: 'experienceLevelIndex',
      partitionKey: { name: 'experienceLevel', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    agentsTable.addGlobalSecondaryIndex({
      indexName: 'businessModelIndex',
      partitionKey: { name: 'businessModel', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    agentsTable.addGlobalSecondaryIndex({
      indexName: 'specializationIndex',
      partitionKey: { name: 'specialization', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    agentsTable.addGlobalSecondaryIndex({
      indexName: 'platformEngagementIndex',
      partitionKey: { name: 'platformEngagement', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    agentsTable.addGlobalSecondaryIndex({
      indexName: 'spendLevelIndex',
      partitionKey: { name: 'spendLevel', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    agentsTable.addGlobalSecondaryIndex({
      indexName: 'marketTypeLocationIndex',
      partitionKey: { name: 'marketTypeLocation', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    agentsTable.addGlobalSecondaryIndex({
      indexName: 'marketTypeConditionIndex',
      partitionKey: { name: 'marketTypeCondition', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING }
    });

    // Create Lambda function for the backend API
    const backendFunction = new lambda.Function(this, 'BackendFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'main.handler',
      code: lambda.Code.fromAsset(BACKEND_PATH),
      environment: {
        AGENTS_TABLE_NAME: agentsTable.tableName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024
    });

    // Grant the Lambda function read/write access to the DynamoDB table
    agentsTable.grantReadWriteData(backendFunction);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ZillowDashboardApi', {
      restApiName: 'Zillow Dashboard API',
      description: 'API for Zillow Real Estate Professional Health Dashboard',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Add proxy resource to API Gateway
    const proxyResource = api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(backendFunction),
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

    // Output the API URL and CloudFront URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway'
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'URL of the CloudFront distribution'
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: agentsTable.tableName,
      description: 'Name of the DynamoDB table'
    });
  }
}