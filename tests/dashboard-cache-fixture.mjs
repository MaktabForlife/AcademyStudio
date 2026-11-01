import assert from 'node:assert/strict';import {sha256} from '../src/protocol.mjs';
export async function dashboardFixtureKey(f,accountId,mode,weekToken){
 if(weekToken){const [context,view,week]=weekToken.split(':');assert.equal(view,mode);const key='private/dashboard/'+await sha256(accountId)+'/'+context+'/'+mode+'/'+week+'.json';assert(await f.content.get(key));return key;}
 const list=await f.content.list({prefix:'private/dashboard/'+await sha256(accountId)+'/'}),rows=list.objects.filter(r=>new RegExp('/'+mode+'/\\d{4}-\\d{2}-\\d{2}\\.json$').test(r.key));assert.equal(rows.length,1,'Choose the single checked fixture week snapshot');return rows[0].key;
}
