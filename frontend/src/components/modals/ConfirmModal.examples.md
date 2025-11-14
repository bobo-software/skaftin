# ConfirmModal Component - Usage Guide

A lightweight, reusable confirmation modal for simple yes/no prompts across the application.

## Import

```tsx
import { ConfirmModal } from '../components/ComponentsIndex';
// or
import ConfirmModal from '../components/modals/ConfirmModal';
```

## Basic Usage

### Simple Confirmation

```tsx
const [showConfirm, setShowConfirm] = useState(false);

<ConfirmModal
  isOpen={showConfirm}
  heading="Delete Item"
  text="Are you sure you want to delete this item? This action cannot be undone."
  onCancel={() => setShowConfirm(false)}
  onConfirm={handleDelete}
/>
```

## Props Reference

### Required Props

- **`isOpen`** (boolean) - Controls modal visibility
- **`heading`** (string) - Modal title/heading
- **`text`** (string) - Confirmation message
- **`onCancel`** (function) - Called when user cancels or closes
- **`onConfirm`** (function) - Called when user confirms

### Optional Props

- **`confirmText`** (string, default: `'Confirm'`) - Text for confirm button
- **`cancelText`** (string, default: `'Cancel'`) - Text for cancel button
- **`variant`** ('danger' | 'warning' | 'info', default: `'warning'`) - Visual style
- **`loading`** (boolean, default: `false`) - Shows loading state on confirm button

## Variants

### Danger (Red)
For destructive actions like delete:

```tsx
<ConfirmModal
  isOpen={showDelete}
  heading="Delete Project"
  text="Are you sure you want to permanently delete this project? All data will be lost."
  onCancel={() => setShowDelete(false)}
  onConfirm={handleDeleteProject}
  variant="danger"
  confirmText="Delete"
/>
```

### Warning (Orange)
For potentially risky actions:

```tsx
<ConfirmModal
  isOpen={showReset}
  heading="Reset Database"
  text="This will clear all tables. Are you sure you want to continue?"
  onCancel={() => setShowReset(false)}
  onConfirm={handleReset}
  variant="warning"
  confirmText="Reset"
/>
```

### Info (Blue)
For informational confirmations:

```tsx
<ConfirmModal
  isOpen={showGenerate}
  heading="Generate API Key"
  text="This will create a new API key for your project. You'll need to store it securely."
  onCancel={() => setShowGenerate(false)}
  onConfirm={handleGenerate}
  variant="info"
  confirmText="Generate"
/>
```

## With Loading State

```tsx
const [isDeleting, setIsDeleting] = useState(false);

const handleDelete = async () => {
  setIsDeleting(true);
  try {
    await deleteItem();
    setShowConfirm(false);
  } finally {
    setIsDeleting(false);
  }
};

<ConfirmModal
  isOpen={showConfirm}
  heading="Delete Item"
  text="Are you sure?"
  onCancel={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  loading={isDeleting}
  variant="danger"
/>
```

## Real-World Examples

### Delete Confirmation

```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

const handleDeleteClick = () => {
  setShowDeleteConfirm(true);
};

const handleDeleteConfirm = async () => {
  await deleteResource();
  setShowDeleteConfirm(false);
  ToastUtils.success('Deleted successfully');
};

<button onClick={handleDeleteClick}>Delete</button>

<ConfirmModal
  isOpen={showDeleteConfirm}
  heading="Delete Resource"
  text="This will permanently delete the resource and cannot be undone."
  onCancel={() => setShowDeleteConfirm(false)}
  onConfirm={handleDeleteConfirm}
  variant="danger"
  confirmText="Delete"
/>
```

### Regenerate Key

```tsx
<ConfirmModal
  isOpen={showRegenerate}
  heading="Regenerate API Key"
  text="The old key will stop working immediately. Update your applications before confirming."
  onCancel={() => setShowRegenerate(false)}
  onConfirm={handleRegenerate}
  variant="warning"
  confirmText="Regenerate"
  cancelText="Keep Current Key"
/>
```

### Publish Action

```tsx
<ConfirmModal
  isOpen={showPublish}
  heading="Publish Changes"
  text="Your changes will be deployed to production. Continue?"
  onCancel={() => setShowPublish(false)}
  onConfirm={handlePublish}
  variant="info"
  confirmText="Publish Now"
  cancelText="Go Back"
  loading={isPublishing}
/>
```

### Leave Page Warning

```tsx
const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

const handleNavigateAway = () => {
  if (hasUnsavedChanges) {
    setShowLeaveConfirm(true);
  } else {
    navigate('/other-page');
  }
};

<ConfirmModal
  isOpen={showLeaveConfirm}
  heading="Unsaved Changes"
  text="You have unsaved changes. Are you sure you want to leave?"
  onCancel={() => setShowLeaveConfirm(false)}
  onConfirm={() => navigate('/other-page')}
  variant="warning"
  confirmText="Leave"
  cancelText="Stay"
/>
```

