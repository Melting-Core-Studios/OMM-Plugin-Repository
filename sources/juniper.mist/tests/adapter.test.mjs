import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {createPlugin} from '../src/index.mjs';
test('Mist discovery emits normalized status and signed webhooks reject unsigned bodies',async()=>{
 const events=[];const ctx={now:()=>new Date().toISOString(),emit:x=>events.push(...x),request:async x=>({status:200,body:JSON.stringify(x.url.includes('stats/devices')?[{id:'mac-1',site_id:'s1',connected:false}]:[{id:'s1',name:'Office',address:'Main 4',latlng:{lat:52,lng:4}}])})};
 const plugin=createPlugin(ctx);await plugin.initialize({host:'api.eu.mist.com',orgId:'org-1',apiToken:'test',webhookSecret:'test-key'});
 await plugin.discover();assert.equal(events[0].status,'offline');assert.equal(events[0].siteId,'s1');
 const raw=Buffer.from(JSON.stringify({topic:'device-updowns',events:[{org_id:'org-1',type:'ap_connected',device_id:'mac-1',site_id:'s1'}]}));
 await assert.rejects(plugin.webhook({raw:raw.toString('base64'),headers:{'x-mist-signature-v2':'invalid'}}),/signature/);
 const sig=createHmac('sha256','test-key').update(raw).digest('hex');const result=await plugin.webhook({raw:raw.toString('base64'),headers:{'x-mist-signature-v2':sig}});assert.equal(result.verified,true);assert.equal(events.at(-1).status,'online');
});
