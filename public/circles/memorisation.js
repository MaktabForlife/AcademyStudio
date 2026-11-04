(function(root){
 'use strict';
 function shuffled(items, random){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
 function selectSets(sets=root.AcademyMemorisationSets||[], count=3, random=Math.random){
  const eligible=[...new Map(sets.filter(set=>set.active!==false&&['SURAHS','DUAS'].includes(set.subject)&&set.tasks?.length).map(set=>[set.id,set])).values()];
  const pool=shuffled(eligible,random),selected=[],limit=Math.max(0,Math.min(Math.floor(count),pool.length));
  for(const subject of ['SURAHS','DUAS']){const index=pool.findIndex(set=>set.subject===subject);if(index>=0&&selected.length<limit)selected.push(...pool.splice(index,1));}
  selected.push(...pool.slice(0,limit-selected.length));return shuffled(selected,random);
 }
 const api={selectSets};if(typeof module==='object'&&module.exports)module.exports=api;else root.AcademyMemorisation=api;
})(globalThis);
