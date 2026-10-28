export const fail=(message,status=400,code='INVALID_REQUEST')=>Object.assign(new Error(message),{status,code});
export const id=value=>{if(typeof value!=='string'||!/^[-A-Za-z0-9_:]{1,180}$/.test(value))throw fail('Invalid stable identifier.');return value;};
export const text=(value,max=240)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('Invalid text.');return value;};
export const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw fail('Invalid number.');return value;};
export const flag=value=>{if(typeof value!=='boolean')throw fail('Use a true or false value.');return Number(value);};
export const month=value=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value||''))throw fail('Choose a calendar month.');return value;};
export const date=value=>{const parsed=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw fail('Choose a valid lesson date.');return value;};
export const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
export const failure=error=>json({success:false,error:error.status?error.message:'The website is temporarily unavailable.',code:error.code||'UNAVAILABLE'},error.status||503);
export async function bytes(stream,limit){
 const reader=stream?.getReader();if(!reader)return new Uint8Array();let length=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw fail('This request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function bodyJSON(stream,limit=1_500_000){try{const result=JSON.parse(new TextDecoder().decode(await bytes(stream,limit)));if(!result||Array.isArray(result)||typeof result!=='object')throw Error();return result;}catch(error){if(error.status)throw error;throw fail('Invalid request data.');}}
export const sha256=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export const challenge=async verifier=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export const safeToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export const parseCookie=request=>{const value=request.headers.get('Cookie')||'';const hits=value.split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-maktab_web='));if(hits.length!==1)return '';const token=hits[0].slice(18);return safeToken(token)?token:'';};
export const cookie=(token,age=86400)=>`__Host-maktab_web=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
export function originCheck(request,env){if(request.headers.get('Origin')!==env.WEBSITE_ORIGIN)throw fail('Reopen this action from the website.',403,'ORIGIN_REQUIRED');}
export function boundedAge(env,admin=false){const seconds=Number(admin?env.ADMIN_MAX_AGE_SECONDS:env.ACCOUNT_MAX_AGE_SECONDS);return Number.isInteger(seconds)&&seconds>0&&seconds<=(admin?900:86400)?seconds*1000:(admin?300_000:3_600_000);}
export async function sign(secret,purpose,payload){if(typeof secret!=='string'||secret.length<32)throw fail('The private connection is not configured.',503);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(purpose+'\n'+payload)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verify(secret,purpose,payload,signature){if(!/^[a-f0-9]{64}$/.test(signature||'')||typeof secret!=='string'||secret.length<32)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);const sig=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));return crypto.subtle.verify('HMAC',key,sig,new TextEncoder().encode(purpose+'\n'+payload));}
export const envelopePurpose=(method,path)=>'maktab-web-v1:'+method+':'+path;
export async function signedHeaders(secret,path,value){const payload=JSON.stringify(value);return {payload,headers:{'Content-Type':'application/json','X-Maktab-Signature':await sign(secret,envelopePurpose('POST',path),payload)}};}
export function httpsURL(value,{zoom=false}={}){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.hash||zoom&&!/^(?:[a-z0-9-]+\.)?zoom\.us$/.test(url.hostname))throw fail('Choose an approved HTTPS destination.');return url.href;}
