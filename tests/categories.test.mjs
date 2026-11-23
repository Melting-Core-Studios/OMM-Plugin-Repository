import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyRepository} from '../scripts/lib/plugin-repository.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(name)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const rootUrl='https://raw.githubusercontent.com/open-map-monitor/plugins/main/repo.json';

test('signed catalogue categories match published metadata and historical archives are retained',()=>{
 const repo=read('repo.json'),keys=read('keys/trusted-keys.json'),categories=read('metadata/categories.json');
 const result=verifyRepository(repo,keys,rootUrl);
 assert.equal(repo.plugins.length,12);
 assert.equal(result.items.length,13);
 assert.deepEqual(new Set(repo.plugins.map(p=>p.id)),new Set(Object.keys(categories)));
 for(const plugin of repo.plugins){
  assert.equal(plugin.category,categories[plugin.id]);
  assert(plugin.versions.some(v=>v.version===plugin.latest&&v.channel==='stable'));
  for(const v of plugin.versions)assert(result.items.some(i=>i.manifest.id===plugin.id&&i.manifest.version===v.version&&i.category===plugin.category));
 }
 assert.equal(repo.plugins.find(p=>p.id==='example.synthetic').versions.length,2,'older release preserved');
 assert.equal(repo.plugins.find(p=>p.id==='extreme.cloudiq').category,'network');
 assert.equal(repo.plugins.find(p=>p.id==='zabbix.webhook').category,'monitoring');
});

test('category values are signed and tampering with them fails signature verification',()=>{
 const repo=read('repo.json'),keys=read('keys/trusted-keys.json');
 const tampered=structuredClone(repo);
 tampered.plugins[0].category='monitoring';
 assert.throws(()=>verifyRepository(tampered,keys,rootUrl),/Ed25519 signature verification failed/);
});

test('invalid category is rejected even when the index carries a valid signature',()=>{
 const repo=read('repo.json'),keys=read('keys/trusted-keys.json');
 const current=structuredClone(repo);
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 current.keyId='test';current.plugins[0].category='exec-something';
 const {signature,...unsigned}=current;
 const canonical=(o)=>Array.isArray(o)?`[${o.map(canonical).join(',')}]`:o&&typeof o==='object'?`{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`:JSON.stringify(o);
 current.signature=crypto.sign(null,Buffer.from(canonical(unsigned)),privateKey).toString('base64');
 assert.throws(()=>verifyRepository(current,{...keys,test:publicKey.export({type:'spki',format:'der'}).toString('base64')},rootUrl),/Invalid signed plugin category/);
});
