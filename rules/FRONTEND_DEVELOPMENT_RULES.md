# Frontend Development Rules for Skaftin Platform

## 📁 Project Structure Rules

### 1. Component Organization
- **All reusable components** must be exported via `@ComponentsIndex.ts`
- **Component files** should be in `src/components/` with proper categorization
- **Page components** go in `src/pages/` and are not exported via ComponentsIndex

### 2. Props & TypeScript
- **All props** passed to components must be **explicitly typed**
- **No implicit any types** - always define interfaces for props
- **Optional props** should be clearly marked with `?`

### 3. File Structure & Spacing
```typescript
// 1. Imports (grouped by type)
import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

// 2. Two spaces after imports

// 3. Type definitions
interface ComponentProps {
  title: string;
  optional?: boolean;
}

// 4. Store variables (labeled)
const { user, setUser, theme } = useAppStore();

// 5. State variables (labeled and grouped)
const [isLoading, setIsLoading] = useState(false);
const [data, setData] = useState<DataType[]>([]);
const [error, setError] = useState<string | null>(null);

// 6. Component definition
const ComponentName = ({ title, optional }: ComponentProps) => {
  // Component logic here
};
```

## 🗂️ Directory Structure

```
src/
├── components/
│   ├── forms/           # Form components
│   ├── modals/          # Modal components  
│   ├── layouts/         # Layout components
│   ├── sidebar/         # Sidebar components
│   ├── elements/        # Basic UI elements
│   └── ComponentsIndex.ts
├── pages/               # Page components (not exported)
├── store/               # State management
├── hooks/               # Custom hooks
├── utils/               # Utility functions
└── types/               # TypeScript type definitions
```

## 📝 Component Categories

### Forms
- `AppButton` - Reusable button component
- `AppInput` - Input field component
- `AppSelect` - Select dropdown component

### Modals
- `CreateProjectModal` - Project creation modal
- `ConfirmModal` - Confirmation dialogs

### Layouts
- `AppLayout` - Main application layout
- `AuthLayout` - Authentication pages layout

### Sidebar
- `Sidebar` - Main navigation sidebar
- `SidebarItem` - Individual sidebar items

### Elements
- `LoadingSpinner` - Loading indicators
- `ErrorMessage` - Error display components

## 🎯 Development Guidelines

### 1. Component Creation Checklist
- [ ] Create component file in appropriate category folder
- [ ] Define explicit prop interfaces
- [ ] Add proper TypeScript types
- [ ] Export via ComponentsIndex.ts
- [ ] Follow spacing rules (2 spaces after imports)
- [ ] Label stores and state variables

### 2. Props Interface Pattern
```typescript
interface ComponentProps {
  // Required props
  title: string;
  onAction: () => void;
  
  // Optional props
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}
```

### 3. State Management Pattern
```typescript
// Store variables (labeled)
const { user, setUser, theme, setTheme } = useAppStore();

// Local state (grouped by purpose)
const [isLoading, setIsLoading] = useState(false);
const [isVisible, setIsVisible] = useState(true);

const [data, setData] = useState<DataType[]>([]);
const [selectedItem, setSelectedItem] = useState<DataType | null>(null);
```

### 4. Component Export Pattern
```typescript
// In ComponentsIndex.ts
export { default as ComponentName } from './category/ComponentName';
```

## 🚀 Best Practices

1. **Always use TypeScript** - No implicit any types
2. **Component composition** - Build complex UIs from simple components
3. **Props drilling prevention** - Use stores for shared state
4. **Consistent naming** - PascalCase for components, camelCase for props
5. **Documentation** - Add JSDoc comments for complex components
6. **Error boundaries** - Wrap components that might fail
7. **Loading states** - Always handle loading and error states
8. **Accessibility** - Include proper ARIA labels and keyboard navigation

## 📋 Code Review Checklist

- [ ] Component exported via ComponentsIndex.ts
- [ ] All props explicitly typed
- [ ] Proper spacing (2 spaces after imports)
- [ ] Store variables labeled
- [ ] State variables grouped and labeled
- [ ] No TypeScript errors
- [ ] Proper error handling
- [ ] Loading states implemented
- [ ] Accessibility considerations
