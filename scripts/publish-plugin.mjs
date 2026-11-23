import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {writeArchive,readArchive} from './lib/plugin-archive.js';
import {canonicalJson,validatePluginManifest,compareVersion} from './lib/plugin-manifest.js';
import {REPO_SCHEMA,validateRuntime,verifyRepository} from './lib/plugin-repository.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function readJSON(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function atomic(file,content){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+`.${process.pid}.tmp`;fs.writeFileSync(tmp,content,{flag:'wx'});fs.renameSync(tmp,file);}
export function build(id){
 const source=path.join(root,'sources',id);if(!/^[a-z0-9.-]+$/.test(id)||!fs.statSync(source).isDirectory())throw Error('Unknown plugin source');
 const manifest=validatePluginManifest(readJSON(path.join(source,'manifest.json'))),runtime=readJSON(path.join(source,'plugin.json'));
 if(manifest.id!==id)throw Error('Source plugin ID mismatch');
 const tests=path.join(source,'tests');
 if(fs.existsSync(tests)){const files=fs.readdirSync(tests).filter(x=>x.endsWith('.test.mjs'));if(files.length){const t=spawnSync(process.execPath,['--test',...files.map(x=>path.join(tests,x))],{encoding:'utf8'});if(t.status!==0)throw Error(`Plugin tests failed: ${t.stderr||t.stdout}`);}}
 const entries={};const crawl=(dir,rel='')=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  if(ent.name.startsWith('.')||ent.name==='tests')continue;const next=rel?`${rel}/${ent.name}`:ent.name;
  if(ent.isSymbolicLink())throw Error('Symlinks prohibited');if(ent.isDirectory())crawl(path.join(dir,ent.name),next);
  else if(ent.isFile()){if(/\.(png|jpe?g|svg|gif|webp|ico|bmp|tiff)$/i.test(next))throw Error('Images prohibited');entries[next]=fs.readFileSync(path.join(dir,ent.name));}
 }};crawl(source);
 validateRuntime(runtime,manifest,runtime.permissions,new Map(Object.entries(entries)));
 const bytes=writeArchive(entries);readArchive(bytes);return {bytes,manifest,runtime};
}
export function publish(id,{keyFile=process.env.PLUGIN_SIGNING_PRIVATE_KEY_FILE,keyId=process.env.PLUGIN_SIGNING_KEY_ID||'primary',base=root}={}){
 if(!keyFile)throw Error('Set PLUGIN_SIGNING_PRIVATE_KEY_FILE to an external, secret PEM file');
 const signingKey=crypto.createPrivateKey(fs.readFileSync(keyFile));if(signingKey.asymmetricKeyType!=='ed25519')throw Error('Signing key must be Ed25519');
 const publicKey=crypto.createPublicKey(signingKey).export({format:'der',type:'spki'}).toString('base64');
 const {bytes,manifest,runtime}=build(id);const repoPath=path.join(base,'repo.json');
 const repo=fs.existsSync(repoPath)?readJSON(repoPath):{schema:REPO_SCHEMA,generatedAt:'',keyId,plugins:[],signature:''};
 const categories=readJSON(path.join(root,'metadata','categories.json'));
 const category=categories[id];
 if(!['network','monitoring','devices','utilities','other'].includes(category))throw Error(`Missing or invalid category for ${id}; add it to metadata/categories.json before publishing`);
 const trustedPath=path.join(base,'keys','trusted-keys.json');
 const trusted=fs.existsSync(trustedPath)?readJSON(trustedPath):{};
 if(trusted[keyId]&&trusted[keyId]!==publicKey)throw Error('Publisher key does not match pinned key ID; use an explicit key rotation');
 if(repo.schema!==REPO_SCHEMA||repo.keyId!==keyId)throw Error('Repository schema/key mismatch; rotate using a signed key-transition release');
 // Never overwrite an existing immutable version, even if bytes appear equal.
 let plugin=repo.plugins.find(x=>x.id===id);
 if(plugin?.versions.some(v=>v.version===manifest.version))throw Error('Duplicate plugin release id@version');
 const rel=`packages/${id}/${manifest.version}/${id}-${manifest.version}.zip`,target=path.join(base,rel);
 if(fs.existsSync(target))throw Error('Immutable package already exists');
 const packageMeta={url:rel,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,keyId,signature:crypto.sign(null,bytes,signingKey).toString('base64')};
 const version={version:manifest.version,channel:'stable',manifest,api:{min:manifest.apiVersion,max:manifest.apiVersion},permissions:runtime.permissions,package:packageMeta,publisher:manifest.publisher,capabilities:manifest.capabilities};
 if(!plugin){plugin={id,category,latest:manifest.version,versions:[]};repo.plugins.push(plugin);}
 else plugin.category=category;
 plugin.versions.push(version);plugin.versions.sort((a,b)=>compareVersion(a.version,b.version));plugin.latest=plugin.versions.filter(v=>v.channel==='stable').at(-1).version;
 repo.plugins.sort((a,b)=>a.id.localeCompare(b.id));repo.generatedAt=new Date().toISOString();
 repo.signature=crypto.sign(null,Buffer.from(canonicalJson(Object.fromEntries(Object.entries(repo).filter(([k])=>k!=='signature')))),signingKey).toString('base64');
 // Fail closed before anything is written. Ensure index always has every old plugin.
 verifyRepository(repo,{...trusted,[keyId]:publicKey},'https://example.invalid/plugins/repo.json');
 for(const p of repo.plugins)for(const v of p.versions){
  const data=v.package.url===rel?bytes:fs.readFileSync(path.join(base,v.package.url));
  const key=({...trusted,[keyId]:publicKey})[v.package.keyId];
  if(!key||crypto.createHash('sha256').update(data).digest('hex')!==v.package.sha256||data.length!==v.package.bytes||
   !crypto.verify(null,data,crypto.createPublicKey({key:Buffer.from(key,'base64'),format:'der',type:'spki'}),Buffer.from(v.package.signature,'base64')))throw Error(`Existing package failed verification: ${p.id}@${v.version}`);
 }
 atomic(target,bytes);
 try{atomic(repoPath,JSON.stringify(repo,null,2)+'\n');}catch(e){fs.rmSync(target,{force:true});throw e;}
 return {id,version:manifest.version,package:target,sha256:packageMeta.sha256};
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){try{const id=process.argv[2];if(!id)throw Error('Usage: node scripts/publish-plugin.mjs <plugin-id>');console.log(JSON.stringify(publish(id),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
