# Admin Dashboard - Security Documentation

**Last Updated:** January 21, 2026  
**Security Level:** HIGH - Admin-only access

---

## 🔐 Security Architecture Overview

This admin dashboard implements **defense-in-depth** security with multiple layers:

1. **Database Layer** - RLS policies
2. **Application Layer** - Middleware protection
3. **UI Layer** - Role-based rendering
4. **Audit Layer** - Immutable logging

---

## Authentication & Authorization

### Role System

- **Admin Role**: Stored in `auth.users.raw_user_meta_data->>'role'`
- **Cannot be self-assigned**: Only modifiable via SQL by database admins
- **Checked at multiple levels**: Database RLS, middleware, and application code

### Creating Admin Users

```sql
-- Step 1: User signs up normally at /auth/signup
-- Step 2: Database admin runs this SQL:
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@example.com';
```

⚠️ **SECURITY WARNING**: Never expose this SQL to users or create a UI for role assignment!

---

## Security Layers

### 1. Database Security (RLS Policies)

**Location:** `infra/supabase/migrations/008_add_admin_role_with_security.sql`

#### Key Policies:

```sql
-- Admins can view all restaurants
CREATE POLICY "Admins and owners can view restaurants"
ON restaurants FOR SELECT
USING (auth.uid() = owner_id OR is_admin());

-- Only admins can delete
CREATE POLICY "Only admins can delete restaurants"
ON restaurants FOR DELETE
USING (is_admin());
```

**Why RLS?**

- Enforced at database level - cannot be bypassed
- Works even if application code has bugs
- Protects direct database access

### 2. Middleware Protection

**Location:** `apps/web-portal/middleware.ts`

**Features:**

- ✅ Checks authentication before allowing /admin access
- ✅ Verifies admin role from user metadata
- ✅ Logs unauthorized access attempts
- ✅ Adds security headers (X-Frame-Options, CSP, etc.)
- ✅ Redirects non-admins to regular dashboard

**Security Headers Added:**

```typescript
'X-Frame-Options': 'DENY'                    // Prevent clickjacking
'X-Content-Type-Options': 'nosniff'          // Prevent MIME sniffing
'X-XSS-Protection': '1; mode=block'          // XSS protection
'Referrer-Policy': 'strict-origin-when-cross-origin'
'Content-Security-Policy': ...               // Restrict resource loading
```

### 3. Audit Logging

**Table:** `admin_audit_log`

**Features:**

- ✅ Logs every admin action (create, update, delete, suspend)
- ✅ Captures IP address and timestamp
- ✅ Stores old and new data for changes
- ✅ **Immutable** - cannot be modified or deleted
- ✅ Only readable by admins

**Example:**

