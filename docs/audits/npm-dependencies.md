# npm dependency audit

Scope: the dependency set based on `6cfe846`, audited on 2026-11-14.
Sourcefed remains version 0.5.1. No package is published by this work.

## Result

The production audit reports **23 moderate findings**, with no low, high, or
critical findings. `npm audit --omit=dev --audit-level=low` exits 1. This is
not a clean audit: the remaining entries depend on two upstream advisories
listed below. No ignore, override, resolution, or new advisory exception is
configured.

| Check | Result |
| --- | --- |
| Baseline production audit | 32: 2 low, 27 moderate, 3 high; exit 1 |
| Compatible lockfile-only remediation | 29 findings; exit 1 |
| Audit with approved Pi development hosts 1.5.2 | 23 moderate; exit 1 |
| Fresh install with lifecycle scripts disabled | Pass; upstream deprecations remain |
| Bundle, declarations, test compilation, TypeScript | Pass locally; no test bodies executed |
| Full check and both Pi integration scenarios | Run on hosted Ubuntu CI |

The owner approves the Pi development-host refresh to 1.5.2. The published
package retains optional `"*"` Pi peers; it gains no runtime dependency or
minimum-host requirement. The Pi plugin's source is unchanged. The existing
0.83.0 release type-consumer fixture remains in `scripts/e2e/types.mjs`.

## Cleared entries

Nine package entries leave the audit report:

- `@aws-sdk/xml-builder` and `fast-xml-parser`.
- `@earendil-works/pi-coding-agent`.
- `brace-expansion`.
- `gaxios`, `gcp-metadata`, and `rimraf`.
- `undici`.
- `zod`.

The Pi 0.83.0 dependency tree carries a published shrinkwrap, exact
`undici 8.5.0`, and older XML/parser and schema packages. Ordinary compatible
updates cannot replace that tree. Its development pins move together to
`@earendil-works/pi-coding-agent@1.5.2` and
`@earendil-works/pi-tui@1.5.2`; the lock contains patched
`undici 8.12.3/8.12.4`, `brace-expansion 5.0.12`, and `zod 4.6.7`.
Compatible lockfile remediation also removes the vulnerable
`gcp-metadata -> gaxios -> rimraf` chain. It selects runtime
`gcp-metadata 8.1.2`, inside `google-auth-library 10.5.0`'s `^8.0.0` range,
because `8.1.4` pins vulnerable `gaxios 7.1.3`.

## Upstream blockers

**G — [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4):**
glob's AbortSignal cancellation bypass permits post-timeout filesystem
traversal. The affected range is `>=9.0.0 <=14.0.1`; the first patched version
is `14.0.2`.

**M — [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249):**
minimatch permits denial of service through globparts amplification. The
affected range is `>=7.0.0 <11.0.1`; the first patched version is `11.0.1`.

Registry inspection of the current `@opencode/plugin@2.3.0` shows that its
`@opencode/util@2.3.0` still pins `glob 13.0.5` and `minimatch 10.2.5`.
Updating the direct plugin from 2.2.7 to 2.3.0 does not fix either advisory,
so this change leaves that SDK pin alone.

The TUI chain uses `@opentui/solid@0.8.1` and
`babel-plugin-module-resolver@5.0.2`, whose `glob ^9.3.3` constraint
excludes patched glob 14. The current solid 0.8.4 still pins resolver 5.0.2;
the current resolver 5.0.3 still requests glob 9. The lock retains glob 9.3.5
and minimatch 8.0.7 in that branch.

Every remaining audit entry is moderate and has `fixAvailable: false`.
They are listed individually below. “Via” names the reported dependency edge;
G and M refer to the advisory constraints above, not to an allowlist.

| Audit entry | Via / upstream constraint |
| --- | --- |
| `@npmcli/arborist` | npmcli, cache, fetch, pacote, minimatch chains; G/M |
| `@npmcli/config` | map-workspaces and package-json; G/M |
| `@npmcli/map-workspaces` | package-json, glob and minimatch; G/M |
| `@npmcli/metavuln-calculator` | cacache and pacote; G/M |
| `@npmcli/package-json` | glob 13 constraint; G/M |
| `@npmcli/run-script` | package-json; G/M |
| `@opencode/plugin` | util and solid; G/M |
| `@opencode/util` | Exact glob 13/minimatch 10 pins and npmcli; G/M |
| `@opentui/solid` | Exact Babel resolver 5.0.2 pin; G/M |
| `@sigstore/sign` | make-fetch-happen; G/M |
| `@sigstore/tuf` | tuf-js; G/M |
| `@tufjs/models` | minimatch 10 constraint; M |
| `babel-plugin-module-resolver` | glob 9 constraint; G/M |
| `cacache` | glob 13 constraint; G/M |
| `glob` | glob 13.0.5 / 9.3.5 and their minimatch; G/M |
| `ignore-walk` | minimatch 10 constraint; M |
| `make-fetch-happen` | cacache; G/M |
| `minimatch` | minimatch 10.2.5 / 8.0.7; M |
| `npm-packlist` | ignore-walk; M |
| `npm-registry-fetch` | make-fetch-happen; G/M |
| `pacote` | npmcli, cache, fetch, packlist and sigstore; G/M |
| `sigstore` | sign and tuf; G/M |
| `tuf-js` | models and make-fetch-happen; G/M |

These SDK packages are runtime dependencies; treating their chains as
development-only would misstate the published package. Removing SDKs or
forcing transitive major versions requires a separate compatibility decision.
No blanket glob, minimatch, Zod, or SDK override is applied.

## Verification and safety

Local verification installs the frozen lockfile with scripts disabled, then
runs build and type commands only. Full tests include process signalling and
run on hosted CI, never on the Mac:

```sh
npm ci --ignore-scripts --no-audit --no-fund

npm run build

npm run build:tui

npm run build:public

npm run build:tests

npm run typecheck

npm audit --omit=dev --audit-level=low
```

The existing hosted Check job runs `npm run check` without weakening it.
A separate hosted Pi job builds the public package and runs the real RPC
integration against both source and packed extension entries:

```sh
npm run integration -- pi.test.mjs pi-package.test.mjs
```

Without scenario arguments, `npm run integration` runs the full suite.
Unknown or duplicate scenario names fail before build/install effects.

Install warnings remain for the upstream OpenTelemetry tracing packages,
`node-domexception`, and glob 9. The audit findings and these deprecations
are not suppressed. This audit does not authorize a sourcefed release,
runtime upgrade, service restart, tap change, or npm settings change.

References: [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/),
[Pi changelog](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/CHANGELOG.md),
and the two GitHub advisories above.
