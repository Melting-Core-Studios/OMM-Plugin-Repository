import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {createPlugin} from '../src/index.mjs';
test('HMAC gateway rejects invalid digest and emits verified observations',async()=>{
 let seen=[];const ctx={emit:x=>seen=x,now:()=>new Date().toISOString()};const p=createPlugin(ctx);p.initialize({sharedSecret:'key'});const raw=Buffer.from(JSON.stringify({events:[{deviceId:'d1',status:'offline'}]}));
 assert.throws(()=>p.webhook({raw:raw.toString('base64'),headers:{'x-plugin-signature':'fail'}}),/signature/);
 const sig=createHmac('sha256','key').update(raw).digest('hex');assert.equal(p.webhook({raw:raw.toString('base64'),headers:{'x-plugin-signature':sig}}).accepted,1);assert.equal(seen[0].status,'offline');
});
