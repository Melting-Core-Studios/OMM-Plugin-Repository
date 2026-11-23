/** Two-phase rotation. Deploy the updated pinned public-key set to ALL
 * consumers before publishing this newly signed index. */
import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {canonicalJson} from './lib/plugin-manifest.js';import {verifyRepository} from './lib/plugin-repository.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2],pem=process.env.PLUGIN_SIGNING_PRIVATE_KEY_FILE;
if(!id||!pem||!/^[a-z0-9.-]{2,60}$/.test(id))throw Error('Usage: PLUGIN_SIGNING_PRIVATE_KEY_FILE=/secure/new.pem node scripts/rotate-repository-key.mjs <new-key-id>');
const key=crypto.createPrivateKey(fs.readFileSync(pem)),publicKey=crypto.createPublicKey(key).export({format:'der',type:'spki'}).toString('base64');
if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 required');
const keysPath=path.join(root,'keys','trusted-keys.json'),keys=JSON.parse(fs.readFileSync(keysPath)),repoPath=path.join(root,'repo.json'),repo=JSON.parse(fs.readFileSync(repoPath));
verifyRepository(repo,keys,'https://example.invalid/plugins/repo.json');
if(keys[id]&&keys[id]!==publicKey)throw Error('Key ID already belongs to another key');
if(!keys[id])throw Error('Publish the new public key into trusted-keys.json and deploy PLUGIN_TRUSTED_KEYS to all clients before rotation');
repo.keyId=id;repo.generatedAt=new Date().toISOString();delete repo.signature;
repo.signature=crypto.sign(null,Buffer.from(canonicalJson(repo)),key).toString('base64');
verifyRepository(repo,keys,'https://example.invalid/plugins/repo.json');
const tmp=repoPath+'.rotate.tmp';fs.writeFileSync(tmp,JSON.stringify(repo,null,2)+'\n');fs.renameSync(tmp,repoPath);
console.log(`Repository now signed by ${id}; all existing package signatures retained under their own key IDs.`);
