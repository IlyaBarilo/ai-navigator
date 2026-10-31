import {execFileSync} from 'node:child_process';import {releaseVersion} from './release-version.mjs';
const tag=process.env.AI_NAVIGATOR_RELEASE_TAG;
if(!releaseVersion(tag))throw Error('Release tag required');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const commit=git('rev-parse',`refs/tags/${tag}^{commit}`);
if(commit!==git('rev-parse','HEAD'))throw Error('Checkout must match the release tag');
execFileSync('git',['merge-base','--is-ancestor',commit,'refs/remotes/origin/main']);
console.log('Release source belongs to main: '+tag);
