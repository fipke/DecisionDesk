# PR Checklist (attach to every PR)

- [ ] SPEC-MASTER.md re-read; no drift or PR 00 added
- [ ] API-SURFACE endpoints updated & OpenAPI visible
- [ ] ENV keys documented and bound
- [ ] Errors & limits enforced (UPLOAD_TOO_LARGE etc.)
- [ ] Costs computed on server (if applicable)
- [ ] Javadoc/JSDoc & changeset added
- [ ] Tests: minimal but meaningful

## Endpoint Checklist

- [ ] Auth & rate-limit policy (even if stub)
- [ ] Input validation (size, mime)
- [ ] 404/400/500 error model with codes
- [ ] ENV-driven behavior toggles respected
- [ ] OpenAPI annotations + examples
- [ ] Logging without secrets
