import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyRepository} from './lib/plugin-repository.js';
import {readArchive} from './lib/plugin-archive.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=JSON.parse(fs.readFileSync(path.join(root,'repo.json'),'utf8'));
const keys=JSON.parse(fs.readFileSync(path.join(root,'keys','trusted-keys.json'),'utf8'));
verifyRepository(repo,keys,'https://example.invalid/plugins/repo.json');
let count=0;
for(const plugin of repo.plugins)for(const release of plugin.versions){const data=fs.readFileSync(path.join(root,release.package.url));
 if(crypto.createHash('sha256').update(data).digest('hex')!==release.package.sha256||data.length!==release.package.bytes)throw Error(`Hash/size mismatch for ${plugin.id}`);
 if(!crypto.verify(null,data,crypto.createPublicKey({key:Buffer.from(keys[release.package.keyId],'base64'),format:'der',type:'spki'}),Buffer.from(release.package.signature,'base64')))throw Error(`Signature invalid: ${plugin.id}`);
 const files=readArchive(data);if(JSON.parse(files.get('manifest.json')).id!==plugin.id)throw Error('Package identity mismatch');count++;}
console.log(`Validated signed repo.json, ${repo.plugins.length} plugins, ${count} signed executable archives`);
