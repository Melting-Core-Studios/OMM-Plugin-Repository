# Fortinet FortiManager

Read-only managed-device inventory and connection state from FortiManager JSON-RPC (specified ADOM).

## Connection and requirements

Uses read-only FortiManager JSON-RPC POST /jsonrpc and the /dvmdb/adom/{ADOM}/device endpoint. Create an API administrator with limited device-manager read access; set a suitable ADOM (usually root). A public, trusted HTTPS hostname on port 443 is required by the worker broker. Private-IP appliances need a securely deployed collector or approved gateway. This does not fetch FortiAnalyzer logs or change firewall configuration. Only connection status indicates a device outage; configuration mismatches may show degraded.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.
