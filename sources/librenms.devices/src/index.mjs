import {text,identity,status,hostname,ensureJson,lifecycle,emitBatches,bounded,coordinate} from './common.mjs';
export function createPlugin(ctx){
 const s={config:{},error:null,lastSync:null,devices:0,configured(){return !!(this.config.apiHost&&this.config.apiToken)}};
 async function sync(){
  if(!s.configured())throw Error('Configure a LibreNMS hostname and API token');
  try{
   const host=hostname(s.config.apiHost),payload=ensureJson(await ctx.request({url:`https://${host}/api/v0/devices`,headers:{Authorization:`Bearer ${s.config.apiToken}`,Accept:'application/json'}}),'LibreNMS');
   if(payload.status==='error')throw Error('LibreNMS reported an API error');
   const list=bounded(payload.devices);
   const seen=new Set(),events=[],now=ctx.now();
   for(const d of list){
    const id=identity(d.serial,d.device_id,d.hostname);if(!id||seen.has(id))continue;seen.add(id);
    const disabled=d.disabled==1||d.ignore==1;
    events.push({deviceId:id,siteId:identity(d.location_id)||null,name:identity(d.display,d.sysName,d.hostname,id),status:disabled?'unknown':status(d.status),timestamp:now,address:text(d.location,300)||undefined,latitude:coordinate(d.lat,-90,90),longitude:coordinate(d.lng,-180,180)});
   }
   emitBatches(ctx,events);s.devices=events.length;s.error=null;s.lastSync=now;return {ok:true,devices:events.length};
  }catch(e){s.error=e.message;throw e;}
 }
 return lifecycle(s,sync);
}
