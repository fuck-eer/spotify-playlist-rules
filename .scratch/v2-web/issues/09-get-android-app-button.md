# 09: "Get the Android app" button

**What to build:** a "Get the Android app" button on the signed-out home page and in the account menu that downloads `/android/rulemix.apk`.

**Blocked by:** android/11 (release APK exists in `apps/web/public/android/`)

**Status:** ready-for-agent

**ADRs:** 0033.

**Files:** `apps/web/components/sign-in.tsx`, `apps/web/components/account-menu.tsx`, `apps/web/public/android/rulemix.apk` (from android/11).

**Acceptance criteria**
- [ ] Link `href="/android/rulemix.apk"` with `download`; component tests in `sign-in.test.tsx`, `account-menu.test.tsx`.
- [ ] Playwright: GET `/android/rulemix.apk` returns 200 with a non-empty body.
