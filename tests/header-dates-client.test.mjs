import test from 'node:test';
import assert from 'node:assert/strict';
import {academyDay,installHeaderDates} from '../public/shared/header-dates.mjs';

const start=Date.parse('2026-10-30T12:00:00Z'),minute=60_000;
const record=(hijri,day='2026-10-30')=>({gregorian:day,hijri,timezone:'Africa/Johannesburg',source:'https://jamiat.org.za/'});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Element{
 constructor(){this.dataset={};this.children=[];this._text='';}
 set textContent(value){this._text=value;this.children=[];}
 get textContent(){return this._text+this.children.map(n=>typeof n==='string'?n:n.textContent).join('');}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this._text='';this.children=nodes;}
 querySelector(){return this.children.find(n=>n.className==='circles-header-dates')||null;}
}
function setup(steps,{time=start,hidden=false,cached}={}){
 let clock=time,serial=0;const timers=new Map(),calls=[],saved=new Map(),header=new Element(),events={window:new Map(),document:new Map()};
 if(cached)saved.set('m4l_circles_header_dates_v1',JSON.stringify(cached));
 const listen=target=>(name,fn)=>{if(!events[target].has(name))events[target].set(name,[]);events[target].get(name).push(fn);};
 const document={hidden,querySelector:()=>header,createElement:()=>new Element(),createTextNode:s=>s,addEventListener:listen('document')};
 const window={localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},addEventListener:listen('window'),clearTimeout:id=>timers.delete(id),setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,at:clock+ms});return id;}};
 const fetcher=async(url,options)=>{
  calls.push({url,options,at:clock});const step=steps[calls.length-1];
  assert.equal(url,'/api/public/header-date?day='+academyDay(clock));assert.deepEqual(options,{credentials:'omit'});
  if(step instanceof Error)throw step;if(typeof step==='function')return step();if(step?.ok===false)return step;
  return {ok:true,json:async()=>record(step,academyDay(clock))};
 };
 const api=installHeaderDates({document,window,fetcher,now:()=>clock});
 const emit=(target,name)=>{for(const fn of events[target].get(name)||[])fn();};
 return {api,calls,timers,header,saved,document,
  async advance(ms){const end=clock+ms;let count=0;for(;;){const task=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!task||task[1].at>end)break;assert(++count<10000,'Timer must not spin');clock=task[1].at;timers.delete(task[0]);task[1].fn();await flush();}clock=end;await flush();assert(calls.length<=steps.length,'Unexpected extra date lookup');},
  async visibility(value){document.hidden=value;emit('document','visibilitychange');await flush();},
  async event(name){emit('window',name);await flush();},
  cached(){return JSON.parse(saved.get('m4l_circles_header_dates_v1')||'null');}
 };
}

test('a visible page recovers automatically after failed and null lookups without focus or polling faster than once a minute',async()=>{
 const f=setup([Error('offline'),null,'1 Test 1448']);await flush();assert.equal(f.calls.length,1);assert.match(f.header.textContent,/Hijri date unavailable/);
 await f.advance(minute-1);assert.equal(f.calls.length,1);await f.advance(1);assert.equal(f.calls.length,2);assert.match(f.header.textContent,/unavailable/);
 await f.advance(minute);assert.equal(f.calls.length,3);assert.match(f.header.textContent,/1 Test 1448/);await f.advance(minute);assert.equal(f.calls.length,3,'A valid date uses the fifteen-minute refresh age');
});

test('a valid date obtained today survives later null, HTTP failure and network failure without poisoning its saved cache',async()=>{
 const f=setup(['1 Test 1448',null,{ok:false},Error('offline')]);await flush();assert.equal(f.cached().hijri,'1 Test 1448');
 await f.advance(15*minute);assert.equal(f.calls.length,2);assert.match(f.header.textContent,/1 Test 1448/);assert.equal(f.cached().hijri,'1 Test 1448');
 await f.advance(minute);await f.advance(minute);assert.equal(f.calls.length,4);assert.match(f.header.textContent,/1 Test 1448/);assert.equal(f.cached().hijri,'1 Test 1448');
});

test('a stale but validated date for today is displayed from storage while a page retries an unavailable refresh',async()=>{
 const f=setup([null,'2 Test 1448'],{cached:{...record('1 Test 1448'),savedAt:start-60*minute}});await flush();assert.equal(f.calls.length,1);assert.match(f.header.textContent,/1 Test 1448/);assert.equal(f.cached().hijri,'1 Test 1448');
 await f.advance(minute);assert.equal(f.calls.length,2);assert.match(f.header.textContent,/2 Test 1448/);
});

test('hidden pages have no retry timer or automatic requests, and visibility resumes a due lookup',async()=>{
 const f=setup([null,'1 Test 1448'],{hidden:true});await flush();assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);await f.advance(30*minute);assert.equal(f.calls.length,0);
 await f.visibility(false);assert.equal(f.calls.length,1);await f.visibility(true);assert.equal(f.timers.size,0);await f.advance(5*minute);await f.event('focus');await f.event('online');assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
 await f.visibility(false);assert.equal(f.calls.length,2);assert.match(f.header.textContent,/1 Test 1448/);await f.visibility(true);await f.advance(30*minute);assert.equal(f.calls.length,2);assert.equal(f.timers.size,0);
});

test('midnight clears yesterday, partitions the browser cache by the new day, and retries unavailable new-day data',async()=>{
 const f=setup(['1 Test 1448',null,'2 Test 1448'],{time:Date.parse('2026-10-30T21:59:30Z')});await flush();assert.match(f.header.textContent,/1 Test 1448/);
 await f.advance(31_000);assert.equal(f.calls.length,2);assert.match(f.header.textContent,/31 October 2026/);assert.doesNotMatch(f.header.textContent,/1 Test 1448/);assert.match(f.header.textContent,/unavailable/);assert.equal(f.cached().gregorian,'2026-10-31');
 await f.advance(minute);assert.equal(f.calls.length,3);assert.match(f.header.textContent,/2 Test 1448/);assert.notEqual(f.calls[0].url,f.calls[1].url);
});

test('a response crossing midnight cannot restore yesterday while the same tab schedules its next-day recovery',async()=>{
 const time=Date.parse('2026-10-30T21:59:30Z');let release;const response=new Promise(resolve=>release=resolve);
 const f=setup([()=>response,'2 Test 1448'],{time,cached:{...record('1 Test 1448'),savedAt:time-60*minute}});await flush();assert.equal(f.calls.length,1);assert.match(f.header.textContent,/1 Test 1448/);
 await f.advance(31_000);assert.equal(f.calls.length,1);assert.doesNotMatch(f.header.textContent,/1 Test 1448/);release({ok:true,json:async()=>record('1 Test 1448')});await flush();assert.doesNotMatch(f.header.textContent,/1 Test 1448/);
 await f.advance(1000);assert.equal(f.calls.length,2);assert.match(f.header.textContent,/2 Test 1448/);
});
