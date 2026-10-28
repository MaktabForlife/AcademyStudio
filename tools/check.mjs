import {readdirSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const roots=['src','public','tests','tools'],files=[];const visit=path=>{for(const entry of readdirSync(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory())visit(file);else if(file.endsWith('.mjs'))files.push(file);}};roots.forEach(visit);
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status){process.stderr.write(result.stderr);process.exit(result.status);}}
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));if(config.vars.PLATFORM_ENABLED!=='0'||config.workers_dev!==false||config.preview_urls!==false||[...config.d1_databases,...config.r2_buckets].some(x=>x.remote))throw Error('Keep deployment disabled and all rehearsal bindings local.');
console.log(JSON.stringify({syntaxFiles:files.length,configurationDisabled:true,remoteBindings:false}));
