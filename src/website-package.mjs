import {referencedAssets} from '../public/shared/model.mjs';
import {validatePackage as validateCourse} from '../public/shared/content-schema.mjs';

export const WEBSITE_PACKAGE = 'ACADEMY_WEBSITE_CONTENT_V1';
export const MAX_PACKAGE_BYTES = 1_500_000;
const identifier = value => typeof value === 'string' && /^[\w:-]{1,160}$/.test(value);
const forbidden = new Set(['participants','purchases','permissions','paidmonths','grants','credentials','password','pin','pinhash','token','accesstoken','refreshtoken','zoomurl','zoomlink','joinurl','reflectionanswers','journalentries','completed','accountid','learnerid']);
const error = message => Object.assign(new Error(message), {status:400, code:'INVALID_WEBSITE_PACKAGE'});

function contentOnly(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (forbidden.has(key.replaceAll('_','').toLowerCase())) throw error('Operational or personal records cannot be saved in a website content package.');
    if (typeof item === 'string' && /https?:\/\/[^\s/]*zoom\.(?:us|com)(?:[/:]|$)/i.test(item)) throw error('Use a join reference; meeting URLs cannot be saved in website content.');
    contentOnly(item);
  }
}

export function validateWebsitePackage(value, {websiteId, review=false}={}) {
  if (!value || value.format !== WEBSITE_PACKAGE || !identifier(value.websiteId) || websiteId && websiteId !== value.websiteId) throw error('Choose the content package for this website.');
  if (Object.keys(value).some(key => !['format','websiteId','document','media'].includes(key))) throw error('The package has unsupported fields.');
  contentOnly(value.document);
  const issues = validateCourse(value.document, {review});
  if (!Array.isArray(value.media) || value.media.length > 100) throw error('Check the website media references.');
  const ids = new Set();
  for (const ref of value.media) {
    if (!ref || !identifier(ref.assetId) || ids.has(ref.assetId) || !['IMAGE','PDF','VIDEO','REFERENCE'].includes(ref.kind)) throw error('Check the website media identifiers.');
    ids.add(ref.assetId);
    if (Object.keys(ref).some(key=>!['assetId','kind','mimeType','size','sha256','byteKey','bindingId'].includes(key))) throw error('Media references cannot contain access rules or private URLs.');
    if (ref.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(ref.sha256)) throw error('Check the media checksum.');
    if (ref.size !== undefined && (!Number.isSafeInteger(ref.size) || ref.size < 0)) throw error('Check the media size.');
    if (ref.byteKey !== undefined && (typeof ref.byteKey !== 'string' || !/^media-bytes\/[a-f0-9]{64}$/.test(ref.byteKey))) throw error('Choose a stored media identity.');
    if (ref.bindingId !== undefined && !identifier(ref.bindingId)) throw error('Check the existing media binding.');
    if (ref.mimeType !== undefined && !['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/youtube'].includes(ref.mimeType)) throw error('Check the media type.');
  }
  if (referencedAssets(value.document).some(id=>!ids.has(id))) throw error('A referenced image or material is missing from this package.');
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > MAX_PACKAGE_BYTES) throw Object.assign(error('The website content package is too large.'), {status:413});
  return issues;
}

export function createWebsitePackage({websiteId, document, media=[]}) {
  const value = {format:WEBSITE_PACKAGE, websiteId, document:structuredClone(document), media:structuredClone(media)};
  const issues=validateWebsitePackage(value);if(issues.length)throw error(issues.join(' '));
  return value;
}

export function stableContentIds(document) {
  return {
    document:document.id,
    lessons:document.lessons.map(lesson=>lesson.id),
    sections:document.lessons.flatMap(lesson=>lesson.sections.map(section=>section.id)),
    blocks:document.lessons.flatMap(lesson=>lesson.sections.flatMap(section=>section.blocks.map(block=>block.id))),
    reflections:document.lessons.flatMap(lesson=>lesson.sections.flatMap(section=>section.blocks.filter(block=>block.type==='reflection').map(block=>block.id))),
    assets:referencedAssets(document)
  };
}

async function digest(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join('');
}

// Pointer transactions and authority belong to the platform publication service.
// This adapter only reads/writes bounded, immutable, per-website content objects.
export class R2WebsiteContentStore {
  constructor(bucket) { this.bucket=bucket; }
  async put(value) {
    const issues=validateWebsitePackage(value);if(issues.length)throw error(issues.join(' '));
    const body=JSON.stringify(value.document), sha256=await digest(body);
    const key=`websites/${encodeURIComponent(value.websiteId)}/versions/${sha256}.json`;
    const saved=await this.bucket.put(key,body,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
    if (!saved) {
      const current=await this.bucket.get(key);
      if (!current || current.size>MAX_PACKAGE_BYTES || await digest(await current.text())!==sha256) throw Object.assign(new Error('The existing content edition failed its integrity check.'),{status:503});
    }
    return {key,sha256,bytes:new TextEncoder().encode(body).byteLength};
  }
  async get(websiteId,key) {
    if (!identifier(websiteId) || !key.startsWith(`websites/${encodeURIComponent(websiteId)}/versions/`) || !/\/versions\/[a-f0-9]{64}\.json$/.test(key)) throw error('Choose an edition belonging to this website.');
    const object=await this.bucket.get(key);
    if (!object || object.size>MAX_PACKAGE_BYTES) throw Object.assign(new Error('The saved edition is unavailable.'),{status:503});
    const body=await object.text();
    if (await digest(body)!==key.slice(-69,-5)) throw Object.assign(new Error('The saved edition failed its integrity check.'),{status:503});
    const document=JSON.parse(body);contentOnly(document);const issues=validateCourse(document);if(issues.length)throw error(issues.join(' '));return document;
  }
}
