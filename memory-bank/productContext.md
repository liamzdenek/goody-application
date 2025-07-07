# Product Context

## Problem Statement
Goody's operations team needs real-time visibility into third-party vendor fulfillment performance to identify issues before they impact customer experience. Currently, there's limited visibility into vendor reliability trends and no systematic way to track performance degradation.

## User Needs
- **Operations Team**: Monitor overall fulfillment health across all vendors
- **Vendor Managers**: Track specific vendor performance and identify improvement opportunities
- **Executive Leadership**: High-level visibility into fulfillment reliability trends

## Solution Approach
A comprehensive dashboard that provides:
1. **Real-time Performance Metrics**: Current vendor reliability scores and order status
2. **Trend Analysis**: 7-day rolling windows with week-over-week comparisons
3. **Issue Detection**: Automated identification of underperforming vendors
4. **Historical Context**: 21-day backfill for meaningful trend analysis

## User Experience Goals
- **Immediate Clarity**: Dashboard overview shows system health at a glance
- **Drill-down Capability**: Click through from summary to vendor details
- **Actionable Insights**: Clear indicators of which vendors need attention
- **Professional Interface**: Clean, data-focused design following Dropbox principles

## Data Strategy
- **Realistic Simulation**: Generate believable order patterns and vendor behaviors
- **Historical Depth**: 21-day backfill provides context for trend analysis
- **Ongoing Updates**: 5-minute order simulation cycles maintain fresh data
- **Performance Patterns**: Vendors have consistent but varied reliability characteristics

## Interface Design Principles
- **Dropbox Design Style**: Flat design, no borders, transparent buttons with thick black borders
- **Bold Color Usage**: Vibrant and pastel colors for status indicators
- **Data Density**: Maximize information display while maintaining readability
- **Manual Control**: Users control when data refreshes (no auto-refresh)

## Success Metrics
- Dashboard loads in <2 seconds
- All vendor performance data visible on main screen
- Clear trend indicators (up/down/stable) for each vendor
- Health check endpoint confirms system operational status
- Report generation completes within 30 seconds of order updates