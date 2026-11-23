import {isIP} from 'node:net';
// Shared source duplicated into each self-contained archive; no external imports.
export const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
export const identity=(...values)=>values.map(v=>v==null?'':String(v).trim()).find(v=>v&&v.length<=180)||'';
export const coordinate=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max?n:null;
export function status(value){
 if(value===true||value===1||value==='1')return 'online';
 if(value===false||value===0||value==='0')return 'offline';
 const v=String(value??'').trim().toLowerCase();
 if(['up','online','connected','healthy','active','running','reachable','success'].includes(v))return 'online';
 if(['down','offline','disconnected','unreachable','failed','failure'].includes(v))return 'offline';
 if(['warning','degraded','critical','alerting'].includes(v))return 'degraded';
 return 'unknown';
}
export function hostname(host){
 const v=text(host,256).toLowerCase();
 if(isIP(v)||!/^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(v)||/\.(local|internal|localhost)$/.test(v))throw Error('Configure an approved public HTTPS DNS hostname (not an IP, URL, or port)');
 return v;
}
export function list(payload,label='devices'){
 if(Array.isArray(payload))return payload;
 for(const key of ['data','devices','items',label])if(Array.isArray(payload?.[key]))return payload[key];
 throw Error(`${label} response did not contain an array`);
}
export function bounded(items,max=5000){if(!Array.isArray(items)||items.length>max)throw Error('Inventory exceeds configured size limit');return items;}
export function emitBatches(ctx,events){for(let i=0;i<events.length;i+=100)ctx.emit(events.slice(i,i+100));}
export function ensureJson(response,label){
 if(response.status===401||response.status===403)throw Error(`${label} authentication or permissions rejected (HTTP ${response.status})`);
 if(response.status===429)throw Error(`${label} API rate limit (HTTP 429)`);
 if(response.status<200||response.status>=300)throw Error(`${label} HTTP ${response.status}`);
 try{return JSON.parse(response.body);}catch{throw Error(`${label} response was not JSON`);}
}
export function addr(value){
 if(typeof value==='string')return text(value,300)||undefined;
 if(value&&typeof value==='object'){
  const street=text(value.address||value.street||value.street_address||value.address1||value.streetAddress,120);
  const number=text(value.house_number||value.houseNumber,20);
  const post=text(value.postal_code||value.postalCode||value.postcode||value.zip,25);
  const city=text(value.city||value.town,80);
  const country=text(value.country||value.country_code,60);
  if(!street||!(post||number))return undefined; // no fuzzy city-only address matches
  return [street,number,post,city,country].filter(Boolean).join(', ');
 }
 return undefined;
}
export function lifecycle(state,sync){
 return {initialize(config){state.config=config||{};return {ok:true};},configChanged(config){state.config=config||{};return {ok:true};},enable(){return {ok:true};},disable(){return {ok:true};},stop(){return {ok:true};},health(){return {ok:!state.error,configured:state.configured(),lastSync:state.lastSync,error:state.error,devices:state.devices};},discover:sync,poll:sync};
}
