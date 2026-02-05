# Auth System - Quick Start Guide

## 🎉 Implementation Complete!

The complete user management and authentication system is now ready to use. All backend APIs and frontend UIs are fully functional.

---

## 🚀 Get Started in 5 Minutes

### Step 1: Start the Application

```bash
# Start backend (creates auth tables automatically)
npm run dev

# In a new terminal, start frontend
cd frontend
npm run dev
```

The backend will automatically create auth tables for any new projects.

---

### Step 2: Navigate to Auth Section

1. Open your browser and go to `http://localhost:3005`
2. Login to your Skaftin account
3. Select a project or create a new one
4. Click on **"Auth"** in the sidebar (Shield icon)

---

### Step 3: Configure Auth Settings

1. Go to **Auth → General**
2. Configure your preferences:
   - Enable/disable authentication system
   - Enable/disable user registration
   - Allow duplicate emails (multi-tenant apps)
   - Require email verification
   - Enable password reset
   - Set default role for new users

3. Select an **Email Provider** for auth emails
   - If no provider exists, you'll see a warning
   - Click "Configure Email Provider" to set one up in Communications
   - Once configured, come back and select it

4. Click **"Save Settings"**

---

### Step 4: Create Your First User

1. Go to **Auth → Users**
2. Click **"Create User"**
3. Fill in the form:
   - Name (required)
   - Email (required)
   - Password (required)
   - Phone (optional)
   - Select roles (optional)
4. Click **"Create User"**

The user will be created in both SuperTokens and your project's app_users table!

---

### Step 5: Manage Roles

1. Go to **Auth → Roles**
2. You'll see 2 default roles:
   - **Admin** (60 minute sessions) - System role
   - **User** (7 day sessions) - System role

3. Create custom roles:
   - Click **"Create Role"**
   - Enter role name (e.g., "Manager")
   - Role key is auto-generated (e.g., "manager")
   - Set session duration (presets: 1h, 1d, 7d or custom)
   - Click **"Create Role"**

4. Edit existing roles:
   - Click **"Edit"** on any role card
   - Update name, description, session duration
   - System roles are protected (only session duration can be changed)

---

### Step 6: Add Custom Fields (Optional)

1. Go to **Auth → Custom Fields**
2. Click **"Add Field"**
3. Select field type:
   - **Text** - Free text input
   - **Number** - Numeric values
   - **Boolean** - True/false
   - **Date** - Date/time values
   - **Select** - Dropdown with options
   - **Multi Select** - Multiple choice
   - **Reference** - Link to another table

4. Fill in field details:
   - Field Label (e.g., "ID Number")
   - Field Name (auto-generated: "id_number")
   - Required checkbox
   - Additional options based on type

5. Click **"Create Field"**

6. Click **"Apply"** to add the field as a database column
   - Initially stored in metadata JSONB
   - Applying creates an actual column in app_users table

---

### Step 7: Configure Email Settings

1. Go to **Auth → Email Settings**
2. Select your email provider
3. Review the default templates:
   - **Registration Email** - OTP code for new users
   - **Email Verification** - Verification link
   - **Password Reset** - Reset password link
   - **Welcome Email** - Post-registration welcome

4. Test email sending:
   - Enter a test email address
   - Click **"Send Test"**
   - Check your inbox

---

## 📋 Features Overview

### User Management
- ✅ Create, read, update, delete users
- ✅ Search and filter by name, email, role, status
- ✅ Pagination (20 users per page)
- ✅ Role assignment
- ✅ Email/phone verification status
- ✅ Active/inactive status toggle
- ✅ SuperTokens integration for authentication

### Role Management
- ✅ Create custom roles
- ✅ Edit role details and session durations
- ✅ Delete roles (with user count validation)
- ✅ System roles (Admin, User) protected
- ✅ Per-role session duration (minutes to days)
- ✅ Beautiful card-based UI
- ✅ User count per role

### Custom Fields
- ✅ 7 field types supported
- ✅ Reference other database tables
- ✅ Validation rules support
- ✅ Default values
- ✅ Required field toggle
- ✅ Metadata storage + optional column creation
- ✅ Active/inactive field management

### Email Integration
- ✅ Integration with Communications providers
- ✅ Professional email templates included
- ✅ Registration OTP emails
- ✅ Email verification links
- ✅ Password reset emails
- ✅ Welcome emails
- ✅ Template variable support

### Security & Settings
- ✅ Enable/disable entire auth system
- ✅ Enable/disable user registration
- ✅ Duplicate email policy (multi-tenant support)
- ✅ Email verification requirement
- ✅ Password reset toggle
- ✅ MFA placeholder (future)
- ✅ Per-role session lengths
- ✅ Default role assignment

---

## 🔌 API Integration

All features are available via REST API:

### Example: Create a User Programmatically

```bash
curl -X POST http://localhost:4005/api/auth/1/users \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "phone": "+1234567890",
    "role_ids": [2]
  }'
```

### Example: List Users with Filters

```bash
curl -X GET "http://localhost:4005/api/auth/1/users?search=john&is_active=true&page=1&limit=20" \
  -H "Cookie: your-session-cookie"
```

### Example: Create Custom Field

```bash
curl -X POST http://localhost:4005/api/auth/1/fields \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "field_name": "department",
    "field_label": "Department",
    "field_type": "select",
    "options": ["Engineering", "Marketing", "Sales"],
    "is_required": true
  }'
```

---

## 📊 Database Schema

### Core Tables (Auto-created for each project)

**app_users**
```
id, supertokens_user_id, name, email, phone, metadata (JSONB),
is_active, email_verified, phone_verified, created_at, updated_at
```

