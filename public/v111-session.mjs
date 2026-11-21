export const studioOrigin='https://worshipuponbaseera.ummabbadacademy.app',academyOrigin='https://ummabbadacademy.app';
const editorControllers=new WeakMap(),draftStores=new WeakMap(),lifecycleControllers=new WeakMap();
const missing=()=>Object.assign(new Error('The Studio session connection is unavailable.'),{code:'V2_CLIENT_UNAVAILABLE',status:503});
export async function createStudioSession(config,{factory,origin=globalThis.location?.origin,onMask=()=>{},...options}={}){
 if(config?.authVersion!==2||config.app!=='studio'||origin!==studioOrigin||config.academyOrigin!==academyOrigin||config.academyPortalOrigin!==academyOrigin)throw missing();
 const create=factory||(await import('./v111/browser-session.mjs')).createBrowserSession;
 if(typeof create!=='function')throw missing();
 let session;const checkpoint=async()=>{await options.checkpoint?.();for(const controller of editorControllers.get(session)||[])await controller.checkpointBeforeJourney();};
 session=await create({app:'studio',origin,onMask,...options,checkpoint});editorControllers.set(session,new Set());installStudioLifecycle(session);return session;
}
export async function navigateStudioAdmission(session,{returnTo='/studio/',win=globalThis.window}={}){
 if(!session||typeof session.beginAdmission!=='function')throw missing();
 const value=await session.beginAdmission({returnTo}),href=typeof value==='string'?value:value?.navigateUrl;
 let destination;try{destination=new URL(href);}catch{throw missing();}
 if(destination.origin!==academyOrigin||destination.protocol!=='https:'||destination.username||destination.password)throw missing();
 win.location.assign(destination.href);return {connecting:true};
}

const encodeBookmarkProof=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const bookmarkStorageKey='uaa-studio-bookmark-return-v2';

async function bookmarkPost(fetcher,path,body,csrf){
 const headers={'Content-Type':'application/json','X-UAA-Request':'2'};
 if(csrf)headers['X-UAA-CSRF']=csrf;
 if(body.expectedContext)headers['X-UAA-Expected-Context']=encodeBookmarkProof(new TextEncoder().encode(JSON.stringify(body.expectedContext)));
 const response=await fetcher(path,{method:'POST',credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'same-origin',headers,body:JSON.stringify(body)});
 const dto=await response.json();
 if(!response.ok||dto.success!==true||dto.contractVersion!==2){
  const message={
   ACADEMY_SIGN_IN_REQUIRED:'Sign in to Academy to open this bookmark.',
   ACCOUNT_SELECTION_REQUIRED:'This bookmark needs an account choice before it can open.',
   PIN_REQUIRED:'Studio is locked. Unlock your Studio session to continue.',
   UNREGISTERED_RETURN:'This Studio bookmark is invalid.'
  }[dto.code]||'Studio could not check this bookmark. Try again.';
  throw Object.assign(Error(message),{code:dto.code,status:response.status});
 }
 return dto;
}

async function finishBookmarkPost(fetcher,body,csrf){
 let original;
 try{
  const result=await bookmarkPost(fetcher,'/auth/v2/shared-entry',body,csrf);
  if(result.state==='UNLOCKED')return result;
  if(result.outcome!=='SUPERSEDED')return result;
  original=Error('Studio could not confirm this bookmark.');
 }catch(error){
  if(error.status&&error.status<500)throw error;
  original=error;
 }
 const {confirmAcademyAccount:_,...observation}=body;
 const status=await bookmarkPost(fetcher,'/auth/v2/shared-entry/status',observation,csrf);
 if(status.outcome==='INSTALLED_CURRENT')return status;
 if(status.outcome==='UNCONFIRMED'&&!body.expectedContext)throw Object.assign(Error('Studio could not confirm the installed session.'),{code:'CHILD_ENTRY_INSTALLATION_UNCONFIRMED'});
 throw original;
}

