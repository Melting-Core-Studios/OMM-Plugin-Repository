import fs from 'node:fs';import {readArchive} from './lib/plugin-archive.js';
const files=readArchive(fs.readFileSync(process.argv[2]));console.log('ZIP verified; files:',[...files.keys()].join(', '));
