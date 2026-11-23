import {build} from './publish-plugin.mjs';
const item=build(process.argv[2]);
console.log(`${item.manifest.id}@${item.manifest.version}: reproducible executable archive, ${item.bytes.length} bytes`);
