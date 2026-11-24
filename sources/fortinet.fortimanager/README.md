# Fortinet FortiManager

Read-only managed-device inventory and connection state from FortiManager JSON-RPC (specified ADOM).

## Connection and requirements

Uses read-only FortiManager JSON-RPC POST /jsonrpc and the /dvmdb/adom/{ADOM}/device endpoint. Create an API administrator with limited device-manager read access; set a suitable ADOM (usually root). A public, trusted HTTPS hostname on port 443 is required by the worker broker. Private-IP appliances need a securely deployed collector or approved gateway. This does not fetch FortiAnalyzer logs or change firewall configuration. Only connection status indicates a device outage; configuration mismatches may show degraded.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.

## Native branch mapping

Run **Synchronize inventory** after enabling. Assign each managed device separately. An ADOM is an administrative domain, not a physical site.

The mapping key is: Managed device serial number (existing name fallback if no serial is returned). Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → Fortinet FortiManager**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.
