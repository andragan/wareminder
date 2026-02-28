---
name: tooling-decisions
description: Guidelines for choosing between off-the-shelf tools, pre-commit hooks, and custom validation scripts in WAReminder development.
---

# Tooling Decisions for WAReminder

## When to Use This Skill

When deciding whether to:
- Create a custom validation script for a recurring error
- Integrate a linter or build tool
- Add pre-commit hooks for automation
- Rely on browser testing as validation

## Core Principle

**Avoid creating custom scripts for every single kind of error.** Instead:

1. **First choice**: Off-the-shelf tools (ESLint, web-ext, Prettier, etc.)
2. **Second choice**: Pre-commit hooks (Husky) or CI/CD pipelines
3. **Last resort**: Custom scripts only if no tooling exists AND error is critical

## Pattern: Chrome Extension Validation

Chrome extensions have **built-in validation** that happens when you load the unpacked extension. Don't create custom validators for these cases:

### i18n Placeholder Validation
- **Problem**: Mismatched placeholders in `_locales/*/messages.json` (e.g., `$TOTAL_DAYS$` referenced but not defined)
- **Why custom script is wrong**: Error appears naturally when you load extension in Edge/Chrome
- **Right approach**: 
  - Load extension in browser during development → catches errors immediately
  - Use pre-commit hook to test-load extension (if desired)
  - Rely on CI/CD to catch before release
- **Tool status**: No off-the-shelf validator exists; this is expected (part of browser's job)

### Manifest Validation
- **Use**: `web-ext lint --source-dir src`
- **Don't write custom**: web-ext already handles this

### JavaScript Syntax
- **Use**: ESLint (already configured)
- **Don't write custom**: we have eslint.config.js

## Decision Tree

```
Do I need to validate something?
├─ YES: Is there an off-the-shelf tool for it?
│   ├─ YES: Use the tool (add to npm scripts or CI)
│   └─ NO: Does the browser/test runner catch it automatically?
│       ├─ YES: Rely on that (e.g., loading unpacked extension)
│       └─ NO: Consider pre-commit hook via Husky
└─ NO: Don't validate it
```

## Examples

| Error Type | Tool/Approach | Reason |
|---|---|---|
| i18n placeholder mismatch | Load extension in browser | Built-in Chrome validation |
| JavaScript syntax | ESLint | Off-the-shelf tool exists |
| Manifest structure | web-ext lint | Off-the-shelf tool exists |
| Service layer DI tests | Jest + mocks | Off-the-shelf tool exists |
| Type safety | TypeScript (future) | Off-the-shelf tool exists |

## When to Create Custom Tooling

Only create a custom script if:
1. No off-the-shelf tool exists
2. The error is critical (blocks development or release)
3. It appears **repeatedly** across the codebase (not one-off)
4. Pre-commit/CI can't catch it

Even then, prefer wrapping existing tooling over building from scratch.

## References

- [WAReminder Copilot Instructions](../../copilot-instructions.md) - Main architecture guide
- [Testing Patterns](../testing-patterns/SKILL.md) - How to test in this repo
