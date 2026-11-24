// Official UniFi Site Manager (cloud) adapter. No local-controller credentials,
// private network access or undocumented /proxy/network APIs are required.
const hasText=value=>typeof value==='string'&&value.trim().length>0;
const str=value=>hasText(value)?value.trim():'';
const point=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
function connectivity(device){
 const raw=device?.status??device?.state??device?.connectionStatus??device?.connection?.state;
 if(raw===1||raw===true)return 'online';
 if(raw===0||raw===false)return 'offline';
 const value=String(raw??'').toLowerCase();
 if(['online','connected','up','healthy','active'].includes(value))return 'online';
 if(['offline','disconnected','down','unreachable'].includes(value))return 'offline';
 if(['degraded','warning','alerting','isolated'].includes(value))return 'degraded';
 return 'unknown';
}
function siteId(entry){return str(entry?.siteId||entry?.site_id||entry?.id);}
function physicalAddress(site){
 // Only use explicitly returned, physical addresses. Country/city alone is not a match.
 const location=site?.location||site?.meta?.location||{};
 const supplied=site?.address??site?.meta?.address??location?.address;
 if(typeof supplied==='string')return supplied.trim()||undefined;
 if(supplied&&typeof supplied==='object'){
  const values=[supplied.streetAddress||supplied.street||supplied.address1,supplied.postalCode||supplied.postcode,supplied.city,supplied.country].filter(hasText);
  if(values.length>=2)return values.join(', ');
 }
 return undefined;
}
function coordinates(site,device){
 const location=device?.location||site?.location||site?.meta?.location||{};
 const position=device?.coordinates||device?.latlng||location?.coordinates||location?.latlng||location;
 const lat=point(position?.lat??position?.latitude),lng=point(position?.lng??position?.lon??position?.longitude);
 return {latitude:lat!=null&&lat>=-90&&lat<=90?lat:null,longitude:lng!=null&&lng>=-180&&lng<=180?lng:null};
}
function inventoryEntries(items){
 const out=[];
 for(const item of items){
  if(!item||typeof item!=='object')continue;
  if(Array.isArray(item.devices))for(const device of item.devices)out.push({...device,siteId:device.siteId||item.siteId,hostId:item.hostId});
  else out.push(item);
 }
 return out;
}
function extractList(response,kind){
 if(Array.isArray(response))return response;
 if(Array.isArray(response?.data))return response.data;
 if(Array.isArray(response?.items))return response.items;
 if(Array.isArray(response?.[kind]))return response[kind];
 throw new Error(`UniFi ${kind} response does not contain a device/site list`);
}
export function createPlugin(ctx){
 const state={config:{},lastSync:null,lastError:null,devices:0,sites:0,pages:0};
 async function page(url){
  const result=await ctx.request({url,headers:{'X-API-KEY':state.config.apiKey,Accept:'application/json'}});
  if(result.status===401||result.status===403)throw Error(`UniFi API key rejected (HTTP ${result.status})`);
  if(result.status===429)throw Error('UniFi Site Manager rate limit reached (HTTP 429); wait before retrying');
  if(result.status!==200)throw Error(`UniFi Site Manager HTTP ${result.status}`);
  const value=JSON.parse(result.body);
  if(value?.error||value?.code>=400)throw Error('UniFi Site Manager returned an API error');
  return value;
 }
 async function list(kind){
  const items=[],tokens=new Set();let token='';
  for(let count=0;count<20;count++){
   const url=new URL(`https://api.ui.com/v1/${kind}`);
   url.searchParams.set('pageSize','200');
   if(token)url.searchParams.set('nextToken',token);
   const response=await page(url.toString()),part=extractList(response,kind);
   if(items.length+part.length>5000)throw Error(`UniFi ${kind} inventory limit reached`);
   items.push(...part);
   const next=response.nextToken||response.nextPageToken||response.pagination?.nextToken||'';
   if(!next){state.pages+=count+1;return items;}
   if(!hasText(next)||next.length>512||tokens.has(next))throw Error('UniFi pagination cursor invalid or repeated');
   tokens.add(next);token=next;
  }
  throw Error('UniFi pagination exceeded 20 pages');
 }
 async function sync(){
  if(!hasText(state.config.apiKey))throw Error('Configure a UniFi Site Manager API key');
  try{
   // Site data is optional; some authorized accounts expose device inventory only.
   state.pages=0;
   let sites=[];
   try{sites=await list('sites');}catch(error){if(!/HTTP 403|HTTP 404|API key rejected \(HTTP 403\)/.test(error.message))throw error;}
   const listOfDevices=inventoryEntries(await list('devices'));
   const siteMap=new Map(sites.map(site=>[siteId(site),site]));
   const now=ctx.now(),seen=new Set(),events=[];
   for(const device of listOfDevices){
    const key=str(device.macAddress||device.mac||device.serialNumber||device.serial||device.id);
    if(!key||key.length>160||seen.has(key))continue;
    seen.add(key);
    const sid=str(device.siteId||device.site_id||device.site?.id);
    const site=siteMap.get(sid);
    const coords=coordinates(site,device);
    events.push({deviceId:key,siteId:sid||null,name:str(device.name||device.model||device.meta?.name)||key,
     status:connectivity(device),timestamp:now,address:state.config.manualMappingOnly===true?undefined:physicalAddress(device)||physicalAddress(site),...(state.config.manualMappingOnly===true?{latitude:null,longitude:null}:coords)});
   }
   // The host ingestion contract accepts no more than 100 events per batch.
   for(let i=0;i<events.length;i+=100)ctx.emit(events.slice(i,i+100));
   state.lastSync=now;state.lastError=null;state.devices=events.length;state.sites=sites.length;
   return {ok:true,devices:state.devices,sites:state.sites,pages:state.pages};
  }catch(error){state.lastError=error.message;throw error;}
 }
 return {initialize(config){state.config=config;return {ok:true};},configChanged(config){state.config=config;return {ok:true};},
  enable(){return {ok:true};},disable(){return {ok:true};},stop(){return {ok:true};},
  health(){return {ok:!state.lastError,configured:!!state.config.apiKey,lastSync:state.lastSync,lastError:state.lastError,devices:state.devices,sites:state.sites};},
  discover:sync,poll:sync,webhook(){throw Error('UniFi Site Manager adapter uses cloud polling, not inbound webhooks');}};
}
