import './preserve-local-files.mjs';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=execFileSync('git',['ls-files','-z','--','tests'],{cwd:root,encoding:'utf8'}).split('\0').filter(p=>/^tests\/[^/]+\.test\.mjs$/.test(p)).sort();
if(process.argv.includes('--list'))console.log(JSON.stringify(files));
else{const r=spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{cwd:root,stdio:'inherit',env:process.env});process.exitCode=r.status??1;}
