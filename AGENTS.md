# Agent instructions

## Commits

The commit subject is the release-note line. Start with a prefix, then a user-facing summary in the imperative, with no trailing period.

- `feat:` — Added. New behavior a user of Clay can rely on.
- `fix:` — Fixed. A correction to existing behavior.
- `docs:` — Docs. README, the docs site, or other user-facing documentation.
- `perf:` — Changed. A speed change with the same behavior.
- `refactor:`, `test:`, and `chore:` stay out of the release notes. Use `chore:` for tooling and for `chore: bump version to x.y.z`.

Name the behavior and the surface a user sees (`clay_file_target`, generate, the input hash). A scope is fine.

- `feat: expose clay_file_target to templates`
- `fix: include pack-local relative imports in the TS input hash`
- `docs: add the example repository and its line count`
- `chore: bump version to 0.3.4`

On the 0.3 line, a `feat` ships in the next patch. The maintainer chooses when to open a new minor.

## Releases

Publish with `npm publish` from a clean `master` that matches `origin/master`, on Node 24. That command refuses to start otherwise. It runs lint, the build, and the tests before uploading. The annotated tag `vX.Y.Z` is created and pushed only after npm accepts the version already in `package.json`. A dry run does not create the tag.

`v0.3.3` is the annotated tag on `c745cee`, the commit npm published as clay-generator 0.3.3. Release notes for the next version are the `feat`, `fix`, `docs`, and `perf` subjects since that tag.

Create a tag or publish to npm only when asked.
