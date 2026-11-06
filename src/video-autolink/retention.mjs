// Deadline calculation only. The owning server must persist and fence the
// original ingestion time and trusted destination policy; caller fields are
// not authority. This helper is not installed lifecycle/storage enforcement.
const DAY=86400000;
function original(value){if(!Number.isSafeInteger(value)||value<0||!Number.isFinite(new Date(value).getTime()))throw new TypeError('Use the persisted original ingestion time.');return value;}
export function calendarMonthAfter(originalIngestedAt){
 const source=new Date(original(originalIngestedAt)),year=source.getUTCFullYear(),month=source.getUTCMonth(),lastDay=new Date(Date.UTC(year,month+2,0)).getUTCDate();
 const end=Date.UTC(year,month+1,Math.min(source.getUTCDate(),lastDay),source.getUTCHours(),source.getUTCMinutes(),source.getUTCSeconds(),source.getUTCMilliseconds());
 if(!Number.isFinite(end)||end<=originalIngestedAt)throw new TypeError('Review the original ingestion time.');
 return end;
}
export function processingRetention({policy,originalIngestedAt}={}){
 original(originalIngestedAt);
 if(policy==='PERMANENT_STUDIO_YOUTUBE')return {originalIngestedAt,videoExpiresAt:null,companionExpiresAt:null};
 if(policy!=='TEMPORARY_ACADEMIC')throw new TypeError('Use the reviewed native destination retention policy.');
 return {originalIngestedAt,videoExpiresAt:originalIngestedAt+14*DAY,companionExpiresAt:calendarMonthAfter(originalIngestedAt)};
}
export function processingObjectReadable(deadline,now){
 if(!Number.isSafeInteger(now)||now<0)throw new TypeError('Use the server clock.');
 if(deadline===null)return true;
 if(!Number.isSafeInteger(deadline)||deadline<0)throw new TypeError('Use the persisted expiry deadline.');
 return now<deadline;
}
