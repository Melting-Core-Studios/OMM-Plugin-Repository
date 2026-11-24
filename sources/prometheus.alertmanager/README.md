# Prometheus Alertmanager

Receives and normalizes native Alertmanager **v4 webhook notifications**, including resolved events. There is no polling and no network permission. The plugin supports Alertmanager's static HTTP header authentication or a forwarder's HMAC-SHA256 signature.

1. Install and enable **Prometheus Alertmanager** in Open Map Monitor.
2. Configure a random **receiver token of at least 32 characters** in Backoffice → Plugin settings → Prometheus Alertmanager.
3. Point Alertmanager's webhook receiver to `https://YOUR-APP/api/plugins/ingress/prometheus.alertmanager` and send the same token as `X-Plugin-Signature`. In Alertmanager's `http_config.http_headers`, use the corresponding static header secret; see your Alertmanager version's `http_header` syntax. Do not put tokens in query strings.
4. Enable `send_resolved: true` and test a firing and resolved alert. Match labels `device_id`, `device`, `instance`, `hostname` or `host` to known devices, then configure branch mapping in Open Map Monitor.

Illustrative Alertmanager configuration (where `http_headers` is supported):

```yaml
receivers:
  - name: open-map-monitor
    webhook_configs:
      - url: https://YOUR-APP/api/plugins/ingress/prometheus.alertmanager
        send_resolved: true
        http_config:
          http_headers:
            X-Plugin-Signature:
              secrets: [YOUR_RANDOM_32_PLUS_CHARACTER_TOKEN]
```

An alert with `status: firing` maps to `degraded` by default (not automatically offline). Multiple firing alerts for the same device are aggregated; resolving one alert will not clear another active alert. The worker keeps this aggregation in memory, so a restart may require Alertmanager's repeated firing notifications to rebuild active state. An unknown recovery is deliberately ignored rather than risk hiding an outage. Set label `omm_status=offline` **only** on outage alerts. Resolved alerts restore `online`. Stable device identity is mandatory; alerts with no matching identity label are skipped. Avoid using ephemeral instances or query strings as device identities. `startsAt` describes the original alert, not the reception time; newly received notifications use the current observation time.

This webhook accepts up to 100 alerts per notification. For older Alertmanager configurations without custom HTTP headers, use a trusted relay that adds the static authentication header or a per-request `sha256=<HMAC>` of raw bytes. The webhook endpoint **must not** be opened without authentication.

Official documentation: https://prometheus.io/docs/alerting/latest/configuration/#webhook_config

Tested with documented sample messages, not a live Alertmanager deployment.

## Native branch mapping

A host appears only after its first accepted firing observation. To prepare mapping, send a controlled test notification with the same stable device ID, then its matching recovery; do not use production outage severity for the test. Keep device identity labels consistent across alerts and recoveries.

The mapping key is: `device_id` label, falling back to `device`, `instance`, `hostname` or `host`. Device names may be changed without losing an assignment as long as this key is unchanged.

1. Create or import branches in Open Map Monitor using its existing branch management or workbook import.
2. Open **Backoffice → Plugin settings → Prometheus Alertmanager**.
3. Under **Device-to-branch mapping**, select **Refresh devices**, search for the device, and select the correct existing branch.
4. Confirm the branch status updates on the live map. Assign additional devices to the same branch as needed. No second location file or plugin-specific branch list is required.

Mappings are stored by Open Map Monitor, not the adapter. They survive subsequent observations and plugin updates when the device ID stays the same. Unmapped devices do not contribute to branch status.

These are alert receivers, not full host inventories. Hosts that never emit a problem cannot be pre-mapped using this adapter alone.
