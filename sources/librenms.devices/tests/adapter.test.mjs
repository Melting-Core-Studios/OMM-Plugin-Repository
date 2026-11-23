import test from 'node:test';import assert from 'node:assert/strict';import {createPlugin} from '../src/index.mjs';
test('LibreNMS reads devices, retains location strings, does not mark intentionally disabled devices as down',async()=>{
 const events=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:e=>events.push(...e),request:async ({url,headers})=>{
  assert.equal(url,'https://nms.example.com/api/v0/devices');assert.equal(headers.Authorization,'Bearer token');
  return {status:200,body:JSON.stringify({status:'ok',devices:[{device_id:1,hostname:'a',status:1,location:'Street 10, 4706 PS'},{device_id:2,hostname:'b',status:0,ignore:1}]})};
 }});await plugin.initialize({apiHost:'nms.example.com',apiToken:'token'});await plugin.discover();assert.deepEqual(events.map(e=>e.status),['online','unknown']);assert.equal(events[0].address,'Street 10, 4706 PS');
});
test('LibreNMS does not emit failed API response as offline',async()=>{const events=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:e=>events.push(...e),request:async()=>({status:403,body:'{}'})});await plugin.initialize({apiHost:'nms.example.com',apiToken:'token'});await assert.rejects(plugin.poll(),/authentication/);assert.equal(events.length,0);});
