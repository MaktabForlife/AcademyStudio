// The initial HTML keeps every old view hidden, even before modules arrive.
// Reveal the requested view only after its data and access checks settle.
export const readerHasLiveSessions=record=>Boolean(record&&record.kind!=='TAFSEER'&&record.capabilities?.liveSessions!==false&&record.document?.pages?.sessions);
export async function startReaderView({main,status,load}){
 main.hidden=true;main.setAttribute('aria-busy','true');
 try{await load();if(status.textContent==='Loading your learning…')status.textContent='';}
 catch(error){status.textContent=error.message||'Your learning could not be loaded. Please try again.';}
 finally{main.hidden=false;main.removeAttribute('aria-busy');}
}
