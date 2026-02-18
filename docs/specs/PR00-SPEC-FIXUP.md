# PR 00 — Spec Fixup (Backfill) PR

**When to use**: Any time code diverges from SPEC-MASTER.md or new requirements modify earlier PRs.

## Tasks
1) **Audit**: list mismatches vs SPEC-MASTER.md (behavior, endpoints, env, flags, UI policies).
2) **Patch**: update code and docs so the repo conforms to SPEC-MASTER.md.
3) **Migration**: write DB/data migrations if needed (Flyway).
4) **Tests**: add/adjust smoke tests proving compliance.
5) **Docs**: update API-SURFACE, ENV, SECURITY, and the affected PR spec files.

## Output format (Codex)
- “PR 00 – Summary”
- “Audit – mismatches vs SPEC-MASTER” (bullets)
- “Files modified” (paths only)
- “Run & verify”
- “PR text + changeset”
