import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlugin} from '../src/index.mjs';
const now='2026-11-23T12:00:00.000Z',secret='zabbix-random-86fd5a3a4d3d9b3e7ec9f1ff';
const msg={host_id:'10291',host_name:'Main router',event_value:'1',severity:'5',event_name:'High CPU',message:'CPU too hot',event_id:'482'};
const input=(m,header=secret)=>({raw:Buffer.from(JSON.stringify(m)).toString('base64'),headers:{'x-plugin-signature':header}});
test('Zabbix problem and recovery normalize stable host IDs conservatively',async()=>{
 const events=[],p=createPlugin({emit:x=>events.push(...x),now:()=>now});await p.initialize({receiverSecret:secret,highSeverityOffline:false});
 await p.webhook(input(msg));assert.equal(events[0].status,'degraded');assert.equal(events[0].deviceId,'10291');
 await p.webhook(input({...msg,event_value:'0'}));assert.equal(events[1].status,'online');
 assert.equal((await p.health()).received,2);
});
test('Zabbix high-severity offline requires administrator opt-in',async()=>{
 const events=[],p=createPlugin({emit:x=>events.push(...x),now:()=>now});
 await p.initialize({receiverSecret:secret,highSeverityOffline:true});
 await p.webhook(input(msg));assert.equal(events[0].status,'offline');
 await p.webhook(input({...msg,severity:'3'}));assert.equal(events[1].status,'degraded');
});
test('Zabbix denies missing/incorrect tokens, fabricated IDs and malformed recovery states',async()=>{
 const events=[],p=createPlugin({emit:x=>events.push(...x),now:()=>now});await p.initialize({receiverSecret:secret});
 assert.throws(()=>p.webhook(input(msg,'wrong')),/token/);
 assert.throws(()=>p.webhook(input({...msg,host_id:''})),/stable host ID/);
 assert.throws(()=>p.webhook(input({...msg,event_value:'3'})),/event_value/);
 assert.equal(events.length,0);
});
test('Zabbix correlates separate problem IDs and resolves only the recovered problem',async()=>{
 const events=[],p=createPlugin({emit:x=>events.push(...x),now:()=>now});
 await p.initialize({receiverSecret:secret,highSeverityOffline:true});
 await p.webhook(input({...msg,event_id:'100',severity:'5'}));
 await p.webhook(input({...msg,event_id:'200',severity:'2'}));
 assert.equal(events.at(-1).status,'offline');
 await p.webhook(input({...msg,event_id:'200',event_value:'0'}));
 assert.equal(events.at(-1).status,'offline');
 await p.webhook(input({...msg,event_id:'100',event_value:'0'}));
 assert.equal(events.at(-1).status,'online');
});
test('Zabbix ignores unknown recovery events rather than falsely clearing a live outage',async()=>{
 const events=[],p=createPlugin({emit:x=>events.push(...x),now:()=>now});await p.initialize({receiverSecret:secret});
 const response=await p.webhook(input({...msg,event_value:'0',event_id:'not-seen'}));
 assert.equal(response.ignoredUnknownRecovery,true);assert.equal(events.length,0);
});
