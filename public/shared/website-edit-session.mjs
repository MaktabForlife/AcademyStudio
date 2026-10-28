import {setPath} from './model.mjs';
import {validatePackage as validateCourse} from './content-schema.mjs';

// Both editing modes use this same account/website-bound lifecycle. Rendering
// and field changes are local; only explicit Save and Publish perform requests.
export function createWebsiteEditSession({websiteId,owner,request}) {
  let record=null,document=null,baseline='',account=owner(),epoch=0,busy=false,pending=null,conflict=false;
  function clear(){epoch++;record=null;document=null;baseline='';pending=null;busy=false;conflict=false;account=null;}
  const active=()=>account&&owner()===account;
  const assert=()=>{if(!active()){clear();throw new DOMException('Your Academy account changed.','AbortError');}};
  const validate=value=>{const errors=validateCourse(value);if(errors.length)throw Error(errors.join(' '));};
  const check=(stamp,actor)=>{if(stamp!==epoch||actor!==owner()||!active())throw new DOMException('The selected website or account changed.','AbortError');};
  function current(){assert();if(!record)throw Error('Open a website draft first.');}
  async function mutate(action,extra={}) {
    current();if(busy)throw Error('Wait for the current save to finish.');
    if(conflict)throw Error('This draft changed elsewhere. Export your unsaved work before reopening the current draft.');
    if(['publish','restore'].includes(action)&&JSON.stringify(document)!==baseline)throw Error('Save your changes before publishing.');
    if(pending&&(pending.action!==action||action==='restore'&&extra.historyRevision!==undefined&&pending.historyRevision!==extra.historyRevision))throw Error('Retry the unfinished action before another action.');
    if(!pending) {
      const issues=validateCourse(document,{review:action==='publish'});if(issues.length)throw Error(issues.join(' '));
      pending={action,...extra,revision:record.revision,operationId:crypto.randomUUID(),...(action==='save'?{document:structuredClone(document)}:{})};
    }
    const stamp=epoch,actor=account,operation=pending;busy=true;
    try {
      const result=await request('mutate',{websiteId,...structuredClone(operation)});check(stamp,actor);
      if(result.websiteId&&result.websiteId!==websiteId)throw Error('The server returned another website.');
      record.revision=result.revision;
      if(action==='save'){record.document=structuredClone(operation.document);baseline=JSON.stringify(operation.document);}
      if(action==='publish'){record.enabled=true;record.publishedVersion=result.publishedVersion||result.revision;}
      if(action==='withdraw')record.enabled=false;
      pending=null;return result;
    } catch(error) {
      if(stamp===epoch&&active()&&error.status&&error.status<500){pending=null;conflict=error.status===409;}
      throw error;
    } finally {if(stamp===epoch)busy=false;}
  }
  return {
    get record(){if(!active())clear();return record?{...record,document}:null;},
    get busy(){return busy;},get dirty(){return Boolean(document&&JSON.stringify(document)!==baseline);},
    get pending(){return Boolean(pending);},get pendingAction(){return pending?.action||null;},get conflict(){return conflict;},
    get state(){return {websiteId,title:document?.name||'',edition:'Private draft',revision:record?.revision,publishedVersion:record?.publishedVersion,unsaved:this.dirty,pending:this.pending,pendingAction:this.pendingAction,conflict};},
    async open({discardUnsaved=false}={}) {
      assert();if(busy)throw Error('Wait for the current action to finish.');
      if((this.dirty||pending)&&!discardUnsaved)throw Error('Export or keep your unsaved work before reopening.');
      const stamp=++epoch,actor=account;busy=true;
      try{const next=await request('open',{websiteId});check(stamp,actor);if(next.websiteId!==websiteId)throw Error('The server returned another website.');validate(next.document);record=structuredClone(next);document=structuredClone(next.document);baseline=JSON.stringify(document);pending=null;conflict=false;return this.record;}
      finally{if(stamp===epoch)busy=false;}
    },
    replace(value){current();if(busy||pending)throw Error('Finish or retry the current action first.');validate(value);document=structuredClone(value);},
    change(path,value){current();if(busy||pending)throw Error('Finish or retry the current action first.');setPath(document,path,value);document.updatedAt=new Date().toISOString();},
    preview(){current();return structuredClone(document);},
    export(){current();return {format:'WEBSITE_UNSAVED_WORK_V1',websiteId,baseRevision:record.revision,document:structuredClone(document)};},
    save(){current();if(!pending&&!this.dirty&&record.revision>0)return Promise.resolve({websiteId,revision:record.revision,unchanged:true});return mutate('save');},publish(){return mutate('publish');},withdraw(){return mutate('withdraw');},
    async restore(historyRevision){if(!Number.isSafeInteger(historyRevision)||historyRevision<0)throw Error('Choose a previous edition.');await mutate('restore',{historyRevision});return this.open({discardUnsaved:true});},
    retry(){if(!pending)throw Error('There is no unfinished action.');return mutate(pending.action);},
    clear
  };
}
