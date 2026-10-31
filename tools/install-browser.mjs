import path from 'node:path';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url),cache=path.join(root,'local','browser-cache');await fs.mkdir(cache,{recursive:true});
const temp=path.join(root,'local','qa','browser-install');await fs.mkdir(temp,{recursive:true});
const cli=path.join(path.dirname(require.resolve('playwright/package.json')),'cli.js');
const result=spawnSync(process.execPath,[cli,'install','chromium'],{stdio:'inherit',env:{...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,PLAYWRIGHT_BROWSERS_PATH:cache}});process.exitCode=result.status??1;
