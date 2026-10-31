// Copy an explicitly reviewed allowlist; never copy the entire working directory.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {checkPublication,safeFile} from './check-publication.mjs';import {checkPublicFiles} from './check-public-files.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),local=path.join(root,'local'),target=process.argv[2]?path.resolve(root,process.argv[2]):path.join(local,'public-export'),report=await checkPublication(root);
if(!target.startsWith(local+path.sep))throw Error('Export must stay inside local/');
report.files=report.files.filter(item=>!item.generated);
const stage=await fs.mkdtemp(path.join(local,'public-export-stage-'));
for(const {file} of report.files){const to=safeFile(stage,file);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(safeFile(root,file),to);}
await checkPublicFiles(stage);
if(await fs.lstat(target).then(()=>true,()=>false)){
 const backup=path.resolve(local,'export-backups','public-export-'+Date.now());
 for(const dir of [target,backup,stage])if(!dir.startsWith(local+path.sep))throw Error('Export path must remain within local');
 if((await fs.lstat(target)).isSymbolicLink())throw Error('Previous export must not be a symbolic link');
 await fs.mkdir(path.dirname(backup),{recursive:true});await fs.rename(target,backup);
}
await fs.rename(stage,target);
const destination=path.relative(root,target).split(path.sep).join('/');
await fs.writeFile(path.join(root,'local','qa','public-export-report.json'),JSON.stringify({status:'prepared',destination,files:report.files,uploaded:false},null,2)+'\n');console.log(JSON.stringify({status:'prepared',directory:destination,files:report.files.length,uploaded:false}));
