import {api,changed} from '/api.mjs';
const form=document.getElementById('preview-access-form'),input=document.getElementById('preview-access-code'),status=document.getElementById('preview-access-status');
const fragment=new URLSearchParams(location.hash.slice(1)),code=fragment.get('access'),destination='/preview/websites/';
// Fragments never reach the server. Remove the invitation from browser history
// immediately; do not keep it in browser/device storage or outgoing URLs.
history.replaceState(null,'','/preview/');
if(code){input.value=code;status.textContent='Your private test access is ready. Select Open preview.';}
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Opening your test account…';
 try{await api('/auth/preview/login',{body:{accessCode:input.value.trim()}});const me=await api('/api/me');changed(me);input.value='';location.replace(destination);}
 catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
