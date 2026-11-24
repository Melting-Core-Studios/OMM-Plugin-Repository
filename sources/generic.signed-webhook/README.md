# Signed JSON Webhook

Generic HMAC-SHA256 webhook event gateway. Sends verified normalized observations to the existing map event stream.

Configure via Backoffice → Plugin settings. All data access is performed server-side. No images are included.

## Native branch mapping

Send a correctly signed observation for each device. An initial `unknown` observation is appropriate only when its status is genuinely unknown; never send it to replace a known live status merely to register inventory.

The mapping key is: Sender-provided `deviceId`. Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → Signed JSON Webhook**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.

Enable **Manual branch mapping only** if provider location data should not be used. It removes address and coordinate hints from future observations while retaining device identity, logical site and status. This setting does not delete or change existing automatic or manual assignments; review and correct any existing assignments in the native mapper. With the switch off, verified location data is passed through as before.
