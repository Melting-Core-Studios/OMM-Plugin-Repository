/** A deliberately small ZIP (stored/deflated) reader with strict entry validation.
 * Rejects symlinks, duplicate names, ZIP64, traversal, archives with ambiguous
 * central directory metadata, compression bombs and executable/native payloads.
 * Does not invoke system extractors or execute archived code during validation.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const MAX_FILES=180,MAX_TOTAL=16*1024*1024,MAX_FILE=3*1024*1024,MAX_ZIP=8*1024*1024;
const rejected=/(?:^|\/)(?:node_modules|\.git|\.env|__MACOSX)(?:\/|$)|\.(?:png|jpe?g|gif|svg|webp|ico|bmp|tiff|dll|exe|so|dylib|node|sh|bat|cmd|ps1)$/i;
export function crc32(buf){let n=~0;for(const byte of buf){n^=byte;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (~n)>>>0;}
function fail(message){throw Object.assign(new Error(message),{status:422});}
function safePath(name){
 if(typeof name!=='string'||!name||name.length>240||name.includes('\\')||name.includes('\0')||name.startsWith('/')||/^[A-Za-z]:/.test(name)||name.endsWith('/')||name.split('/').some(x=>!x||x==='.'||x==='..')||rejected.test(name)||!/^[a-zA-Z0-9._/@+-]+$/.test(name))fail('Unsafe or forbidden plugin archive path');
 return name;
}
export function readArchive(bytes){
 const b=Buffer.from(bytes);if(b.length>MAX_ZIP||b.length<22)fail('Plugin ZIP size invalid');
 const eocd=Math.max(0,b.length-65557);let end=-1;
 for(let i=b.length-22;i>=eocd;i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
 if(end<0)fail('ZIP central directory not found');
 const count=b.readUInt16LE(end+10),offset=b.readUInt32LE(end+16),size=b.readUInt32LE(end+12);
 if(!count||count>MAX_FILES||b.readUInt16LE(end+8)!==count||b.readUInt16LE(end+4)||b.readUInt16LE(end+6)||offset+size!==end)fail('Invalid ZIP central directory');
 let at=offset,total=0;const files=new Map();
 for(let i=0;i<count;i++){
  if(at+46>end||b.readUInt32LE(at)!==0x02014b50)fail('Malformed ZIP central record');
  const made=b.readUInt16LE(at+4),flags=b.readUInt16LE(at+8),method=b.readUInt16LE(at+10),crc=b.readUInt32LE(at+16),packed=b.readUInt32LE(at+20),raw=b.readUInt32LE(at+24);
  const n=b.readUInt16LE(at+28),extra=b.readUInt16LE(at+30),comment=b.readUInt16LE(at+32),external=b.readUInt32LE(at+38),local=b.readUInt32LE(at+42);
  if(at+46+n+extra+comment>end||!n||flags&~0x0808||!(flags&0x800)||![0,8].includes(method))fail('Unsupported ZIP flags, encoding or compression');
  const name=safePath(b.subarray(at+46,at+46+n).toString('utf8'));
  if(files.has(name))fail('Duplicate ZIP entry');
  const mode=(external>>>16)&0xffff,kind=mode&0xf000;
  if((made>>8)===3&&kind!==0&&kind!==0x8000)fail('Plugin ZIP contains symlink or non-file object');
  if((mode&0o111)!==0)fail('Executable file permissions are not allowed in plugin ZIP');
  if(raw>MAX_FILE||(total+=raw)>MAX_TOTAL||packed>MAX_ZIP||raw>packed*100+65536)fail('Plugin ZIP exceeds expanded size or compression-ratio limits');
  if(local+30>b.length||b.readUInt32LE(local)!==0x04034b50)fail('Missing ZIP local record');
  const ln=b.readUInt16LE(local+26),le=b.readUInt16LE(local+28),start=local+30+ln+le;
  if(start+packed>offset||b.subarray(local+30,local+30+ln).toString('utf8')!==name||b.readUInt16LE(local+8)!==method)fail('Conflicting ZIP local metadata');
  let content;try{content=method===0?b.subarray(start,start+packed):zlib.inflateRawSync(b.subarray(start,start+packed),{maxOutputLength:MAX_FILE+1});}
  catch{fail('Plugin ZIP decompression failed');}
  if(content.length!==raw||crc32(content)!==crc)fail('Corrupt plugin ZIP contents');
  files.set(name,Buffer.from(content));at+=46+n+extra+comment;
 }
 if(at!==end)fail('Extra ZIP central directory data');
 for(const needed of ['manifest.json','plugin.json','package.json','README.md','LICENSE'])if(!files.has(needed))fail(`Missing ${needed} in plugin package`);
 return files;
}
export function extractArchive(bytes,target){
 const files=readArchive(bytes);fs.mkdirSync(target,{recursive:true,mode:0o700});
 for(const [name,content] of files){const dest=path.join(target,name);fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});fs.writeFileSync(dest,content,{flag:'wx',mode:0o600});}
 return files;
}
/** Simple deterministic stored ZIP writer: canonical by sorted entry paths. */
export function writeArchive(entries){
 const files=Object.entries(entries).sort(([a],[b])=>a.localeCompare(b)),parts=[],central=[];let offset=0;
 for(const [name,input] of files){safePath(name);const data=Buffer.from(input),nb=Buffer.from(name,'utf8'),crc=crc32(data);
  if(data.length>MAX_FILE)fail('Plugin source too large');
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nb.length,26);
  const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(0x800,8);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(data.length,20);dir.writeUInt32LE(data.length,24);dir.writeUInt16LE(nb.length,28);dir.writeUInt32LE(0x81a40000,38);dir.writeUInt32LE(offset,42);
  parts.push(local,nb,data);central.push(dir,nb);offset+=local.length+nb.length+data.length;
 }
 if(files.length>MAX_FILES||offset>MAX_ZIP)fail('Plugin package exceeds limits');
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...parts,directory,end]);
}
