# MCP Integration Key Feature

## Overview

Implemented a dedicated MCP (Model Context Protocol) key system that allows projects to securely connect to MCP tools and services. Each project can have one MCP key that provides full access to all MCP capabilities.

## Features

### Backend Implementation

#### CredentialsController Updates

**New Methods:**

1. **`getMcpKey()`** - Get the MCP key for a project
   - `GET /api/credentials/:projectId/mcp-key`
   - Returns existing MCP key or 404 if not found

2. **`regenerateMcpKey()`** - Create or regenerate MCP key
   - `POST /api/credentials/:projectId/mcp-key/regenerate`
   - Creates new key if none exists
   - Updates existing key with new token
   - Resets `last_used_at` timestamp

3. **`generateMcpKey()`** - Private method
   - Generates secure random key: `mcp_[64 hex characters]`
   - Uses `crypto.randomBytes(32)`

**Key Characteristics:**
- ✅ One MCP key per project (enforced)
- ✅ Full access permissions (`mcp:full_access`)
- ✅ Never expires (no expiration date)
- ✅ Can be regenerated at any time
- ✅ Always active by default
- ✅ Named "MCP Integration Key"

**Updated Types:**
```typescript
credential_type: 'api_key' | 'access_token' | 'mcp_key'
```

**New Permission Category:**
```typescript
mcp: ['mcp:full_access']
```

#### CredentialsRouter Updates

Added two new routes:
```typescript
router.get('/:projectId/mcp-key', authMiddleware, controller.getMcpKey);
router.post('/:projectId/mcp-key/regenerate', authMiddleware, controller.regenerateMcpKey);
```

### Frontend Implementation

#### 1. API Routes (`ApiRoutes.ts`)

Added routes:
```typescript
GET_MCP_KEY: (projectId: string) => `/api/credentials/${projectId}/mcp-key`
REGENERATE_MCP_KEY: (projectId: string) => `/api/credentials/${projectId}/mcp-key/regenerate`
```

#### 2. CredentialsService

**New Methods:**

```typescript
// Get MCP key for a project
async getMcpKey(projectId: string): Promise<ApiCredential | null>

// Regenerate or create MCP key
async regenerateMcpKey(projectId: string): Promise<ApiCredential>
```

**Updated Types:**
- `ApiCredential.credential_type` now includes `'mcp_key'`
- `AvailablePermissions` now includes `mcp: string[]`

#### 3. CredentialsTab Component

**New UI Section:**

Added a prominent MCP Integration Key section at the top with:

**When MCP Key Exists:**
- 🎨 Gradient purple/blue background (stands out from regular credentials)
- 🔑 Full key display with show/hide toggle
- 📋 Copy button for quick clipboard access
- 🔄 Regenerate button with confirmation
- 📅 Creation and last used timestamps
- ℹ️ Usage instructions

**When No MCP Key:**
- Clear message about no key
- "Generate MCP Key" button
- Purple gradient styling

**Visual Design:**
- Purple/blue gradient background
- Sparkles icon for MCP branding
- Separated from regular API credentials
- Eye-catching premium feel
- Dark mode support

### User Experience

#### Viewing MCP Key

1. Navigate to **Settings → API Credentials**
2. MCP key appears in its own section at the top
3. Initially hidden (dots shown)
4. Click eye icon to reveal
5. Click copy button to copy to clipboard
6. See when it was created and last used

#### Generating MCP Key (First Time)

1. Click "Generate MCP Key" button
2. Key is instantly created
3. Auto-revealed after generation
4. Copy prompt via toast notification
5. Ready to use in MCP clients

#### Regenerating MCP Key

1. Click "Regenerate Key" button
2. Confirmation dialog appears: "Are you sure? Old key will stop working"
3. Confirm to proceed
4. New key generated and revealed
5. Old key is immediately invalidated
6. Success notification shown

## Security

### Access Control
- ✅ Authentication required (JWT)
- ✅ Project membership required
- ✅ Same permissions as API credentials

