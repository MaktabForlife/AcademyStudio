import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedSQLIdentifierFinding} from '../tools/reviewed-sql-integrity.mjs';
const File='src/video-autolink/review.mjs',RuleID='generic-api-key';
const sql=readFileSync(new URL('../'+File,import.meta.url),'utf8').split('\n').find(s=>s.includes("store.statement('INSERT INTO recording_companions VALUES"));
test('the actual reviewed SQL assignment is classified without suppressing any scanner rule',()=>{
 assert(sql);assert.match(sql,/draft_key=excluded\.draft_key,duration_seconds=excluded\.duration_seconds/);
 assert.equal(reviewedSQLIdentifierFinding({File,RuleID},sql),true);
});
test('a finding with changed SQL, appended key material, another file or rule remains blocked',()=>{
 for(const [finding,line]of [
  [{File,RuleID},sql.replace('excluded.draft_key','excluded.other_key')],
  [{File,RuleID},sql+' // api_key=unreviewed-synthetic-value'],
  [{File:'public/another.mjs',RuleID},sql],
  [{File,RuleID:'private-key'},sql],
  [{File,RuleID},'api_key=unreviewed-synthetic-value'],
  [{File,RuleID},null]
 ])assert.equal(reviewedSQLIdentifierFinding(finding,line),false);
});
