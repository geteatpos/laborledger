# Security Note

## Exposed credential indication

A supplied historical implementation document appears to contain an API credential value. The value is intentionally not reproduced in this kit.

Treat the credential as compromised:

1. Revoke or rotate it at the provider immediately.
2. Search the current repository, branches, tags, CI artifacts, logs, backups, copied documents, and shell history for the same credential pattern.
3. Replace committed values with environment-variable references.
4. If it exists in Git history, use an approved history-rewrite procedure and coordinate with every collaborator before force-pushing.
5. Invalidate old clones or require collaborators to re-clone after a rewrite.
6. Review provider audit logs and usage for unauthorized activity.
7. Add automated secret scanning to CI and local hooks.

Never ask an agent to print matching lines containing the full secret. Search should redact values and report only file paths, variable names, and secret type.

## MCP security

- The Stitch key is read from `STITCH_API_KEY`.
- Do not pass secrets as literal command arguments or commit them to configuration.
- Keep MCP tool access limited to the design agent where possible.
- Review generated design/code artifacts before adding them to the repository.