```sql
SELECT * FROM admin_audit_log
WHERE resource_type = 'restaurant'
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Soft Deletion (Suspension)

**Why soft delete?**

- ✅ Reversible - can restore suspended restaurants
- ✅ Maintains data integrity (no broken foreign keys)
- ✅ Keeps historical records
- ✅ Tracks who suspended and why

**Columns:**

- `is_active` - Boolean flag (true = active, false = suspended)
- `suspended_at` - Timestamp of suspension
- `suspended_by` - Admin user ID who suspended
- `suspension_reason` - Text explanation

---

## Threat Model & Mitigations

### Threat 1: Privilege Escalation

**Attack:** User tries to give themselves admin role

**Mitigations:**

1. ✅ Role stored in auth.users (user cannot modify)
2. ✅ No API endpoint to change roles
3. ✅ Middleware checks role on every request
4. ✅ RLS policies enforce at database level

### Threat 2: Unauthorized Data Access

**Attack:** Non-admin tries to access /admin routes

**Mitigations:**

1. ✅ Middleware blocks access before page loads
2. ✅ RLS policies prevent data retrieval
3. ✅ Attempts are logged for monitoring
4. ✅ User redirected with error message

### Threat 3: Data Tampering

**Attack:** Admin deletes audit logs to hide actions

**Mitigations:**

1. ✅ Audit log has no UPDATE/DELETE policies
2. ✅ Table is append-only
3. ✅ Even admins cannot modify logs
4. ✅ Database backups retain full history

### Threat 4: Session Hijacking

**Attack:** Attacker steals admin session cookie

**Mitigations:**

1. ✅ HTTPS only (enforced in production)
2. ✅ HttpOnly cookies (Supabase default)
3. ✅ IP address logged in audit trail
4. ✅ Session expiration (Supabase default: 1 hour)
5. ✅ Refresh token rotation

### Threat 5: SQL Injection

**Attack:** Malicious SQL in form inputs

**Mitigations:**

1. ✅ Supabase client uses parameterized queries
2. ✅ Input validation with Zod schemas
3. ✅ TypeScript type safety
4. ✅ RLS policies as second line of defense

### Threat 6: XSS (Cross-Site Scripting)

**Attack:** Malicious JavaScript in restaurant names/descriptions

**Mitigations:**

1. ✅ React auto-escapes output
2. ✅ CSP header blocks inline scripts
3. ✅ X-XSS-Protection header
4. ✅ Input sanitization on forms

---

## Security Best Practices

### For Developers:

1. **Never bypass RLS** - Don't use service role key in client-side code
2. **Always use middleware** - Don't rely only on client-side checks
3. **Log sensitive actions** - Use `log_admin_action()` function
4. **Validate inputs** - Use Zod schemas for all form data
5. **Use TypeScript** - Catch type errors at compile time
6. **Review audit logs** - Check for suspicious activity regularly

### For Admins:

1. **Use strong passwords** - Minimum 16 characters
2. **Enable 2FA** (when available)
3. **Don't share credentials** - Each admin should have their own account
4. **Log out when done** - Don't leave sessions open
5. **Review audit trail** - Check who did what regularly
6. **Be careful with deletions** - Use suspension instead when possible

---

## Monitoring & Incident Response

### What to Monitor:

1. **Failed login attempts** - Multiple failures may indicate attack
2. **Unauthorized access attempts** - Check middleware logs
3. **Bulk operations** - Large deletions/updates may be accidental
4. **Off-hours activity** - Admin actions at unusual times
5. **Unknown IP addresses** - Admin logins from new locations

### Incident Response:

If you suspect a security breach:

1. **Immediately disable compromised admin**:

   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = raw_user_meta_data - 'role'
   WHERE email = 'compromised@example.com';
   ```

2. **Review audit logs**:

   ```sql
   SELECT * FROM admin_audit_log
   WHERE admin_email = 'compromised@example.com'
   ORDER BY created_at DESC;
   ```

3. **Check affected resources**
4. **Restore from backup if needed**
5. **Update passwords** for all admins
6. **Review and patch vulnerability**

---

## Compliance & Data Privacy

### GDPR Considerations:

- ✅ Audit logs contain IP addresses (requires consent)
- ✅ User data can be deleted (right to erasure)
- ✅ Data access is logged (accountability)
- ✅ Purpose limitation (admin access for management only)

### Data Retention:

- **Audit logs**: Retain for 2 years minimum
- **Soft-deleted restaurants**: Retain for 90 days before hard delete
- **User accounts**: Retain until explicit deletion request

---

## Testing Security

### Manual Security Tests:

1. **Test unauthorized access**:
   - Try to access /admin without login
   - Try to access /admin as restaurant owner
   - Verify redirects work correctly

2. **Test RLS policies**:
   - Log in as owner, try to query other restaurants
   - Verify owners can only see their own data
   - Verify admins can see all data

3. **Test audit logging**:
   - Perform admin action
   - Check audit_log table
   - Verify all fields are populated

4. **Test suspension**:
   - Suspend a restaurant
   - Verify it doesn't appear in mobile app
   - Verify owner cannot edit suspended restaurant
   - Verify admin can unsuspend

---

## Future Security Enhancements

**Planned:**

- [ ] Two-factor authentication (2FA)
- [ ] IP whitelist for admin access
- [ ] Rate limiting on admin actions
- [ ] Automated security scanning
- [ ] Real-time anomaly detection
- [ ] Webhook notifications for suspicious activity

---

## Security Contacts

**For security issues:**

- Report to: security@eatme.com
- PGP Key: [Add if available]
- Response time: 24 hours

**Never post security vulnerabilities in:**

- Public GitHub issues
- Slack channels
- Email lists

---

## Compliance Checklist

Before going to production:

- [ ] All admins have strong passwords
- [ ] Audit logging is enabled
- [ ] HTTPS is enforced
- [ ] Session timeout is configured
- [ ] Backup system is in place
- [ ] Incident response plan is documented
- [ ] Security review completed
- [ ] Penetration testing done (if required)

---

**This document is confidential. Do not share outside the development team.**
