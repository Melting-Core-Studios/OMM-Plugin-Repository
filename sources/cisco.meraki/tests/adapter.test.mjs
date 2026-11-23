import test from 'node:test';import assert from 'node:assert/strict';import {createPlugin} from '../src/index.mjs';
test('Meraki discovers device addresses and preserves offline status',async()=>{
 const events=[],ctx={now:()=>new Date().toISOString(),emit:x=>events.push(...x),request:async ({url})=>({status:200,body:JSON.stringify(url.includes('/statuses')?[{serial:'abc',status:'offline'}]:url.endsWith('/devices?perPage=1000')?[{serial:'abc',networkId:'s1',name:'Switch',address:'Street 12, 4706 PS',lat:51.4,lng:4.1}]:[{id:'s1',name:'HQ'}])})};
 const plugin=createPlugin(ctx);await plugin.initialize({orgId:'org',apiKey:'test'});await plugin.discover();assert.equal(events[0].status,'offline');assert.equal(events[0].address,'Street 12, 4706 PS');assert.equal(events[0].latitude,51.4);
});
