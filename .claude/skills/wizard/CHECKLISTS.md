# Quick Reference Checklists

## Pre-Implementation Checklist

- [ ] Read CLAUDE.md
- [ ] Read relevant project docs
- [ ] Assessed complexity (simple/medium/complex)
- [ ] Created/found GitHub issue (for medium+ tasks)
- [ ] Created todo list with phases
- [ ] Verified all methods/APIs exist (grep/search)
- [ ] Identified patterns to follow
- [ ] Listed files to modify

## TDD Checklist

- [ ] Wrote failing test FIRST (RED)
- [ ] Test fails for the right reason
- [ ] Implemented minimal code (GREEN)
- [ ] Test passes
- [ ] Added boundary condition tests (0, 1, -1, null, empty)
- [ ] Added side effect assertions
- [ ] Isolated tests from external dependencies

## Implementation Checklist

- [ ] Using constants/enums, not hard-coded strings
- [ ] Using project's logging patterns
- [ ] Following project's UI framework conventions
- [ ] Input validation is complete
- [ ] Error handling is complete
- [ ] Race conditions checked for shared state
- [ ] Transaction side-effects considered

## Pre-Commit Checklist

- [ ] All acceptance criteria addressed
- [ ] No hard-coded values that should be constants
- [ ] No assumptions made without verification
- [ ] All edge cases handled
- [ ] No security vulnerabilities
- [ ] Tests cover new functionality
- [ ] Appropriate test suite passes
- [ ] Documentation updated
- [ ] GitHub issue updated

## Adversarial Questions

Before committing, ask yourself:

1. What happens if this runs twice concurrently?
2. What if the input is null? Empty? Zero? Negative? Huge?
3. What assumptions am I making that could be wrong?
4. If I were trying to break this, how would I?
5. What other code touches this same data?
6. Would I be embarrassed if this broke in production?

## Test Strategy Quick Reference

| Change Type | Strategy |
|-------------|----------|
| < 20 lines, single file | Related test only |
| 20-50 lines, single file | Related + sanity |
| Multiple files, same feature | Feature suite |
| Cross-cutting | Full affected modules |
| Database/schema changes | Full affected modules |
| Auth/security | Full affected modules |

## GitHub Issue Commands

```bash
# List issues
gh issue list --search "keyword"

# Create issue
gh issue create --title "Title" --body "Body"

# Update issue body (check acceptance criteria)
gh issue edit <number> --body "..."

# Add comment
gh issue comment <number> --body "Progress update..."

# Add labels
gh issue edit <number> --add-label "in-progress"

# Close issue
gh issue close <number> --comment "Completed in PR #123"
```
