// Narrow classification of one reviewed SQL identifier false positive.
// No credential value, directory/rule exclusion, or scanner-range change.
import {createHash} from 'node:crypto';
export function reviewedSQLIdentifierFinding(f,content){
 return f?.File==='src/video-autolink/review.mjs'&&f?.RuleID==='generic-api-key'&&typeof content==='string'&&
  createHash('sha256').update(content.trim()).digest('hex')==='adb675739ae20d9baef072ca780a887a90a89e6a0ebfa3508dcbb9a48ee36464';
}
