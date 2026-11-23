# Fortinet FortiGate (FortiOS)

Monitor FortiOS appliance reachability and optional interface health via the official HTTPS REST API.

## Connection and requirements

Requires a FortiOS REST API administrator token and an administrator-authorized, public HTTPS hostname on TCP 443. Private IPs, VPN-only targets, self-signed certificates and port 8443 are blocked by the core network broker. For LAN-only firewalls, deploy a separately secured outbound collector rather than exposing management to the internet. The adapter checks system status and optionally one named interface. Successful API access reports online; missing interface state is not treated as down. Polling errors are not silently reclassified as appliance outages. API access should be read-only and restricted by trusted hosts/source addresses.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.
