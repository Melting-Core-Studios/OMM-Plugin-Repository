# MikroTik RouterOS

Monitor a RouterOS v7 router over its official read-only HTTPS REST interface.

## Connection and requirements

Uses RouterOS v7 REST API over HTTPS with HTTP Basic authentication, GET /rest/system/identity and optional GET /rest/interface. The RouterOS host must use a trusted public HTTPS FQDN on TCP 443. No TLS verification bypass is provided. Do not expose RouterOS management to the internet just to use this integration: LAN-only routers should use a secure outbound collector. If an optional interface is configured, a known down state is marked degraded while the reachable router remains online.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.

## Native branch mapping

Run **Synchronize inventory** after enabling. Keep the API hostname stable; changing it creates a new device identity and requires a new assignment.

The mapping key is: Configured API hostname (not the mutable RouterOS identity name). Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → MikroTik RouterOS**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.
