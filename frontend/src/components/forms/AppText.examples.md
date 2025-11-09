# AppText Component - Usage Guide

A flexible, Tailwind-based text component for consistent typography across the application. Supports dark mode, semantic HTML, and extensive customization.

## Import

```tsx
import { AppText } from '../components/ComponentsIndex';
// or
import AppText from '../components/forms/AppText';
```

## Basic Usage

### Default Text
```tsx
<AppText>This is a paragraph of text</AppText>
```

### Headings
```tsx
<AppText as="h1" size="4xl" weight="bold">
  Main Heading
</AppText>

<AppText as="h2" size="3xl" weight="semibold">
  Section Heading
</AppText>

<AppText as="h3" size="2xl" weight="semibold">
  Subsection Heading
</AppText>
```

### Text Variants
```tsx
// Primary colored text
<AppText color="primary" weight="semibold">
  Primary Action Text
</AppText>

// Muted text for descriptions
<AppText color="muted" size="sm">
  This is a description or helper text
</AppText>

// Error text
<AppText color="error" size="sm">
  Invalid input provided
</AppText>

// Success message
<AppText color="success" weight="medium">
  Operation completed successfully!
</AppText>
```

## Props Reference

### Element Type (`as`)
Choose the semantic HTML element:
- `'p'` (default) - Paragraph
- `'span'` - Inline text
- `'div'` - Block element
- `'h1'` to `'h6'` - Headings
- `'label'` - Form label

```tsx
<AppText as="label" htmlFor="email" size="sm" weight="medium">
  Email Address
</AppText>
```

### Size (`size`)
Available sizes:
- `'xs'` - 12px - Fine print
- `'sm'` - 14px - Small text, descriptions
- `'base'` - 16px (default) - Body text
- `'lg'` - 18px - Large body text
- `'xl'` - 20px - Small headings
- `'2xl'` - 24px - Medium headings
- `'3xl'` - 30px - Large headings
- `'4xl'` - 36px - Extra large headings
- `'5xl'` - 48px - Hero text

```tsx
<AppText size="xs">Fine print text</AppText>
<AppText size="sm">Small text</AppText>
<AppText size="base">Normal text</AppText>
<AppText size="2xl">Heading text</AppText>
```

### Weight (`weight`)
Font weights:
- `'thin'` - 100
- `'extralight'` - 200
- `'light'` - 300
- `'normal'` - 400 (default)
- `'medium'` - 500
- `'semibold'` - 600
- `'bold'` - 700
- `'extrabold'` - 800
- `'black'` - 900

```tsx
<AppText weight="light">Light text</AppText>
<AppText weight="medium">Medium weight</AppText>
<AppText weight="bold">Bold text</AppText>
```

### Color (`color`)
Color variants with automatic dark mode support:
- `'default'` - Dark text (light mode) / White text (dark mode)
- `'primary'` - Brand primary color
- `'secondary'` - Brand secondary color
- `'muted'` - Less emphasized text
- `'subtle'` - Very subtle text
- `'disabled'` - Disabled state text
- `'success'` - Success/positive messages
- `'warning'` - Warning messages
- `'error'` - Error/danger messages
- `'info'` - Information messages
- `'white'` - Always white
- `'black'` - Always black

```tsx
<AppText color="default">Standard text</AppText>
<AppText color="primary">Brand colored text</AppText>
<AppText color="muted">Secondary information</AppText>
<AppText color="error">Error message</AppText>
```

### Alignment (`align`)
- `'left'` (default)
- `'center'`
- `'right'`
- `'justify'`

```tsx
<AppText align="center">Centered text</AppText>
<AppText align="right">Right-aligned text</AppText>
```

### Text Modifiers

```tsx
// Truncate long text with ellipsis
<AppText truncate>
  This is a very long text that will be truncated with ellipsis...
</AppText>

// Italic
<AppText italic>Italic text</AppText>

// Underline
<AppText underline>Underlined text</AppText>

// Line through
<AppText lineThrough>Strikethrough text</AppText>

// Text transform
<AppText uppercase>uppercase text</AppText>
<AppText lowercase>LOWERCASE TEXT</AppText>
<AppText capitalize>capitalize first letter</AppText>
```

### Custom Styling

