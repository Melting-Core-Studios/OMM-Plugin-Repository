import {text,identity,status,hostname,ensureJson,lifecycle,emitBatches} from './common.mjs';
export function createPlugin(ctx){
 const s={config:{},error:null,lastSync:null,devices:0,configured(){return !!(this.config.apiHost&&this.config.username&&this.config.password)}};
 async function sync(){
  if(!s.configured())throw Error('Configure RouterOS hostname and credentials');
  try{
   const host=hostname(s.config.apiHost);
   const credentials=Buffer.from(`${s.config.username}:${s.config.password}`).toString('base64');
   const headers={Authorization:`Basic ${credentials}`,Accept:'application/json'};
   const identityResult=ensureJson(await ctx.request({url:`https://${host}/rest/system/identity`,headers}),'RouterOS identity');
   const name=identity(identityResult.name,host);
   let state='online';const requested=text(s.config.interfaceName,100);
   if(requested){
    const list=ensureJson(await ctx.request({url:`https://${host}/rest/interface`,headers}),'RouterOS interfaces');
    if(!Array.isArray(list))throw Error('RouterOS interface response must be an array');
    const iface=list.find(x=>x.name===requested);
    if(!iface)throw Error('Configured RouterOS interface not found');
    if(iface.disabled!==true&&iface.disabled!=='true'&&iface.disabled!=='yes'&&status(iface.running)==='offline')state='degraded';
   }
   const now=ctx.now();emitBatches(ctx,[{deviceId:host,name,status:state,siteId:null,timestamp:now}]);s.devices=1;s.error=null;s.lastSync=now;return {ok:true,devices:1};
  }catch(e){s.error=e.message;throw e;}
 }
 return lifecycle(s,sync);
}
