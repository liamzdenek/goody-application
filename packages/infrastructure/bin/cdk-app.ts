#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GoodyDashboardStack } from '../src/lib/goody-dashboard-stack';

const app = new cdk.App();

new GoodyDashboardStack(app, 'GoodyDashboardStack', {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] || 'us-east-1'
  },
  description: 'Goody Third-Party Gift Fulfillment Health Dashboard'
});

app.synth();