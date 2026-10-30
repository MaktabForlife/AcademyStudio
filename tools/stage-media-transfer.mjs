// Filesystem-only private staging. A transfer receipt is never an admission grant.
import {readFile,writeFile,mkdir,copyFile,link,unlink,realpath,lstat,chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {contentHash} from './reconciled-content.mjs';
import {verifyLocalMedia} from './media-import-plan.mjs';
const check=(value,message)=>{if(!value)throw Error(message);};

async function privateDirectory(path){
 try{await mkdir(path,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
 const stat=await lstat(path);check(stat.isDirectory()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'PRIVATE_MEDIA_DIRECTORY_REQUIRED');
}
async function immutableJSON(file,value){
 const bytes=JSON.stringify(value,null,2),temporary=file+'.partial-'+randomUUID();
 await writeFile(temporary,bytes,{mode:0o600,flag:'wx'});
 try{try{await link(temporary,file);}catch(e){if(e.code!=='EEXIST')throw e;const stat=await lstat(file);check(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'PRIVATE_MEDIA_CHECKPOINT_REQUIRED');check((await readFile(file,'utf8'))===bytes,'MEDIA_CHECKPOINT_CHANGED');}}finally{await unlink(temporary);}
}

export async function stageMediaTransfer(plan,{sourceRoot,destination,onCheckpoint=async()=>{}}={}){
 const {planSha256,...payload}=plan;
 check(plan.format==='CIRCLES_MEDIA_TRANSFER_PLAN_V1'&&plan.localOnly&&plan.readyToAdmit===false&&plan.readyToPublish===false&&contentHash(payload)===planSha256,'MEDIA_TRANSFER_PLAN_CHANGED');
 check(Array.isArray(plan.objects)&&plan.objects.length<=2000,'MEDIA_TRANSFER_LIMIT');
 const root=await realpath(sourceRoot),output=resolve(destination);check(output!==root&&!output.startsWith(root+'/'),'MEDIA_STAGE_MUST_BE_SEPARATE');await privateDirectory(output);
 await privateDirectory(join(output,'objects'));await privateDirectory(join(output,'receipts'));
 await immutableJSON(join(output,'checkpoint.json'),{format:'CIRCLES_MEDIA_STAGE_CHECKPOINT_V1',planSha256});
 const receipts=[];let bytes=0;
 for(const {object,localFile}of plan.objects){
  if(object.kind==='YOUTUBE')continue;
  check(localFile&&/^objects\/[a-f0-9]{64}\.(pdf|mp4)$/.test(localFile.file),'MEDIA_PRIVATE_FILE_REQUIRED');
  const original=await realpath(join(root,localFile.file));check(original.startsWith(root+'/'),'MEDIA_SOURCE_PATH_INVALID');
  const verified=await verifyLocalMedia(object,original);
  check(verified.sha256===localFile.sha256&&verified.size===localFile.bytes,'MEDIA_COPIED_BYTES_CHANGED');
  const name=verified.sha256+(object.kind==='PDF'?'.pdf':'.mp4'),file=join(output,'objects',name),temporary=file+'.partial-'+randomUUID();
  const existing=await lstat(file).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
  if(!existing){try{
   await copyFile(original,temporary,constants.COPYFILE_EXCL);await chmod(temporary,0o600);
   const copied=await verifyLocalMedia(object,temporary);check(contentHash(copied)===contentHash(verified),'MEDIA_STAGED_BYTES_CHANGED');
   try{await link(temporary,file);}catch(e){if(e.code!=='EEXIST')throw e;}
  }finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
  const stored=await lstat(file);check(stored.isFile()&&!stored.isSymbolicLink()&&(stored.mode&0o077)===0,'MEDIA_STAGE_PATH_INVALID');
  check(contentHash(await verifyLocalMedia(object,file))===contentHash(verified),'MEDIA_STAGED_BYTES_CHANGED');
  const receipt={...verified,stagedFile:'objects/'+name,planSha256,targetAdmission:'PENDING'};
  await immutableJSON(join(output,'receipts',contentHash(object.assetId)+'.json'),receipt);
  receipts.push(receipt);bytes+=verified.size;await onCheckpoint({completed:receipts.length,assetId:object.assetId});
 }
 const result={format:'CIRCLES_MEDIA_STAGE_RECEIPT_V1',localOnly:true,planSha256,receipts,
  referenceOnly:plan.objects.filter(o=>o.object.kind==='YOUTUBE').map(o=>({assetId:o.object.assetId,youtubeId:o.object.youtubeId,targetAdmission:'PENDING'})),
  summary:{verifiedPrivateObjects:receipts.length,verifiedBytes:bytes,readyToAdmit:false,readyToPublish:false},sourceRevalidation:'REQUIRED',acceptedTargetMappings:[],hostedWrites:0};
 await immutableJSON(join(output,'transfer-receipt.json'),result);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 check(process.argv.length===5,'Provide the private plan JSON, private bundle directory and stage directory.');
 const bytes=await readFile(process.argv[2]);check(bytes.length<=2_000_000,'MEDIA_TRANSFER_PLAN_TOO_LARGE');
 const result=await stageMediaTransfer(JSON.parse(bytes),{sourceRoot:process.argv[3],destination:process.argv[4]});console.log(JSON.stringify(result.summary));
}
