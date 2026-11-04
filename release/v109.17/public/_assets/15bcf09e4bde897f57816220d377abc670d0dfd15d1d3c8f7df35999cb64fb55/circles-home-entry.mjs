import {canonicalCirclesDestination} from './shared/canonical-circles.mjs';
import {startDashboardBootstrap} from './shared/dashboard-bootstrap.mjs';
const destination=canonicalCirclesDestination(location.href);
window.AcademyCirclesRedirecting=Boolean(destination);
if(destination)location.replace(destination);
else {
 const params=new URLSearchParams(location.search);
 window.AcademyCirclesEntry={login:params.get('login')==='1',area:params.get('area'),workspace:params.get('workspace'),public:params.get('public')==='1'};
 try {
  if(window.AcademyCirclesHomeEntry?.pending)startDashboardBootstrap(window.AcademyCirclesEntry.workspace);
  await import('./circles/app.js');
  await import('./circles/homepage-layout.js');
  await import('./circles-login.mjs');
 }catch {
  // No private cached markup is mounted on a failed account bootstrap.
  window.AcademyCirclesHomeEntry?.fail();
  const host=document.querySelector('#experience');
  if(host&&!host.childElementCount){const text=document.createElement('p'),retry=document.createElement('button');text.textContent='Circles could not be opened. Please try again.';retry.type='button';retry.textContent='Try again';retry.onclick=()=>location.reload();host.append(text,retry);}
 }
}
