# Cursor MCP Integration Guide

## Overview

The Cursor Integration modal provides a step-by-step guide for users to connect their Skaftin project to Cursor AI using the MCP (Model Context Protocol) key.

## Features

### CursorIntegrationModal Component

A comprehensive guide modal that:
- ✅ Shows 5-step integration instructions
- ✅ Displays the user's MCP key with copy button
- ✅ Provides ready-to-use JSON configuration
- ✅ Auto-fills project ID and API URL from environment
- ✅ Includes troubleshooting tips
- ✅ Links to Cursor MCP documentation
- ✅ Beautiful UI with purple theme matching MCP branding

### Integration in CredentialsTab

Added **"Cursor Setup"** button in the MCP key section that:
- Appears in the blue info box when MCP key exists
- Opens the integration guide modal
- Provides complete configuration instructions
- Makes Cursor integration super easy

## User Flow

1. **Generate MCP Key** (if not already done)
   - Click "Generate MCP Key"
   - Confirm in modal
   - Key is created and displayed

2. **Open Integration Guide**
   - Click "Cursor Setup" button
   - Modal opens with step-by-step instructions

3. **Follow the Steps**
   - **Step 1:** Copy your MCP key
   - **Step 2:** Locate `.cursor/mcp.json` file
   - **Step 3:** Copy the full JSON configuration
   - **Step 4:** Update any placeholder values
   - **Step 5:** Restart Cursor

4. **Start Using**
   - Cursor AI now has access to Skaftin tools
   - Can query databases, manage files, etc.

## Configuration Details

### Backend URL Source

The backend URL is read from `VITE_API_URL` environment variable:
- **Development:** `http://localhost:4006` (from `frontend/.env`)
- **Production:** Set in `frontend/.env` to your live URL

**Important:** For production deployment, update `frontend/.env`:
```bash
VITE_API_URL=https://skaftinplatform.bobosoftware.co.za
```

### MCP Configuration Format

```json
{
  "mcpServers": {
    "skaftin": {
      "command": "node",
      "args": ["/path/to/skaftin-mcp-server/index.js"],
      "env": {
        "SKAFTIN_API_URL": "http://localhost:4006",
        "SKAFTIN_PROJECT_ID": "123",
        "SKAFTIN_MCP_KEY": "mcp_abc123..."
      }
    }
  }
}
```

### Environment Variables

The configuration uses three key environment variables:
1. **SKAFTIN_API_URL** - Backend API endpoint
2. **SKAFTIN_PROJECT_ID** - Your project ID
3. **SKAFTIN_MCP_KEY** - Your MCP authentication key

## UI Features

### Visual Design
- Purple/blue color scheme (MCP branding)
- 5 numbered steps with visual indicators
- Code blocks with syntax highlighting
- Copy buttons with feedback
- Info boxes for additional context
- Troubleshooting section
- External documentation link

### Interactive Elements
1. **Copy MCP Key Button** - Quick clipboard copy
2. **Copy Full Config Button** - Copy entire JSON
3. **External Link** - Opens Cursor MCP docs
4. **Close Button** - Dismiss modal

### States
- Default state showing all steps
- Copied feedback (checkmarks)
- Dark mode support throughout

## Benefits for Users

When configured, users get:
- ✅ AI can read and query database tables
- ✅ AI can manage storage files
- ✅ AI can send emails via configured providers
- ✅ AI can execute GraphQL queries
- ✅ Full project management capabilities

## Technical Implementation

### Component Props

```typescript
interface CursorIntegrationModalProps {
  isOpen: boolean;      // Modal visibility
  onClose: () => void;  // Close handler
  mcpKey: string;       // User's MCP key
  projectId: string;    // Current project ID
}
```

### Environment Variable Usage

```typescript
const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4006';
```

This ensures:
- Development uses `localhost:4006`
- Production uses configured URL
- Falls back to localhost if not set
- Consistent with rest of the app

### Copy to Clipboard

Two copy functions:
1. `handleCopyKey()` - Copies just the MCP key
2. `handleCopyConfig()` - Copies entire JSON configuration

Both provide visual feedback with checkmarks.

## Files Modified

1. **frontend/src/components/modals/CursorIntegrationModal.tsx** - New component
2. **frontend/src/components/ComponentsIndex.tsx** - Export added
3. **frontend/src/components/settings/CredentialsTab.tsx** - Added button and modal
4. **frontend/.env** - Set VITE_API_URL explicitly
5. **root/.env** - Added production note

## Production Deployment

When deploying to production:

### 1. Update Frontend Environment
Edit `frontend/.env`:
```bash
VITE_API_URL=https://skaftinplatform.bobosoftware.co.za
VITE_WS_URL=wss://skaftinplatform.bobosoftware.co.za
```

### 2. Rebuild Frontend
```bash
cd frontend
npm run build
```

### 3. Users Get Correct URL
The Cursor integration modal will automatically show the production URL in the configuration.

## Troubleshooting

### Modal Shows Wrong URL
- Check `frontend/.env` has correct `VITE_API_URL`
- Rebuild frontend after changing env vars
- Clear browser cache

### Copy Buttons Don't Work
- Browser may block clipboard API
- Use HTTPS in production
- Grant clipboard permissions

### Configuration Not Working
- Verify backend URL is accessible
- Check MCP key is correct
- Ensure project ID matches
- Restart Cursor after config changes

## Example Configurations

### Development (Go MCP over HTTP)
```json
{
  "mcpServers": {
    "skaftin": {
      "url": "http://localhost:4006/app-api/mcp/protocol",
      "headers": {
        "x-api-key": "sk_your_project_api_key_here"
      }
    }
  }
}
```

### Production (Go MCP over HTTP)
```json
{
  "mcpServers": {
    "skaftin": {
      "url": "https://skaftinplatform.bobosoftware.co.za/app-api/mcp/protocol",
      "headers": {
        "x-api-key": "sk_prod_project_api_key_here"
      }
    }
  }
}
```

## Future Enhancements

- One-click install MCP server
- Auto-detect Cursor installation
- Test connection button
- Configuration validator
- Multiple environment presets
- Export configuration file
- QR code for mobile sharing

## Related Documentation

- [MCP_KEY_FEATURE.md](./MCP_KEY_FEATURE.md) - MCP key system details
- [Cursor MCP Docs](https://docs.cursor.com/context/context-mcp) - Official Cursor documentation

