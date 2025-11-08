# PostgreSQL Cron Features Integration

## Overview

This document describes the PostgreSQL cron features that have been integrated into the Skaftin platform. The integration enables users to schedule and manage automated database tasks using `pg_cron` extension.

## Features Implemented

### 1. Database Setup

- **Extension Enabled**: `pg_cron` extension is automatically enabled during database initialization
- **Location**: `/database/init/01-init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 2. Backend API Endpoints

All cron endpoints require authentication and project access verification.

#### List Cron Jobs
- **Endpoint**: `GET /api/database/:projectId/cron`
- **Description**: Retrieves all cron jobs for a project
- **Response**: Array of cron jobs with schedule, command, status, etc.

#### Create Cron Job
- **Endpoint**: `POST /api/database/:projectId/cron`
- **Body**:
  ```json
  {
    "jobName": "my_cleanup_job",
    "schedule": "0 2 * * *",
    "command": "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"
  }
  ```
- **Description**: Creates a new scheduled cron job
- **Note**: The search path is automatically set to the project schema

#### Update Cron Job
- **Endpoint**: `PUT /api/database/:projectId/cron/:jobId`
- **Body**: Optional fields - `jobName`, `schedule`, `command`
- **Description**: Updates an existing cron job

#### Delete Cron Job
- **Endpoint**: `DELETE /api/database/:projectId/cron/:jobId`
- **Description**: Removes a cron job from the schedule

#### Toggle Cron Job
- **Endpoint**: `PATCH /api/database/:projectId/cron/:jobId/toggle`
- **Body**:
  ```json
  {
    "active": true
  }
  ```
- **Description**: Activates or deactivates a cron job

#### Get Cron Job History
- **Endpoint**: `GET /api/database/:projectId/cron/:jobId/history`
- **Query Params**: `limit` (default: 50)
- **Description**: Retrieves execution history for a specific cron job

### 3. Frontend Components

#### Cron Manager Component
- **Location**: `/frontend/src/components/database/CronManager.tsx`
- **Features**:
  - View all cron jobs with status indicators
  - Create new cron jobs with schedule and SQL command
  - Edit existing cron jobs
  - Toggle jobs on/off
  - Delete cron jobs
  - View execution history with status and error messages

#### Database Tab Integration
- **Location**: `/frontend/src/pages/user/dashboard/database/ProjectDatabaseTab.tsx`
- **New Tab**: "Cron Jobs" tab added to database management interface
- **Icon**: Clock icon for easy identification

### 4. MCP Tools

The following MCP tools are available for AI agents and automation:

#### list_cron_jobs
```typescript
{
  projectId: string
}
```
Lists all cron jobs for a project.

#### create_cron_job
```typescript
{
  projectId: string,
  jobName: string,
  schedule: string,
  command: string
}
```
Creates a new cron job. Schedule uses standard cron syntax.

#### update_cron_job
```typescript
{
  projectId: string,
  jobId: string,
  jobName?: string,
  schedule?: string,
  command?: string
}
```
Updates an existing cron job.

#### delete_cron_job
```typescript
{
  projectId: string,
  jobId: string
}
```
Deletes a cron job.

#### toggle_cron_job
```typescript
{
  projectId: string,
  jobId: string,
  active: boolean
}
```
Enables or disables a cron job.

#### get_cron_job_history
```typescript
{
  projectId: string,
  jobId: string,
  limit?: number
}
```
Retrieves execution history for a cron job.

## Cron Schedule Syntax

The schedule field uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday=0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Examples

- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 2 * * *` - Daily at 2:00 AM
- `0 0 * * 0` - Weekly on Sunday at midnight
- `0 0 1 * *` - Monthly on the 1st at midnight
- `*/15 9-17 * * 1-5` - Every 15 minutes during business hours (9 AM - 5 PM, Monday-Friday)

## Usage Examples

### Example 1: Daily Cleanup Job

**Use Case**: Delete old log entries daily at 3 AM

```sql
-- Schedule
0 3 * * *

-- Command
DELETE FROM application_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Example 2: Hourly Data Aggregation

**Use Case**: Aggregate analytics data every hour

```sql
-- Schedule
0 * * * *

-- Command
INSERT INTO hourly_analytics (date, total_users, total_transactions)
SELECT 
  DATE_TRUNC('hour', NOW()), 
  COUNT(DISTINCT user_id),
  COUNT(*)
