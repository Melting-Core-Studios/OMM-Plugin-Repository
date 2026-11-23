import {text,identity,status,hostname,ensureJson,lifecycle,emitBatches} from './common.mjs';
export function createPlugin(ctx){
 const s={config:{},error:null,lastSync:null,devices:0,configured(){return !!(this.config.apiHost&&this.config.apiToken)}};
 async function sync(){
  if(!s.configured())throw Error('Configure an API hostname and FortiOS token');
  try{
   const host=hostname(s.config.apiHost);
   const auth={Authorization:`Bearer ${s.config.apiToken}`,Accept:'application/json'};
   const payload=ensureJson(await ctx.request({url:`https://${host}/api/v2/monitor/system/status`,headers:auth}),'FortiGate');
   if(payload?.status==='error'||payload?.http_status&&payload.http_status!==200)throw Error('FortiGate API returned an error');
   const d=payload.results||payload;
   const serial=identity(d.serial,d.serial_number,d.serialNumber,d.sn);
   if(!serial)throw Error('FortiGate system status did not provide a stable serial');
   let health='online';
   const requested=text(s.config.interfaceName,100);
   if(requested){
    // Optional: avoid falsely declaring an unreachable device because one interface is down.
    const body=ensureJson(await ctx.request({url:`https://${host}/api/v2/monitor/system/interface`,headers:auth}),'FortiGate interfaces');
    const interfaces=Array.isArray(body.results)?body.results:Object.entries(body.results||{}).map(([name,value])=>({...value,name}));
    const iface=interfaces.find(i=>i.name===requested);
    if(!iface)throw Error('Configured FortiGate interface was not returned; check interface name and API permissions');
    const current=status(iface.link??iface.link_status??iface.status);
    if(current==='offline')health='degraded';
   }
   const event={deviceId:serial,name:identity(d.hostname,d.name,serial),status:health,timestamp:ctx.now(),siteId:null};
   emitBatches(ctx,[event]);s.devices=1;s.error=null;s.lastSync=event.timestamp;
   return {ok:true,devices:1};
  }catch(e){s.error=e.message;throw e;}
 }
 return lifecycle(s,sync);
}
