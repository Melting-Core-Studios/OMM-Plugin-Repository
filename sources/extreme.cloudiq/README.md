# Extreme Networks ExtremeCloud IQ

Official ExtremeCloud IQ login, paginated device status and verified site address discovery.

## Connection and requirements

Connects to https://api.extremecloudiq.com with POST /login, GET /devices and GET /locations/site. A read-only API-capable account must have access to the target organization and locations. Site addresses are retained only when provided by ExtremeCloud IQ; unassigned devices remain unmapped. The adapter does not require or use local network access. It respects pagination and fails on 429 without inventing device outages.

## Data and privacy

API credentials are stored by the Open Map Monitor host, encrypted for the tenant. The browser never receives the stored secrets. The adapter emits normalized device events only; it does not modify vendor configuration. No icons or other images are bundled.

## Source and support

See the vendor official API documentation and your firmware/API permissions. Live vendor access is required to confirm compatibility with your deployment.

## Native branch mapping

Run **Synchronize inventory** after enabling. Devices with no assigned or usable site location still appear.

The mapping key is: Device serial, MAC or API ID, in existing priority order. Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → Extreme Networks ExtremeCloud IQ**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.

Enable **Manual branch mapping only** if provider location data should not be used. It removes address and coordinate hints from future observations while retaining device identity, logical site and status. This setting does not delete or change existing automatic or manual assignments; review and correct any existing assignments in the native mapper. With the switch off, verified location data is passed through as before.
