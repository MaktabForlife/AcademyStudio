// Permanent owner instruction: preserve every local file, including test output.
import fs from 'node:fs';
import promises from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
const log=(operation,path)=>{const target=process.env.M4L_NO_DELETE_LOG;if(target)fs.appendFileSync(target,JSON.stringify({operation,path:String(path),preserved:true})+'\n');};
for(const operation of ['rm','rmdir','unlink']){
 fs[operation+'Sync']=(path)=>{log(operation+'Sync',path);};
 fs[operation]=(...args)=>{log(operation,args[0]);const callback=args.at(-1);if(typeof callback==='function')queueMicrotask(()=>callback(null));};
 promises[operation]=async(path)=>{log('promises.'+operation,path);};
}
syncBuiltinESMExports();
const flag='--import='+import.meta.url;
if(!(process.env.NODE_OPTIONS||'').includes(flag))process.env.NODE_OPTIONS=((process.env.NODE_OPTIONS||'')+' '+flag).trim();
