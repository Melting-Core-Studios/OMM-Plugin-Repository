import test from 'node:test';import assert from 'node:assert/strict';import {createPlugin} from '../src/index.mjs';
test('ExtremeCloud IQ logs in, paginates sites/devices, and retains verified addresses',async()=>{
 const events=[],calls=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:e=>events.push(...e),request:async (req)=>{
  calls.push(req.url);
  if(req.url.endsWith('/login')){assert.equal(req.body.username,'user@example.com');return {status:200,body:JSON.stringify({access_token:'x'.repeat(30)})};}
  assert.equal(req.headers.Authorization,'Bearer '+ 'x'.repeat(30));
  if(req.url.includes('/locations/site'))return {status:200,body:JSON.stringify({data:[{id:1,address:{address:'Street 12',postal_code:'4706 PS',city:'Roosendaal'},name:'HQ'}],total_pages:1})};
  return {status:200,body:JSON.stringify({data:[{serial_number:'EX-1',hostname:'AP',site_id:1,connected:true},{serial_number:'EX-2',connected:false,site_id:99}],total_pages:1})};
 }});
 await plugin.initialize({username:'user@example.com',password:'secret'});await plugin.discover();assert.equal(calls.length,3);assert.equal(events[0].status,'online');assert.equal(events[0].address,'Street 12, 4706 PS, Roosendaal');assert.equal(events[1].status,'offline');assert.equal(events[1].address,undefined);
});
test('ExtremeCloud IQ 429 does not emit events',async()=>{
 const events=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:x=>events.push(...x),request:async()=>({status:429,body:'{}'})});await plugin.initialize({username:'u',password:'p'});await assert.rejects(plugin.poll(),/rate limit/);assert.equal(events.length,0);
});
