# Team Invitations - Testing Guide

## 🧪 Complete Testing Checklist

### Prerequisites:
- ✅ Backend running: `npm run dev`
- ✅ Frontend running: `cd frontend && npm run dev`
- ✅ At least one email provider configured
- ✅ Logged in to your account

---

## Test 1: Create Invitation with Email

### Steps:
1. Go to Settings → Team tab
2. Click "Invite Member"
3. Enter email: `test@example.com` (or your test email)
4. Select email provider: "Bobo Software Mail"
5. Click "Send Invitation"

### Expected Results:
✅ Success message: "Invitation sent via email!"
✅ New invitation appears in "Pending Invitations"
✅ Backend logs show:
```
📧 [createInvitation] Creating invitation
  └─ email: test@example.com
  └─ email_provider_id: 1 number
  └─ ✅ Invitation created with ID: X
  └─ Sending invitation email via provider: 1
     📨 [sendInvitationEmail] Starting email send process
        └─ ✅ Provider found
        └─ Sending email...
        └─ ✅ Email sent successfully!
           └─ Message ID: <...>
           └─ Accepted: ['test@example.com']
```

✅ Email received in inbox with:
- Project name
- Invite code
- "Accept Invitation" button
- Invite link

---

## Test 2: Create Invitation without Email (Manual Share)

### Steps:
1. Go to Settings → Team tab
2. Click "Invite Member"
3. Enter email: `manual@example.com`
4. Leave email provider as "Don't send email"
5. Click "Send Invitation"

### Expected Results:
✅ Success message: "Invitation created! Share the link..."
✅ Invite link copied to clipboard
✅ Invitation appears in "Pending Invitations"
✅ Can click copy button to copy link again

---

## Test 3: Accept Invitation (Logged In User)

### Steps:
1. Open invite link from email or copy it
2. **Already logged in** with matching email
3. Click "Accept Invitation" button

### Expected Results:
✅ Success message: "Invitation accepted!"
✅ Redirected to project dashboard
✅ Project appears in your projects list
✅ You appear in Team Members section
✅ Invitation removed from Pending Invitations

---

## Test 4: Accept Invitation (New User)

### Steps:
1. Open invite link in incognito/private browser
2. See invitation details
3. Click "Sign In to Accept" button
4. On login page, click "Sign Up" toggle
5. Enter email (same as invitation email)
6. Enter password
7. Confirm password
8. Click "Sign Up"

### Expected Results:
✅ Account created successfully
✅ Automatically redirected back to invite page
✅ Now shows "Accept Invitation" button
✅ Click accept → Join project
✅ Redirected to project dashboard

---

## Test 5: Accept Invitation (Existing User Not Logged In)

### Steps:
1. Open invite link in incognito/private browser
2. Click "Sign In to Accept"
3. Login with existing account
4. Automatically returned to invite page
5. Click "Accept Invitation"

### Expected Results:
✅ Login successful
✅ Returned to invite page
✅ Can accept invitation
✅ Redirected to project

---

## Test 6: Copy Invite Link

### Steps:
1. Go to Settings → Team
2. Find a pending invitation
3. Click the copy icon (📋)

### Expected Results:
✅ Link copied to clipboard
✅ Icon changes to checkmark briefly
✅ Success toast: "Invite link copied!"
✅ Can paste and share link

---

## Test 7: Revoke Invitation

### Steps:
1. Go to Settings → Team
2. Find a pending invitation
3. Click trash icon (🗑️)
4. Confirm deletion

### Expected Results:
✅ Confirmation dialog appears
✅ Success message: "Invitation revoked"
✅ Invitation removed from list
✅ Invite link becomes invalid

---

## Test 8: Remove Team Member

### Steps:
1. Go to Settings → Team
2. Find a team member
3. Click trash icon next to their name
4. Confirm removal

### Expected Results:
✅ Confirmation dialog
✅ Success message: "Member removed"
✅ Member removed from list
✅ User loses access to project

---

## Test 9: Re-invite After Deletion

### Steps:
1. Delete an invitation
2. Immediately create a new invitation with same email

### Expected Results:
✅ New invitation created successfully
✅ No "duplicate key" error
✅ Old invitation cleaned up automatically

---

## Test 10: Expired Invitation

### Steps:
1. Create invitation (expires in 7 days)
2. Manually update database to set expires_at to yesterday
3. Try to open invite link

### Expected Results:
✅ "Invitation Expired" message
✅ Can't accept invitation
✅ Prompted to contact project owner

---

## Backend Logs to Check

