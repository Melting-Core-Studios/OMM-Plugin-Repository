/** Re-sign signed catalogue category metadata without rebuilding immutable ZIPs.
 * Publish package archives before this updated repo.json, as with plugin releases.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {canonicalJson} from './lib/plugin-manifest.js';
import {verifyRepository} from './lib/plugin-repository.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowed=new Set(['network','monitoring','devices','utilities','other']);
function json(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
export function updateCategories({base=root,categoriesPath=path.join(root,'metadata/categories.json'),keyFile=process.env.PLUGIN_SIGNING_PRIVATE_KEY_FILE}={}){
 if(!keyFile)throw Error('Set PLUGIN_SIGNING_PRIVATE_KEY_FILE to your external publisher private key');
 const key=crypto.createPrivateKey(fs.readFileSync(keyFile));
 if(key.asymmetricKeyType!=='ed25519')throw Error('Publisher key must be Ed25519');
 const publicKey=crypto.createPublicKey(key).export({type:'spki',format:'der'}).toString('base64');
 const indexPath=path.join(base,'repo.json');
 const index=json(indexPath),categories=json(categoriesPath);
 const pinnedPath=path.join(base,'keys/trusted-keys.json');
 const pinned=fs.existsSync(pinnedPath)?json(pinnedPath):{};
 if(pinned[index.keyId]&&pinned[index.keyId]!==publicKey)throw Error('Signing key does not match current repository signing key ID');
 const keys={...pinned,[index.keyId]:publicKey};
 verifyRepository(index,keys,'https://example.invalid/plugins/repo.json');
 for(const p of index.plugins){
  const category=categories[p.id];
  if(!allowed.has(category))throw Error(`Missing or invalid category for ${p.id}`);
  // Never accept an index rewrite when an immutable package has vanished or
  // differs from its already published hash/signature.
  for(const v of p.versions){
   const bytes=fs.readFileSync(path.join(base,v.package.url));
   const signingPublic=keys[v.package.keyId];
   if(!signingPublic||bytes.length!==v.package.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==v.package.sha256||
      !crypto.verify(null,bytes,crypto.createPublicKey({key:Buffer.from(signingPublic,'base64'),format:'der',type:'spki'}),Buffer.from(v.package.signature,'base64')))
    throw Error(`Existing package integrity check failed for ${p.id}@${v.version}`);
  }
  p.category=category;
 }
 index.generatedAt=new Date().toISOString();
 const {signature,...unsigned}=index;
 index.signature=crypto.sign(null,Buffer.from(canonicalJson(unsigned)),key).toString('base64');
 verifyRepository(index,keys,'https://example.invalid/plugins/repo.json');
 const temp=indexPath+`.${process.pid}.tmp`;
 try{fs.writeFileSync(temp,JSON.stringify(index,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,indexPath);}catch(error){fs.rmSync(temp,{force:true});throw error;}
 return {plugins:index.plugins.length,releases:index.plugins.reduce((total,p)=>total+p.versions.length,0),keyId:index.keyId};
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){try{console.log(JSON.stringify(updateCategories(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
