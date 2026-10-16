# 03: New-mix screen hides the source picker until a name is typed

**Status:** done
**Type:** bug
**Refs:** Nishchay feedback ("user does not know where to go")

## Decision
Name stays first. Without a name: hint "Name your mix to pick a source"; trying the source button highlights the name field (aria-invalid) and focuses it. With a name: source row and order options show straight away, plus "Rules: <name>" under the name. Spinner while the mix is created (`busy`).

## Tests (write first)
- component: hint shown with no name; clicking source highlights the field; typing shows the target line and order options; busy shows a spinner.

## Acceptance criteria
- [x] All tests pass
