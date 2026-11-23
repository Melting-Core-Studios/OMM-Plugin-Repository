import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createPlugin} from '../src/index.mjs';
const now='2026-11-23T12:00:00.000Z';
const secret='34ec67f2150c438e9a08f7c62fb0e653a0d2a28789cbb54f';
const firing={version:'4',alerts:[{status:'firing',labels:{instance:'gateway-1',alertname:'WAN Down',omm_status:'offline'},
 annotations:{summary:'WAN Down',description:'Uplink lost'},fingerprint:'aabb',startsAt:'2026-01-01T00:00:00Z'}]};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64');
test('Alertmanager static-header token emits authenticated outage and its recovery',async()=>{
 const out=[],p=createPlugin({emit:x=>out.push(...x),now:()=>now});
 await p.initialize({receiverSecret:secret});
 const result=await p.webhook({raw:b64(firing),headers:{'x-plugin-signature':secret}});
 assert.equal(result.verified,true);assert.equal(result.normalized,1);
 assert.equal(out[0].deviceId,'gateway-1');assert.equal(out[0].status,'offline');assert.equal(out[0].timestamp,now);
 assert.equal(out[0].address,undefined); // Labels cannot be treated as verified physical addresses.
 const recovered={...firing,alerts:[{...firing.alerts[0],status:'resolved',endsAt:now}]};
 await p.webhook({raw:b64(recovered),headers:{'x-plugin-signature':secret}});
 assert.equal(out[1].status,'online');
});
test('Alertmanager accepts optional HMAC token for a trusted relay and rejects tampering',async()=>{
 const out=[],p=createPlugin({emit:x=>out.push(...x),now:()=>now});await p.initialize({receiverSecret:secret});
 const raw=Buffer.from(JSON.stringify(firing)),signature=createHmac('sha256',secret).update(raw).digest('hex');
 await p.webhook({raw:raw.toString('base64'),headers:{'x-plugin-signature':`sha256=${signature}`}});
 assert.throws(()=>p.webhook({raw:b64({...firing,status:'resolved'}),headers:{'x-plugin-signature':`sha256=${signature}`}}),/signature/);
 assert.throws(()=>p.webhook({raw:raw.toString('base64'),headers:{'x-plugin-signature':'wrong'}}),/token/);
 assert.equal(out.length,1);
});
test('Alertmanager skips alerts without stable device labels, without guessing location',async()=>{
 const out=[],p=createPlugin({emit:x=>out.push(...x),now:()=>now});await p.initialize({receiverSecret:secret});
 const msg={version:'4',alerts:[{status:'firing',labels:{alertname:'test'},annotations:{}},
 {status:'firing',labels:{device_id:'switch-9'},annotations:{summary:'High temp'}}]};
 const result=await p.webhook({raw:b64(msg),headers:{'x-plugin-signature':secret}});
 assert.equal(result.skipped,1);assert.equal(out[0].status,'degraded');assert.equal(out[0].deviceId,'switch-9');
 assert.equal(out.length,1);
});
test('Alertmanager rejects unsupported versions, oversized bursts, and short receiver secrets',async()=>{
 const p=createPlugin({emit:()=>{},now:()=>now});await p.initialize({receiverSecret:secret});
 for(const msg of [{version:'3',alerts:[]},{version:'4',alerts:Array(101).fill({status:'firing',labels:{instance:'x'}})}])
  assert.throws(()=>p.webhook({raw:b64(msg),headers:{'x-plugin-signature':secret}}),/Expected/);
 await p.configChanged({receiverSecret:'short'});
 assert.throws(()=>p.webhook({raw:b64(firing),headers:{'x-plugin-signature':'short'}}),/at least 32/);
});
test('Alertmanager keeps the remaining active outage when another alert resolves',async()=>{
 const out=[],p=createPlugin({emit:x=>out.push(...x),now:()=>now});await p.initialize({receiverSecret:secret});
 const offline={status:'firing',labels:{device_id:'router-1',alertname:'Uplink',omm_status:'offline'},fingerprint:'link-1',startsAt:now};
 const temperature={status:'firing',labels:{device_id:'router-1',alertname:'Temp'},fingerprint:'temp-1',startsAt:now};
 let body={version:'4',alerts:[offline,temperature]};
 const result=await p.webhook({raw:b64(body),headers:{'x-plugin-signature':secret}});
 assert.equal(result.normalized,1,'Two alerts for one device become one aggregate observation');
 assert.equal(out.at(-1).status,'offline');
 body={version:'4',alerts:[{...temperature,status:'resolved',endsAt:now}]};
 await p.webhook({raw:b64(body),headers:{'x-plugin-signature':secret}});
 assert.equal(out.at(-1).status,'offline','Temperature recovery must not clear the uplink outage');
 body={version:'4',alerts:[{...offline,status:'resolved',endsAt:now}]};
 await p.webhook({raw:b64(body),headers:{'x-plugin-signature':secret}});
 assert.equal(out.at(-1).status,'online');
});
test('Alertmanager refuses unknown recoveries rather than clearing persisted host status',async()=>{
 const out=[],p=createPlugin({emit:x=>out.push(...x),now:()=>now});await p.initialize({receiverSecret:secret});
 const result=await p.webhook({raw:b64({version:'4',alerts:[{...firing.alerts[0],status:'resolved',endsAt:now}]}),headers:{'x-plugin-signature':secret}});
 assert.equal(result.normalized,0);assert.equal(out.length,0);
});
