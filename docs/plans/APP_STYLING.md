# 🎨 App Styling Guide - Skaftin Platform

## 🌟 Design Philosophy: Retro-Modern

A fusion of nostalgic design elements with contemporary functionality, creating a unique and memorable user experience that feels both familiar and cutting-edge.

## 🎨 Color Palette

### Primary Colors
```css
/* Light Theme */
--primary-green: #32A956;
--primary-green-dark: #2A8F47;
--primary-green-light: #4BC06A;

/* Dark Theme */
--primary-green: #32A956;
--primary-green-dark: #4BC06A;
--primary-green-light: #2A8F47;
```

### Base Colors
```css
/* Light Theme */
--background-primary: #FFFFFF;
--background-secondary: #F8F9FA;
--background-tertiary: #E9ECEF;
--text-primary: #212529;
--text-secondary: #6C757D;
--text-muted: #ADB5BD;

/* Dark Theme */
--background-primary: #0D1117;
--background-secondary: #161B22;
--background-tertiary: #21262D;
--text-primary: #F0F6FC;
--text-secondary: #8B949E;
--text-muted: #6E7681;
```

### Accent Colors
```css
/* Status Colors */
--success: #32A956;
--warning: #FFA500;
--error: #DC3545;
--info: #17A2B8;

/* Interactive States */
--hover-overlay: rgba(50, 169, 86, 0.1);
--active-overlay: rgba(50, 169, 86, 0.2);
--focus-ring: rgba(50, 169, 86, 0.3);
```

## 🔤 Typography

### Font Stack
```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
--font-display: 'Poppins', 'Inter', sans-serif;
```

### Type Scale
```css
/* Headings */
--text-6xl: 3.75rem;    /* 60px - Hero titles */
--text-5xl: 3rem;      /* 48px - Page titles */
--text-4xl: 2.25rem;   /* 36px - Section titles */
--text-3xl: 1.875rem;  /* 30px - Subsection titles */
--text-2xl: 1.5rem;     /* 24px - Card titles */
--text-xl: 1.25rem;     /* 20px - Large text */

/* Body Text */
--text-lg: 1.125rem;   /* 18px - Large body */
--text-base: 1rem;     /* 16px - Base body */
--text-sm: 0.875rem;   /* 14px - Small text */
--text-xs: 0.75rem;    /* 12px - Caption text */
```

### Font Weights
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
```

## 📐 Spacing System

### Base Unit: 8px
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

## 🎭 Component Styles

### Buttons
```css
/* Primary Button */
.btn-primary {
  background: var(--primary-green);
  color: white;
  border: none;
  border-radius: 8px;
  padding: var(--space-3) var(--space-6);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(50, 169, 86, 0.2);
}

.btn-primary:hover {
  background: var(--primary-green-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(50, 169, 86, 0.3);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--primary-green);
  border: 2px solid var(--primary-green);
  border-radius: 8px;
  padding: var(--space-3) var(--space-6);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--hover-overlay);
  border-color: var(--primary-green-dark);
}
```

### Cards
```css
.card {
  background: var(--background-primary);
  border: 1px solid var(--background-tertiary);
  border-radius: 12px;
  padding: var(--space-6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.card-header {
  border-bottom: 1px solid var(--background-tertiary);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-4);
}
```

### Forms
```css
.form-group {
  margin-bottom: var(--space-6);
}

.form-label {
  display: block;
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--background-tertiary);
  border-radius: 8px;
  background: var(--background-primary);
  color: var(--text-primary);
  font-size: var(--text-base);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-green);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
```

## 🎪 Retro-Modern Elements

### Gradients
```css
/* Subtle gradients for depth */
.gradient-primary {
  background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-dark) 100%);
}

.gradient-card {
  background: linear-gradient(145deg, var(--background-primary) 0%, var(--background-secondary) 100%);
}
```

### Shadows & Depth
```css
/* Layered shadow system */
.shadow-sm {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.shadow-md {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.shadow-lg {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}

.shadow-xl {
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
}
```

### Border Radius
```css
/* Consistent border radius */
.rounded-sm { border-radius: 4px; }
.rounded-md { border-radius: 8px; }
.rounded-lg { border-radius: 12px; }
.rounded-xl { border-radius: 16px; }
.rounded-full { border-radius: 9999px; }
```

## 🌙 Dark Mode Implementation

### CSS Custom Properties
```css
:root {
  /* Light theme variables */
  --background-primary: #FFFFFF;
  --text-primary: #212529;
  /* ... other light theme colors */
}

[data-theme="dark"] {
  /* Dark theme variables */
  --background-primary: #0D1117;
  --text-primary: #F0F6FC;
  /* ... other dark theme colors */
}
```

### Theme Toggle
```css
.theme-toggle {
  position: relative;
  width: 60px;
  height: 30px;
  background: var(--background-tertiary);
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.theme-toggle::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  background: var(--primary-green);
  border-radius: 50%;
  transition: all 0.3s ease;
}

[data-theme="dark"] .theme-toggle::before {
  transform: translateX(30px);
}
```

## 🎬 Animations & Transitions

### Micro-interactions
```css
/* Hover effects */
.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Loading animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Fade transitions */
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## 📱 Responsive Design

### Breakpoints
```css
/* Mobile First Approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### Grid System
```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.grid {
  display: grid;
  gap: var(--space-6);
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
```

## 🎯 Component Library

### Navigation
```css
.sidebar {
  background: var(--background-secondary);
  border-right: 1px solid var(--background-tertiary);
  min-height: 100vh;
  width: 280px;
  transition: all 0.3s ease;
}

.sidebar.collapsed {
  width: 80px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 8px;
  margin: var(--space-1) var(--space-2);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-overlay);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--primary-green);
  color: white;
}
```

### Data Tables
```css
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--background-primary);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table th {
  background: var(--background-secondary);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  padding: var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--background-tertiary);
}

.table td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--background-tertiary);
  color: var(--text-primary);
}

.table tr:hover {
  background: var(--hover-overlay);
}
```

## 🎨 Icon System

### Icon Styles
```css
.icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
  transition: all 0.2s ease;
}

.icon-sm { width: 16px; height: 16px; }
.icon-lg { width: 24px; height: 24px; }
.icon-xl { width: 32px; height: 32px; }
```

## 🚀 Implementation Notes

### CSS Architecture
- **CSS Modules** for component-scoped styles
- **CSS Custom Properties** for theming
- **Mobile-first** responsive design
- **BEM methodology** for class naming

### Performance
- **Critical CSS** inlined
- **Lazy loading** for non-critical styles
- **CSS purging** for production builds
- **Minimal runtime** CSS-in-JS usage

### Accessibility
- **High contrast** ratios
- **Focus indicators** for keyboard navigation
- **Screen reader** friendly markup
- **Color-blind** friendly palette

---

*This styling guide will be updated as we implement and refine the design system.*