### Successful Invitation Creation:
```
📧 [createInvitation] Creating invitation
  └─ projectId: 1
  └─ email: test@example.com
  └─ email_provider_id: 1 number
  └─ Cleaning up old invitations...
  └─ ✅ Invitation created with ID: 5
  └─ Sending invitation email via provider: 1
     📨 [sendInvitationEmail] Starting email send process
        └─ Fetching email provider...
        └─ ✅ Provider found:
           └─ Host: mail.bobosoftware.co.za
           └─ Port: 465
           └─ From: gift@bobosoftware.co.za
        └─ Creating nodemailer transporter...
        └─ Invite link: http://localhost:3005/invite/abc123...
        └─ Preparing email...
        └─ Sending email...
        └─ ✅ Email sent successfully!
           └─ Message ID: <...>
           └─ Accepted: ['test@example.com']
           └─ Rejected: []
```

### If Email Provider Not Found:
```
  └─ ❌ Email provider not found or inactive
```
**Fix:** Check provider ID is correct and is_active = true

### If Provider Wrong:
```
  └─ projectId: 1
  └─ email_provider_id: 1 number
     📨 [sendInvitationEmail] Starting email send process
        └─ providerId: 1
        └─ projectId: 1
        └─ Fetching email provider...
        └─ ❌ Email provider not found or inactive
```
**Fix:** Provider ID doesn't match project ID

---

## Common Issues & Solutions

### Issue 1: "Duplicate key error"
**Cause:** Trying to invite same email twice
**Solution:** Now automatically deletes old non-pending invitations ✅

### Issue 2: "No email sent"
**Check:**
1. Email provider ID is being sent in request
2. Provider exists and is active
3. SMTP credentials are correct
4. Backend logs show email sending attempt

### Issue 3: "No routes matched location '/register'"
**Solution:** Updated InviteAcceptPage to use `/login` ✅
**Note:** Login page has register toggle built-in

### Issue 4: "This invitation is for a different email"
**Cause:** Logged in with wrong email
**Solution:** Must use email that matches invitation

### Issue 5: "User is already a member"
**Cause:** User already has access
**Solution:** Check Team Members section - they're already there

---

## Debug Commands

### Check if tables exist:
```sql
SELECT * FROM project_invitations;
SELECT * FROM project_members;
SELECT * FROM email_providers;
```

### Check pending invitations:
```sql
SELECT * FROM project_invitations WHERE status = 'pending';
```

### Check team members:
```sql
SELECT * FROM project_members WHERE project_id = 1;
```

### Manually expire invitation (for testing):
```sql
UPDATE project_invitations 
SET expires_at = NOW() - INTERVAL '1 day'
WHERE id = 1;
```

---

## Expected User Flows

### Flow 1: Email Invitation → New User
```
1. User receives email
2. Clicks "Accept Invitation" button
3. Lands on /invite/[code] page
4. Sees invitation details
5. Clicks "Sign In to Accept"
6. On login page, clicks "Sign Up"
7. Creates account
8. Redirected back to /invite/[code]
9. Now shows "Accept Invitation" button
10. Clicks accept
11. Joins project ✅
12. Redirected to project dashboard
```

### Flow 2: Manual Link → Existing User
```
1. Project owner copies invite link
2. Shares via Slack/WhatsApp
3. User clicks link
4. Lands on /invite/[code] page
5. Already logged in
6. Clicks "Accept Invitation"
7. Joins project ✅
8. Redirected to project dashboard
```

---

## Success Criteria

All of these should work:
- ✅ Create invitation with email → Email sent
- ✅ Create invitation without email → Link copied
- ✅ Accept invitation (logged in) → Join project
- ✅ Accept invitation (new user) → Create account → Join project
- ✅ Copy invite link → Share manually
- ✅ Revoke invitation → Link becomes invalid
- ✅ Remove member → User loses access
- ✅ Re-invite same email → No duplicate error
- ✅ View team members → See all members
- ✅ View pending invitations → See all pending

---

## What to Share for Debugging

If something isn't working, share:

1. **Frontend console logs** (browser DevTools)
   - Look for: `📤 [TeamTab]`, `🚀 [InvitationsService]`

2. **Backend console logs** (terminal)
   - Look for: `📧 [createInvitation]`, `📨 [sendInvitationEmail]`

3. **Error messages** from toast notifications

4. **Network tab** in DevTools:
   - Check the request payload
   - Check the response

This will help us diagnose the issue quickly! 🔍

---

## Summary

The invitation system is now **fully functional** with:
- ✅ No duplicate key errors (auto-cleanup)
- ✅ Detailed logging throughout
- ✅ Proper redirect flow for new users
- ✅ Email sending with debugging
- ✅ Manual link sharing option

**Test it now!** 🚀

