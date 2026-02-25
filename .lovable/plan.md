

## Analysis

The root cause is in the `update_settings` action of the `admin-operations` edge function (line 238-246). It uses `UPDATE` to save settings, but the `system_settings` table starts empty (no rows). An `UPDATE` on a non-existent row silently does nothing -- the function returns `"Settings updated"` but zero rows are actually written. This is confirmed by the network data: `get_settings` returns `{"settings":{}}`.

The reported "blank screen" is likely a secondary effect of the app reading empty settings on subsequent navigations.

## Plan

### 1. Fix the edge function to use UPSERT (single file change)

**File:** `supabase/functions/admin-operations/index.ts`

In the `update_settings` case (lines 234-257), replace the `.update()` call with an upsert pattern:

```typescript
case "update_settings": {
  const { settings } = params;
  
  for (const [key, value] of Object.entries(settings)) {
    await adminClient
      .from("system_settings")
      .upsert(
        { 
          key, 
          value: JSON.stringify(value), 
          updated_at: new Date().toISOString(),
          updated_by: actorUserId,
        },
        { onConflict: "key" }
      );
  }

  // audit log (already exists, keep as-is)
  ...
}
```

### 2. Add a unique constraint on `system_settings.key`

A database migration is needed so that `upsert` with `onConflict: "key"` works:

```sql
ALTER TABLE public.system_settings
  ADD CONSTRAINT system_settings_key_unique UNIQUE (key);
```

### 3. No other changes needed

- The UI code in `AdminSettings.tsx` already has loading states, error toasts, and success toasts -- all working correctly.
- The `useSystemSettings` hook already has fallback defaults when the table is empty.
- The `Auth.tsx` page already reads `settings.registration_enabled` and `settings.require_approval` from the hook.
- Audit logging is already implemented in the edge function.

### Summary

Two changes total: one migration (unique constraint) and one line change in the edge function (UPDATE to UPSERT). This ensures settings rows are created on first save and updated on subsequent saves.

