// Isolated CI runtime selection; never imported by production.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
const mode=process.env.JWT_RUNTIME||'legacy';
if(!['legacy','production-date'].includes(mode))throw Error('Unknown isolated JWT runtime.');
const resolver=createRequire(mode==='production-date'?new URL('../node_modules/wrangler/package.json',import.meta.url):import.meta.url);
const path=resolver.resolve('miniflare');
const runtime=await import(pathToFileURL(path).href);
export const Miniflare=runtime.Miniflare;
export const convertV4MiniflareOptions=runtime.convertV4MiniflareOptions;
export const compatibilityDate=mode==='production-date'?'2026-10-28':'2026-09-28';
if(typeof Miniflare!=='function'||typeof convertV4MiniflareOptions!=='function')throw Error('Review the selected Miniflare API before running.');
const marker='/node_modules/miniflare/',prefix=path.slice(0,path.lastIndexOf(marker)+marker.length);
const pkg=JSON.parse(await readFile(prefix+'package.json','utf8'));
export const runtimeEvidence={mode,compatibilityDate,miniflare:pkg.version,workerdDependency:pkg.dependencies?.workerd,completeApplicationParity:false};
if(mode==='production-date'&&pkg.version!=='5.20261103.0-beta')throw Error('Unexpected Wrangler-owned Miniflare version; review lockfile.');
