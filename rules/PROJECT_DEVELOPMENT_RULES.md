# Project Development Rules for Skaftin Platform

## 🎯 Overall Development Standards

### 1. Code Quality
- **TypeScript First**: All code must be properly typed
- **No Lint Errors**: All lint errors must be resolved before committing
- **Consistent Formatting**: Follow established patterns and spacing
- **Error Handling**: Comprehensive error handling in all code paths

### 2. Git & Version Control
- **Meaningful Commits**: Clear, descriptive commit messages
- **Feature Branches**: Use feature branches for new development
- **Code Reviews**: All code must be reviewed before merging
- **Clean History**: Squash commits when appropriate

### 3. Documentation
- **README Files**: Keep README files updated
- **Code Comments**: Document complex logic and business rules
- **API Documentation**: Document all API endpoints
- **Component Documentation**: Document reusable components

## 📁 Project Structure Standards

### Repository Organization
```
Skaftin/
├── rules/              # Development rules and guidelines
├── src/
│   ├── backend/        # Backend services and APIs
│   └── frontend/       # React frontend application
├── docs/               # Project documentation
└── scripts/            # Build and deployment scripts
```

### File Naming Conventions
- **Components**: PascalCase (e.g., `AppButton.tsx`)
- **Services**: PascalCase (e.g., `AuthService.ts`)
- **Routes**: kebab-case (e.g., `auth.routes.ts`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Types**: PascalCase (e.g., `UserTypes.ts`)

## 🔧 Development Workflow

### 1. Feature Development
1. **Create Feature Branch**: `git checkout -b feature/feature-name`
2. **Follow Rules**: Adhere to frontend/backend development rules
3. **Test Thoroughly**: Test all functionality before committing
4. **Code Review**: Request review from team members
5. **Merge**: Merge to main after approval

### 2. Bug Fixes
1. **Create Bug Branch**: `git checkout -b bugfix/bug-description`
2. **Fix & Test**: Implement fix and test thoroughly
3. **Document**: Document the fix and any changes
4. **Review**: Request code review
5. **Merge**: Merge to main after approval

### 3. Hotfixes
1. **Create Hotfix Branch**: `git checkout -b hotfix/critical-fix`
2. **Fix Immediately**: Implement critical fix
3. **Test**: Verify fix works in production
4. **Deploy**: Deploy to production immediately
5. **Document**: Document the hotfix

## 🚀 Deployment Standards

### Environment Management
- **Development**: Local development environment
- **Staging**: Pre-production testing environment
- **Production**: Live production environment

### Configuration
- **Environment Variables**: Use `.env` files for configuration
- **Secrets Management**: Never commit secrets to repository
- **Database Migrations**: Use proper migration scripts
- **Backup Strategy**: Regular backups of production data

## 📋 Quality Assurance

### Testing Requirements
- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database operations
- **End-to-End Tests**: Test complete user workflows
- **Performance Tests**: Test application performance under load

### Security Standards
- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Data Validation**: Validate all inputs
- **SQL Injection**: Use parameterized queries
- **XSS Protection**: Sanitize all user inputs
- **CORS**: Proper CORS configuration

## 🔍 Code Review Checklist

### General Checklist
- [ ] Code follows established patterns
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Proper error handling
- [ ] Security considerations addressed
- [ ] Performance optimizations applied
- [ ] Documentation updated
- [ ] Tests written and passing

### Frontend Checklist
- [ ] Components properly typed
- [ ] Props interfaces defined
- [ ] State management follows patterns
- [ ] UI/UX considerations addressed
- [ ] Accessibility standards met

### Backend Checklist
- [ ] Services properly structured
- [ ] API responses consistent
- [ ] Database queries safe
- [ ] Authentication implemented
- [ ] Error handling comprehensive
- [ ] Logging implemented

## 📝 Documentation Standards

### Code Documentation
- **JSDoc Comments**: Document all public methods
- **Inline Comments**: Explain complex logic
- **Type Definitions**: Document all interfaces
- **API Documentation**: Document all endpoints

### Project Documentation
- **README Files**: Keep updated with setup instructions
- **Architecture Docs**: Document system architecture
- **Deployment Guides**: Document deployment procedures
- **Troubleshooting**: Document common issues and solutions

## 🎯 Performance Standards

### Frontend Performance
- **Bundle Size**: Keep bundle size optimized
- **Loading Times**: Minimize initial load time
- **Rendering**: Optimize component rendering
- **Memory Usage**: Monitor and optimize memory usage

### Backend Performance
- **Response Times**: Keep API response times under 200ms
- **Database Queries**: Optimize database queries
- **Connection Pooling**: Use connection pooling
- **Caching**: Implement appropriate caching strategies

## 🔒 Security Standards

### Authentication & Authorization
- **JWT Tokens**: Secure token generation and validation
- **Password Security**: Proper password hashing
- **Session Management**: Secure session handling
- **Role-Based Access**: Implement proper access control

### Data Protection
- **Input Validation**: Validate all user inputs
- **SQL Injection**: Use parameterized queries
- **XSS Protection**: Sanitize user inputs
- **CSRF Protection**: Implement CSRF tokens
- **HTTPS**: Use HTTPS in production
