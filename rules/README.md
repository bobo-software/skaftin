# Skaftin Platform Development Rules

This directory contains all development rules, guidelines, and standards for the Skaftin Platform project.

## 📁 Rules Structure

### Frontend Development
- **[Frontend Development Rules](./FRONTEND_DEVELOPMENT_RULES.md)** - Complete frontend development guidelines including component organization, TypeScript standards, and code structure.

### Backend Development
- **[Backend Development Rules](./BACKEND_DEVELOPMENT_RULES.md)** - Complete backend development guidelines including service organization, API standards, and database patterns.

### Project Standards
- **[Project Development Rules](./PROJECT_DEVELOPMENT_RULES.md)** - Overall project development standards including code quality, git workflow, deployment, and security.

## 🎯 Rule Categories

### Frontend Rules
- **Component Organization**: How to structure and export components
- **TypeScript Standards**: Explicit typing requirements
- **File Structure**: Spacing, imports, and organization patterns
- **State Management**: Store and state variable labeling
- **Code Quality**: Linting, error handling, and best practices

### Backend Rules
- **Service Organization**: How to structure services and business logic
- **API Standards**: Consistent response formats and error handling
- **Database Patterns**: Safe query practices and connection management
- **TypeScript Standards**: Explicit typing for all functions and interfaces
- **Security**: Authentication, validation, and data protection

### Project Rules
- **Code Quality**: TypeScript, linting, and formatting standards
- **Git Workflow**: Branching, commits, and code review process
- **Deployment**: Environment management and deployment procedures
- **Security**: Authentication, authorization, and data protection
- **Performance**: Frontend and backend performance optimization

## 📋 Quick Reference

### Component Creation Checklist
- [ ] Create component in appropriate category folder
- [ ] Define explicit prop interfaces
- [ ] Export via ComponentsIndex.ts
- [ ] Follow spacing rules (2 spaces after imports)
- [ ] Label stores and state variables
- [ ] Add proper TypeScript types
- [ ] Handle loading and error states

### Service Creation Checklist
- [ ] Create service file in services/ directory
- [ ] Define explicit interfaces for all methods
- [ ] Add comprehensive error handling
- [ ] Include proper TypeScript types
- [ ] Follow spacing rules (2 spaces after imports)
- [ ] Add JSDoc comments for complex methods
- [ ] Use parameterized database queries

### File Structure Pattern
```typescript
// 1. Imports (grouped by type)
import React from 'react';
import { useState } from 'react';

// 2. Two spaces after imports

// 3. Type definitions
interface ComponentProps {
  title: string;
  optional?: boolean;
}

// 4. Store variables (labeled)
const { user, setUser } = useAppStore();

// 5. State variables (labeled and grouped)
const [isLoading, setIsLoading] = useState(false);
const [data, setData] = useState<DataType[]>([]);

// 6. Component definition
const ComponentName = ({ title, optional }: ComponentProps) => {
  // Component logic here
};
```

## 🚀 Getting Started

1. **Read the Rules**: Start with the frontend development rules
2. **Follow Patterns**: Use the established patterns for consistency
3. **Check Quality**: Ensure all lint errors are resolved
4. **Document Changes**: Update rules when adding new patterns

## 📝 Contributing to Rules

When adding new rules or patterns:
1. Create a new markdown file in this directory
2. Update this README to include the new rule
3. Follow the established format and structure
4. Include examples and checklists where helpful
