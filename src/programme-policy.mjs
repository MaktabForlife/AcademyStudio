// Definitions are signed Source facts, cached only inside one request's Store.
export async function mouDefinition(store){
 if(store.mouDefinition!==undefined)return store.mouDefinition;
 return store.mouDefinition=await store.first("SELECT p.offering_id,p.access_model,s.authority,s.enabled,s.live_enabled,s.timezone,h.phase FROM programme_offerings p JOIN source_access_scopes s USING(offering_id) LEFT JOIN access_handovers h USING(offering_id) WHERE p.programme_key='mothers'");
}
export async function studioMouVisible(store,actor,definition){
 if(!definition?.enabled||definition.authority!=='WEBSITE'||definition.phase!=='COMMITTED')return false;
 if(actor.global_admin)return true;
 return Boolean(await store.first(`SELECT 1 WHERE EXISTS(SELECT 1 FROM participation WHERE account_id=? AND offering_id=? AND enrolled=1)
 OR EXISTS(SELECT 1 FROM staff WHERE account_id=? AND offering_id=?)
 OR EXISTS(SELECT 1 FROM paid_months WHERE account_id=? AND offering_id=?)
 OR EXISTS(SELECT 1 FROM website_months WHERE account_id=? AND offering_id=?)
 OR EXISTS(SELECT 1 FROM surah_grants g JOIN websites w USING(website_id) WHERE g.account_id=? AND w.offering_id=?)`,Array.from({length:5},()=>[actor.account_id,definition.offering_id]).flat()));
}