Add additional Tailwind classes:
```tsx
<AppText className="mb-4 leading-relaxed">
  Text with custom spacing and line height
</AppText>

<AppText className="bg-primary-50 dark:bg-primary-900 p-4 rounded-lg">
  Text with background
</AppText>
```

### Events

```tsx
<AppText onClick={() => console.log('Clicked!')}>
  Clickable text (cursor-pointer is added automatically)
</AppText>
```

## Real-World Examples

### Form Label
```tsx
<AppText 
  as="label" 
  htmlFor="username" 
  size="sm" 
  weight="medium"
  className="mb-2"
>
  Username
</AppText>
```

### Card Title with Description
```tsx
<div className="card">
  <AppText as="h3" size="xl" weight="semibold" className="mb-2">
    Database Statistics
  </AppText>
  <AppText color="muted" size="sm">
    Real-time metrics for your project database
  </AppText>
</div>
```

### Status Badge
```tsx
<div className="flex items-center space-x-2">
  <div className="w-2 h-2 rounded-full bg-green-500" />
  <AppText color="success" size="sm" weight="medium">
    Active
  </AppText>
</div>
```

### Error Message
```tsx
<AppText color="error" size="sm" className="mt-1">
  This field is required
</AppText>
```

### Loading Text
```tsx
<div className="flex items-center space-x-2">
  <Loader2 className="w-4 h-4 animate-spin" />
  <AppText color="muted" size="sm">
    Loading data...
  </AppText>
</div>
```

### Hero Section
```tsx
<div className="text-center py-12">
  <AppText 
    as="h1" 
    size="5xl" 
    weight="bold" 
    className="mb-4"
  >
    Welcome to Skaftin
  </AppText>
  <AppText 
    color="muted" 
    size="xl" 
    className="max-w-2xl mx-auto"
  >
    Build powerful applications with PostgreSQL and MinIO
  </AppText>
</div>
```

### Table Header
```tsx
<AppText 
  as="span" 
  size="sm" 
  weight="semibold" 
  color="muted" 
  uppercase
>
  Column Name
</AppText>
```

### Truncated File Name
```tsx
<AppText truncate className="max-w-xs">
  very-long-filename-that-needs-to-be-truncated.txt
</AppText>
```

### Inline Code Style
```tsx
<AppText 
  as="span" 
  size="sm"
  className="bg-dark-100 dark:bg-dark-700 px-2 py-1 rounded font-mono"
>
  npm install
</AppText>
```

## Best Practices

1. **Use Semantic Elements**: Choose the appropriate `as` prop for accessibility
   ```tsx
   // Good
   <AppText as="h1">Page Title</AppText>
   
   // Bad (using default p for heading)
   <AppText size="4xl" weight="bold">Page Title</AppText>
   ```

2. **Consistent Sizing**: Use the predefined sizes for consistency
   ```tsx
   // Good
   <AppText size="sm">Helper text</AppText>
   
   // Avoid custom sizes
   <AppText className="text-[13px]">Helper text</AppText>
   ```

3. **Dark Mode**: Always use the `color` prop for colors (they support dark mode)
   ```tsx
   // Good (dark mode compatible)
   <AppText color="muted">Description</AppText>
   
   // Bad (no dark mode support)
   <AppText className="text-gray-600">Description</AppText>
   ```

4. **Combine with Tailwind**: Use `className` for spacing and layout
   ```tsx
   <AppText color="muted" size="sm" className="mt-2 mb-4">
     Additional styling via className
   </AppText>
   ```

5. **Accessibility**: Use `title` and proper semantic elements
   ```tsx
   <AppText 
     as="label" 
     htmlFor="email"
     title="User email address"
   >
     Email
   </AppText>
   ```

## Migration from Old AppText

Old syntax:
```tsx
<AppText 
  text="Hello World"
  size="medium"
  color="primary"
  weight="large"
/>
```

New syntax:
```tsx
<AppText 
  size="base"
  color="primary"
  weight="bold"
>
  Hello World
</AppText>
```

### Key Changes:
1. Use `children` instead of `text` prop
2. Size values changed: `extraSmall` → `xs`, `small` → `sm`, `medium` → `base`, etc.
3. Weight values changed: `large` → `bold`, `extraLarge` → `extrabold`
4. Color values expanded and now support dark mode
5. Removed inline styles, now uses Tailwind CSS

