import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import {publish} from '../scripts/publish-plugin.mjs';
const root=path.resolve('sources');
test('publisher appends two plugins then a new version without deleting the other plugin',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repo-atomic-')),keyPath=path.join(dir,'key.pem');
 const keys=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(keyPath,keys.privateKey.export({format:'pem',type:'pkcs8'}));
 const source=path.join(root,'example.synthetic'),manifestFile=path.join(source,'manifest.json'),runtimeFile=path.join(source,'plugin.json'),packageFile=path.join(source,'package.json');
 const originals=[manifestFile,runtimeFile,packageFile].map(p=>fs.readFileSync(p));
 try{
  publish('example.synthetic',{keyFile:keyPath,base:dir});publish('generic.signed-webhook',{keyFile:keyPath,base:dir});
  for(const file of [manifestFile,runtimeFile,packageFile]){const value=JSON.parse(fs.readFileSync(file));value.version='1.0.2';fs.writeFileSync(file,JSON.stringify(value));}
  publish('example.synthetic',{keyFile:keyPath,base:dir});
  const current=JSON.parse(fs.readFileSync(path.join(dir,'repo.json')));
  assert.equal(current.plugins.length,2);
  assert.equal(current.plugins.find(x=>x.id==='example.synthetic').versions.length,2);
  assert.equal(current.plugins.find(x=>x.id==='generic.signed-webhook').versions.length,1);
  assert.throws(()=>publish('example.synthetic',{keyFile:keyPath,base:dir}),/Duplicate/);
 }finally{[manifestFile,runtimeFile,packageFile].forEach((p,i)=>fs.writeFileSync(p,originals[i]));fs.rmSync(dir,{recursive:true,force:true});}
});
