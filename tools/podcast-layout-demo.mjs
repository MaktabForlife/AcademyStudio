// Loopback design review only. Never include the reviewed private teaching
// package, this server or its demo responses in a production asset manifest.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),project=resolve(repo,'../..');
const source=resolve(project,'outputs/all-course-recording-review-20261029/private/kahf-with-recordings-package.json'),manifest=resolve(project,'outputs/all-course-recording-review-20261029/private/kahf-local-source-manifest.json');
const packageData=JSON.parse(await readFile(source,'utf8')),sources=JSON.parse(await readFile(manifest,'utf8'));
const course=structuredClone(packageData.document);course.home.imageId='demo-cover';course.pages.materials=true;
const entries=recordingGuides(course).map(g=>{const row=sources.recordings.find(r=>r.lessonId===g.lessonId);return row?{id:g.lessonId,authorVideo:row.videoId,title:g.title,summary:g.summary,date:row.date,duration:row.durationSeconds,readingIds:[g.readingId],topics:g.topics||[],quote:g.quote}:null;}).filter(Boolean);
const mime={'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1'),path=decodeURIComponent(url.pathname);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(path==='/demo.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({course,entries}));return;}
 if(path==='/course.pdf'){res.setHeader('Content-Type','application/pdf');res.end(await readFile(sources.materials[0].path));return;}
 const target=path==='/'?resolve(repo,'tools/podcast-demo/index.html'):path.startsWith('/demo/')?resolve(repo,'tools/podcast-demo',path.slice(6)):path.startsWith('/shared/')?resolve(repo,'public',path.slice(1)):null;
 if(!target||!target.startsWith(resolve(repo,'tools/podcast-demo')+sep)&&!target.startsWith(resolve(repo,'public/shared')+sep))throw Error('Unavailable');
 res.setHeader('Content-Type',mime[extname(target)]||'application/octet-stream');res.end(await readFile(target));
 }catch{res.statusCode=404;res.end('Not available in this local design preview.');}});
server.listen(Number(process.env.PODCAST_DEMO_PORT||9138),'127.0.0.1',()=>process.stdout.write('Podcast layout review: http://127.0.0.1:'+server.address().port+'/\n'));
