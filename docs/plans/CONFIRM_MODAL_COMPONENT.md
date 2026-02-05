# ConfirmModal Component

## Overview

Created a lightweight, reusable confirmation modal component for simple yes/no prompts throughout the application. Provides consistent UX for confirmations with three visual variants.

## Features

### Component Props

```typescript
interface ConfirmModalProps {
  isOpen: boolean;          // Required: Controls visibility
  heading: string;          // Required: Modal title
  text: string;             // Required: Confirmation message
  onCancel: () => void;     // Required: Cancel handler
  onConfirm: () => void;    // Required: Confirm handler
  confirmText?: string;     // Optional: Confirm button text (default: "Confirm")
  cancelText?: string;      // Optional: Cancel button text (default: "Cancel")
  variant?: 'danger' | 'warning' | 'info'; // Optional: Visual style (default: "warning")
  loading?: boolean;        // Optional: Loading state (default: false)
}
```

### Visual Variants

**1. Danger (Red)**
- For destructive, permanent actions
- Examples: Delete, Remove, Destroy
- Red icon, background, and confirm button

**2. Warning (Orange)**
- For risky but recoverable actions
- Examples: Reset, Clear, Regenerate
- Orange icon, background, and confirm button

**3. Info (Blue)**
- For informational confirmations
- Examples: Generate, Create, Proceed
- Blue icon, background, and green confirm button

## Implementation

### File Created
`/frontend/src/components/modals/ConfirmModal.tsx`

### Features
- ✅ Three visual variants (danger, warning, info)
- ✅ Loading states during async operations
- ✅ Disabled states prevent double-clicks
- ✅ Can't be closed during loading
- ✅ Dark mode support
- ✅ Customizable button text
- ✅ Clean, minimal design
- ✅ Consistent with app design system
- ✅ Responsive layout

### Component Exported
Added to `ComponentsIndex.tsx` for easy import

## First Usage: MCP Key Generation

Updated `CredentialsTab.tsx` to use ConfirmModal for MCP key generation/regeneration:

**Before:**
```tsx
if (!window.confirm('Are you sure...')) return;
```

**After:**
```tsx
<ConfirmModal
  isOpen={showMcpConfirm}
  heading={mcpKey ? 'Regenerate MCP Key' : 'Generate MCP Key'}
  text={
    mcpKey
      ? 'Are you sure you want to regenerate the MCP key? The old key will stop working immediately.'
      : 'This will create a new MCP integration key for this project.'
  }
  onCancel={() => setShowMcpConfirm(false)}
  onConfirm={handleRegenerateMcpKey}
  confirmText={mcpKey ? 'Regenerate' : 'Generate'}
  variant={mcpKey ? 'warning' : 'info'}
  loading={mcpKeyLoading}
/>
```

## Usage Patterns

### Basic Delete Confirmation

```tsx
const [showConfirm, setShowConfirm] = useState(false);

<ConfirmModal
  isOpen={showConfirm}
  heading="Delete Item"
  text="Are you sure you want to delete this item?"
  onCancel={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  variant="danger"
  confirmText="Delete"
/>
```

### With Loading State

```tsx
const [isLoading, setIsLoading] = useState(false);

const handleConfirm = async () => {
  setIsLoading(true);
  try {
    await performAction();
    setShowConfirm(false);
  } finally {
    setIsLoading(false);
  }
};

<ConfirmModal
  isOpen={showConfirm}
  heading="Perform Action"
  text="This action will take a few seconds."
  onCancel={() => setShowConfirm(false)}
  onConfirm={handleConfirm}
  loading={isLoading}
/>
```

### Custom Button Text

```tsx
<ConfirmModal
  isOpen={showConfirm}
  heading="Leave Page"
  text="You have unsaved changes. Leave anyway?"
  onCancel={() => setShowConfirm(false)}
  onConfirm={handleLeave}
  confirmText="Leave Page"
  cancelText="Stay Here"
  variant="warning"
/>
```

## Where to Use

### Replace window.confirm() Calls

Search for `window.confirm` and replace with ConfirmModal:

```tsx
// OLD: Browser confirm
if (window.confirm('Delete this?')) {
  deleteItem();
}

// NEW: ConfirmModal
const [showConfirm, setShowConfirm] = useState(false);

<button onClick={() => setShowConfirm(true)}>Delete</button>

<ConfirmModal
  isOpen={showConfirm}
  heading="Delete Item"
  text="Delete this?"
  onCancel={() => setShowConfirm(false)}
  onConfirm={() => {
    deleteItem();
    setShowConfirm(false);
  }}
  variant="danger"
/>
```

### Good Use Cases

- ✅ Simple action confirmations
- ✅ Delete confirmations
- ✅ Regenerate key confirmations
- ✅ Clear data confirmations
- ✅ Leave page warnings
- ✅ Publish/deploy confirmations
- ✅ Enable/disable confirmations

### Not Ideal For

- ❌ Multi-step processes → Use custom modal
- ❌ Forms with inputs → Use custom modal
- ❌ Type-to-confirm → Use ResetProjectModal pattern
- ❌ Complex decisions → Use custom modal

## Benefits

1. **Consistency:** Same look and feel everywhere
2. **Maintainability:** Single component to update
3. **Accessibility:** Built-in keyboard navigation
4. **UX:** Better than browser confirm dialogs
5. **Flexibility:** Three variants for different contexts
6. **Loading States:** Proper async handling
7. **Dark Mode:** Automatic dark theme support
8. **Type Safety:** Full TypeScript support

## Files Modified

1. `frontend/src/components/modals/ConfirmModal.tsx` - New component
2. `frontend/src/components/ComponentsIndex.tsx` - Added export
3. `frontend/src/components/settings/CredentialsTab.tsx` - First usage example
4. `frontend/src/components/modals/ConfirmModal.examples.md` - Usage guide

## Future Enhancements

- Add icon customization prop
- Add custom colors option
- Add size variants (sm, md, lg)
- Add animation options
- Add sound effects
- Add keyboard shortcuts display

## Related Components

- **DeleteConfirmModal:** Specialized for delete operations with counts
- **ResetProjectModal:** Multi-step confirmation with type-to-confirm
- **ConfirmModal:** General purpose, simple confirmation

Choose the right one based on complexity needs!

