import {mouSubjects} from '../public/shared/mou-subjects.mjs';
import {comingSoonLabel} from '../public/shared/course-notices.mjs';
export const fixtureTime=Date.UTC(2026,9,31,9);
export function mouFixture({connected=false,now=fixtureTime,accountId='synthetic-member',epoch=1}={}){
 const offeringId=connected?'synthetic:mothers':null;
 return {schema:'MOU_CLASSROOM_V1',title:'Mothers of the Ummah',context:{accountId,epoch},programme:{key:'mothers',kind:'PROGRAMME',accessModel:'MONTHLY',offeringId,authority:connected?'STUDIO':null,state:connected?'ACTIVE':'PENDING_CONNECTION'},management:{canManage:false,requiresAuthorityRefresh:false,authority:'ACADEMY_PROXY',offeringId},monthly:{state:connected?'CONNECTED':'NOT_CONNECTED',month:connected?'2026-10':null,hasCurrentMonth:false,hasRetainedMonths:false},materialsConnected:false,subjects:mouSubjects.map(s=>({key:s.key,title:s.title,state:s.first?'PREPARING':'COMING_SOON',availabilityLabel:s.first?null:comingSoonLabel,website:null})),timetable:{state:connected?'NO_UPCOMING_SESSIONS':'NOT_CONNECTED',serverTime:now,sessions:[]}};
}
export function fixtureWebsite(value,{canOpen=true,canEdit=false}={}){
 value.materialsConnected=canOpen;value.subjects[0].state=canOpen?'PUBLISHED':'PREPARING';
 value.subjects[0].website={id:'synthetic-baqarah',title:'Baqarah',completionMonth:'2026-10',canOpen,canEdit,...(canOpen?{href:'/studio/?website=synthetic-baqarah'}:{}),...(canEdit?{editorHref:'/builder/?website=synthetic-baqarah'}:{})};return value;
}
export function fixtureSession(value,{startsAt=value.timetable.serverTime+120_000,endsAt=startsAt+3_600_000,eligibleToJoin=true,eligibilityExpiresAt=endsAt}={}){
 const now=value.timetable.serverTime;value.timetable.state='PUBLISHED';
 value.timetable.sessions=[{id:'synthetic-class',title:'Published MOU class',startsAt,endsAt,joinOpensAt:startsAt-300_000,eligibleToJoin,eligibilityExpiresAt,canJoin:eligibleToJoin&&now>=startsAt-300_000&&now<endsAt&&now<eligibilityExpiresAt,timezone:'Africa/Johannesburg',classIds:['synthetic-classroom'],classes:[{id:'synthetic-classroom',label:'MOU classroom'}],teacherLabels:['Synthetic teacher'],joinPath:'/api/offerings/'+encodeURIComponent(value.programme.offeringId)+'/join'}];return value;
}