### Key Format
- Prefix: `mcp_`
- Length: 64 hex characters (32 bytes)
- Total: ~68 characters
- Example: `mcp_a1b2c3d4e5f6...` (32 bytes hex encoded)

### Best Practices
- One key per project (prevents confusion)
- No expiration (MCP integrations need stability)
- Full access (MCP needs comprehensive project access)
- Easy regeneration (if compromised)

## Use Cases

### 1. AI Code Assistant Integration
Connect Cursor or other AI tools to project:
```json
{
  "mcp": {
    "server": "skaftin",
    "endpoint": "https://api.skaftin.com",
    "projectId": "123",
    "mcpKey": "mcp_abc123..."
  }
}
```

### 2. Automated Workflows
Use MCP key for automated scripts:
```bash
export SKAFTIN_MCP_KEY="mcp_abc123..."
export SKAFTIN_PROJECT_ID="123"
```

### 3. CI/CD Integration
Configure deployment pipelines:
```yaml
env:
  SKAFTIN_MCP_KEY: ${{ secrets.SKAFTIN_MCP_KEY }}
  PROJECT_ID: "123"
```

### 4. Third-Party Integrations
Connect external tools that support MCP protocol

## API Reference

### Get MCP Key

**Endpoint:** `GET /api/credentials/:projectId/mcp-key`

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "project_id": 123,
    "name": "MCP Integration Key",
    "credential_type": "mcp_key",
    "token": "mcp_a1b2c3...",
    "permissions": ["mcp:full_access"],
    "is_active": true,
    "created_at": "2025-11-09T10:30:00Z",
    "last_used_at": "2025-11-09T15:45:00Z",
    "created_by": "user_123"
  }
}
```

**Response (404):**
```json
{
  "success": false,
  "error": "No MCP key found for this project",
  "data": null
}
```

### Regenerate MCP Key

**Endpoint:** `POST /api/credentials/:projectId/mcp-key/regenerate`

**Authentication:** Required

**Response (200 or 201):**
```json
{
  "success": true,
  "message": "MCP key regenerated successfully",
  "data": {
    "id": 42,
    "token": "mcp_new_token_here...",
    ...
  }
}
```

## Differences from Regular API Credentials

| Feature | API Keys | Access Tokens | MCP Keys |
|---------|----------|---------------|----------|
| **Quantity** | Multiple per project | Multiple per project | **One per project** |
| **Permissions** | Customizable | Customizable | **Full access only** |
| **Expiration** | Optional | Optional | **Never expires** |
| **UI Location** | Credentials list | Credentials list | **Dedicated section** |
| **Purpose** | REST API access | Client apps | **MCP integration** |
| **Prefix** | `sk_` | `sat_` | **`mcp_`** |
| **Revocable** | Yes (delete) | Yes (delete) | **Yes (regenerate)** |
| **Visual Design** | Standard | Standard | **Purple gradient** |

## Configuration Examples

### Cursor MCP Configuration

Add to your `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "skaftin": {
      "url": "https://api.skaftin.com/api/mcp",
      "headers": {
        "Authorization": "Bearer mcp_your_key_here",
        "X-Project-ID": "your_project_id"
      }
    }
  }
}
```

### Environment Variables

```bash
# .env file
SKAFTIN_MCP_KEY=mcp_your_key_here
SKAFTIN_PROJECT_ID=123
SKAFTIN_API_URL=https://api.skaftin.com
```

### Code Usage

```typescript
import { MCPClient } from '@skaftin/mcp-client';

const client = new MCPClient({
  apiUrl: process.env.SKAFTIN_API_URL,
  projectId: process.env.SKAFTIN_PROJECT_ID,
  mcpKey: process.env.SKAFTIN_MCP_KEY,
});

