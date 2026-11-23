# MikroTik RouterOS

Monitor a RouterOS v7 router over its official read-only HTTPS REST interface.

## Connection and requirements

Uses RouterOS v7 REST API over HTTPS with HTTP Basic authentication, GET /rest/system/identity and optional GET /rest/interface. The RouterOS host must use a trusted public HTTPS FQDN on TCP 443. No TLS verification bypass is provided. Do not expose RouterOS management to the internet just to use this integration: LAN-only routers should use a secure outbound collector. If an optional interface is configured, a known down state is marked degraded while the reachable router remains online.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.
