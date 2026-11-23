import test from 'node:test';import assert from 'node:assert/strict';import {createPlugin} from '../src/index.mjs';
test('RouterOS v7 reads router identity and the optional critical interface',async()=>{
 const events=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:x=>events.push(...x),request:async (req)=>{
  assert.ok(req.headers.Authorization.startsWith('Basic '));return {status:200,body:JSON.stringify(req.url.endsWith('/interface')?[{name:'ether1',running:false,disabled:false}]:{name:'Router-1'})};
 }});await plugin.initialize({apiHost:'router.example.com',username:'user',password:'secret',interfaceName:'ether1'});await plugin.discover();assert.equal(events[0].status,'degraded');assert.equal(events[0].name,'Router-1');
});
test('RouterOS refuses a private IP or untrusted endpoint',async()=>{const plugin=createPlugin({now:()=>new Date().toISOString(),emit:()=>{throw Error('not reached');},request:async()=>({status:200,body:'{}'})});await plugin.initialize({apiHost:'10.0.0.1',username:'u',password:'p'});await assert.rejects(plugin.discover(),/public HTTPS/);});