export async function checkStudioBookmark(session,bookmark,{fetcher=globalThis.fetch?.bind(globalThis),crypto=globalThis.crypto,
 storage=globalThis.sessionStorage,navigate=url=>globalThis.location.assign(url),onAccountChoice,recheckInstallation=true}={}){
 if(!session||!crypto?.subtle)throw missing();
 const auth=await session.bootstrap();
 if(auth.context&&auth.state==='UNLOCKED')await session.ensureFresh({activeWork:false});
 const expectedContext=session.getContext(),encoder=new TextEncoder();
 const verifier=encodeBookmarkProof(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=encodeBookmarkProof(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
 const entry=await bookmarkPost(fetcher,'/auth/v2/shared-entry/start',{destination:{bookmark},challenge,expectedContext});
 const body={tx:entry.tx,operationId:entry.operationId,expectedContext,verifier};
 const requestReturn=async mode=>{
  const state=encodeBookmarkProof(crypto.getRandomValues(new Uint8Array(32)));
  const stateHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(state))),v=>v.toString(16).padStart(2,'0')).join('');
  const registered=await bookmarkPost(fetcher,'/auth/v2/shared-entry/continue',{...body,stateHash,...(mode==='continue'?{}:{mode})},entry.csrf);
  if(registered.tx!==body.tx||registered.operationId!==body.operationId||!storage)throw missing();
  storage.setItem(bookmarkStorageKey,JSON.stringify({body,csrf:entry.csrf,state,bookmark,mode,until:Date.now()+900000}));
  const target=new URL('/auth/v2/shared-return',academyOrigin);
  target.searchParams.set('tx',body.tx);target.hash=state;
  navigate(target.href);
  return null;
 };
 let result;
 try{result=await finishBookmarkPost(fetcher,body,entry.csrf);}
 catch(error){
  if(error.code==='CHILD_ENTRY_INSTALLATION_UNCONFIRMED'&&recheckInstallation){
   return checkStudioBookmark(session,bookmark,{fetcher,crypto,storage,navigate,onAccountChoice,recheckInstallation:false});
  }
  if(error.code==='ACADEMY_SIGN_IN_REQUIRED')return requestReturn('continue');
  if(!expectedContext&&error.code==='SHARED_ENTRY_RECOVERY_REQUIRED')return requestReturn('renew');
  if(error.code!=='ACCOUNT_SELECTION_REQUIRED'||!onAccountChoice)throw error;
  const choice=await onAccountChoice();
  if(choice==='select')return requestReturn('select');
  if(choice!=='continue')throw Error('The bookmark is closed.');
  result=await finishBookmarkPost(fetcher,{...body,confirmAcademyAccount:true},entry.csrf);
 }
 if(result.state!=='UNLOCKED'||result.operationId!==entry.operationId||!result.returnTo?.startsWith('/studio/?website='))throw missing();
 const current=await session.bootstrap();
 if(current.state!=='UNLOCKED'||!session.checkCurrentContext(result.context))throw missing();
 return result.returnTo;
}

export async function resumeStudioBookmark(callback,{fetcher=globalThis.fetch?.bind(globalThis),storage=globalThis.sessionStorage,
 navigate=url=>globalThis.location.replace(url)}={}){
 let saved;
 try{saved=JSON.parse(storage?.getItem(bookmarkStorageKey)||'null');}catch{}
 if(!saved||saved.until<=Date.now()||saved.body?.tx!==callback.tx||saved.state!==callback.state
  ||typeof saved.bookmark!=='string'||!saved.bookmark.startsWith('/studio/?website='))throw missing();
 if(callback.expired||saved.mode==='select'){
  storage.removeItem(bookmarkStorageKey);
  navigate(saved.bookmark);return;
 }
 let result;
 try{result=await finishBookmarkPost(fetcher,{...saved.body,returnState:callback.state},saved.csrf);}
 catch(error){
  if(error.code!=='CHILD_ENTRY_INSTALLATION_UNCONFIRMED')throw error;
  storage.removeItem(bookmarkStorageKey);
  navigate(saved.bookmark);return;
 }
 if(result.state!=='UNLOCKED'||result.operationId!==saved.body.operationId||!result.returnTo?.startsWith('/studio/?website='))throw missing();
 storage.removeItem(bookmarkStorageKey);
 navigate(result.returnTo);
}

