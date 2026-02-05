# Team Invitations - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Start Your Application

```bash
# Start backend
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev
```

The system will automatically create the new database tables:
- ✅ `project_members`
- ✅ `project_invitations`

---

## Step 2: Navigate to Team Settings

1. Open your browser: `http://localhost:3005`
2. Login to your account
3. Select a project
4. Click **Settings** in the sidebar
5. Click the **Team** tab

You should now see the Team Management interface! 👥

---

## Step 3: Invite Your First Team Member

### Option A: Send Email Automatically

1. Click **"Invite Member"** button
2. Enter email: `colleague@example.com`
3. Select an email provider from dropdown (e.g., "Gmail SMTP")
4. Click **"Send Invitation"**

**Result:**
- ✅ Invitation created
- 📧 Email sent automatically
- 🔗 User receives invite link in their inbox

### Option B: Share Link Manually

1. Click **"Invite Member"** button
2. Enter email: `colleague@example.com`
3. Leave email provider as "Don't send email"
4. Click **"Send Invitation"**

**Result:**
- ✅ Invitation created
- 📋 Link copied to clipboard
- 💬 Share via Slack, WhatsApp, SMS, etc.

---

## Step 4: Accept the Invitation

### For New Users:
1. Click invite link: `http://localhost:3005/invite/abc123...`
2. See invitation details (project name, role, etc.)
3. Click **"Create Account"**
4. Register with the invited email
5. Automatically returned to invite page
6. Click **"Accept Invitation"**
7. Redirected to project dashboard ✅

### For Existing Users (Not Logged In):
1. Click invite link
2. Click **"Sign In to Accept"**
3. Login with account
4. Automatically returned to invite page
5. Click **"Accept Invitation"**
6. Redirected to project dashboard ✅

### For Logged In Users:
1. Click invite link
2. See invitation details
3. Click **"Accept Invitation"**
4. Immediately join project ✅

---

## What You'll See

### In Settings → Team Tab:

**Team Members Section:**
```
┌─────────────────────────────────────┐
│ Team Members                         │
├─────────────────────────────────────┤
│ user@example.com                     │
│ member • Joined Nov 8, 2025     [🗑️] │
└─────────────────────────────────────┘
```

**Pending Invitations Section:**
```
┌─────────────────────────────────────┐
│ Pending Invitations                  │
├─────────────────────────────────────┤
│ colleague@example.com                │
│ member • Expires Nov 15, 2025        │
│ Invited Nov 8, 2025         [📋][🗑️] │
└─────────────────────────────────────┘
```

### Email Invitation Example:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You've been invited! 🎉

You've been invited to join the project 
"My Awesome Project" on Skaftin Platform.

┌─────────────────────────┐
│ Invite Code:            │
│ abc123def456789...      │
└─────────────────────────┘

[Accept Invitation]

This invitation will expire in 7 days.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Managing Your Team

### View Team Members
- Go to Settings → Team
- See all current members
- View their role and join date

### Remove a Member
- Click the trash icon next to member
- Confirm removal
- Member loses access immediately

### View Pending Invitations
- See all invitations that haven't been accepted
- Check expiration dates
- Copy invite links to resend

### Revoke an Invitation
- Click trash icon next to pending invitation
- Invitation is cancelled
- Invite link becomes invalid

### Copy Invite Link
- Click copy icon next to pending invitation
- Link copied to clipboard
- Share via any channel

---

## API Integration

External applications can manage invitations programmatically:

### Create Invitation
```bash
POST /api/invitations/1/invitations
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com",
  "role": "member",
  "email_provider_id": 1
}
```

### Accept Invitation
```bash
POST /api/invitations/accept/abc123def456...
Authorization: Bearer <token>
```

---

## Key Features

### Security ✅
- 🔐 **Unique 64-character codes** - Impossible to guess
- ⏰ **7-day expiration** - Time-limited access
- ✉️ **Email validation** - Tied to specific email
- 🔒 **Single use** - Can't accept twice
- 🚫 **No duplicates** - Can't invite same email twice

### User Experience ✅
- 📧 **Beautiful emails** - Professional HTML formatting
- 🎨 **Modern UI** - Clean, intuitive interface
- 📱 **Responsive design** - Works on all devices
- 🌙 **Dark mode** - Full theme support
- ⚡ **Real-time updates** - Instant feedback
- 🔔 **Toast notifications** - Clear success/error messages

### Access Control ✅
- 👥 **Project-level access** - Granular permissions
- 🏢 **Organization projects** - Full org access
- 📋 **Invited projects only** - See only what you're invited to
- 🔄 **Dynamic project list** - Updates when invitations accepted

---

## Troubleshooting

### "No email providers configured"
**Solution:** Go to Communications tab and add an email provider first

### "Invitation not found"
**Causes:**
- Invalid invite code
- Invitation was revoked
- Link was mistyped

**Solution:** Request a new invitation from project owner

### "Invitation has expired"
**Solution:** Invitations expire after 7 days - request a new one

### "User is already a member"
**Solution:** You already have access - go to project directly

### "This invitation is for a different email"
**Solution:** Login with the email address that received the invitation

---

## Testing Checklist

- [ ] Create email provider in Communications tab
- [ ] Go to Settings → Team tab
- [ ] Send invitation with email provider
- [ ] Check email received (Mailtrap inbox if using Mailtrap)
- [ ] Click invite link
- [ ] Accept invitation (login/register if needed)
- [ ] Verify project appears in projects list
- [ ] Verify member appears in Team tab
- [ ] Test removing a member
- [ ] Test revoking a pending invitation
- [ ] Test copying invite link

---

## Summary

The Team Invitations feature is **fully implemented** and **ready to use**! 🎉

**What You Can Do:**
- ✅ Invite unlimited team members
- ✅ Send invitations via email or link
- ✅ Manage team members and invitations
- ✅ Grant project-level access (without full org access)
- ✅ Track who has access to what

**Start inviting your team now!** 🚀

Navigate to: **Settings → Team → Invite Member**

