/** Signed, pinned, HTTPS-only repository and immutable package downloader. */
import crypto from 'node:crypto';
import {canonicalJson,validatePluginManifest,compareVersion} from './plugin-manifest.js';
import {readArchive} from './plugin-archive.js';
import {downloadHttpsBytes} from './plugin-network.js';
export const REPO_SCHEMA='open-map-monitor.repository/v1';
const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const HEX=/^[0-9a-f]{64}$/i;
const SEMVER=/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?$/i;
const error=(message,status=422)=>Object.assign(new Error(message),{status});
function urlOnlyHttps(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||!u.hostname)throw error('Repository requires HTTPS and no URL credentials');return u;}
function edKey(value){const key=crypto.createPublicKey({key:Buffer.from(value,'base64'),format:'der',type:'spki'});if(key.asymmetricKeyType!=='ed25519')throw error('Trusted key must be Ed25519');return key;}
export function verifyBytes(bytes,signature,key){if(!signature||!crypto.verify(null,bytes,edKey(key),Buffer.from(signature,'base64')))throw error('Ed25519 signature verification failed');}
export function canonicalUnsigned(obj){const {signature,...rest}=obj;return Buffer.from(canonicalJson(rest));}
export function pinnedKeys(env=process.env){
 if(env.PLUGIN_TRUSTED_KEYS){const keys=JSON.parse(env.PLUGIN_TRUSTED_KEYS);if(!keys||typeof keys!=='object'||Array.isArray(keys)||!Object.keys(keys).length)throw error('No trusted repository keys');for(const k of Object.values(keys))edKey(k);return keys;}
 if(env.PLUGIN_REPOSITORY_PUBLIC_KEY)return {primary:env.PLUGIN_REPOSITORY_PUBLIC_KEY};
 return {};
}
export function verifyRepository(data,keys,rootUrl){
 if(!data||data.schema!==REPO_SCHEMA||!Array.isArray(data.plugins)||data.plugins.length>200||!data.keyId||!keys[data.keyId])throw error('Unsupported or untrusted repository index');
 verifyBytes(canonicalUnsigned(data),data.signature,keys[data.keyId]);
 const base=urlOnlyHttps(rootUrl);const prefix=new URL('.',base).pathname;const ids=new Set();const items=[];
 for(const plugin of data.plugins){
  if(!ID.test(plugin.id)||ids.has(plugin.id)||!plugin.versions?.length||plugin.versions.length>70)throw error('Invalid or duplicate plugin ID');ids.add(plugin.id);
  const versions=new Set();let latest='0.0.0';
  for(const v of plugin.versions){
   if(!SEMVER.test(v.version)||versions.has(v.version)||!['stable','beta'].includes(v.channel))throw error('Duplicate or invalid plugin release');versions.add(v.version);
   const manifest=validatePluginManifest(v.manifest);
   if(manifest.id!==plugin.id||manifest.version!==v.version)throw error('Release manifest ID/version mismatch');
   if(!HEX.test(v.package?.sha256)||!Number.isSafeInteger(v.package?.bytes)||v.package.bytes<100||v.package.bytes>8*1024*1024||typeof v.package.signature!=='string')throw error('Invalid package digest or signature');
   if(!Array.isArray(v.permissions?.networkHosts)||v.permissions.networkHosts.length>20||v.permissions.networkHosts.some(h=>typeof h!=='string'||!/^[a-z0-9*.-]+$/i.test(h)))throw error('Invalid network permissions');
   if(v.permissions.configHostField!==undefined&&!v.manifest.configFields?.some(f=>f.key===v.permissions.configHostField&&f.type==='text'&&f.required))throw error('Configurable network hostname requires a required text config field');
   if(!v.api||v.api.min!=='open-map-monitor.plugin/v1'||v.api.max!=='open-map-monitor.plugin/v1')throw error('Incompatible plugin API');
   if(typeof v.package.url!=='string'||!/^packages\/[a-z0-9.-]+\/\d+\.\d+\.\d+(?:-[\da-z.-]+)?\/[a-z0-9.-]+\.zip$/i.test(v.package.url))throw error('Unsafe package path');
   const packageUrl=new URL(v.package.url,new URL('.',base));
   if(packageUrl.origin!==base.origin||!packageUrl.pathname.startsWith(prefix))throw error('Package URL must stay on trusted repository origin');
   if(compareVersion(v.version,latest)>0&&v.channel==='stable')latest=v.version;
   // The signed repository includes all package metadata and manifests.
   items.push({manifest,signature:data.signature,package:v.package,packageUrl:packageUrl.href,permissions:v.permissions,release:v});
  }
  if(plugin.latest!==latest)throw error(`Incorrect latest release for ${plugin.id}`);
 }
 return {configured:true,items,repository:data};
}
export async function readLimited(url,max,fetchImpl=fetch){
 const target=urlOnlyHttps(url);
 if(fetchImpl===fetch)return await downloadHttpsBytes(target.href,max);
 const response=await fetchImpl(target,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/octet-stream, application/json'}});
 if(!response.ok||response.redirected)throw error(`Repository download HTTP ${response.status}`,502);
 const len=Number(response.headers?.get('content-length'));if(len>max)throw error('Repository response exceeds size limit',413);
 // Support both stream responses and lightweight fixture fetch implementations.
 if(!response.body?.getReader){const b=Buffer.from(await response.arrayBuffer());if(b.length>max)throw error('Repository response exceeds size limit',413);return b;}
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw error('Repository response exceeds size limit',413);chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
export async function readPluginRepository({url=process.env.PLUGIN_REPOSITORY_URL,keys=pinnedKeys(),fetchImpl=fetch}={}){
 if(!url)return {configured:false,items:[]};
 if(!Object.keys(keys).length)throw error('PLUGIN_TRUSTED_KEYS / PLUGIN_REPOSITORY_PUBLIC_KEY is required');
 const bytes=await readLimited(url,1024*1024,fetchImpl);
 let json;try{json=JSON.parse(bytes.toString('utf8'));}catch{throw error('Invalid repository JSON');}
 return verifyRepository(json,keys,url);
}
export async function downloadPlugin(item,{fetchImpl=fetch,keys=pinnedKeys()}={}){
 const bytes=await readLimited(item.packageUrl,8*1024*1024,fetchImpl);
 if(bytes.length!==item.package.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==item.package.sha256)throw error('Plugin archive SHA-256/size mismatch');
 const key=keys[item.release?.package?.keyId||item.release?.keyId||'primary'];
 if(!key)throw error('Package signing key is not trusted');
 verifyBytes(bytes,item.package.signature,key);
 const files=readArchive(bytes);
 const manifest=JSON.parse(files.get('manifest.json'));const runtime=JSON.parse(files.get('plugin.json'));
 validatePluginManifest(manifest);
 if(canonicalJson(manifest)!==canonicalJson(item.manifest))throw error('Archive manifest differs from signed repository');
 validateRuntime(runtime,manifest,item.permissions,files);
 return {bytes,files,manifest,runtime};
}
export function validateRuntime(runtime,manifest,permissions,files){
 if(runtime?.schema!=='open-map-monitor.runtime/v1'||runtime.id!==manifest.id||runtime.version!==manifest.version||runtime.apiVersion!==manifest.apiVersion)throw error('Invalid runtime identity');
 const entry=runtime.entrypoint;
 if(typeof entry!=='string'||!/^src\/[a-zA-Z0-9._/-]+\.mjs$/.test(entry)||entry.includes('..')||!files.has(entry))throw error('Invalid plugin entrypoint');
 if(canonicalJson(runtime.permissions)!==canonicalJson(permissions))throw error('Package permissions differ from repository');
 if(!Array.isArray(runtime.hooks)||!runtime.hooks.includes('health')||!runtime.hooks.includes('initialize')||runtime.hooks.some(x=>!['initialize','health','enable','disable','stop','uninstall','discover','poll','webhook','configChanged'].includes(x)))throw error('Invalid runtime lifecycle');
 if(!Array.isArray(permissions.networkHosts)||!Array.isArray(permissions.secrets)||permissions.secrets.some(x=>!manifest.configFields?.some(f=>f.type==='password'&&f.key===x)))throw error('Invalid secret grants');
 if(permissions.configHostField!==undefined&&!manifest.configFields?.some(f=>f.key===permissions.configHostField&&f.type==='text'&&f.required))throw error('Configurable network host must be a required text field');
 if(files.has('config.schema.json')){try{JSON.parse(files.get('config.schema.json'));}catch{throw error('Malformed plugin config schema');}}
 const packageMeta=JSON.parse(files.get('package.json'));
 if(packageMeta.dependencies&&Object.keys(packageMeta.dependencies).length)throw error('Plugin must bundle all production dependencies');
 return runtime;
}
