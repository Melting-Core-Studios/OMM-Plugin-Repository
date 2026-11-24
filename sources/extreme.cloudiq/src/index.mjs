import {text,identity,status,ensureJson,lifecycle,emitBatches,coordinate,addr} from './common.mjs';
export function createPlugin(ctx){
 const s={config:{},error:null,lastSync:null,devices:0,sites:0,configured(){return !!(this.config.username&&this.config.password)}};
 async function sync(){
  if(!s.configured())throw Error('Configure ExtremeCloud IQ account credentials');
  try{
   const base='https://api.extremecloudiq.com';
   const login=ensureJson(await ctx.request({url:base+'/login',method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:{username:s.config.username,password:s.config.password}}),'ExtremeCloud IQ authentication');
   if(typeof login.access_token!=='string'||login.access_token.length<20)throw Error('ExtremeCloud IQ did not return an access token');
   const headers={Authorization:`Bearer ${login.access_token}`,Accept:'application/json'};
   async function getPaged(endpoint){
    let out=[];
    for(let page=1;page<=50;page++){
     const url=new URL(base+endpoint);url.searchParams.set('page',String(page));url.searchParams.set('limit','100');
     const response=ensureJson(await ctx.request({url:url.href,headers}),'ExtremeCloud IQ inventory');
     if(!Array.isArray(response.data))throw Error('ExtremeCloud IQ pagination response missing data array');
     out.push(...response.data);
     if(out.length>5000)throw Error('ExtremeCloud IQ inventory limit exceeded');
     if(Number.isInteger(response.total_pages)&&page>=response.total_pages)return out;
     if(!Number.isInteger(response.total_pages)&&response.data.length<100)return out;
    }
    throw Error('ExtremeCloud IQ inventory pagination exceeded 50 pages');
   }
   const sites=await getPaged('/locations/site');
   const devices=await getPaged('/devices?views=full');
   const siteMap=new Map(sites.map(x=>[String(x.id),x]));const events=[],seen=new Set(),now=ctx.now();
   for(const d of devices){
    const id=identity(d.serial_number,d.mac_address,d.id);if(!id||seen.has(id))continue;seen.add(id);
    const siteId=identity(d.site_id,d.location_id,d.locationId,d.location?.id);
    const site=siteMap.get(siteId),location=site?.location||site;
    const address=addr(site?.address)||undefined;
    const lat=coordinate(location?.latitude??location?.lat,-90,90),lng=coordinate(location?.longitude??location?.lng,-180,180);
    events.push({deviceId:id,siteId:siteId||null,name:identity(d.hostname,d.name,id),status:status(d.connected),timestamp:now,address:s.config.manualMappingOnly===true?undefined:address,latitude:s.config.manualMappingOnly===true?null:lat,longitude:s.config.manualMappingOnly===true?null:lng});
   }
   emitBatches(ctx,events);s.lastSync=now;s.devices=events.length;s.sites=sites.length;s.error=null;return {ok:true,devices:s.devices,sites:s.sites};
  }catch(e){s.error=e.message;throw e;}
 }
 const api=lifecycle(s,sync);
 const oldHealth=api.health;
 api.health=()=>({...oldHealth(),sites:s.sites});
 return api;
}
