# Zabbix Alert Webhook

Receives signed-header notifications from the Zabbix **Webhook media type**, including problem and recovery actions. The adapter performs no API polling and requires no direct connection from Open Map Monitor into a private Zabbix server.

1. Install **Zabbix Alert Webhook** and configure a random receiver token of at least 32 characters in Backoffice → Plugin settings.
2. In Zabbix, go to **Alerts → Media types** and create a media type of type **Webhook**.
3. Copy the packaged `resources/zabbix-media-type.js` into the script field. Configure these media type parameters:

| Parameter | Value |
| --- | --- |
| `url` | `https://YOUR-APP/api/plugins/ingress/zabbix.webhook` |
| `secret` | The same strong receiver token configured in Open Map Monitor |
| `host_id` | `{HOST.ID}` |
| `host_name` | `{HOST.NAME}` |
| `event_value` | `{EVENT.VALUE}` |
| `event_name` | `{EVENT.NAME}` |
| `severity` | `{EVENT.NSEVERITY}` |
| `event_id` | `{EVENT.ID}` |
| `site_id` | Leave blank unless you have a verified site identifier |
| `message` | `{ALERT.MESSAGE}` |

4. Assign the webhook media type to a dedicated Zabbix user and configure an action with **problem and recovery operations**. Test both; map each host to a branch in Backoffice.

Problems map to `degraded` by default, regardless of severity, because a severe software trigger does **not** prove network equipment is offline. The optional **Treat high/disaster as offline** switch changes this behavior explicitly. Recovery (`event_value=0`) maps to `online` only when no other known problem remains active for the same host. The plugin tracks alert IDs in memory, so after a worker restart it cannot definitively reconstruct older, still-active Zabbix problems without a replay or reconciliation feed. A recovery it cannot correlate is ignored rather than clearing an unrelated outage. For reliable multi-trigger monitoring across restarts, configure periodic state replay or use a polling-capable adapter.

Zabbix macros used in some event types can be unavailable; this adapter deliberately rejects notifications without a stable host ID rather than inventing one. The token is passed only as an HTTPS request header, never in the URL.

Official documentation: https://www.zabbix.com/documentation/current/en/manual/config/notifications/media/webhook

Tested using synthetic media-type notifications; a live Zabbix installation has not been tested.

## Native branch mapping

A host appears only after its first accepted problem observation. Use a controlled test problem and matching recovery with the real host ID to prepare mapping. A recovery alone does not register a new host.

The mapping key is: Zabbix `host_id` (not the display name). Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → Zabbix Alert Webhook**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.

These are alert receivers, not full host inventories. Hosts that never emit a problem cannot be pre-mapped using this adapter alone.
