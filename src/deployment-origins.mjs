// Explicit deployment configuration only. Request Host, Origin and forwarding
// headers never select trusted origins or an upstream.
export const legacyHosting=Object.freeze({
 website:'https://maktab4life.org',
 studioBackend:'https://academy-studio-parallel.naidu-hajira.workers.dev',
 academy:'https://academy-maktab4life.pages.dev',
 aliases:Object.freeze(['https://www.maktab4life.org'])
});
const invalid=name=>Object.assign(new Error('The '+name+' address is not configured.'),{status:503,code:'ORIGIN_CONFIGURATION_INVALID'});
export function exactOrigin(value,name='deployment'){
 let url;try{if(typeof value!=='string'||!value)throw Error();url=new URL(value);}catch{throw invalid(name);}
 if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.port||!url.hostname||url.hostname.includes('*'))throw invalid(name);
 return value;
}
export function websiteOrigin(env){return exactOrigin(env.WEBSITE_ORIGIN,'website');}
export function hostingOrigins(env={}){
 const website=exactOrigin(env.WEBSITE_ORIGIN===undefined?legacyHosting.website:env.WEBSITE_ORIGIN,'website');
 const studioBackend=exactOrigin(env.STUDIO_BACKEND_ORIGIN===undefined?legacyHosting.studioBackend:env.STUDIO_BACKEND_ORIGIN,'Studio backend');
 const academy=exactOrigin(env.ACADEMY_ORIGIN===undefined?legacyHosting.academy:env.ACADEMY_ORIGIN,'Academy');
 const academyPortal=exactOrigin(env.ACADEMY_PORTAL_ORIGIN===undefined?website:env.ACADEMY_PORTAL_ORIGIN,'Academy portal');
 let aliases=website===legacyHosting.website?[...legacyHosting.aliases]:[];
 if(env.WEBSITE_ALIAS_ORIGINS!==undefined){try{aliases=JSON.parse(env.WEBSITE_ALIAS_ORIGINS);}catch{throw invalid('website aliases');}}
 if(!Array.isArray(aliases)||aliases.length>8)throw invalid('website aliases');
 aliases=aliases.map(value=>exactOrigin(value,'website alias'));
 if(new Set(aliases).size!==aliases.length||aliases.includes(website))throw invalid('website aliases');
 return {website,studioBackend,academy,academyPortal,aliases};
}
