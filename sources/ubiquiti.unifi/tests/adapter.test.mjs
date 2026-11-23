import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlugin} from '../src/index.mjs';

const base='2026-11-23T12:00:00.000Z';
const response=x=>({status:200,body:JSON.stringify(x)});
test('UniFi Site Manager inventories paginated devices and keeps only supplied locations',async()=>{
 const events=[],calls=[];
 const requests=async ({url,headers})=>{
  const target=new URL(url);calls.push(target);
  assert.equal(headers['X-API-KEY'],'test-api-key');
  assert.equal(target.hostname,'api.ui.com');
  if(target.pathname==='/v1/sites')return response({data:[{id:'s1',meta:{location:{address:{street:'High Street 10',postcode:'1000 AA',city:'Amsterdam'},lat:52.3,lon:4.8}}}]});
  if(target.searchParams.get('nextToken')==='second')return response({data:[{id:'c',siteId:'s1',status:'offline',name:'Switch',serial:'SN-1'}]});
  return response({data:[{devices:[{macAddress:'AA:BB',name:'AP',status:'online',siteId:'s1'},
   {macAddress:'CC:DD',status:'pending',siteId:'unknown'}]}, {macAddress:'EE:FF',status:'isolated',siteId:'s1'}],nextToken:'second'});
 };
 const p=createPlugin({request:requests,emit:x=>events.push(x),now:()=>base});
 await p.initialize({apiKey:'test-api-key'});
 const inventory=await p.discover();
 assert.equal(inventory.devices,4);assert.equal(inventory.sites,1);
 assert.equal(events.length,1);const all=events.flat();
 assert.equal(all.find(x=>x.deviceId==='AA:BB').address,'High Street 10, 1000 AA, Amsterdam');
 assert.equal(all.find(x=>x.deviceId==='AA:BB').latitude,52.3);
 assert.equal(all.find(x=>x.deviceId==='CC:DD').address,undefined);
 assert.equal(all.find(x=>x.deviceId==='CC:DD').status,'unknown');
 assert.equal(all.find(x=>x.deviceId==='SN-1').status,'offline');
 assert.equal(all.find(x=>x.deviceId==='EE:FF').status,'degraded');
 assert.equal(calls.length,3);
 assert.equal((await p.health()).ok,true);
});
test('UniFi paginated inventory detects cursor loops and never emits partial snapshots',async()=>{
 const events=[],p=createPlugin({emit:x=>events.push(x),now:()=>base,request:async({url})=>
  url.includes('/sites')?response({data:[]}):response({data:[{macAddress:'AA:BB',status:'online'}],nextToken:'loop'})});
 await p.initialize({apiKey:'test-api-key'});
 await assert.rejects(p.poll(),/cursor invalid or repeated/);
 assert.equal(events.length,0);
 assert.equal((await p.health()).ok,false);
});
test('UniFi invalid API key does not emit online observations and reports configuration error',async()=>{
 let emitted=false;
 const p=createPlugin({emit:()=>{emitted=true;},now:()=>base,request:async()=>({status:401,body:''})});
 await p.initialize({apiKey:'bad'});
 await assert.rejects(p.discover(),/key rejected/);
 assert.equal(emitted,false);
});
test('UniFi splits observations into <=100 event batches',async()=>{
 const calls=[];
 const p=createPlugin({emit:x=>calls.push(x),now:()=>base,request:async({url})=>url.includes('sites')?response({data:[]}):
  response({data:Array.from({length:230},(_,i)=>({id:`device-${i}`,status:'online'}))})});
 await p.initialize({apiKey:'key'});await p.discover();
 assert.deepEqual(calls.map(x=>x.length),[100,100,30]);
});
