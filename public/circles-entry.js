// Synchronous, public-data-only Home gate. It runs before the public homepage
// renderer. A requested dashboard shows no account or private cached content.
(()=>{
 const params=new URL(location.href).searchParams;
 const pending=!window.AcademyCirclesRedirecting&&params.get('public')!=='1'&&(params.get('dashboard')==='1'||['academy','dashboard'].includes(params.get('view'))||['#overview','#dashboard'].includes(location.hash)||['learn','teach','admin'].includes(params.get('workspace')));
 let phase=pending?'checking':'complete',panel,message,retry;
 function complete(){phase='complete';document.documentElement.removeAttribute('data-circles-home-state');panel?.remove();}
 function fail(){if(!pending)return;phase='error';document.documentElement.setAttribute('data-circles-home-state','error');if(message)message.textContent='Your dashboard could not be checked. Please try again.';if(retry)retry.hidden=false;}
 window.AcademyCirclesHomeEntry={pending,complete,fail};
 if(!pending)return;
 document.documentElement.setAttribute('data-circles-home-state','checking');
 const style=document.createElement('style');style.textContent='html[data-circles-home-state] #experience,html[data-circles-home-state] #studio{display:none!important}#circles-dashboard-entry{box-sizing:border-box;max-width:650px;margin:14vh auto;padding:36px 26px;color:#654c5d;text-align:center;font:14px/1.6 "DM Sans",Arial,sans-serif}#circles-dashboard-entry img{width:82px;height:82px;object-fit:contain;margin-bottom:24px}#circles-dashboard-entry h1{font:400 42px/1.15 "Libre Caslon Display",Georgia,serif;margin:8px 0 18px}#circles-dashboard-entry p{margin:8px 0}#circles-dashboard-entry button{margin-top:20px;padding:11px 22px;border:1px solid #bda9b3;border-radius:24px;background:#654c5d;color:#fff9f3;font:inherit;cursor:pointer}html[data-circles-home-state] body{background:#faf7f2}';document.head.append(style);
 function mount(){
  if(phase==='complete')return;
  panel=document.createElement('section');panel.id='circles-dashboard-entry';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
  const logo=document.createElement('img');logo.src='/academy-logo.png';logo.alt='Umm Abbad Academy';logo.setAttribute('style','display:block;margin:0 auto 24px');
  const heading=document.createElement('h1');heading.textContent='Returning to your day.';
  message=document.createElement('p');message.textContent='Checking your account and dashboard…';
  retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.hidden=true;retry.onclick=()=>location.reload();
  panel.append(logo,heading,message,retry);document.body.append(panel);if(phase==='error')fail();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
