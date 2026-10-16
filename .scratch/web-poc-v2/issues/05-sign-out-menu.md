# 05: Sign out dangles on the mixes page

**Status:** done
**Type:** bug
**Refs:** Nishchay feedback

## Decision
Remove the loose Sign out button from `app/mixes/page.tsx`; add a header account menu (shadcn DropdownMenu, more icon) next to RulesIconLink with "Sign out".

## Tests (write first)
- component: the menu opens and offers Sign out, which posts to the logout route.

## Acceptance criteria
- [x] All tests pass
