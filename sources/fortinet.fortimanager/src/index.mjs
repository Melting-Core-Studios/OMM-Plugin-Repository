import {text,identity,status,hostname,ensureJson,lifecycle,emitBatches,bounded} from './common.mjs';
export function createPlugin(ctx){
 const s={config:{},error:null,lastSync:null,devices:0,configured(){return !!(this.config.apiHost&&this.config.apiToken&&this.config.adom)}};
 async function sync(){
  if(!s.configured())throw Error('Configure a FortiManager hostname, token and ADOM');
  try{
   const host=hostname(s.config.apiHost),adom=text(s.config.adom,64);
   if(!/^[a-z0-9_.-]{1,64}$/i.test(adom))throw Error('FortiManager ADOM name contains unsupported characters');
   const request={id:1,method:'get',params:[{option:['no loadsub'],url:`/dvmdb/adom/${adom}/device`}],verbose:1};
   const response=ensureJson(await ctx.request({url:`https://${host}/jsonrpc`,method:'POST',headers:{Authorization:`Bearer ${s.config.apiToken}`,'Content-Type':'application/json',Accept:'application/json'},body:request}),'FortiManager');
   const item=response?.result?.[0];
   if(item?.status?.code!==0)throw Error(`FortiManager JSON-RPC returned status ${item?.status?.code??'unknown'}`);
   const devices=bounded(Array.isArray(item.data)?item.data:item.data&&typeof item.data==='object'?[item.data]:null);
   const events=[],seen=new Set(),now=ctx.now();
   for(const d of devices){
    if(!d||typeof d!=='object')continue;
    const id=identity(d.sn,d.serial,d.serial_number,d.name);if(!id||seen.has(id))continue;seen.add(id);
    const connection=status(d.conn_status??d.connect_status??d.connection_status);
    const config=String(d.conf_status||'').toLowerCase();
    events.push({deviceId:id,name:identity(d.hostname,d.name,id),siteId:null,status:connection==='online'&&['outofsync','out-of-sync','modified'].includes(config)?'degraded':connection,timestamp:now});
   }
   emitBatches(ctx,events);s.error=null;s.lastSync=now;s.devices=events.length;return {ok:true,devices:events.length,adom};
  }catch(e){s.error=e.message;throw e;}
 }
 return lifecycle(s,sync);
}