export async function createStudioEditorRecovery({session,websiteId,capture,baseRevision,isDirty=()=>true,onUnavailable=()=>{},drafts:providedDrafts,draftFactory,resultContext=()=>null}={}){
 if(!session||typeof capture!=='function'||typeof baseRevision!=='function'||typeof websiteId!=='string'||!/^[-A-Za-z0-9_:]{1,180}$/.test(websiteId))throw missing();
 const resource=Object.freeze({type:'studio-website',websiteId}),family=session.getState().context,familyFields=['app','sub','sid','psid','bsid','bv','ce','ae','le'],sameFamily=value=>Boolean(family&&value&&familyFields.every(key=>family[key]===value[key]));if(!family)throw missing();
 let drafts=providedDrafts||draftStores.get(session);
 if(!drafts){const factory=draftFactory||(await import('./v111/browser-drafts.mjs')).createBrowserDrafts;drafts=factory({crypto:globalThis.crypto,indexedDB:globalThis.indexedDB,sessionStorage:globalThis.sessionStorage,clock:()=>session.getServerNowMs(),releaseCapsule:args=>session.draftKey(args),onUnavailable:error=>{session.pagehide();onUnavailable(error);}});draftStores.set(session,drafts);}
 session.attachDrafts(drafts);let disposed=false;
 const current=()=>{const state=session.getState(),now=session.getServerNowMs();if(disposed||!sameFamily(state.context)||state.state!=='UNLOCKED'||!state.context||now>=Math.min(state.originalExpiresAtMs,state.idleUntilMs,state.validationDeadlineMs))throw Object.assign(Error('Unlock Studio before recovering this draft.'),{code:'DRAFT_CONTEXT_UNAVAILABLE'});return state.context;};
 const write=async(document,{dirty=true,revision=baseRevision()}={})=>{const expected=current();if(!Number.isSafeInteger(revision)||revision<0)throw Error('The website draft revision is unavailable.');const value=await drafts.save(resource,{format:'STUDIO_EDITOR_RECOVERY_V2',websiteId,baseRevision:revision,dirty,document});if(disposed||!sameFamily(session.getState().context)||!session.checkCurrentContext(expected))throw Object.assign(Error('The Studio session changed.'),{code:'DRAFT_CONTEXT_CHANGED'});return value;};
 const read=async()=>{await session.ensureFresh();const expected=current();await drafts.prepare(resource);const saved=await drafts.load(resource);if(disposed||!sameFamily(session.getState().context)||!session.checkCurrentContext(expected))throw Object.assign(Error('The Studio session changed.'),{code:'DRAFT_CONTEXT_CHANGED'});if(saved?.payload&&(saved.payload.format!=='STUDIO_EDITOR_RECOVERY_V2'||saved.payload.websiteId!==websiteId||!Number.isSafeInteger(saved.payload.baseRevision)||typeof saved.payload.dirty!=='boolean'))throw Error('The retained website draft has an invalid binding.');return {draft:saved?.payload||null,marker:saved?.marker||null};};
 const controller={
  resource,
  async prepare(){return (await read()).draft;},prepareState:read,
  checkpoint:write,
  async saved(document,revision){return write(document,{dirty:false,revision});},
  async beforeMutation(request,{method='POST'}={}){await session.prepareSensitive({activeWork:true});const expected=current();if(await drafts.recoveryMarker(resource))throw Object.assign(Error('Review the previous save before sending another change.'),{code:'SAVE_OUTCOME_UNKNOWN'});return drafts.checkpointMutation({resource,method,context:expected,payload:{format:'STUDIO_EDITOR_RECOVERY_V2',websiteId,baseRevision:baseRevision(),dirty:Boolean(isDirty()),document:capture(),request}});},
  async finishMutation(attempt,value){const expected=resultContext(value);if(!expected||!session.checkCurrentContext(expected))throw Object.assign(Error('The save response belongs to an earlier Studio view.'),{code:'STALE_MUTATION_RESPONSE'});return drafts.finishMutation(attempt,expected);},
  markUnknown:attempt=>drafts.markUnknown(attempt),
  async reviewCurrent(readServer){return drafts.reconcileUnknown(resource,async()=>{const value=await readServer();if(!resultContext(value))throw Object.assign(Error('The current server draft could not be checked.'),{code:'RECOVERY_READ_UNAVAILABLE'});return value;});},
  async discardRetained({confirmed=false,currentServerValue}={}){const expected=resultContext(currentServerValue);if(!confirmed||!expected||!session.checkCurrentContext(expected))throw Object.assign(Error('Review the current server draft first.'),{code:'MANUAL_RECOVERY_REQUIRED'});return drafts.discardResource(resource,{expectedContext:current()});},
  async checkpointBeforeJourney(){const state=session.getState(),now=session.getServerNowMs();if(state.state==='UNLOCKED'&&state.context&&now<Math.min(state.originalExpiresAtMs,state.idleUntilMs,state.validationDeadlineMs)){const snapshot=capture();if(snapshot)await write(snapshot,{dirty:Boolean(isDirty())});}await drafts.flush();},
  async flush(){await drafts.flush();},
  dispose(){disposed=true;editorControllers.get(session)?.delete(controller);}
 };

 if(!editorControllers.has(session))editorControllers.set(session,new Set());editorControllers.get(session).add(controller);return controller;
}

export function installStudioLifecycle(session,{win=globalThis.window,doc=globalThis.document}={}){
 if(lifecycleControllers.has(session))return lifecycleControllers.get(session);if(!win?.addEventListener||!doc?.addEventListener)return ()=>{};
 let restoring=null,suspended=false;const listeners=[];
 const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
 const hide=()=>{suspended=true;session.pagehide();},show=event=>{if(doc.visibilityState==='hidden'||!suspended&&!event?.persisted)return;suspended=false;if(!restoring)restoring=session.pageshow().catch(()=>{}).finally(()=>{restoring=null;});};
 listen(win,'pagehide',hide);listen(win,'pageshow',show);listen(doc,'visibilitychange',()=>doc.visibilityState==='hidden'?hide():show());if(doc.visibilityState==='hidden')hide();
 for(const [event,kind]of [['keydown','keyboard'],['pointerdown','pointer'],['touchstart','touch'],['wheel','scroll']])listen(doc,event,e=>{if(e.isTrusted&&doc.visibilityState!=='hidden'){session.recordActivity({kind});session.scheduleRenewal({activeWork:true});}},{capture:true,passive:true});
 const remove=()=>{listeners.forEach(fn=>fn());lifecycleControllers.delete(session);};lifecycleControllers.set(session,remove);return remove;
}