FROM transactions
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

### Example 3: Weekly Report Generation

**Use Case**: Generate weekly reports every Monday at 8 AM

```sql
-- Schedule
0 8 * * 1

-- Command
INSERT INTO weekly_reports (week_start, revenue, new_users)
SELECT 
  DATE_TRUNC('week', NOW() - INTERVAL '1 week'),
  SUM(amount),
  COUNT(DISTINCT user_id)
FROM orders
WHERE created_at >= NOW() - INTERVAL '1 week'
  AND created_at < NOW();
```

### Example 4: Vacuum and Analyze

**Use Case**: Optimize database performance every night at 1 AM

```sql
-- Schedule
0 1 * * *

-- Command
VACUUM ANALYZE;
```

## WebSocket Events

All cron operations emit WebSocket events for real-time updates:

- `create_cron_job` - When a new job is created
- `update_cron_job` - When a job is modified
- `delete_cron_job` - When a job is deleted
- `toggle_cron_job` - When a job is activated/deactivated

## Security Considerations

1. **Project Isolation**: Cron jobs automatically run in the context of the project schema
2. **Authentication**: All API endpoints require SuperTokens authentication
3. **Authorization**: Project access is verified before any cron operation
4. **Search Path**: Commands automatically include `SET search_path TO <project_schema>, public;`

## Monitoring and Debugging

### Viewing Execution History

Each cron job maintains a detailed execution history including:
- Start and end times
- Status (succeeded/failed)
- Return messages and errors
- Execution duration

### Common Issues

1. **Job Not Running**: Check if the job is active using the toggle button
2. **Permission Errors**: Ensure the SQL command has proper permissions
3. **Schema Issues**: The search path is automatically set, but verify table names are correct
4. **Schedule Validation**: Use online cron expression validators to verify syntax

## Database Tables

pg_cron uses the following system tables:

- `cron.job` - Stores all scheduled jobs
- `cron.job_run_details` - Stores execution history

These tables are in the `cron` schema and are accessible for querying.

## Performance Considerations

1. **Execution Time**: Keep cron jobs short and efficient
2. **Frequency**: Avoid scheduling jobs too frequently (< 1 minute intervals)
3. **Resource Usage**: Monitor database load when jobs are running
4. **Concurrent Jobs**: Multiple jobs can run simultaneously

## Future Enhancements

Potential improvements for future versions:

1. Job templates and presets
2. Email notifications on job failure
3. Job chaining and dependencies
4. Visual cron schedule builder
5. Job execution statistics and graphs
6. Retry logic for failed jobs
7. Job categories and tagging

## Files Modified/Created

### Backend
- `/database/init/01-init.sql` - Added pg_cron extension
- `/src/controllers/DatabaseController.ts` - Added 6 cron management methods
- `/src/routers/DatabaseRouter.ts` - Added 6 cron routes
- `/src/mcp/tools/databaseTools.ts` - Added 6 MCP tools for cron

### Frontend
- `/frontend/src/components/database/CronManager.tsx` - New component (550+ lines)
- `/frontend/src/components/ComponentsIndex.tsx` - Exported CronManager
- `/frontend/src/pages/user/dashboard/database/ProjectDatabaseTab.tsx` - Added Cron tab

## Testing

To test the cron integration:

1. **Enable Extension** (if not already done):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

2. **Create a Test Job**:
   - Navigate to Project → Database → Cron Jobs tab
   - Click "Create Job"
   - Name: "test_job"
   - Schedule: "*/1 * * * *" (every minute)
   - Command: "SELECT NOW();"
   - Click "Create"

3. **Monitor Execution**:
   - Click the history icon on the job
   - Wait 1-2 minutes
   - Refresh to see execution history

4. **Test Toggle**:
   - Click pause to deactivate
   - Verify no new executions appear
   - Click play to reactivate

5. **Test Delete**:
   - Click delete icon
   - Confirm deletion
   - Verify job is removed

## Support

For issues or questions:
- Check execution history for error messages
- Verify pg_cron extension is installed: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Check PostgreSQL logs for cron job errors
- Ensure cron daemon is running in PostgreSQL

## References

- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Cron Expression Guide](https://crontab.guru/)

