import test from 'node:test';import assert from 'node:assert/strict';import {createPlugin} from '../src/index.mjs';
test('FortiGate system status reports a real serial and optional degraded uplink',async()=>{
 const events=[],calls=[];const plugin=createPlugin({now:()=>new Date('2026-11-23T00:00:00Z').toISOString(),emit:ev=>events.push(...ev),request:async ({url,headers})=>{
  calls.push(url);assert.equal(headers.Authorization,'Bearer token');return {status:200,body:JSON.stringify(url.endsWith('/interface')?{results:[{name:'wan1',status:'down'}]}:{results:{serial:'FGT12345',hostname:'FW-01'}})};
 }});
 await plugin.initialize({apiHost:'fw.example.com',apiToken:'token',interfaceName:'wan1'});await plugin.discover();assert.equal(events[0].deviceId,'FGT12345');assert.equal(events[0].status,'degraded');assert.equal(calls.length,2);
});
test('FortiGate rejects invalid hostname and does not invent offline events on API failure',async()=>{
 const events=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:ev=>events.push(...ev),request:async()=>({status:401,body:'{}'})});
 await plugin.initialize({apiHost:'192.168.1.1',apiToken:'token'});await assert.rejects(plugin.discover(),/public HTTPS/);await plugin.configChanged({apiHost:'fw.example.com',apiToken:'token'});await assert.rejects(plugin.poll(),/authentication/);assert.equal(events.length,0);
});
