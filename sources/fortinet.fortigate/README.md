# Fortinet FortiGate (FortiOS)

Monitor FortiOS appliance reachability and optional interface health via the official HTTPS REST API.

## Connection and requirements

Requires a FortiOS REST API administrator token and an administrator-authorized, public HTTPS hostname on TCP 443. Private IPs, VPN-only targets, self-signed certificates and port 8443 are blocked by the core network broker. For LAN-only firewalls, deploy a separately secured outbound collector rather than exposing management to the internet. The adapter checks system status and optionally one named interface. Successful API access reports online; missing interface state is not treated as down. Polling errors are not silently reclassified as appliance outages. API access should be read-only and restricted by trusted hosts/source addresses.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.

## Native branch mapping

Run **Synchronize inventory** after enabling. A successful poll registers the appliance, even without an address.

The mapping key is: Serial number returned by FortiOS. Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → Fortinet FortiGate (FortiOS)**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.
