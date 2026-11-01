import test from 'node:test';import assert from 'node:assert/strict';
import {teachingScheduleRows,selectedCircleDay,joinableConstituent} from '../public/shared/circle-days.mjs';
import {learningCircleHTML,mayOfferJoin} from '../public/shared/learning-circle.mjs';
const now=Date.parse('2026-11-01T08:00:00Z'),row=(id,start=now,extra={})=>({kind:'PROGRAM',activityId:'native',activityName:'Native programme',title:id,startsAt:start,endsAt:start+1800000,status:'SCHEDULED',meetingGroup:'opaque-native-meeting',nativeJoin:{joinKey:id,date:'2026-11-01'},...extra});
test('Teach combines only contiguous checked meeting identities and preserves every original Join child',()=>{
 const rows=[row('one'),row('two',now+1800000),row('gap',now+5400000),row('different',now+7200000,{meetingGroup:'other'}),row('unknown',now+9000000,{meetingGroup:null}),row('other-programme',now+1800000,{activityId:'other'})],before=JSON.stringify(rows),groups=teachingScheduleRows(rows,{timezone:'UTC'});
 assert.equal(groups.length,5);const combined=groups[0];assert.equal(combined.endsAt,now+3600000);assert.deepEqual(combined.constituents.map(r=>r.nativeJoin.joinKey),['one','two']);assert.equal(joinableConstituent(combined,now+1800001).nativeJoin.joinKey,'two');assert(!mayOfferJoin(combined,now+3600000));assert.equal(JSON.stringify(rows),before);
});
test('selected days change circle content without moving the actual Join clock',()=>{
 const future=row('future',now+86400000),data={timezone:'UTC',startDate:'2026-11-01',endDate:'2026-11-07'};
 assert.equal(selectedCircleDay(data,'2026-11-02',now).date,'2026-11-02');const html=learningCircleHTML([row('today'),future],{now,timezone:'UTC',date:'2026-11-02'});assert.match(html,/future/);assert.doesNotMatch(html,/data-circle-join=/);assert.match(html,/Learning circle for 2026-11-02/);
});
