import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHmac} from 'node:crypto';
import {build} from '../scripts/publish-plugin.mjs';
const secret='test-only-secret-at-least-32-characters';
const physical='Example Street 12, 4706 PS';
const response=x=>({status:200,body:JSON.stringify(x)});
const conditional={
 'cisco.meraki':{config:{orgId:'org',apiKey:secret},id:'meraki-serial',request:({url})=>response(url.includes('/statuses')?[{serial:'meraki-serial',status:'offline'}]:url.includes('/networks')?[{id:'net'}]:[{serial:'meraki-serial',networkId:'net',address:physical,lat:51.4,lng:4.1}])},
 'extreme.cloudiq':{config:{username:'test-user',password:secret},id:'extreme-serial',request:({url})=>response(url.endsWith('/login')?{access_token:secret}:url.includes('/locations/site')?{data:[{id:'site',address:physical,latitude:51.4,longitude:4.1}],total_pages:1}:{data:[{serial_number:'extreme-serial',site_id:'site',connected:false}],total_pages:1})},
 'librenms.devices':{config:{apiHost:'nms.example.com',apiToken:secret},id:'libre-serial',request:()=>response({devices:[{serial:'libre-serial',status:0,location:physical,lat:51.4,lng:4.1}]})},
 'ubiquiti.unifi':{config:{apiKey:secret},id:'unifi-serial',request:({url})=>response(url.includes('/sites')?{data:[{id:'site',address:physical,location:{lat:51.4,lng:4.1}}]}:{data:[{serial:'unifi-serial',siteId:'site',status:'offline'}]})},
 'generic.signed-webhook':{config:{sharedSecret:secret},id:'generic-id',webhook:()=>({events:[{deviceId:'generic-id',status:'offline',address:physical,latitude:51.4,longitude:4.1}]}),hmac:true}
};
const manual={
 'fortinet.fortigate':{config:{apiHost:'fw.example.com',apiToken:secret,interfaceName:'wan1'},id:'FGT-1',status:'degraded',request:({url})=>response(url.endsWith('/interface')?{results:[{name:'wan1',status:'down'}]}:{results:{serial:'FGT-1',hostname:'Firewall'}})},
 'fortinet.fortimanager':{config:{apiHost:'fmg.example.com',apiToken:secret,adom:'root'},id:'FGT-2',status:'offline',request:()=>response({result:[{status:{code:0},data:[{sn:'FGT-2',name:'Firewall 2',conn_status:0}]}]})},
 'mikrotik.routeros':{config:{apiHost:'router.example.com',username:'user',password:secret,interfaceName:'ether1'},id:'router.example.com',status:'degraded',request:({url})=>response(url.endsWith('/interface')?[{name:'ether1',running:false,disabled:false}]:{name:'Router 1'})},
 'prometheus.alertmanager':{config:{receiverSecret:secret},id:'prom-host',status:'offline',webhook:()=>({version:'4',alerts:[{status:'firing',labels:{device_id:'prom-host',site_id:'logical-site',omm_status:'offline'},fingerprint:'test-incident'}]})},
 'zabbix.webhook':{config:{receiverSecret:secret,highSeverityOffline:true},id:'12345',status:'offline',webhook:()=>({host_id:'12345',host_name:'Test host',site_id:'logical-site',event_id:'test-incident',event_value:'1',severity:'5'})}
};
const fixtures={...conditional,...manual};
async function adapter(id,f,emit,now){
 const {createPlugin}=await import(`../sources/${id}/src/index.mjs`);
 return createPlugin({emit,now,request:async req=>{assert.ok(f.request,'Unexpected broker request');return f.request(req);}});
}
async function observe(p,f){
 if(!f.webhook)return p.discover();
 const bytes=Buffer.from(JSON.stringify(f.webhook()));
 return p.webhook({raw:bytes.toString('base64'),headers:{'x-plugin-signature':f.hmac?createHmac('sha256',secret).update(bytes).digest('hex'):secret}});
}
for(const [id,f] of Object.entries(fixtures))test(`${id}: stable device identity and native manual mapping event contract`,async()=>{
 const events=[],p=await adapter(id,f,batch=>events.push(...batch),()=>new Date().toISOString());
 await p.initialize(f.config);await observe(p,f);
 assert.equal(events.length,1);const first=events[0];assert.equal(first.deviceId,f.id);assert.equal(first.status,f.status||'offline');
 if(id in conditional){
  assert.equal(first.address,physical);assert.equal(first.latitude,51.4);assert.equal(first.longitude,4.1);
  await p.configChanged({...f.config,manualMappingOnly:true});await observe(p,f);
  const next=events[1];assert.equal(next.deviceId,first.deviceId);assert.equal(next.siteId,first.siteId);assert.equal(next.status,first.status);assert.equal(next.address,undefined);assert.equal(next.latitude,null);assert.equal(next.longitude,null);
  await p.configChanged({...f.config,manualMappingOnly:false});await observe(p,f);assert.equal(events[2].address,physical);
 }else{assert.equal(first.address,undefined);assert.equal(first.latitude,undefined);assert.equal(first.longitude,undefined);}
 if(id==='fortinet.fortimanager')assert.equal(first.siteId,null,'ADOM is not a geographical site');
});
test('Meraki exposes large addressless inventory in bounded batches rather than dropping it',async()=>{
 const f=conditional['cisco.meraki'],batches=[];
 const p=await adapter('cisco.meraki',{...f,request:({url})=>response(url.includes('/statuses')||url.includes('/networks')?[]:Array.from({length:231},(_,i)=>({serial:`serial-${i}`})))},x=>batches.push(x),()=>new Date().toISOString());
 await p.initialize(f.config);await p.discover();assert.deepEqual(batches.map(x=>x.length),[100,100,31]);assert.equal(batches.flat().every(e=>!e.address&&e.status==='unknown'),true);
});
test('all ten revised sources produce valid package archives',()=>{
 for(const id of Object.keys(fixtures)){const {manifest,runtime,bytes}=build(id);assert.equal(manifest.version,runtime.version);assert.ok(bytes.length>0);}
});
// Run against a separately supplied, unmodified application checkout.
// OMM_CORE_ROOT is optional for the portable repository unit suite.
const core=process.env.OMM_CORE_ROOT;
test('all ten adapters integrate with the real core mapper, persistence and upgrades',{skip:!core&&'Set OMM_CORE_ROOT to the application checkout'},async t=>{
 const {createPluginManager}=await import(pathToFileURL(path.join(core,'server/plugins.js')).href);
 const {validatePluginManifest}=await import(pathToFileURL(path.join(core,'server/plugin-manifest.js')).href);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'omm-mapping-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const previousKey=process.env.DATA_ENCRYPTION_KEY;process.env.DATA_ENCRYPTION_KEY='ab'.repeat(32);t.after(()=>{if(previousKey===undefined)delete process.env.DATA_ENCRYPTION_KEY;else process.env.DATA_ENCRYPTION_KEY=previousKey;});
 const branches=[{id:'imported-a',name:'Imported A',postcode:'4706 PS',number:'12',status:'online'},{id:'imported-b',name:'Imported B',postcode:'4706 PS',number:'14',status:'online'}];
 const index=JSON.parse(fs.readFileSync(new URL('../repo.json',import.meta.url)));
 for(const [id,f] of Object.entries(fixtures)){
  await t.test(id,async()=>{
   let clock=Date.now(),revision=0;const manifest=validatePluginManifest(JSON.parse(fs.readFileSync(new URL(`../sources/${id}/manifest.json`,import.meta.url))));
   const old=index.plugins.find(x=>x.id===id).versions.find(x=>x.version==='1.0.0').manifest;
   let current=old;
   const opts={filePath:path.join(temp,id+'.json'),builtInMist:false,branches:()=>branches,now:()=>clock,notify:()=>revision++,catalogue:async()=>({configured:true,items:[{manifest:current,signature:'test-fixture'}]})};
   let manager=createPluginManager(opts);await manager.install(id);manager.rotateKey(id);manager.updateConfig(id,f.config);manager.setEnabled(id,true);
   // Existing assignments must survive an update. Exercise the real manager with a baseline observation.
   manager.ingestWorker(id,{events:[{deviceId:f.id,status:'online',timestamp:new Date(clock).toISOString()}]});
   manager.mapDevice(id,f.id,'imported-b',branches.map(b=>b.id));
   current=manifest;await manager.install(id);clock+=1000;
   const config={...f.config,...(id in conditional?{manualMappingOnly:true}:{})};manager.updateConfig(id,config);
   const p=await adapter(id,f,events=>manager.ingestWorker(id,{events}),()=>new Date(clock).toISOString());await p.initialize(config);await observe(p,f);
   let d=manager.devices(id)[0];assert.equal(d.id,f.id);assert.equal(d.branchId,'imported-b');assert.equal(d.mappingSource,'manual');assert.equal(d.address,null);
   assert.equal(manager.apply(branches)[1].status,f.status||'offline');assert.equal(manager.apply(branches)[0].status,'online');
   // Persisted assignments are still available after manager restart.
   manager=createPluginManager(opts);assert.equal(manager.devices(id)[0].branchId,'imported-b');
   manager.mapDevice(id,f.id,null,branches.map(b=>b.id));clock+=1000;await observe(p,f);assert.equal(manager.devices(id)[0].branchId,null);assert.equal(manager.apply(branches)[1].status,'online');
   if(id in conditional){await p.configChanged(f.config);clock+=1000;await observe(p,f);assert.equal(manager.devices(id)[0].branchId,'imported-a');assert.equal(manager.devices(id)[0].mappingSource,'verified-address');await p.configChanged(config);clock+=1000;await observe(p,f);assert.equal(manager.devices(id)[0].branchId,'imported-a','manual-only switch must not erase saved assignments');}
   assert.ok(revision>0);
  });
 }
});
