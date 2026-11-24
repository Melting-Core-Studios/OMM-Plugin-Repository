import test from 'node:test';import assert from 'node:assert/strict';import {createPlugin} from '../src/index.mjs';
test('FortiManager lists managed devices via read-only JSON RPC and interprets conn_status',async()=>{
 const events=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:e=>events.push(...e),request:async (req)=>{
  assert.equal(req.url,'https://fmg.example.com/jsonrpc');assert.equal(req.method,'POST');assert.equal(req.body.method,'get');assert.equal(req.body.params[0].url,'/dvmdb/adom/root/device');
  return {status:200,body:JSON.stringify({result:[{status:{code:0},data:[{sn:'FGT-A',name:'appliance-a',conn_status:1},{sn:'FGT-B',conn_status:0},{name:'unknown',conn_status:null}]}]})};
 }});
 await plugin.initialize({apiHost:'fmg.example.com',apiToken:'token',adom:'root'});await plugin.discover();assert.deepEqual(events.map(x=>x.status),['online','offline','unknown']);assert.deepEqual(events.map(x=>x.siteId),[null,null,null]);
});
test('FortiManager RPC errors are not silently interpreted as device offline',async()=>{
 const events=[];const plugin=createPlugin({now:()=>new Date().toISOString(),emit:e=>events.push(...e),request:async()=>({status:200,body:JSON.stringify({result:[{status:{code:-3}}]})})});
 await plugin.initialize({apiHost:'fmg.example.com',apiToken:'token',adom:'root'});await assert.rejects(plugin.discover(),/status -3/);assert.equal(events.length,0);
});
