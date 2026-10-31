// Development helper. No browser automation library is embedded in ai-navigator.html.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function launchBrowser(root){
 const temp=path.join(root,'local','qa','tmp');await fs.mkdir(temp,{recursive:true});
 process.env.TEMP=temp;process.env.TMP=temp;process.env.TMPDIR=temp;
 process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root,'local','browser-cache');
 const {chromium}=await import('playwright');
 const executable=process.env.AI_NAVIGATOR_BROWSER_PATH;
 return chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
}
