# Contributing

Thanks for considering a contribution. This document covers:

- The kinds of changes that are welcome (and the kinds that aren't).
- The contributor IP terms — non-negotiable, and the reason this file exists.
- Practical mechanics: development setup, tests, code style, PR conventions.

## Project shape

This package is **source-available**, not open source. The repository is published so that:

- Customers can read what they're depending on.
- Bug reports can quote line numbers.
- Drive-by typo and clarity fixes are easy to apply.
- Single fund management companies can fork-for-Internal-Use under the License.

It is **not** a community-governed open-source project. The license restricts commercial redistribution; see [`LICENSE`](./LICENSE) for terms. Architectural direction is owned by Unstructured Ventures, LLC and is not subject to community voting.

If you want to use the code in a commercial product, contact hello@hemrock.com for a commercial license — don't fork and rebrand under a different license. Section 3 of the License covers this explicitly.

## What's welcome

- **Bug fixes** with a failing test that reproduces the bug, plus the fix.
- **Documentation improvements** — README clarifications, doc-string fixes, missing sections in `docs/formula-map.md`, broken links, typos, examples that no longer compile.
- **Test coverage** for behavior that's already shipped. Especially welcome: parity fixtures comparing the engine to the canonical Excel template.
- **Performance fixes** that are measured (benchmark before/after) and don't change observable behavior.
- **Type-safety improvements** — tightening `any`, narrowing return types, refining the public surface in ways that are backward-compatible.

## What needs a discussion first

Open an issue before sending a PR for any of the following. We may have already considered it, or may want to design it differently:

- New computed metrics, new tier shapes, new waterfall variants.
- Changes to the public API (exported names, function signatures, type shapes).
- New sub-paths or new bundles.
- New dependencies (we keep these minimal).
- Anything that changes UI semantics in `/ui` (we maintain a specific design system).

For larger changes, "discussion first" means an issue with a written proposal — what changes, why, and the alternatives you considered. Don't open a 2,000-line PR cold; we'd rather lose your time than yours and ours both.

## What's out of scope

- **Re-licensing.** The License is final for the foreseeable future. Don't open issues asking to change it to MIT/Apache/BSL/etc.
- **Architectural rewrites** ("port to Rust," "switch to a streaming API," etc.). These either happen as part of an internal roadmap or don't.
- **Features that exist solely to support a non-licensed use case.** If a request only makes sense for a fund administrator running the package across many clients, it's a commercial-license conversation, not a contribution.
- **Cosmetic refactors that change how the code is organized** without changing behavior. We'll merge these only when there's a clear win and minimal review burden.

## Contributor IP terms

By submitting any contribution (a pull request, a patch, a written suggestion that we adopt verbatim, or any other form of contribution to this repository), you agree:

1. **You own or have rights to the contribution.** The contribution is your original work, or you have explicit permission from the owner to contribute it under these terms.
2. **You assign copyright to Unstructured Ventures, LLC.** All right, title, and interest in the contribution — including all copyright and other intellectual property rights — transfers to Unstructured Ventures, LLC upon acceptance into the repository. This is so the project can keep a single, unambiguous license holder, which keeps the License enforceable for everyone.
3. **You waive moral rights** to the extent permitted by law, so we can edit, restructure, or remove your contribution without notice.
4. **You grant a perpetual, worldwide, royalty-free, irrevocable license** for the project to use, distribute, modify, sublicense (under different terms via Commercial License), and otherwise exploit the contribution.
5. **The contribution is provided "as is."** You make no warranty about it.

This is the same model used by many source-available projects that need to be able to grant Commercial Licenses to third parties. If you're not comfortable with assignment, don't contribute — fork the repo for Internal Use under the License instead.

If you're contributing on behalf of a company, you confirm that you have authority to assign copyright on behalf of that company.

A short Contributor License Agreement (CLA) check may be added in the future via a bot. Contributions submitted before that bot exists are still subject to these terms by virtue of submission.

## Development

### Setup

```bash
git clone https://github.com/tdavidson/fund-economics-tool.git
cd fund-economics-tool
npm install
```

### Build and test

```bash
npm run build       # tsc to dist/
npm run typecheck   # type-only check, no emit
npm run test        # vitest, run once
npm run test:watch  # vitest in watch mode
```

A change is ready to PR when `npm run build`, `npm run typecheck`, and `npm run test` all pass cleanly.

### Code style

- TypeScript strict mode. No `any` without a comment explaining why.
- Public exports go through `src/index.ts` (engine), `src/ui/index.ts` (React), or `src/mc.ts` (Monte Carlo). Don't export from internal files.
- Function comments only for non-obvious behavior. Don't restate the type signature in prose.
- Tests in `test/`, mirroring source structure. Parity fixtures in `test/fixtures/`.

### Commit messages

One sentence, imperative mood, lowercase. "fix carry calc when gp commit is zero," not "Fixed carry calculation when GP commit is zero." Multi-paragraph bodies welcome when context matters.

### Pull requests

- Keep PRs focused. One bug fix per PR; one feature per PR.
- Reference the issue number in the PR description if there is one.
- Update `CHANGELOG.md` under an `## Unreleased` section if your change is user-visible.
- Don't bump the version number — that happens at release time.

## Reporting bugs

Open an issue. Include:

- The version of the package (`npm ls @tdavidson/fund-economics-tool`).
- The smallest possible reproduction — ideally a `FundInputs` JSON snippet plus what you expected and what actually happened.
- The Node version and OS.

If the bug touches financial math, attach the inputs as JSON so we can drop them into a test fixture.

## Security

If you find a security issue (anything that lets a non-licensed party access licensed functionality, or any vulnerability in a runtime dependency we haven't caught), email **hello@hemrock.com** instead of opening a public issue.

## Questions

For licensing or commercial questions, email hello@hemrock.com. For technical questions about how to use the package, the [README](./README.md) and [`docs/formula-map.md`](./docs/formula-map.md) are the first stop; an issue is the second.
