# Open Map Monitor plugin repository

This repository publishes installable monitoring adapters for Open Map Monitor. Administrators browse it from the Plugins menu, download verified packages, manage updates and configure their integration credentials in Backoffice → Plugin settings.

Every release is an immutable ZIP with runnable ESM code, a runtime manifest, installation metadata, configuration schema, README and license. **Plugin archives contain no images.** The signed `repo.json` records each available version, release channel, compatible API contract, permissions, package URL, SHA-256 hash and detached Ed25519 signature. Older releases remain available for rollback.

## Included adapters

- **Juniper Mist 1.0.0:** organization/site inventory, device connectivity and authenticated webhook normalization.
- **Cisco Meraki 1.0.0:** organization, network, device and physical-address information using the Meraki API where provided.
- **Generic Signed Webhook 1.0.0:** HMAC-authenticated JSON observations for systems with a compatible webhook feed.
- **Synthetic Test Adapter 1.0.0 and 1.0.1:** deterministic integration test plugin for installation, update and rollback validation; not intended for live monitoring.

## Repository integrity

Run `node scripts/validate-repo.mjs` and `npm test` to verify the index and release archives. The included releases are signed with a **reference development publisher key**; adopt your own production Ed25519 signing key before serving a production installation. Only public keys belong in the published repository.

To publish with a production key, store the private key outside the source tree and run:

```bash
export PLUGIN_SIGNING_PRIVATE_KEY_FILE=/secure/publisher.pem
export PLUGIN_SIGNING_KEY_ID=production-v1
node scripts/rekey-all.mjs production-v1
node scripts/validate-repo.mjs
```

Host `repo.json` and the packages folder on a trusted HTTPS origin, such as Azure Blob Storage with a CDN. Serve immutable archives with long cache lifetimes and the signed index with short caching. Upload package files **before** the newly signed index. Configure each application with the matching trusted public keys.

## Publishing plugin updates

Each plugin has its own source directory under `sources/`. Edit its implementation and increment the release version before running:

```bash
node scripts/publish-plugin.mjs juniper.mist
node scripts/validate-repo.mjs
```

The publishing script runs plugin tests, audits the ZIP, calculates its digest and size, verifies existing repository entries, signs the new release and atomically updates `repo.json` without discarding other plugins or previous versions. It rejects duplicate version publication. See `keys/PUBLISHING.md` for public-key rotation.

## Installation and support

Only trusted repositories configured by an administrator can install code. Plugin workers run server-side with restricted outbound HTTPS destinations; browsers do not receive executable packages or credentials. Mapping uses exact verified address evidence where possible and manual association otherwise.

Reference adapters are verified with synthetic API fixtures rather than live vendor tokens. Check the provider's current API licensing, firmware, permissions, rate limits, pagination behavior and webhook signing requirements before using a plugin for operational alerting.
