import {createWebsiteEditSession} from './shared/website-edit-session.mjs';
import {createInlineEditor} from './shared/inline-editor.mjs';

export function readerEditing({root,identity,api,current,route,showDraft,showPublished,refresh}) {
 let session=null,boundId=null,boundAccount=null;
 const dialog=document.createElement('dialog'),title=document.createElement('h2'),body=document.createElement('div');
 title.textContent='Review website text';dialog.append(title,body);document.body.append(dialog);
 const proxy={get record(){return session?.record;},get dirty(){return session?.dirty;},get busy(){return session?.busy;},get pending(){return session?.pending;},get pendingAction(){return session?.pendingAction;},retry:()=>session.retry(),
  open:()=>session.open(),change:(...args)=>session.change(...args),save:()=>session.save(),publish:()=>session.publish(),export:()=>session.export(),clear:()=>session?.clear()};
 const view=createInlineEditor({root,session:proxy,workspace:()=> 'ADMIN',enterAdmin:()=>{},
  active:()=>Boolean(identity.account&&current()&&(!boundAccount||boundAccount===identity.account.accountId)&&(!boundId||boundId===current().websiteId)),
  allowed:()=>Boolean(current()?.canEdit),permissionLost:()=>{if(current())current().canEdit=false;view.draw();},
  async launchEditor(){boundId=current().websiteId;boundAccount=identity.account.accountId;session=createWebsiteEditSession({websiteId:boundId,owner:()=>identity.account?.accountId,request:(action,input)=>action==='open'?api('/api/websites/'+boundId+'/edit'):api('/api/websites/'+boundId+'/edit',{body:input})});return false;},
  showDraft:record=>showDraft(record),showPublished,published:refresh,route,dialog,dialogTitle:title,dialogBody:body});
 return {get editing(){return view.editing;},draw:()=>view.draw(),canLeave:()=>view.canLeave(),clear(){view.clear();dialog.close();session=null;boundId=null;boundAccount=null;}};
}
