#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ZillowDashboardStack } from '../src/lib/zillow-dashboard-stack';

const app = new cdk.App();

new ZillowDashboardStack(app, 'ZillowDashboardStack', {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] || 'us-west-2'
  },
  description: 'Zillow Real Estate Professional Health Dashboard'
});

app.synth();