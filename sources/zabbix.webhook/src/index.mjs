import {timingSafeEqual} from 'node:crypto';
const trim=(v,max=180)=>typeof v==='string'?v.trim().slice(0,max):'';
function trusted(header,secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('Configure a webhook receiver token of at least 32 characters');
 const actual=Buffer.from(trim(header,256)),expected=Buffer.from(secret);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('Invalid webhook token');
}
function normalizedPayload(payload,highSeverityOffline){
 const id=trim(payload.host_id||payload.hostId,160);
 if(!id)throw Error('Zabbix notification requires stable host ID');
 if(!['0','1',0,1].includes(payload.event_value))throw Error('Zabbix event_value must be 0 (recovery) or 1 (problem)');
 const recovery=String(payload.event_value)==='0';
 const severity=Number(payload.severity);
 const status=highSeverityOffline&&Number.isInteger(severity)&&severity>=4&&severity<=5?'offline':'degraded';
 const fingerprint=trim(payload.event_id,180)||'host-state';
 return {id,fingerprint,recovery,status,siteId:trim(payload.site_id,160)||null,name:trim(payload.host_name||payload.host||id,180),
  title:trim(payload.event_name,180)||undefined,detail:trim(payload.message,500)||undefined};
}
export function createPlugin(ctx){let config={},received=0,lastAt=null,lastTimestamp=0;
 const active=new Map(); // Single worker process: aggregate multiple active trigger events by stable host ID.
 function timestamp(){const parsed=Date.parse(ctx.now());const ms=Math.max(Number.isFinite(parsed)?parsed:Date.now(),lastTimestamp+1);lastTimestamp=ms;return new Date(ms).toISOString();}
 return {initialize(value){config=value||{};return {ok:true};},configChanged(value){config=value||{};return {ok:true};},
  enable(){return {ok:true};},disable(){return {ok:true};},stop(){return {ok:true};},
  health(){return {ok:true,configured:typeof config.receiverSecret==='string'&&config.receiverSecret.length>=32,received,lastAt,activeProblems:[...active.values()].reduce((n,v)=>n+v.size,0)};},
  discover(){return {ok:true,devices:active.size};},
  webhook({raw,headers}){
   const bytes=Buffer.from(raw,'base64');trusted(headers?.['x-plugin-signature'],config.receiverSecret);
   if(bytes.length>256*1024)throw Error('Zabbix notification too large');
   const data=JSON.parse(bytes.toString('utf8'));
   if(!data||Array.isArray(data)||typeof data!=='object')throw Error('Expected a Zabbix event object');
   const alert=normalizedPayload(data,config.highSeverityOffline===true);
   const known=active.get(alert.id)||new Map();
   if(alert.recovery){
    // An unknown recovery is not evidence that other alarms are gone.
    if(!known.has(alert.fingerprint))return {ok:true,verified:true,received:1,normalized:0,ignoredUnknownRecovery:true};
    known.delete(alert.fingerprint);
    if(!known.size)active.delete(alert.id);
   }else{
    if(known.size>=50&&!known.has(alert.fingerprint))throw Error('Too many active problems for a single host');
    if(!active.has(alert.id)&&active.size>=5000)throw Error('Zabbix host limit reached');
    known.set(alert.fingerprint,alert);active.set(alert.id,known);
   }
   const live=[...(active.get(alert.id)||new Map()).values()];
   const worst=live.find(x=>x.status==='offline')||live[0];
   const basis=worst||alert;
   const at=timestamp();
   ctx.emit([{deviceId:alert.id,siteId:basis.siteId,name:basis.name,status:worst?.status||'online',
    timestamp:at,title:basis.title,detail:basis.detail}]);received++;lastAt=at;
   return {ok:true,verified:true,received:1,normalized:1};
  }};
}