## Visual Variants

### Danger (Red)
- **Icon:** Red warning triangle
- **Background:** Red with dark mode support
- **Button:** Red
- **Use for:** Delete, remove, destroy actions

### Warning (Orange)
- **Icon:** Orange warning triangle
- **Background:** Orange with dark mode support
- **Button:** Orange
- **Use for:** Reset, clear, potentially risky actions

### Info (Blue)
- **Icon:** Blue warning triangle
- **Background:** Blue with dark mode support
- **Button:** Primary green
- **Use for:** Generate, create, informational confirmations

## Features

- ✅ Clean, minimal design
- ✅ Dark mode support
- ✅ Loading states
- ✅ Disabled states
- ✅ Can't close during loading
- ✅ ESC key support (via onCancel)
- ✅ Backdrop click to close
- ✅ Responsive design
- ✅ Consistent with app design system

## State Management Pattern

```tsx
const MyComponent = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await performAction();
      setShowConfirm(false);
      ToastUtils.success('Success!');
    } catch (error) {
      ToastUtils.error('Failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button onClick={handleAction}>Trigger Action</button>
      
      <ConfirmModal
        isOpen={showConfirm}
        heading="Confirm Action"
        text="Are you sure?"
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        loading={isProcessing}
      />
    </>
  );
};
```

## When to Use ConfirmModal

✅ **Use ConfirmModal for:**
- Simple yes/no confirmations
- Quick action confirmations
- Single-step confirmations
- Standard confirmation dialogs

❌ **Don't use ConfirmModal for:**
- Multi-step processes (use custom modals)
- Forms with input fields (use custom modals)
- Complex workflows (use custom modals)
- Type-to-confirm scenarios (use ResetProjectModal pattern)

## Comparison with Other Modals

| Feature | ConfirmModal | DeleteConfirmModal | ResetProjectModal |
|---------|--------------|-------------------|-------------------|
| **Complexity** | Simple | Medium | Complex |
| **Steps** | Single | Single | Multi-step |
| **Use Case** | General | Delete items | Reset projects |
| **Input Required** | No | No | Yes (type to confirm) |
| **Variants** | 3 (danger, warning, info) | Delete-specific | Reset-specific |

## Best Practices

1. **Clear Heading:** Use action-oriented headings
   ```tsx
   // Good
   heading="Delete User"
   heading="Regenerate Key"
   
   // Avoid
   heading="Are you sure?"
   heading="Confirmation"
   ```

2. **Explicit Text:** Explain consequences clearly
   ```tsx
   // Good
   text="The old key will stop working immediately."
   
   // Avoid
   text="This will do something."
   ```

3. **Action Buttons:** Use action verbs
   ```tsx
   // Good
   confirmText="Delete"
   confirmText="Regenerate"
   
   // Avoid
   confirmText="OK"
   confirmText="Yes"
   ```

4. **Choose Right Variant:**
   - `danger`: Destructive, permanent actions
   - `warning`: Risky but recoverable actions
   - `info`: Safe, informational confirmations

5. **Loading States:** Always show loading for async actions
   ```tsx
   loading={isProcessing}
   ```

## Accessibility

- ✅ Semantic HTML
- ✅ Keyboard navigation (Tab, Enter, ESC)
- ✅ Focus management
- ✅ Screen reader friendly
- ✅ Disabled states prevent double-clicks

## Customization

### Custom Button Text

```tsx
<ConfirmModal
  confirmText="Yes, Delete It"
  cancelText="No, Keep It"
  ...
/>
```

### Different Variant Colors

The modal automatically applies colors based on variant:
- No custom styling needed
- Consistent across the app
- Dark mode handled automatically

## Migration from window.confirm()

**Old:**
```tsx
const handleDelete = () => {
  if (window.confirm('Are you sure?')) {
    deleteItem();
  }
};
```

**New:**
```tsx
const [showConfirm, setShowConfirm] = useState(false);

const handleDelete = () => {
  setShowConfirm(true);
};

const handleConfirmDelete = async () => {
  await deleteItem();
  setShowConfirm(false);
};

<ConfirmModal
  isOpen={showConfirm}
  heading="Delete Item"
  text="Are you sure you want to delete this item?"
  onCancel={() => setShowConfirm(false)}
  onConfirm={handleConfirmDelete}
  variant="danger"
/>
```

## Complete Example

```tsx
import { useState } from 'react';
import { ConfirmModal } from '../components/ComponentsIndex';
import ToastUtils from '../utils/ToastUtils';

const UserManagement = () => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (userId: number) => {
    setUserToDelete(userId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteUser(userToDelete);
      ToastUtils.success('User deleted successfully');
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      refreshUsers();
    } catch (error) {
      ToastUtils.error('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button onClick={() => handleDeleteClick(123)}>
        Delete User
      </button>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        heading="Delete User"
        text="This user will be permanently removed from the system. This action cannot be undone."
        onCancel={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        confirmText="Delete User"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
};
```

