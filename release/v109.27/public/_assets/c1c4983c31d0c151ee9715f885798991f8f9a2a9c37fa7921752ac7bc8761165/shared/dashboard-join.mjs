const modes=new Set(['learn','teach','admin']);
const stableId=value=>typeof value==='string'&&/^[-A-Za-z0-9_:]{1,160}$/.test(value);
const owner=value=>JSON.stringify([value.account?.accountId,value.account?.globalAdmin,value.account?.verifiedAt,value.account?.epoch,value.generation,value.mode]);
const lesson=value=>JSON.stringify([value.kind,value.activityId,value.date,value.status,value.startsAt,value.endsAt,value.nativeJoin,value.studioJoin]);
const openAt=(row,now)=>row.status==='SCHEDULED'&&Number.isFinite(row.startsAt)&&Number.isFinite(row.endsAt)&&row.endsAt>row.startsAt&&now>=row.startsAt-300000&&now<row.endsAt;

function destination(row,mode){
 if(Boolean(row.nativeJoin)===Boolean(row.studioJoin))return null;
 if(row.nativeJoin){
  const reference=row.nativeJoin;
  if(typeof reference.joinKey!=='string'||!reference.joinKey||reference.joinKey.length>1200||!/^\d{4}-\d{2}-\d{2}$/.test(reference.date)||reference.date!==row.date)return null;
  return {path:'/api/circles/lesson-join',body:{mode,joinKey:reference.joinKey,date:reference.date},field:'joinUrl'};
 }
 const reference=row.studioJoin;
 if(!stableId(reference.offeringId)||!stableId(reference.sessionId))return null;
 return {path:'/api/offerings/'+encodeURIComponent(reference.offeringId)+'/join',body:{sessionId:reference.sessionId},field:'destination'};
}

// One explicit click opens one placeholder synchronously. Only the current
// checked resolver may replace it, after account, selected view and row checks.
export function createDashboardJoin({context,request,openWindow=()=>window.open('about:blank','_blank'),now=()=>Date.now(),onMessage=()=>{},onPending=()=>{}}){
 let flight=null,revision=0;
 function valid(captured,row,signature,stamp){
  const current=context();
  return stamp===revision&&current.visible!==false&&!current.pending&&current.account&&owner(current)===owner(captured)&&current.data===captured.data&&current.data?.mode===current.mode&&current.data.timetable?.includes(row)&&lesson(row)===signature&&openAt(row,now());
 }
 function clear(){revision++;if(flight){try{flight.popup?.close();}catch{}flight=null;onPending(false);}}
 function join(row){
  if(flight)return flight.promise;
  const current=context(),captured={...current,account:current.account?{...current.account}:null},stamp=revision,signature=lesson(row||{});
  if(!captured.account||!modes.has(captured.mode)||captured.data?.mode!==captured.mode||captured.visible===false||captured.pending||!captured.data?.timetable?.includes(row)||!openAt(row,now()))return Promise.resolve(false);
  const target=destination(row,captured.mode);if(!target)return Promise.resolve(false);
  let popup;try{popup=openWindow();if(popup)popup.opener=null;}catch{try{popup?.close();}catch{}popup=null;}
  if(!popup){onMessage('Allow the class window to open, then select Join class again.');return Promise.resolve(false);}
  const operation={popup,promise:null};flight=operation;onMessage('Checking your current class access…');onPending(true,row);
  operation.promise=(async()=>{
   try{
    const result=await request(target.path,{body:target.body});
    if(!valid(captured,row,signature,stamp)||popup.closed){try{popup.close();}catch{}return false;}
    const url=new URL(result?.[target.field]);
    if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Invalid class destination.');
    popup.location.replace(url.href);onMessage('Your class opened in a separate window.');return true;
   }catch(error){
    try{popup.close();}catch{}
    if(valid(captured,row,signature,stamp))onMessage('Class access has changed or is unavailable. Refresh your dashboard before trying again.');
    return false;
   }finally{if(flight===operation){flight=null;onPending(false);}}
  })();
  return operation.promise;
 }
 return {join,clear,get pending(){return Boolean(flight);}};
}
