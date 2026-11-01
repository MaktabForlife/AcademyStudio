import test from 'node:test';
import assert from 'node:assert/strict';
import {combinedSessionCards,joinIsOpen} from '../public/shared/lesson-media.mjs';
test('session/media cards match only stable IDs and show no year or ended-session time',()=>{
 const start=Date.UTC(2026,9,18,17),end=start+3600_000;
 const html=combinedSessionCards({sessions:[{session_id:'one',title:'Sunday lesson',starts_at:start,ends_at:end},{session_id:'two',title:'Sunday lesson',starts_at:start,ends_at:end}],media:[{attachment_id:'clip',lesson_id:'one',title:'Recording one',type:'video/mp4'},{attachment_id:'separate',lesson_id:'unbound',title:'Sunday lesson',type:'application/pdf'}],now:end+1});
 assert.equal((html.match(/class="sp-session(?:\s[^"]*)?"/g)||[]).length,3);assert.equal((html.match(/data-material="clip"/g)||[]).length,1);assert(!html.includes('2026'));assert(!html.includes('19:00'));assert(!html.includes('data-join'));
 assert(!html.includes('zoom.us'));
});
test('join visibility follows the stored time window including cancellation',()=>{
 const session={starts_at:1_000_000,ends_at:2_000_000};assert.equal(joinIsOpen(session,699999),false);assert.equal(joinIsOpen(session,700000),true);assert.equal(joinIsOpen(session,2000000),false);assert.equal(joinIsOpen({...session,cancelled:true},1000000),false);
});
