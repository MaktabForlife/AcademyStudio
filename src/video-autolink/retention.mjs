import {recordingRetention} from '../../public/shared/learner-companion.mjs';
// Typed adapter to the EXISTING native retention policy. The owning server must
// persist/fence original ingestion and trusted destination policy. This is not
// installed storage, read, cleanup or immutable-floor enforcement.
function original(value){if(!Number.isSafeInteger(value)||value<0||!Number.isFinite(new Date(value).getTime()))throw new TypeError('Use the persisted original ingestion time.');return value;}
export function calendarMonthAfter(originalIngestedAt){
 original(originalIngestedAt);const native=recordingRetention(new Date(originalIngestedAt).toISOString(),{now:originalIngestedAt}),end=Date.parse(native.companionExpiresAt);
 if(!Number.isFinite(end)||end<=originalIngestedAt)throw new TypeError('Review the original ingestion time.');
 return end;
}
export function processingRetention({policy,originalIngestedAt}={}){
 original(originalIngestedAt);
 if(!['PERMANENT_STUDIO_YOUTUBE','TEMPORARY_ACADEMIC'].includes(policy))throw new TypeError('Use the reviewed native destination retention policy.');
 const native=recordingRetention(new Date(originalIngestedAt).toISOString(),{permanent:policy==='PERMANENT_STUDIO_YOUTUBE',now:originalIngestedAt});
 return {originalIngestedAt,videoExpiresAt:native.recordingExpiresAt===null?null:Date.parse(native.recordingExpiresAt),companionExpiresAt:native.companionExpiresAt===null?null:Date.parse(native.companionExpiresAt)};
}
export function processingObjectReadable(deadline,now){
 if(!Number.isSafeInteger(now)||now<0)throw new TypeError('Use the server clock.');
 if(deadline===null)return true;
 if(!Number.isSafeInteger(deadline)||deadline<0)throw new TypeError('Use the persisted expiry deadline.');
 return now<deadline;
}
