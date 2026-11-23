// Paste this script into a Zabbix Webhook media type (JavaScript runtime).
// Configure parameter names: url, secret, host_id, host_name, event_value,
// event_name, severity, event_id, site_id, message.
var p=JSON.parse(value);
if(!/^https:\/\//.test(p.url))throw 'The Open Map Monitor webhook URL must use HTTPS';
if(!p.secret||p.secret.length<32)throw 'Configure a strong receiver token';
if(!p.host_id)throw 'Host ID is missing; configure {HOST.ID}';
var req=new HttpRequest();
req.addHeader('Content-Type: application/json');
req.addHeader('X-Plugin-Signature: '+p.secret);
var body=JSON.stringify({host_id:p.host_id,host_name:p.host_name,event_value:p.event_value,
 event_name:p.event_name,severity:p.severity,event_id:p.event_id,site_id:p.site_id,message:p.message});
var response=req.post(p.url,body);
if(req.getStatus()<200||req.getStatus()>=300)throw 'Open Map Monitor returned HTTP '+req.getStatus();
return 'OK';
