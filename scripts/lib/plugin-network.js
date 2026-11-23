/** All outbound plugin traffic passes through this broker. Worker containers
 * have --network none. DNS is resolved once and pinned to the HTTPS connection. */
import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
function reject(s){throw Object.assign(new Error(s),{status:403});}
const privateIP=ip=>{
 if(net.isIP(ip)===4){const a=ip.split('.').map(Number);return a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&a[1]>=18&&a[1]<=19;}
 const s=ip.toLowerCase();return s==='::1'||s==='::'||s.startsWith('fe80:')||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('ff')||s.startsWith('::ffff:');
};
export async function brokerFetch(input,allowlist){
 const {url,method='GET',headers={},body}=input||{};
 let target;try{target=new URL(url);}catch{reject('Invalid plugin URL');}
 if(target.protocol!=='https:'||target.port&&target.port!=='443'||target.username||target.password||target.hash)reject('Only HTTPS 443 vendor requests permitted');
 const host=target.hostname.toLowerCase();
 if(!allowlist.some(allow=>host===allow||allow.startsWith('*.')&&host.endsWith(allow.slice(1))&&host!==allow.slice(2)))reject('Vendor hostname is not in declared plugin permissions');
 if(net.isIP(host)||host==='localhost')reject('IP-literal or local network targets are forbidden');
 if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))reject('Invalid vendor HTTP method');
 const resolved=await dns.lookup(host,{all:true,verbatim:true});if(!resolved.length||resolved.some(r=>privateIP(r.address)))reject('Vendor DNS resolves to a restricted address');
 const address=resolved[0];const payload=body==null?null:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
 if(payload?.length>256*1024)reject('Plugin request body too large');
 const allowedHeaders={};for(const [k,v] of Object.entries(headers)){if(!['authorization','accept','content-type','x-api-key','x-cisco-meraki-api-key'].includes(k.toLowerCase())||typeof v!=='string'||v.length>4096)reject('Forbidden vendor request header');allowedHeaders[k]=v;}
 return new Promise((resolve,rejectPromise)=>{
  const req=https.request(target,{method,headers:{...allowedHeaders,...payload?{'Content-Length':payload.length}:{}},timeout:15000,lookup:(_host,_opts,callback)=>callback(null,address.address,address.family)},res=>{
   if(res.statusCode>=300&&res.statusCode<400){res.resume();return rejectPromise(new Error('Vendor redirects are not followed'));}
   let chunks=[],length=0;res.on('data',c=>{length+=c.length;if(length>1024*1024){req.destroy(new Error('Vendor response too large'));return;}chunks.push(c);});res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),headers:{'content-type':res.headers['content-type']||''}}));
  });req.on('timeout',()=>req.destroy(new Error('Vendor request timed out')));req.on('error',rejectPromise);if(payload)req.write(payload);req.end();
 });
}
/** Hardened signed repository downloader: pinned DNS, no redirects, no proxies. */
export async function downloadHttpsBytes(value,max=8*1024*1024){
 let url;try{url=new URL(value);}catch{reject('Invalid repository URL');}
 if(url.protocol!=='https:'||url.port&&url.port!=='443'||url.username||url.password||url.hash||net.isIP(url.hostname)||url.hostname==='localhost')reject('Repository URL must be public HTTPS');
 const addresses=await dns.lookup(url.hostname,{all:true,verbatim:true});
 if(!addresses.length||addresses.some(x=>privateIP(x.address)))reject('Repository resolves to a private or restricted network');
 const chosen=addresses[0];return await new Promise((resolve,fail)=>{
  const request=https.request(url,{method:'GET',timeout:15000,headers:{Accept:'application/json, application/zip'},lookup:(_host,_opts,callback)=>callback(null,chosen.address,chosen.family)},response=>{
   if(response.statusCode!==200){response.resume();return fail(new Error(`Repository returned HTTP ${response.statusCode}; redirects are forbidden`));}
   const len=Number(response.headers['content-length']);if(len>max){response.destroy();return fail(new Error('Repository response exceeds size limit'));}
   let parts=[],size=0;response.on('data',part=>{size+=part.length;if(size>max){request.destroy(new Error('Repository response exceeds size limit'));return;}parts.push(part);});
   response.on('end',()=>resolve(Buffer.concat(parts)));
  });request.on('error',fail);request.on('timeout',()=>request.destroy(new Error('Repository request timeout')));request.end();
 });
}
