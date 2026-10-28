// Test-only instrumentation: count native D1 metadata across the source API and
// its split coordinator. This module is never imported by the shipped worker.
export function measuredBindings(env){
 const originals=new WeakMap(),sqlByStatement=new WeakMap();
 const counted=async(result,sqls)=>{const all=Array.isArray(result)?result:[result],metrics=all.reduce((sum,r)=>({queries:sum.queries+1,rowsRead:sum.rowsRead+(r.meta?.rows_read||0),rowsWritten:sum.rowsWritten+(r.meta?.rows_written||0)}),{queries:0,rowsRead:0,rowsWritten:0});metrics.statements=all.map((r,i)=>({sql:sqls[i],rowsRead:r.meta?.rows_read||0}));await env.LOCAL_D1_METRICS.fetch('https://local-metrics.test/',{method:'POST',body:JSON.stringify(metrics)});return result;};
 const statement=(native,sql)=>{
  const wrapper={bind:(...args)=>statement(native.bind(...args),sql),all:async()=>counted(await native.all(),[sql]),run:async()=>counted(await native.run(),[sql]),first:async column=>{const row=(await wrapper.all()).results[0];return row?(column===undefined?row:row[column]):null;},raw:async({columnNames=false}={})=>{const rows=(await wrapper.all()).results;if(!rows.length)return [];const keys=Object.keys(rows[0]);return [...(columnNames?[keys]:[]),...rows.map(row=>keys.map(key=>row[key]))];}};originals.set(wrapper,native);sqlByStatement.set(wrapper,sql);return wrapper;
 };
 const database=native=>({prepare:sql=>statement(native.prepare(sql),sql),withSession:bookmark=>database(native.withSession(bookmark)),batch:async statements=>counted(await native.batch(statements.map(s=>originals.get(s)||s)),statements.map(s=>sqlByStatement.get(s))),getBookmark:()=>native.getBookmark?.()});
 return {...env,ACADEMY_DB:database(env.ACADEMY_DB),ACADEMY_ADMIN_DB:database(env.ACADEMY_ADMIN_DB)};
}
