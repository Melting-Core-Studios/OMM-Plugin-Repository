/** Re-sign a development/example catalogue with your own production publisher
 * key without changing immutable package bytes or losing historical versions.
 * External private key is never read into or persisted under repository root. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {canonicalJson} from './lib/plugin-manifest.js';import {verifyRepository} from './lib/plugin-repository.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const keyFile=process.env.PLUGIN_SIGNING_PRIVATE_KEY_FILE,newId=process.argv[2];
if(!keyFile||!/^[a-z0-9.-]{2,60}$/.test(newId||''))throw Error('Usage: PLUGIN_SIGNING_PRIVATE_KEY_FILE=/secure/production.pem node scripts/rekey-all.mjs production-v1');
const priv=crypto.createPrivateKey(fs.readFileSync(keyFile));if(priv.asymmetricKeyType!=='ed25519')throw Error('Only Ed25519 supported');
const pub=crypto.createPublicKey(priv).export({type:'spki',format:'der'}).toString('base64');
const repoPath=path.join(root,'repo.json'),keysPath=path.join(root,'keys','trusted-keys.json');
const repo=JSON.parse(fs.readFileSync(repoPath)),keys=JSON.parse(fs.readFileSync(keysPath));
verifyRepository(repo,keys,'https://example.invalid/plugins/repo.json');
for(const item of repo.plugins)for(const release of item.versions){
 const bytes=fs.readFileSync(path.join(root,release.package.url));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==release.package.sha256)throw Error(`Corrupt immutable package ${release.package.url}`);
 const old=keys[release.package.keyId];
 if(!old||!crypto.verify(null,bytes,crypto.createPublicKey({key:Buffer.from(old,'base64'),format:'der',type:'spki'}),Buffer.from(release.package.signature,'base64')))throw Error(`Invalid existing signature: ${release.package.url}`);
 release.package.signature=crypto.sign(null,bytes,priv).toString('base64');release.package.keyId=newId;
}
repo.keyId=newId;repo.generatedAt=new Date().toISOString();delete repo.signature;
repo.signature=crypto.sign(null,Buffer.from(canonicalJson(repo)),priv).toString('base64');
const nextKeys={[newId]:pub};verifyRepository(repo,nextKeys,'https://example.invalid/plugins/repo.json');
const stage=repoPath+'.rekey.tmp';fs.writeFileSync(stage,JSON.stringify(repo,null,2)+'\n');
fs.writeFileSync(keysPath,JSON.stringify(nextKeys,null,2)+'\n');
fs.writeFileSync(path.join(root,'keys','trusted-public-key.txt'),pub+'\n');
fs.renameSync(stage,repoPath);
console.log(`Re-signed ${repo.plugins.reduce((n,p)=>n+p.versions.length,0)} archives under ${newId}. Update clients' pinned keys BEFORE publishing.`);
