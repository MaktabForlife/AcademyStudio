const programmeSQL={
 tafseer:"o.kind='TAFSEER' AND NOT EXISTS(SELECT 1 FROM programme_offerings programme WHERE programme.offering_id=o.offering_id AND programme.programme_key='mothers')",
 courses:"o.kind='COURSE'",
 mothers:"o.kind='TAFSEER' AND EXISTS(SELECT 1 FROM programme_offerings programme WHERE programme.offering_id=o.offering_id AND programme.programme_key='mothers')"
};
const destinations={
 '/studio/?view=collections&collection=tafseer':'tafseer',
 '/studio/?view=collections&collection=courses':'courses',
 '/studio/?classroom=mothers':'mothers'
};

export function programmeRestriction(programme){
 if(!Object.hasOwn(programmeSQL,programme))throw new Error('Unknown Studio programme');
 return programmeSQL[programme];
}
export const programmeForReturn=path=>Object.hasOwn(destinations,path)?destinations[path]:null;

export async function programmeForProtectedRead(url,db){
 const path=url.pathname;
 if(path==='/api/circles/classrooms/mothers'||path==='/api/circles/reader-bootstrap'&&url.searchParams.get('classroom')==='mothers')return {programme:'mothers'};
 if(path==='/api/websites'){
  const collection=url.searchParams.getAll('collection');
  return collection.length===1&&['tafseer','courses'].includes(collection[0])?{programme:collection[0]}:null;
 }
 const website=path.match(/^\/api\/websites\/([-A-Za-z0-9_:]+)(?:\/(?:edit|export|history|assets))?$/)?.[1]
  ||(path==='/api/circles/reader-bootstrap'?url.searchParams.get('website'):null);
 const attachment=path.match(/^\/api\/media\/([-A-Za-z0-9_:]+)(?:\/companion)?$/)?.[1];
 const offering=path.match(/^\/api\/offerings\/([-A-Za-z0-9_:]+)\//)?.[1];
 if(!website&&!attachment&&!offering)return null;
 const where=website?'o.offering_id=(SELECT offering_id FROM websites WHERE website_id=?)'
  :attachment?'o.offering_id=(SELECT offering_id FROM attachments WHERE attachment_id=?)':'o.offering_id=?';
 const row=await db.withSession('first-primary').prepare(`SELECT CASE
  WHEN ${programmeRestriction('mothers')} THEN 'mothers'
  WHEN o.kind='TAFSEER' THEN 'tafseer'
  WHEN o.kind='COURSE' THEN 'courses' END programme,o.offering_id
  FROM offerings o WHERE ${where}`).bind(website||attachment||offering).first();
 return row?.programme?{programme:row.programme,offeringId:attachment?row.offering_id:null}:null;
}
