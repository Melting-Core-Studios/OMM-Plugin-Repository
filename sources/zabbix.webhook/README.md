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
