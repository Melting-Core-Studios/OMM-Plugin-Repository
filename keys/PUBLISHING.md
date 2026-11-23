# Ed25519 repository publishing and rotation

Only pinned **public** keys belong in this directory. Keep the publisher's private Ed25519 key in Key Vault/HSM or a restricted deployment identity, never in the plugin repository, ZIPs, `repo.json`, browser code, App Service settings, or CI logs.

`repo.json` signs `canonicalJson(all_top_level_fields_except_signature)` with Ed25519 and carries a `keyId`. Every package has a separate Ed25519 signature over exact ZIP bytes and its own key ID; a SHA-256 digest and length must also match.

The included `primary` key is a **development example**, not a production release identity. `scripts/rekey-all.mjs` accepts an externally stored production key, verifies all previously signed packages and atomically re-signs all index entries and the repository index. New archives can then be published using `PLUGIN_SIGNING_KEY_ID=production-v1` and that private key. Back up the production private key securely; if lost, rotate trust using approved operational procedures.

For a regular planned key rotation, insert a new key ID/public key into `trusted-keys.json`, deploy a `PLUGIN_TRUSTED_KEYS` pinset containing both keys to all instances, and then execute `scripts/rotate-repository-key.mjs <new-key-id>` using the new external key. This re-signs the index but keeps existing package signatures and their old `keyId`. Publish new packages under the new key. Keep the old key pinned until older version ZIPs have been retired or re-signed through a controlled trust migration. **Never accept public keys supplied only by an untrusted repository response.**
