// Public-file checks use private editorial policy without redistributing its vocabulary.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {checkPublicFiles,safeFile,isGeneratedPath} from './check-public-files.mjs';
export {safeFile} from './check-public-files.mjs';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function editorialText(name,text){if(name.endsWith('.md')||name==='src/catalog.json')return text;if(name.startsWith('src/')&&name.endsWith('.html'))return text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<[^>]*>/g,' ');if(name==='ai-navigator.html'){const data=text.match(/<script[^>]*id="catalog-data"[^>]*>([\s\S]*?)<\/script\s*>/i)?.[1]||'';const body=(text.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)||[])[1]||'';return data+'\n'+body.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<[^>]*>/g,' ');}return '';}
export async function checkPublication(root=projectRoot){
 await checkPublicFiles(root);
 const manifest=JSON.parse(await fs.readFile(path.join(root,'PUBLIC-FILES.json'),'utf8')),files=manifest.files;if(!Array.isArray(files)||new Set(files).size!==files.length)throw Error('Invalid public manifest');const allowed=new Set(files),privateRoots=new Set(['local','node_modules','.git','.qa','.codex-tmp']);for(const name of files){safeFile(root,name);if(privateRoots.has(name.split('/')[0]))throw Error('Private path cannot be in public manifest');}
 const policyPath=path.join(root,'local','publication-policy.json');let policy;try{policy=JSON.parse(await fs.readFile(policyPath,'utf8'));}catch{throw Error('Owner publication policy is required at local/publication-policy.json. Build and ordinary tests do not require that private file.');}
 const problems=[],records=[];const ignored=new Set(['local','node_modules','.git','.qa','.codex-tmp']);
 async function inspect(dir,relative=''){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(ignored.has(entry.name.toLowerCase())||['agents.md','.gitignore'].includes(entry.name.toLowerCase()))continue;const name=(relative?relative+'/':'')+entry.name;if(entry.isSymbolicLink()){problems.push({file:name,rule:'symbolic-link'});continue;}if(entry.isDirectory())await inspect(path.join(dir,entry.name),name);else if(!allowed.has(name)&&!isGeneratedPath(name))problems.push({file:name,rule:'not-in-public-manifest'});}}
 await inspect(root);
 const generated=await fs.stat(path.join(root,'ai-navigator.html')).then(()=>['ai-navigator.html'],()=>[]);
 for(const name of [...files,...generated]){const file=safeFile(root,name);const info=await fs.lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('Not an ordinary public file: '+name);const real=path.relative(await fs.realpath(root),await fs.realpath(file));if(real==='..'||real.startsWith('..'+path.sep)||path.isAbsolute(real)||privateRoots.has(real.split(path.sep)[0]))throw Error('Public file resolves outside the public project');const data=await fs.readFile(file),text=data.toString('utf8');
 for(const rule of policy.rules){const value=rule.scope==='editorial'?editorialText(name,text):text;const match=new RegExp(rule.pattern,rule.flags).exec(value);if(match)problems.push({file:name,rule:rule.id,line:value.slice(0,match.index).split('\n').length});}
 for(const [id,re] of [['private-key',/-----BEGIN [A-Z ]*PRIVATE KEY-----/],['access-token',/gh[pousr]_[A-Za-z0-9]{30,}/],['machine-path',/[A-Z]:[\\/](?:Users|AI-vibecoding)[\\/]/i]])if(re.test(text))problems.push({file:name,rule:id});
 records.push({file:name,bytes:data.length,sha256:sha(data),...(generated.includes(name)?{generated:true}:{})});
 }
 const report={status:problems.length?'failed':'passed',files:records,problems,privatePolicyLoaded:true};await fs.mkdir(path.join(root,'local','qa'),{recursive:true});await fs.writeFile(path.join(root,'local','qa','publication-report.json'),JSON.stringify(report,null,2)+'\n');if(problems.length)throw Error('Public-file review failed: '+JSON.stringify(problems));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const report=await checkPublication();console.log(JSON.stringify({status:report.status,publicFiles:report.files.filter(f=>!f.generated).length,generatedChecked:report.files.filter(f=>f.generated).length,privateFilesIncluded:0}));}catch(error){console.error(error.message);process.exitCode=1;}}
