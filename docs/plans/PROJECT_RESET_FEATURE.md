# Project Reset Feature

## Overview

Implemented a comprehensive project reset feature that allows users to clear all database tables and storage files while keeping the project structure intact. Includes a multi-step confirmation process to prevent accidental data loss.

## Features

### Backend Implementation

#### ProjectsController (`src/controllers/ProjectsController.ts`)

Added `resetProject` method that:
- ✅ Verifies user permissions (admin or dev can reset)
- ✅ Drops all tables in the project schema
- ✅ Deletes all files from the project's MinIO bucket
- ✅ Provides detailed feedback with counts
- ✅ Handles errors gracefully
- ✅ Emits WebSocket events for real-time updates
- ✅ Uses connection pooling for database operations

**What Gets Deleted:**
- All database tables in the project schema (CASCADE drops)
- All files in the project's storage bucket

**What Gets Preserved:**
- Project metadata (name, description)
- Team members and permissions
- API credentials
- Schema and bucket names (for future use)

**Endpoint:**
- `POST /api/projects/reset/:id`
- Requires authentication and project access
- Requires admin or dev role

**Response:**
```json
{
  "success": true,
  "message": "Project reset successfully. Dropped 15 tables and deleted 203 files.",
  "data": {
    "droppedTables": 15,
    "deletedFiles": 203,
    "errorCount": 0,
    "errors": []
  }
}
```

### Frontend Implementation

#### 1. ResetProjectModal Component

A sophisticated multi-step confirmation modal:

**Step 1: Warning**
- Shows what will be deleted (database tables, storage files)
- Shows what will be kept (project settings, team, credentials)
- Orange warning theme

**Step 2: Confirmation**
- Lists all destructive actions
- Emphasizes permanent data loss
- Red warning about no recovery

**Step 3: Type to Confirm**
- Requires typing "reset [project name]"
- Case-insensitive validation
- Prevents accidental resets

**Features:**
- ✅ Can't be accidentally closed during reset
- ✅ Step-by-step navigation (Back/Next buttons)
- ✅ Loading states during reset
- ✅ Disabled state prevents double-clicking
- ✅ Auto-focus on confirmation input
- ✅ Clear visual hierarchy

#### 2. Settings Integration

**Updated ProjectSettingsTab:**
- ✅ Separate cards for Reset vs Delete
- ✅ Clear descriptions for each action
- ✅ Orange theme for reset (warning, not danger)
- ✅ Red theme for delete (danger)
- ✅ Disabled states during operations
- ✅ Toast notifications with detailed results

#### 3. Store Integration

**Added to useProjectStore:**
```typescript
resetProject: async (projectId: string) => Promise<{ success: boolean; result?: any }>
```

- Calls backend API
- Returns detailed results
- Manages loading state
- Handles errors gracefully

## User Flow

1. **Navigate to Settings:**
   - Project Dashboard → Settings tab
   - Scroll to "Danger Zone"

2. **Click "Reset Project":**
   - Opens multi-step modal

3. **Step 1 - Read Warning:**
   - Review what will be deleted
   - Review what will be kept
   - Click "I Understand, Continue"

4. **Step 2 - Confirm Understanding:**
   - Review destructive actions again
   - See warning about no recovery
   - Click "Continue to Confirmation"

5. **Step 3 - Type to Confirm:**
   - Type "reset [project name]"
   - Button enables when text matches
   - Click "Reset Project"

6. **Reset Executes:**
   - Modal shows loading state
   - Backend drops tables and deletes files
   - User sees toast with results

7. **Completion:**
   - Modal closes automatically
   - Toast shows success/warning with counts
   - Project is now empty and ready for new data

## Security & Permissions

### Backend Authorization
```typescript
// Required role check
if (access.role !== 'admin' && access.role !== 'dev') {
  return 403: 'You do not have permission to reset this project'
}
```

- ✅ Authentication required (JWT token)
- ✅ Project membership required
- ✅ Admin or Dev role required
- ✅ Viewers cannot reset projects

### Frontend Safeguards
- ✅ 3-step confirmation process
- ✅ Type-to-confirm with project name
- ✅ Clear warnings at each step
- ✅ No accidental clicks (disabled during operation)

## Technical Details

### Database Operations

**Transaction Safety:**
Each table is dropped individually with CASCADE:
```sql
DROP TABLE IF EXISTS "table_name" CASCADE;
```

- Foreign key constraints are handled automatically
- CASCADE ensures dependent objects are also dropped
- Individual error handling per table

**Schema Isolation:**
```sql
SET search_path TO project_schema_name, public;
```

- Operations are scoped to project schema
- Won't affect other projects
- System tables are protected

### Storage Operations

**Batch Deletion:**
- Lists objects in bucket
- Deletes in batches (up to 1000 per batch)
- Handles pagination for large buckets
- Individual error tracking per file

