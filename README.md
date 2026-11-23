# Open Map Monitor — plugin catalogue

Install monitoring integrations for **Open Map Monitor** from the application's **Plugins** menu. Each plugin is a standalone, signed ZIP that contains its executable adapter code and setup instructions. Images and vendor logos are not included.

## Available integrations

| Integration | Data source | What it monitors |
| --- | --- | --- |
| Juniper Mist | Juniper Mist API and signed webhook | Organization/site inventory, devices, outages and recoveries |
| Cisco Meraki | Meraki Dashboard API | Networks, devices, connectivity and known physical addresses |
| Ubiquiti UniFi Site Manager | Official UniFi cloud API | Devices, site inventory, status and available coordinates |
| Prometheus Alertmanager | Authenticated Alertmanager webhook | Firing alerts, resolved alerts and device status |
| Zabbix Alert Webhook | Custom Zabbix media type | Host trigger problems, recoveries and severity |
| Signed JSON Webhook | HMAC-SHA256 JSON webhook | Generic normalized monitoring observations |
| Synthetic Reference Monitor | Offline test adapter | Installation and rollback testing; **not for production monitoring** |

Vendor authentication details and configuration are available in the respective `sources/<plugin-id>/README.md` files. API-based plugins may require an account subscription, appropriate permissions or compatible device firmware. Integrations not providing verified addresses can still be linked to branches manually.

## Installing a plugin

1. Sign in to Open Map Monitor as an administrator and open **Plugins**.
2. Choose a plugin and select **Install**. The server downloads and verifies its signed package.
3. Open **Backoffice → Plugin settings → [Plugin name]** and configure the required credentials or webhook secret. Credentials are retained server-side; they are not delivered to the browser as plaintext.
4. Enable the plugin and run discovery/connection diagnostics, then map any unmatched devices to branches.
5. Monitor plugin health and update availability from **Plugins**. You can disable, update, roll back or uninstall an adapter without removing unrelated branch data.

### Using the GitHub-hosted catalogue

The repository can be hosted publicly on GitHub without an additional application or GitHub access token. Configure the application's `PLUGIN_REPOSITORY_URL` to the raw HTTPS URL of this repository's `repo.json`, for example:

```text
https://raw.githubusercontent.com/OWNER/REPOSITORY/main/repo.json
```

The directory structure must stay intact: `repo.json` at the root and ZIP archives under `packages/`. Publish immutable package files before updating the signed index. The application must also trust the repository publisher public key IDs through `PLUGIN_TRUSTED_KEYS`; a public GitHub directory alone does **not** establish trust.

## Signed releases

`repo.json` contains release versions, package locations, capabilities, permissions, compatibility and cryptographic metadata. Every listed ZIP is checked using SHA-256 and a detached Ed25519 signature before extraction or execution. Old release archives remain accessible for rollback. No archives contain images, vendor logos or signing private keys.

A trusted catalogue may use more than one public key during publisher-key rotation: one key verifies the index, while each ZIP is verified with its recorded key ID. The `keys/trusted-keys.json` file contains public keys only. Applications must pin the expected keys in their own environment; downloading a public key from GitHub is not sufficient to establish trust.

## Repository administration

To verify all published packages, run:

```sh
node scripts/validate-repo.mjs
npm test
```

The repository publisher uses a private Ed25519 signing key, stored **outside the public repository**. Publishing a new plugin or version automatically builds and tests the adapter, checks its package contents, creates an immutable release ZIP and atomically updates `repo.json` without losing prior plugins or rollback versions:

```sh
PLUGIN_SIGNING_PRIVATE_KEY_FILE=/secure/publisher.pem PLUGIN_SIGNING_KEY_ID=community-2026-11 \
  node scripts/publish-plugin.mjs ubiquiti.unifi
```

Consult `keys/PUBLISHING.md` for publisher key rotation and deployment ordering. Never commit private signing keys, tenant credentials, `.env` files, or customer data to this public repository.

## Compatibility and support

These adapters use `open-map-monitor.plugin/v1` and require a compatible Open Map Monitor plugin engine. The contained tests use documented, simulated vendor responses. They do **not** constitute certification against a live vendor account, local hardware, production Azure deployment or the monitoring screen. Confirm status mappings, API rate limits, alert recoveries and branch associations before relying on any adapter for production incidents.

This catalogue contains community integrations. The vendors do not endorse or maintain these packages.