**app_roles**
```
id, role_name, role_key, description, permissions (JSONB),
session_duration_minutes, is_system_role, created_at, updated_at
```

**app_user_roles**
```
id, app_user_id, role_id, assigned_at, assigned_by
```

**app_user_custom_fields**
```
id, field_name, field_label, field_type, is_required, default_value,
options (JSONB), reference_table, reference_column, validation_rules (JSONB),
display_order, is_active, created_at, updated_at
```

**auth_settings** (in public schema)
```
id, project_id, allow_duplicate_emails, require_email_verification,
require_phone_verification, enable_password_reset, enable_mfa,
registration_enabled, auth_enabled, default_role_id, email_provider_id,
sms_provider_id, settings_json (JSONB), created_at, updated_at
```

---

## 🎯 Common Use Cases

### Use Case 1: Multi-Tenant SaaS Application
1. **Enable duplicate emails** (different tenants can have users with same email)
2. Create a **"Tenant Admin"** role with appropriate permissions
3. Add custom field: **"tenant_id"** (reference to your tenants table)
4. Assign users to tenants via the custom field

### Use Case 2: Corporate Application
1. **Disable duplicate emails** (one user per email)
2. Create roles: **"Employee", "Manager", "Executive"**
3. Add custom fields:
   - **employee_id** (text)
   - **department** (select with options)
   - **hire_date** (date)
4. Require email verification

### Use Case 3: Community Platform
1. Enable registration
2. Set **"Member"** as default role
3. Add custom fields:
   - **username** (text)
   - **bio** (text)
   - **avatar_url** (text)
4. Enable email verification

---

## 🔒 Security Features

- ✅ **SuperTokens Integration** - Industry-standard auth
- ✅ **HTTP-only Cookies** - XSS protection
- ✅ **Session Management** - Per-role durations
- ✅ **Password Hashing** - Secure bcrypt via SuperTokens
- ✅ **Email Verification** - Confirm user identity
- ✅ **Password Reset** - Secure token-based reset
- ✅ **Soft Delete** - Deactivate instead of permanent deletion
- ✅ **CSRF Protection** - Built into SuperTokens

---

## 🎨 UI Features

### Navbar
- ✅ **Sticky Navigation** - Stays at top while scrolling
- ✅ **Auth Section Icon** - Shield icon in breadcrumb
- ✅ **Responsive Design** - Works on mobile and desktop

### Users Tab
- ✅ **Search & Filter** - By name, email, role, status
- ✅ **Pagination** - 20 users per page
- ✅ **Role Badges** - Visual role indicators
- ✅ **Verification Status** - Email/phone verification icons
- ✅ **Quick Actions** - Edit and delete buttons

### Roles Tab
- ✅ **Card Layout** - Beautiful role cards
- ✅ **User Count** - Shows how many users per role
- ✅ **Session Duration** - Visual duration display
- ✅ **System Role Badges** - Protected roles highlighted

### Custom Fields Tab
- ✅ **Field Type Icons** - Visual field type indicators
- ✅ **Reference Info** - Shows table relationships
- ✅ **Apply Button** - Add column to database
- ✅ **Active/Inactive Status** - Toggle field visibility

### General Settings Tab
- ✅ **Toggle Switches** - Beautiful on/off switches
- ✅ **Provider Selection** - Dropdown with email providers
- ✅ **Success Messages** - Visual feedback
- ✅ **Warning Alerts** - When no email provider configured

---

## 🔍 Testing Checklist

- [ ] Create a new project (auth tables should auto-create)
- [ ] Navigate to Auth section
- [ ] Check that Admin and User roles exist
- [ ] Create a test user
- [ ] Assign a role to the user
- [ ] Edit user details
- [ ] Create a custom role
- [ ] Create a custom field
- [ ] Configure email provider (in Communications)
- [ ] Select email provider in Auth settings
- [ ] Save general settings
- [ ] Test user search and filters
- [ ] Deactivate a user
- [ ] Delete a custom role (should check for assigned users)

---

## 💡 Tips & Best Practices

### Email Setup
1. Always configure an email provider in Communications first
2. Test email sending before enabling verification requirements
3. Use Mailtrap for development/testing

### Role Management
1. Start with default roles (Admin, User)
2. Create additional roles as needed
3. Set appropriate session durations (shorter for admin roles)
4. Don't delete roles with assigned users

### Custom Fields
1. Define fields in metadata first (test them)
2. Apply to database once you're sure
3. Use reference fields for relationships
4. Required fields will prevent user creation if not provided

### Security
1. Enable email verification for production
2. Use shorter session durations for privileged roles
3. Don't allow duplicate emails unless multi-tenant
4. Enable password reset for user convenience

---

## 🆘 Troubleshooting

### Email provider not configured error
**Solution:** Go to Communications tab and create an email provider first.

### Cannot create user with email already exists
**Solution:** Check "Allow duplicate emails" in General settings if you need this.

### Cannot delete role
**Solution:** Role has users assigned. Remove users from role first or reassign them.

### Custom field not appearing
**Solution:** Click "Apply" button to add the field as a database column.

---

## 📚 Resources

- [SuperTokens Documentation](https://supertokens.com/docs)
- [Auth System Implementation](./AUTH_SYSTEM_IMPLEMENTATION.md)
- [Communications Feature](./COMMUNICATIONS_FEATURE_SUMMARY.md)
- [API Routes](../src/routers/AuthRouter.ts)

---

**That's it! Your auth system is ready to use.** 🎉

For advanced features like custom permissions, template editing, and MFA, check the full implementation documentation.

