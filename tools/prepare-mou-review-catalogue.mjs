// Pure local packaging. Never uploads, authenticates, attaches or publishes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {reviewMouCatalogue} from '../public/shared/mou-prepared-review.mjs';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Use: node tools/prepare-mou-review-catalogue.mjs PREPARED_PACKAGE.json PRIVATE_OUTPUT.json');
const destination=resolve(output);if(destination.includes('/public/'))throw Error('Prepared lesson data must stay outside public assets.');
const plan=JSON.parse(await readFile(input,'utf8'));await reviewMouCatalogue(plan);
await mkdir(dirname(destination),{recursive:true});await writeFile(destination,JSON.stringify(plan),{mode:0o600});
console.log(JSON.stringify({lessons:4,output:destination,hostedActions:0}));
