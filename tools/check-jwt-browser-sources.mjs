// GitHub-only source consistency check for the deliberately shared UI/verifier
// contracts. Native business data and auth issuance are not copied by this tool.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const academy=process.env.ACADEMY_SOURCE,hifz=process.env.HIFZ_SOURCE;assert.ok(academy&&hifz);
const browser=['browser-display-state.mjs','browser-control-relay.mjs','browser-control-client.mjs','browser-app-privacy.mjs','browser-entry.mjs','browser-bootstrap.js'];
const server=['claims.mjs','native-rights.mjs','store.mjs','compact-studio.mjs','server-context.mjs'],rows=[];
for(const name of browser){
 const paths=[resolve('src/auth/v110',name),resolve('public/auth/v110',name),resolve(academy,'auth/v110',name),resolve(hifz,'auth/v110',name)];
 const contents=await Promise.all(paths.map(path=>readFile(path,'utf8')));for(const value of contents)assert.equal(value,contents[0],name+' shared browser source differs.');
 rows.push({kind:'browser',name,sha256:createHash('sha256').update(contents[0]).digest('hex')});
}
for(const name of server){
 const paths=[resolve('src/auth/v110',name),resolve(academy,'backend/src/auth/v110',name),resolve(hifz,'worker/src/auth/v110',name)];
 const contents=await Promise.all(paths.map(path=>readFile(path,'utf8')));for(const value of contents)assert.equal(value,contents[0],name+' shared verifier source differs.');
 rows.push({kind:'server',name,sha256:createHash('sha256').update(contents[0]).digest('hex')});
}
for(const root of [resolve('public'),academy,hifz]){
 const config=await readFile(resolve(root,'auth/v110/browser-config.js'),'utf8');assert.match(config,/"enabled": false/,'Default feature config must be disabled.');
}
await mkdir('.build/jwt-v110-browser-integration',{recursive:true});
await writeFile('.build/jwt-v110-browser-integration/shared-source.json',JSON.stringify({synthetic:true,businessDataCopied:false,rows},null,2)+'\n');
process.stdout.write('Shared browser/verifier contracts match; feature configs disabled.\n');
