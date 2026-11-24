# LibreNMS

Poll LibreNMS API v0 managed devices, device connectivity and provider-reported location strings.

## Connection and requirements

Requires a LibreNMS account API token with read access. Uses GET /api/v0/devices with Authorization: Bearer. Only device status 0/1 is mapped as down/up; disabled or ignored devices are unknown. The LibreNMS instance must be reachable via a public HTTPS FQDN on 443 with a trusted TLS certificate, because the app intentionally blocks SSRF and private-IP access. For internal networks, use a secured outbound collector instead.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.

## Native branch mapping

Run **Synchronize inventory** after enabling. A location name alone is not a verified physical address.

The mapping key is: Device serial, API device ID or hostname, in existing priority order. Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → LibreNMS**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.

Enable **Manual branch mapping only** if provider location data should not be used. It removes address and coordinate hints from future observations while retaining device identity, logical site and status. This setting does not delete or change existing automatic or manual assignments; review and correct any existing assignments in the native mapper. With the switch off, verified location data is passed through as before.
