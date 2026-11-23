import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
function text(value,max=180){return typeof value==='string'?value.trim().slice(0,max):'';}
function safeEqual(value,expected){const a=Buffer.from(value),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
function verify(raw,header,secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('Configure a receiver token of at least 32 characters');
 const h=text(header,250);
 if(h.startsWith('sha256=')){
  const supplied=h.slice(7);if(!/^[\da-f]{64}$/i.test(supplied))throw Error('Invalid webhook signature');
  const digest=createHmac('sha256',secret).update(raw).digest('hex');
  if(!safeEqual(supplied.toLowerCase(),digest))throw Error('Invalid webhook signature');
 }else if(!safeEqual(h,secret))throw Error('Invalid webhook token');
}
function identity(alert){
 const labels=alert.labels||{};
 const deviceId=text(labels.device_id||labels.device||labels.instance||labels.hostname||labels.host,160);
 if(!deviceId)return null;
 const desired=text(labels.omm_status).toLowerCase();
 const status=['offline','degraded','unknown'].includes(desired)?desired:'degraded';
 const fingerprint=text(alert.fingerprint,200)||createHash('sha256').update(JSON.stringify(Object.entries(labels).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
 return {deviceId,status,fingerprint,siteId:text(labels.site_id,160)||null,name:text(labels.device_name||labels.instance||labels.host,180)||deviceId,
  title:text(alert.annotations?.summary||labels.alertname,180)||undefined,detail:text(alert.annotations?.description,500)||undefined};
}
const weight={offline:4,degraded:3,unknown:1};
export function createPlugin(ctx){let config={},received=0,accepted=0,rejected=0,lastAt=null,lastTimestamp=0;
 const active=new Map(); // Per-device alert state; never let one recovery erase another firing alert.
 function timestamp(){const parsed=Date.parse(ctx.now());const ms=Math.max(Number.isFinite(parsed)?parsed:Date.now(),lastTimestamp+1);lastTimestamp=ms;return new Date(ms).toISOString();}
 return {initialize(value){config=value||{};return {ok:true};},configChanged(value){config=value||{};return {ok:true};},
  enable(){return {ok:true};},disable(){return {ok:true};},stop(){return {ok:true};},
  health(){return {ok:true,configured:typeof config.receiverSecret==='string'&&config.receiverSecret.length>=32,received,accepted,rejected,lastAt,activeAlerts:[...active.values()].reduce((n,v)=>n+v.size,0)};},
  discover(){return {ok:true,devices:active.size};},
  webhook({raw,headers}){
   const bytes=Buffer.from(raw,'base64');
   verify(bytes,headers?.['x-plugin-signature'],config.receiverSecret);
   if(bytes.length>256*1024)throw Error('Alertmanager request too large');
   const payload=JSON.parse(bytes.toString('utf8'));
   if(payload.version!=='4'||!Array.isArray(payload.alerts)||payload.alerts.length>100)throw Error('Expected Alertmanager webhook version 4, up to 100 alerts');
   const touched=new Map();let seen=0;
   for(const alert of payload.alerts){
    if(!alert||!['firing','resolved'].includes(alert.status))continue;
    const details=identity(alert);if(!details)continue;
    const deviceId=details.deviceId,entries=active.get(deviceId)||new Map();
    if(alert.status==='firing'){
     if(!entries.has(details.fingerprint)&&entries.size>=50)throw Error('Too many distinct alerts for a single device');
     if(!active.has(deviceId)&&active.size>=5000)throw Error('Alertmanager device limit reached');
     entries.set(details.fingerprint,{...details,startsAt:Date.parse(alert.startsAt)||0});active.set(deviceId,entries);
     touched.set(deviceId,details);
    }else if(entries.has(details.fingerprint)){
     const existing=entries.get(details.fingerprint),endsAt=Date.parse(alert.endsAt)||0;
     // Do not let an old resolved notification clear a newer incident that
     // re-used the same fingerprint (e.g., during Alertmanager retries).
     if(endsAt&&existing.startsAt&&endsAt<existing.startsAt)continue;
     entries.delete(details.fingerprint);
     if(entries.size)active.set(deviceId,entries);else active.delete(deviceId);
     touched.set(deviceId,details);
    }
    // Unknown recoveries are ignored: after a worker restart, the state of
    // other active problems is unknown and cannot safely be cleared.
    seen++;
   }
   const time=timestamp(),events=[];
   for(const [deviceId,last] of touched){
    const live=[...(active.get(deviceId)||new Map()).values()];
    const worst=live.sort((a,b)=>weight[b.status]-weight[a.status])[0];
    const basis=worst||last;
    events.push({deviceId,siteId:basis.siteId,name:basis.name,status:worst?.status||'online',timestamp:time,title:basis.title,detail:basis.detail});
   }
   if(events.length)ctx.emit(events);
   received+=payload.alerts.length;accepted+=events.length;rejected+=payload.alerts.length-seen;lastAt=time;
   return {ok:true,verified:true,received:payload.alerts.length,normalized:events.length,skipped:payload.alerts.length-seen};
  }};
}
