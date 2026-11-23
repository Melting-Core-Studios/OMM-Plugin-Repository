# Ubiquiti UniFi Site Manager

Monitors UniFi devices through the **official cloud Site Manager API**, not through a local controller or undocumented endpoints. No local collector is required. The plugin reads device connectivity and site inventory; it never changes UniFi settings.

1. Create an API key in [UniFi Site Manager](https://unifi.ui.com) → Settings → API Keys. Grant the account access to the sites to be monitored.
2. In Open Map Monitor, install this plugin, then open Backoffice → Plugin settings → Ubiquiti UniFi Site Manager.
3. Paste the API key, enable the plugin, and select **Discover** or **Test connection**. Review unmapped devices before assigning them to branches.

The adapter polls `GET https://api.ui.com/v1/sites` and `GET https://api.ui.com/v1/devices` every five minutes, following bounded `nextToken` pagination. It reports `online`, `offline`, `degraded` or `unknown` depending on API data, with no guessing. Account access may restrict site inventory; device monitoring can still operate when the sites endpoint is unavailable.

**Address caveat:** Site Manager may not expose postal addresses or coordinates. The adapter never constructs a location from a device name, public IP or country; assign branch locations manually when none are supplied. Device identifiers prefer MAC, serial or API device ID. API availability, site permissions and rate limits depend on the UniFi account and firmware.

Official documentation: https://developer.ui.com/site-manager/v1.0.0/gettingstarted

This adapter has been tested using mocked API responses, not a live customer's UniFi API key.