// Use MCP tools
await client.database.query('SELECT * FROM users');
await client.storage.listFiles();
```

## UI Components

### MCP Key Section Design

**Colors:**
- Background: Purple-to-blue gradient
- Border: Purple (2px)
- Icon background: Purple
- Buttons: Purple
- Text: Dark with purple accents

**Layout:**
- Positioned above regular credentials
- Full-width card
- Prominent "Sparkles" icon
- Clear call-to-action

**States:**
- Empty: Shows "Generate MCP Key" button
- Generated: Shows key with controls
- Loading: Shows spinner on regenerate button
- Copied: Shows checkmark briefly

## Files Modified

### Backend
1. `src/controllers/CredentialsController.ts`
   - Added `generateMcpKey()` method
   - Added `getMcpKey()` method
   - Added `regenerateMcpKey()` method
   - Updated `createCredential()` to support `mcp_key`
   - Added `AVAILABLE_PERMISSIONS.mcp`

2. `src/routers/CredentialsRouter.ts`
   - Added `/mcp-key` GET route
   - Added `/mcp-key/regenerate` POST route

### Frontend
3. `frontend/src/constants/ApiRoutes.ts`
   - Added `GET_MCP_KEY` route
   - Added `REGENERATE_MCP_KEY` route

4. `frontend/src/services/CredentialsService.ts`
   - Updated `ApiCredential` type
   - Updated `CreateCredentialRequest` type
   - Updated `AvailablePermissions` type
   - Added `getMcpKey()` method
   - Added `regenerateMcpKey()` method

5. `frontend/src/components/settings/CredentialsTab.tsx`
   - Added MCP key state management
   - Added MCP key UI section
   - Added regenerate functionality
   - Added copy to clipboard for MCP key
   - Added show/hide toggle for MCP key
   - Filters MCP key from regular credentials list

## Security Considerations

### Key Storage
- Keys are stored in database (api_credentials table)
- Not encrypted at rest (like other credentials)
- Protected by authentication and authorization

### Key Rotation
- Easy regeneration process
- Old key invalidated immediately
- No grace period (prevent key leakage)

### Permission Model
- MCP keys have full access by default
- Cannot customize permissions (by design)
- Simplifies MCP integration

## Testing Checklist

- ✅ Generate MCP key (first time)
- ✅ View MCP key
- ✅ Hide MCP key
- ✅ Copy MCP key to clipboard
- ✅ Regenerate MCP key (with confirmation)
- ✅ Old key stops working after regeneration
- ✅ MCP key appears separate from regular credentials
- ✅ Loading states work correctly
- ✅ Toast notifications appear
- ✅ Dark mode styling looks good
- ✅ Only one MCP key per project enforced

## Future Enhancements

Potential improvements:

1. **MCP Key Rotation:** Automatic key rotation on schedule
2. **Usage Analytics:** Track MCP API calls and usage patterns
3. **Rate Limiting:** Implement rate limits specific to MCP keys
4. **Scoped Permissions:** Allow fine-grained MCP permissions
5. **Key Versioning:** Support multiple active MCP keys with versioning
6. **Audit Log:** Track MCP key usage and operations
7. **Integration Testing:** Built-in MCP connection tester
8. **Documentation Links:** In-app links to MCP setup guides

## Troubleshooting

### MCP Key Not Working

1. **Check if key is active:**
   - Look for "Active" badge in UI
   - MCP keys are active by default

2. **Verify key format:**
   - Should start with `mcp_`
   - Followed by 64 hex characters

3. **Check project ID:**
   - MCP key is project-specific
   - Use correct project ID in requests

4. **Regenerate if needed:**
   - Use regenerate button
   - Update MCP client configuration

### Can't Generate MCP Key

- Check authentication (logged in?)
- Verify project access
- Try refreshing the page
- Check browser console for errors

### Copy Not Working

- Browser may block clipboard access
- Grant clipboard permissions
- Try manual copy (select and Ctrl+C)

## Migration Notes

### From Previous System

If you previously used regular API keys for MCP:

1. Generate new MCP key in Credentials tab
2. Update MCP client configuration
3. Remove old API key if no longer needed
4. Test MCP integration

### Database Migration

No database migration required:
- Uses existing `api_credentials` table
- New `credential_type` value: `mcp_key`
- Automatically handled by application code

## Support

For issues with MCP integration:
1. Check this documentation
2. Verify MCP key in Credentials tab
3. Test key with MCP client
4. Check backend logs for errors
5. Regenerate key if suspected compromise

