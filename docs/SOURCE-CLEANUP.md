# Non-destructive source cleanup

Obsolete paths listed in `.retired-code.json` are removed from the tracked source tree only. Their existing files stay on this Mac, are explicitly ignored and remain recoverable from the unchanged Git history. Existing local files and branches are never deleted.

The cleanup retains the current Learn/Teach/Admin tools, all native backend and permission code, stable historical reader/recording identities, manual media attachment/publication, and every current compatibility redirect. Hifz is excluded. Old-looking website-studio protocol files are active dependencies and remain.

The committed V109.14 public package and SHA-256 manifest remain unchanged as the verified deployed reference. This is a source-only change; do not deploy or republish. New builds and tests use retained fresh folders. Test discovery follows Git's tracked file list so physically preserved retired test files cannot re-enter the active suite.
