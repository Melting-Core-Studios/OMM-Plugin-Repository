import crypto from 'node:crypto';

export const PLUGIN_API_VERSION='open-map-monitor.plugin/v1';
export const PLUGIN_REGISTRY_VERSION='open-map-monitor.registry/v1';
const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const SEMVER=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const CAPABILITIES=new Set(['alerts','device-status','sites','coordinates','addresses']);
const FIELD_TYPES=new Set(['text','password','url','number','boolean']);
function fail(message){throw Object.assign(new Error(message),{status:400});}
function clean(value,max=180){return typeof value==='string'?value.trim().slice(0,max):'';}
export function canonicalJson(value){
 if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
 return JSON.stringify(value);
}
export function validatePluginManifest(raw){
 if(!raw||Array.isArray(raw)||typeof raw!=='object'||raw.apiVersion!==PLUGIN_API_VERSION)fail('Unsupported plugin manifest API version');
 if(!ID.test(raw.id||'')||raw.id.length>90)fail('Invalid plugin identifier');
 if(!SEMVER.test(raw.version||'')||raw.version.length>70)fail('Invalid plugin version');
 for(const field of ['name','publisher'])if(!clean(raw[field])||raw[field].length>120)fail(`Missing or invalid ${field}`);
 if(raw.transport!=='webhook-v1')fail('Unsupported plugin transport; supported: webhook-v1');
 if(!Array.isArray(raw.capabilities)||raw.capabilities.some(x=>!CAPABILITIES.has(x))||new Set(raw.capabilities).size!==raw.capabilities.length)fail('Invalid plugin capabilities');
 if(raw.website!==undefined&&(!/^https:\/\//i.test(raw.website)||raw.website.length>500))fail('Plugin website must be HTTPS');
 if(raw.description!==undefined&&(typeof raw.description!=='string'||raw.description.length>1000))fail('Invalid description');
 if(raw.configFields!==undefined){
  if(!Array.isArray(raw.configFields)||raw.configFields.length>30)fail('Too many configuration fields');
  const names=new Set();
  for(const field of raw.configFields){
   if(!field||typeof field!=='object'||!/^[a-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)*$/.test(field.key||'')||field.key.length>64||names.has(field.key)||!FIELD_TYPES.has(field.type)||!clean(field.label)||field.label.length>90||typeof field.required!=='boolean'||(field.help!==undefined&&typeof field.help!=='string'))fail('Invalid plugin configuration field');
   names.add(field.key);
  }
 }
 // Strict object allowlist prevents unexpected executable or privileged properties
 // from being silently accepted by the host or a future runtime.
 const allowed=new Set(['apiVersion','id','version','name','publisher','description','website','transport','capabilities','configFields']);
 if(Object.keys(raw).some(key=>!allowed.has(key)))fail('Unsupported plugin manifest fields');
 return structuredClone(raw);
}
export function verifyCatalogueItem(item,publicKey){
 if(!item||typeof item!=='object'||!item.signature||typeof item.signature!=='string')fail('Unsigned plugin catalogue entry');
 const manifest=validatePluginManifest(item.manifest);
 let key;
 try{key=crypto.createPublicKey({key:Buffer.from(publicKey,'base64'),format:'der',type:'spki'});}catch{fail('PLUGIN_REGISTRY_PUBLIC_KEY is invalid');}
 if(key.asymmetricKeyType!=='ed25519')fail('Plugin registry key must be Ed25519');
 const valid=crypto.verify(null,Buffer.from(canonicalJson(manifest),'utf8'),key,Buffer.from(item.signature,'base64'));
 if(!valid)fail(`Signature validation failed for ${manifest.id}`);
 return {manifest,signature:item.signature};
}
export function compareVersion(a,b){
 const left=String(a).split('-')[0].split('.').map(Number),right=String(b).split('-')[0].split('.').map(Number);
 for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]>right[i]?1:-1;
 return a===b?0:(String(a).includes('-')?-1:1);
}
export async function readPluginCatalogue({url=process.env.PLUGIN_REGISTRY_URL,key=process.env.PLUGIN_REGISTRY_PUBLIC_KEY,fetchImpl=fetch}={}){
 if(!url||!key)return {configured:false,items:[]};
 let target;
 try{target=new URL(url);}catch{fail('Invalid plugin registry URL');}
 if(target.protocol!=='https:'||target.username||target.password||target.hash)fail('Plugin registry URL must use HTTPS without embedded credentials');
 const response=await fetchImpl(target,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
 if(!response.ok)throw Object.assign(new Error(`Plugin registry returned HTTP ${response.status}`),{status:502});
 const length=Number(response.headers?.get('content-length'));
 if(length>1024*1024)fail('Plugin catalogue exceeds 1 MiB');
 const contents=await response.text();
 if(Buffer.byteLength(contents)>1024*1024)fail('Plugin catalogue exceeds 1 MiB');
 let data;try{data=JSON.parse(contents);}catch{fail('Plugin catalogue is not valid JSON');}
 if(data.apiVersion!==PLUGIN_REGISTRY_VERSION||!Array.isArray(data.plugins)||data.plugins.length>200)fail('Unsupported plugin registry index');
 const items=data.plugins.map(item=>verifyCatalogueItem(item,key));
 const keys=new Set();
 for(const {manifest} of items){const id=`${manifest.id}@${manifest.version}`;if(keys.has(id))fail('Duplicate plugin catalogue version');keys.add(id);}
 return {configured:true,items};
}
