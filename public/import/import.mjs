import {api,identity} from '/api.mjs';
import {reviewImport,importReviewedWebsite} from '/shared/reviewed-website-import.mjs';
const file=document.getElementById('package'),review=document.getElementById('review'),button=document.getElementById('publish'),status=document.getElementById('status');let prepared=null,busy=false;
const clear=()=>{prepared=null;file.value='';button.disabled=true;review.textContent='Your account changed. Choose the reviewed package again.';};
window.addEventListener('website-account-changed',clear);window.addEventListener('website-session-ended',clear);
try{identity.account=await api('/api/me');}catch(error){status.textContent=error.message;}
file.addEventListener('change',async()=>{prepared=null;button.disabled=true;const selected=file.files?.[0],generation=identity.generation,account=identity.account?.accountId;if(!selected||!account)return;
 try{if(selected.size>64*1024*1024)throw Error('Choose a website package smaller than 64 MB.');const plan=JSON.parse(await selected.text()),summary=await reviewImport(plan);if(generation!==identity.generation||account!==identity.account?.accountId)return;prepared={plan,generation,account};review.textContent=summary.title+' · '+summary.recordings+' recordings · '+summary.readings+' supporting readings · '+summary.files+' files';button.disabled=false;}catch(error){review.textContent=error.message;}
});
button.addEventListener('click',async()=>{if(busy||!prepared)return;const selection=prepared,current=()=>{if(selection.generation!==identity.generation||selection.account!==identity.account?.accountId)throw new DOMException('Your account changed.','AbortError');};busy=true;button.disabled=true;file.disabled=true;
 try{await importReviewedWebsite(selection.plan,{api,current,report:text=>status.textContent=text});}catch(error){status.textContent=error.message+' Keep the same prepared package when retrying.';}finally{busy=false;file.disabled=false;button.disabled=!prepared;}
});
