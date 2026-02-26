

## Analysis

The auth flow in `Auth.tsx` (lines 181-205) already correctly checks profile status after login and blocks pending/rejected users by signing them out. The pending/rejected UI screens are also already implemented.

**The real vulnerability**: Protected pages (`Dashboard.tsx`, `EventDetails.tsx`, `Admin.tsx`) only check for an active session -- they do NOT verify profile `status === "approved"`. A user whose email is confirmed gets a valid session from Supabase Auth. Even though `Auth.tsx` calls `signOut()` for pending users, there's a race condition: if the user navigates directly to `/dashboard` (e.g., via the email confirmation redirect URL `emailRedirectTo: window.location.origin`), they bypass the Auth.tsx gate entirely and land on the dashboard with full access.

Additionally, the `useEffect` in `Auth.tsx` (lines 31-49) that runs on page load checks profile status but only sets UI state -- it doesn't sign out the user if they're pending.

## Plan

### 1. Create a reusable `useProfileGuard` hook (new file)

**File:** `src/hooks/useProfileGuard.ts`

This hook will:
- Accept the current user
- Query the `profiles` table for `status`
- Return `{ status, loading }` where status is `"approved" | "pending" | "rejected" | null`
- Used by all protected pages to gate access

### 2. Update `Auth.tsx` -- fix the initial session check

**File:** `src/pages/Auth.tsx` (lines 31-49)

The existing `useEffect` checks profile status on load but doesn't sign out pending/rejected users who arrive via email confirmation redirect. Fix: add `await supabase.auth.signOut()` for pending and rejected cases in the initial session check, matching what the login handler already does.

### 3. Update `Dashboard.tsx` -- add profile status gate

**File:** `src/pages/Dashboard.tsx`

After session is confirmed, check profile status using `useProfileGuard`. If status is not `"approved"`:
- Sign the user out
- Redirect to `/auth`

This adds a server-side truth check even if someone navigates directly to `/dashboard`.

### 4. Update `EventDetails.tsx` -- add same gate

**File:** `src/pages/EventDetails.tsx`

Same pattern: check profile status, redirect if not approved.

### 5. No database changes needed

The `profiles` table already has a `status` column with values `pending`, `approved`, `rejected`. The admin approval/rejection actions (`approve_user`, `reject_user`) in the edge function already work correctly. No new columns or migrations are required.

### 6. No email changes

Automated approval emails would require a third-party email service (non-auth emails are not supported by the platform's built-in email system). The admin can manually notify users, or this can be added later with an external integration.

---

### Summary

| File | Change |
|---|---|
| `src/hooks/useProfileGuard.ts` | New hook: queries profile status for authenticated user |
| `src/pages/Auth.tsx` | Fix initial session check to sign out non-approved users |
| `src/pages/Dashboard.tsx` | Add profile status gate before rendering |
| `src/pages/EventDetails.tsx` | Add profile status gate before rendering |

The core fix ensures that every protected page verifies `profile.status === "approved"` server-side, not just the login form. Users with confirmed emails but pending approval will be signed out and redirected to the auth page with the appropriate message.

