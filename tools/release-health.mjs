import assert from 'node:assert/strict';

// Retry only a healthy, known previous release during propagation.
// Unexpected status, body or version remains an immediate deployment failure.
export async function waitForReleaseHealth({url,expectedVersion,previousVersion,fetcher=fetch,sleep=ms=>new Promise(done=>setTimeout(done,ms)),onSample=async()=>{}}){
 assert(/^\d+\.\d+$/.test(expectedVersion)&&/^\d+\.\d+$/.test(previousVersion));
 assert.notEqual(expectedVersion,previousVersion);
 const endpoint=new URL(url);endpoint.searchParams.set('release_check',expectedVersion);
 const delays=[0,2000,5000,10000],samples=[];
 for(let attempt=0;attempt<delays.length;attempt++){
  if(delays[attempt])await sleep(delays[attempt]);
  const response=await fetcher(endpoint.href,{headers:{'Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(15000)});
  const health=await response.json();
  const version=typeof health?.version==='string'&&/^\d+\.\d+$/.test(health.version)?health.version:null;
  const sample={attempt:attempt+1,status:response.status,success:health?.success===true,version};
  samples.push(sample);await onSample(sample,samples.map(row=>({...row})));
  if(response.ok&&sample.success&&version===expectedVersion)return {passed:true,...sample,samples};
  assert(response.ok&&sample.success&&version===previousVersion,'Unexpected Academy health response: '+JSON.stringify(sample));
 }
 throw Error('Academy is still serving the previous version after bounded propagation checks.');
}