**Error Handling:**
```typescript
if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
  deleteResponse.Errors.forEach(err => {
    errors.push(`Failed to delete ${err.Key}: ${err.Message}`);
  });
}
```

### WebSocket Events

Emits real-time updates:
```typescript
emitProjectEvent(projectId, 'project_reset', {
  droppedTables,
  deletedFiles,
  errorCount,
});
```

Connected clients are notified of the reset operation.

## Error Handling

### Backend
- Individual table drop errors don't stop the process
- Individual file delete errors are tracked
- Returns first 10 errors in response
- Logs all errors to console
- Graceful degradation

### Frontend
- Displays toast notifications with results
- Shows error count if any failures
- Logs detailed errors to console
- User-friendly error messages
- Modal closes on success

## Use Cases

### 1. Development Reset
Clear test data and start fresh during development:
- Reset after testing
- Clean slate for new features
- Remove mock data

### 2. Production Data Wipe
Safely clear customer data when needed:
- Customer account deletion request
- GDPR compliance
- End of contract

### 3. Template Reset
Reset template projects to initial state:
- Demo accounts
- Training environments
- Starter templates

### 4. Accidental Data Fix
Recover from bad imports or scripts:
- Failed migration rollback
- Bad bulk import
- Script error recovery

## Files Modified

### Backend
1. `src/controllers/ProjectsController.ts`
   - Added `initialize()` method
   - Added `resetProject()` method
   - Imports for S3 operations

2. `src/routers/ProjectsRouter.ts`
   - Added reset route

3. `src/Server.ts`
   - Initialize ProjectsController with pool

### Frontend
4. `frontend/src/constants/ApiRoutes.ts`
   - Added `RESET` route

5. `frontend/src/stores/data/useProjectStore.ts`
   - Added `resetProject()` method

6. `frontend/src/components/modals/ResetProjectModal.tsx`
   - New 3-step confirmation modal

7. `frontend/src/components/ComponentsIndex.tsx`
   - Export ResetProjectModal

8. `frontend/src/pages/user/dashboard/settings/ProjectSettingsTab.tsx`
   - Integrated reset functionality
   - Updated Danger Zone UI
   - Added reset handler

## API Reference

### Reset Project

**Endpoint:** `POST /api/projects/reset/:id`

**Authentication:** Required (JWT token)

**Authorization:** Admin or Dev role in project

**Parameters:**
- `id` (path): Project ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Project reset successfully. Dropped 15 tables and deleted 203 files.",
  "data": {
    "droppedTables": 15,
    "deletedFiles": 203,
    "errorCount": 0,
    "errors": []
  }
}
```

**Success with Warnings (200):**
```json
{
  "success": true,
  "message": "Project reset completed with warnings. Dropped 15 tables, deleted 200 files, 3 errors occurred.",
  "data": {
    "droppedTables": 15,
    "deletedFiles": 200,
    "errorCount": 3,
    "errors": [
      "Failed to delete file.txt: Access denied",
      "Failed to drop table_x: Foreign key constraint",
      "..."
    ]
  }
}
```

**Error Responses:**
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (insufficient permissions)
- `404`: Project not found
- `500`: Internal server error

## Testing Checklist

- ✅ Backend endpoint exists and requires auth
- ✅ Permission check works (admin/dev only)
- ✅ Tables are dropped correctly
- ✅ Files are deleted from storage
- ✅ Counts are accurate
- ✅ Errors are tracked
- ✅ WebSocket events are emitted
- ✅ Modal has 3 steps
- ✅ Type-to-confirm works
- ✅ Toast shows results
- ✅ Loading states work
- ✅ Can't double-click
- ✅ Modal closes on success

## Best Practices

1. **Always Backup:** Take a backup before resetting production projects
2. **Communicate:** Notify team members before resetting shared projects
3. **Verify Intent:** Use the type-to-confirm carefully
4. **Check Results:** Review the toast notification for any errors
5. **Monitor Logs:** Check backend logs for detailed error information

## Future Enhancements

Potential improvements:

1. **Backup Before Reset:** Automatic backup creation before reset
2. **Selective Reset:** Option to reset database OR storage separately
3. **Scheduled Reset:** Schedule resets for specific times
4. **Reset Templates:** Save reset configurations as templates
5. **Audit Log:** Track who reset what and when
6. **Email Notifications:** Notify team members of reset operations
7. **Undo Window:** Brief window to cancel/undo reset
8. **Reset Stats:** Track reset frequency and patterns

## Troubleshooting

### Reset Button Disabled
- Check your role (must be admin or dev)
- Verify project membership
- Refresh the page

### Reset Takes Too Long
- Large projects with many tables/files take longer
- Check backend logs for progress
- Wait for completion (can take several minutes)

### Partial Reset
- Some errors may occur during reset
- Check toast notification for error count
- Review backend logs for details
- Remaining items may need manual cleanup

### Permission Denied
- Only admins and devs can reset
- Viewers cannot perform resets
- Contact project admin for access

