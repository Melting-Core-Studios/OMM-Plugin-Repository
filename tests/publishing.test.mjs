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
  assert.equal(current.plugins.find(x=>x.id==='example.synthetic').category,'utilities');
  assert.equal(current.plugins.find(x=>x.id==='generic.signed-webhook').category,'monitoring');
  assert.throws(()=>publish('example.synthetic',{keyFile:keyPath,base:dir}),/Duplicate/);
 }finally{[manifestFile,runtimeFile,packageFile].forEach((p,i)=>fs.writeFileSync(p,originals[i]));fs.rmSync(dir,{recursive:true,force:true});}
});

test('category-only update re-signs the index without modifying a historical package',async()=>{
 const {updateCategories}=await import('../scripts/update-categories.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repo-categories-')),keyPath=path.join(dir,'key.pem');
 const keys=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(keyPath,keys.privateKey.export({format:'pem',type:'pkcs8'}));
 const map=path.join(dir,'categories.json');
 try{
  publish('example.synthetic',{keyFile:keyPath,base:dir});
  const before=JSON.parse(fs.readFileSync(path.join(dir,'repo.json'),'utf8'));
  const archive=path.join(dir,before.plugins[0].versions[0].package.url);
  const packageHash=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  fs.writeFileSync(map,JSON.stringify({'example.synthetic':'devices'}));
  const result=updateCategories({base:dir,categoriesPath:map,keyFile:keyPath});
  const after=JSON.parse(fs.readFileSync(path.join(dir,'repo.json'),'utf8'));
  assert.equal(result.plugins,1);
  assert.equal(after.plugins[0].category,'devices');
  assert.notEqual(before.signature,after.signature);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),packageHash);
  assert.throws(()=>updateCategories({base:dir,categoriesPath:path.join(dir,'missing.json'),keyFile:keyPath}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
