// Structural distribution checks; no private policy or pre-existing local directory required.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const privateNames=new Set(['local','agents.md','.gitignore','node_modules','.git','.qa','.codex-tmp']);
export const isPrivatePath=name=>name.split(/[\\/]/).some(part=>privateNames.has(part.toLowerCase()));
export const isGeneratedPath=name=>/^(ai-navigator|index)\.html$/i.test(name);
export function safeFile(root,name){
 if(typeof name!=='string'||name.includes('\\')||name.includes(':')||name.split('/').some(p=>p==='..'||p==='.'||!p)||path.isAbsolute(name))throw Error('Invalid public path');
 const target=path.resolve(root,name);if(!target.startsWith(path.resolve(root)+path.sep))throw Error('Public path leaves project');return target;
}
export async function checkPublicFiles(root=projectRoot){
 root=path.resolve(root);const manifest=JSON.parse(await fs.readFile(path.join(root,'PUBLIC-FILES.json'),'utf8')),files=manifest.files;
 if(!Array.isArray(files)||new Set(files).size!==files.length)throw Error('Invalid public manifest');
 for(const name of files){safeFile(root,name);if(isPrivatePath(name))throw Error('Private path cannot be published: '+name);if(isGeneratedPath(name))throw Error('Generated HTML cannot be committed: '+name);}
 const allowed=new Set(files),records=[],problems=[];
 async function inspect(dir,relative=''){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const name=relative?relative+'/'+entry.name:entry.name;if(isPrivatePath(name))continue;if(entry.isSymbolicLink())problems.push({file:name,rule:'symbolic-link'});else if(entry.isDirectory())await inspect(path.join(dir,entry.name),name);else if(!allowed.has(name)&&!isGeneratedPath(name))problems.push({file:name,rule:'not-in-public-manifest'});}}
 await inspect(root);
 const realRoot=await fs.realpath(root);
 for(const name of files){const file=safeFile(root,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Not an ordinary public file: '+name);
 const relative=path.relative(realRoot,await fs.realpath(file));if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||isPrivatePath(relative))throw Error('Public path resolves outside allowed tree');
 const bytes=await fs.readFile(file);if(!/\.(png|jpg|jpeg|webp|ico)$/i.test(name)){const text=bytes.toString('utf8');for(const [rule,re] of [['private-key',/-----BEGIN [A-Z ]*PRIVATE KEY-----/],['access-token',/gh[pousr]_[A-Za-z0-9]{30,}/],['machine-path',/[A-Z]:[\\/](?:Users|AI-vibecoding)[\\/]/i]])if(re.test(text))problems.push({file:name,rule});}
 records.push({file:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
 if(await fs.stat(path.join(root,'.git')).then(()=>true,()=>false)){const tracked=execFileSync('git',['-C',root,'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);for(const name of tracked)if(isPrivatePath(name)||isGeneratedPath(name))problems.push({file:name,rule:'excluded-file-tracked'});}
 if(problems.length)throw Error('Public-file review failed: '+JSON.stringify(problems));
 return {status:'passed',files:records};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const r=await checkPublicFiles();console.log(JSON.stringify({status:r.status,files:r.files.length}));}catch(e){console.error(e.message);process.exitCode=1;}}
