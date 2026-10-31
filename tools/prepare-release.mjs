// Packages the already checked HTML; never rebuilds or contacts a remote service.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {releaseVersion} from './release-version.mjs';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function prepareRelease({root=projectRoot,tag,source=path.join(root,'ai-navigator.html'),out=path.join(root,'local','release')}={}){
const version=releaseVersion(tag);
if(!version)throw Error('AI_NAVIGATOR_RELEASE_TAG is required');
for(const file of [source,out])if(!path.resolve(file).startsWith(path.resolve(root)+path.sep))throw Error('Release files must remain inside project');
const html=await fs.readFile(source);
const provenance=JSON.parse(html.toString('utf8').match(/<script[^>]*id="asset-provenance"[^>]*>([\s\S]*?)<\/script\s*>/i)?.[1]||'{}');
if(provenance.release?.tag!==tag)throw Error('HTML does not match the requested release');
await fs.mkdir(out,{recursive:true});
const names=['ai-navigator.html',`ai-navigator-${version}.html`];
for(const name of names)await fs.writeFile(path.join(out,name),html);
const hash=crypto.createHash('sha256').update(html).digest('hex');await fs.writeFile(path.join(out,'SHA256SUMS.txt'),names.map(name=>`${hash}  ${name}`).join('\n')+'\n');
return {tag,files:[...names,'SHA256SUMS.txt'],sha256:hash};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareRelease({tag:process.env.AI_NAVIGATOR_RELEASE_TAG})));
