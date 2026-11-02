import test from 'node:test';
import assert from 'node:assert/strict';
import {studioFixture} from './studio-access-fixture.mjs';
import {sha256} from '../src/protocol.mjs';
test('actual native Source upload proxy preserves narrow limits, current Admin and exact retry/preview boundaries',async t=>{
 const x=await studioFixture();t.after(()=>x.f.close());await x.handover();
 const id=crypto.randomUUID(),table=await x.good({action:'mou-playlists'}),token=await x.nativeLogin();
 // Deliberately exceed the general131072/250000 limits, while staying inside
 // the decorative512KiB decoded budget. This never uses instructional media.
 const bytes=new Uint8Array(300000);bytes.set([137,80,78,71,13,10,26,10]);
 const command={action:'mou-playlist-cover-upload',operationId:crypto.randomUUID(),playlistId:id,revision:table.revision,type:'image/png',sha256:await sha256(bytes),data:Buffer.from(bytes).toString('base64')};
 const upload=async(command,extra={})=>{const r=await x.f.runtime.dispatchFetch('https://academy.test/api/admin/platform/studio-access/playlist-cover',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+token,'X-Academy-Workspace':'ADMIN',...extra.headers},body:JSON.stringify({activityKey:x.x.courseA,command,...extra.body})});return {status:r.status,body:await r.json()};};
 let result=await upload(command);for(let n=0;n<6&&result.body.code==='STUDIO_CONFIRMATION_PENDING';n++)result=await upload(command);assert.equal(result.status,200,JSON.stringify(result.body));const image=result.body.image;assert.equal(image.size,bytes.length);assert.equal(image.url,null);assert.equal((await upload(command)).body.replayed,true);
 const preview=await x.good({action:'mou-playlist-cover-preview',playlistId:id,assetId:image.assetId});assert.equal(Buffer.from(preview.data,'base64').length,300000);assert.equal(preview.image.sha256,command.sha256);
 assert.equal((await x.f.request('/api/public/circles/covers/'+image.sha256)).status,404);
 assert.equal((await x.proxy(command)).status,413,'General browser parser must remain small');assert.equal((await upload({action:'mou-playlists'})).status,400);
 assert.equal((await upload({...command,operationId:crypto.randomUUID(),data:'a'.repeat(800000)})).status,413);
 assert.equal((await upload({...command,operationId:crypto.randomUUID()},{headers:{Origin:'https://elsewhere.test'}})).status,403);
 const teacher=await x.nativeLogin('teacherA');assert.equal((await upload(command,{headers:{Authorization:'Bearer '+teacher}})).status,403);
 const latest=await x.good({action:'mou-playlists'});
 const saved=await x.good({action:'mou-playlist-save',operationId:crypto.randomUUID(),playlistId:id,name:'Native private card',closeDate:'',revision:latest.revision,playlistRevision:0,websiteRevision:0,teacherIds:[],card:{version:1,style:'image',colour:'#759786',gradient:null,image,teacher:'Client label ignored'}});assert.equal(saved.card.teacher,null);assert.equal(saved.card.image.assetId,image.assetId);
 const options=await x.good({action:'mou-playlist-card-options'});assert.equal(options.teacherRequired,false);assert(Array.isArray(options.teachers));
 assert(options.teachers.length,'Native fixture has registered Teachers');const selected=options.teachers[0],fresh=await x.good({action:'mou-playlists'}),row=fresh.playlists.find(p=>p.id===id);const attributed=await x.good({action:'mou-playlist-save',operationId:crypto.randomUUID(),playlistId:id,name:row.name,closeDate:'',revision:fresh.revision,playlistRevision:row.revision,websiteRevision:row.websiteRevision,teacherIds:[selected.id],card:{...row.card,teacher:'Forged client teacher'}});assert.equal(attributed.card.teacher,selected.name);
 assert.equal((await x.proxy({action:'mou-playlist-cover-preview',playlistId:'wrong-parent',assetId:image.assetId})).status,404);
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());await (await x.f.runtime.getD1Database('ACADEMY_DB','academy')).prepare('UPDATE account_sessions SET revoked_at=? WHERE account_id=? COLLATE NOCASE').bind(new Date().toISOString(),claims.accountid).run();assert.equal((await upload(command)).status,401);
});
