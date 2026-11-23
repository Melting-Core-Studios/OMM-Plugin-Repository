import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const targets=[];
for(const folder of [path.join(root,'tests'),...fs.readdirSync(path.join(root,'sources')).map(x=>path.join(root,'sources',x,'tests'))]){
 if(!fs.existsSync(folder))continue;
 for(const file of fs.readdirSync(folder))if(file.endsWith('.test.mjs'))targets.push(path.join(folder,file));
}
const run=spawnSync(process.execPath,['--test',...targets],{stdio:'inherit',cwd:root});
if(run.error)throw run.error;
process.exitCode=run.status||0;
