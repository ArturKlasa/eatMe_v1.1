# Rough Idea

Review the EatMe authentication flow (web portal + mobile app) with the code as the source of truth and `docs/project/workflows/auth-flow.md` as a reference document.

Goal: find gaps, errors, mistakes, and things that could go wrong — security issues, logic bugs, doc/code mismatches, race conditions, missing edge-case handling.

Key files reviewed:
- `apps/web-portal/contexts/AuthContext.tsx`
- `apps/web-portal/app/auth/callback/route.ts`
- `apps/web-portal/app/auth/login/page.tsx`
- `apps/web-portal/app/auth/signup/page.tsx`
- `apps/web-portal/components/ProtectedRoute.tsx`
- `apps/web-portal/lib/supabase.ts`
- `apps/web-portal/lib/supabase-server.ts`
- `apps/web-portal/lib/storage.ts`
- `apps/web-portal/proxy.ts`
- `apps/mobile/src/stores/authStore.ts`
- `apps/mobile/src/lib/supabase.ts`
- `apps/mobile/src/lib/googleAuth.ts`
