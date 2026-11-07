import {api,identity} from '../api.mjs';
import {dashboardWorkspace,readDashboardPreference,dashboardViewStorage} from './dashboard-home.mjs';

// Start the existing checked request while the public interface modules load.
// Keep only one unconsumed result in this document; no private DOM or new
// persistent copy is restored before the native session/rights check completes.
let pending=null;
const owner=()=>JSON.stringify([identity.account?.accountId||null,identity.generation]);
function queryFor(workspace){
 const query=new URLSearchParams(),preference=readDashboardPreference(dashboardViewStorage());
 if(dashboardWorkspace(workspace))query.set('mode',workspace);
 else if(preference){query.set('preferredAccount',preference.accountId);query.set('preferredMode',preference.mode);}
 return query.toString();
}
export function startDashboardBootstrap(workspace){
 const query=queryFor(workspace),account=owner();
 if(pending?.owner===account&&pending.query===query)return pending;
 const flight={owner:account,query,promise:api('/api/circles/bootstrap'+(query?'?'+query:''),{optionalSession:true}).then(value=>({value}),error=>({error}))};
 pending=flight;return flight;
}
export async function takeDashboardBootstrap(workspace){
 const flight=startDashboardBootstrap(workspace),result=await flight.promise;
 if(flight.owner!==owner()||pending!==flight)throw new DOMException('Your account or dashboard changed.','AbortError');
 pending=null;
 if(result.error)throw result.error;
 return result.value;
}
for(const name of ['website-account-changed','website-session-ended','website-display-invalidated','website-course-policy-changed'])
 window.addEventListener(name,()=>{pending=null;});
