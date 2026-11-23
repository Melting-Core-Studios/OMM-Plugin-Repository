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
