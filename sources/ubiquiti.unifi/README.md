# Ubiquiti UniFi Site Manager

Monitors UniFi devices through the **official cloud Site Manager API**, not through a local controller or undocumented endpoints. No local collector is required. The plugin reads device connectivity and site inventory; it never changes UniFi settings.

1. Create an API key in [UniFi Site Manager](https://unifi.ui.com) → Settings → API Keys. Grant the account access to the sites to be monitored.
2. In Open Map Monitor, install this plugin, then open Backoffice → Plugin settings → Ubiquiti UniFi Site Manager.
3. Paste the API key, enable the plugin, and select **Discover** or **Test connection**. Review unmapped devices before assigning them to branches.

The adapter polls `GET https://api.ui.com/v1/sites` and `GET https://api.ui.com/v1/devices` every five minutes, following bounded `nextToken` pagination. It reports `online`, `offline`, `degraded` or `unknown` depending on API data, with no guessing. Account access may restrict site inventory; device monitoring can still operate when the sites endpoint is unavailable.

**Address caveat:** Site Manager may not expose postal addresses or coordinates. The adapter never constructs a location from a device name, public IP or country; assign branch locations manually when none are supplied. Device identifiers prefer MAC, serial or API device ID. API availability, site permissions and rate limits depend on the UniFi account and firmware.

Official documentation: https://developer.ui.com/site-manager/v1.0.0/gettingstarted

This adapter has been tested using mocked API responses, not a live customer's UniFi API key.

## Native branch mapping

Run **Synchronize inventory** after enabling. Missing site location does not prevent manual device assignment.

The mapping key is: Existing UniFi device key (MAC, serial or API ID). Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → Ubiquiti UniFi Site Manager**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.

Enable **Manual branch mapping only** if provider location data should not be used. It removes address and coordinate hints from future observations while retaining device identity, logical site and status. This setting does not delete or change existing automatic or manual assignments; review and correct any existing assignments in the native mapper. With the switch off, verified location data is passed through as before.
