# Extreme Networks ExtremeCloud IQ

Official ExtremeCloud IQ login, paginated device status and verified site address discovery.

## Connection and requirements

Connects to https://api.extremecloudiq.com with POST /login, GET /devices and GET /locations/site. A read-only API-capable account must have access to the target organization and locations. Site addresses are retained only when provided by ExtremeCloud IQ; unassigned devices remain unmapped. The adapter does not require or use local network access. It respects pagination and fails on 429 without inventing device outages.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.
