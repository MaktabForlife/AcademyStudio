import {readFileSync,readdirSync} from 'node:fs';
export async function applyTargetSchema(db,{before}={}){
 const root=new URL('../migrations/',import.meta.url),schema=readdirSync(root).filter(x=>/^\d{4}_.*\.sql$/.test(x)&&(!before||x<before)).sort().map(name=>readFileSync(new URL(name,root),'utf8')).join('\n');
 let statement='';for(const part of schema.replace(/--[^\n]*/g,'').split(';')){statement+=part+';';if(/CREATE TRIGGER/i.test(statement)&&! /\sEND;\s*$/.test(statement))continue;if(statement.trim()!==';')await db.prepare(statement).run();statement='';}
}
