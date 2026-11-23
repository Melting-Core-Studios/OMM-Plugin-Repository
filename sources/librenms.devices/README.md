# LibreNMS

Poll LibreNMS API v0 managed devices, device connectivity and provider-reported location strings.

## Connection and requirements

Requires a LibreNMS account API token with read access. Uses GET /api/v0/devices with Authorization: Bearer. Only device status 0/1 is mapped as down/up; disabled or ignored devices are unknown. The LibreNMS instance must be reachable via a public HTTPS FQDN on 443 with a trusted TLS certificate, because the app intentionally blocks SSRF and private-IP access. For internal networks, use a secured outbound collector instead.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.
