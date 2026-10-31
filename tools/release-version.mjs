// Release tags are preserved as strings; package metadata is not a UI version.
export function releaseVersion(tag='') {
 if(tag==='')return '';
 if(typeof tag!=='string'||!/^v[0-9]+(?:\.[0-9]+){0,3}$/.test(tag)||/[\r\n]/.test(tag))throw Error('Expected a release tag such as v1, v0.1, v0.1.0 or v0.1.2.3.');
 return tag.slice(1);
}
