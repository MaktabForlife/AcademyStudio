import assert from 'node:assert/strict';import test from 'node:test';
import {readRemembered,rememberVerified,forgetRemembered,rememberedKey} from '../public/shared/remembered-accounts.mjs';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
test('remembered Academy IDs contain only bounded hints after verified login, never credentials or roles',()=>{
 const s=storage(),base='https://academy.test';for(let i=0;i<12;i++)rememberVerified(s,base,{uniqueid:'USER-'+i,displayName:'Member '+i,pin:'1234',token:'secret',roles:['GLOBAL_ADMIN']},i);
 const rows=readRemembered(s,base);assert.equal(rows.length,10);assert.deepEqual(Object.keys(rows[0]),['id','name','lastUsed']);assert.doesNotMatch(s.getItem(rememberedKey(base)),/1234|secret|GLOBAL_ADMIN/);assert.deepEqual(readRemembered(s,'https://other.test'),[]);
 rememberVerified(s,base,{uniqueid:'user-11',displayName:'Renamed'},20);assert.equal(readRemembered(s,base).length,10);assert.equal(readRemembered(s,base)[0].name,'Renamed');forgetRemembered(s,base,'USER-11');assert.equal(readRemembered(s,base).length,9);forgetRemembered(s,base);assert.deepEqual(readRemembered(s,base),[]);
});
test('corrupt or blocked browser storage cannot establish an account',()=>{
 const s=storage(),base='https://academy.test';for(const value of ['bad JSON','{}','x'.repeat(65537),'[null,{"id":"bad id","lastUsed":3}]']){s.setItem(rememberedKey(base),value);assert.deepEqual(readRemembered(s,base),[]);}assert.equal(rememberVerified(s,base,{uniqueid:'<script>'}),false);assert.deepEqual(readRemembered(null,base),[]);assert.equal(rememberVerified(null,base,{uniqueid:'USER'}),false);
});
