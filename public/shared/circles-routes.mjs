// Presentation routes only. Every reader/editor request still uses its normal
// server session, publication and entitlement gate.
import {canonicalCirclesDestination} from './canonical-circles.mjs';
export const legacyStudioDestination=url=>canonicalCirclesDestination(url);
export const applicationPath=()=>'/studio/';
const studioProgrammeQueries=new Set([
 '?view=collections&collection=tafseer',
 '?classroom=mothers',
 '?view=collections&collection=courses'
]);
export const studioSignInReturnPath=search=>applicationPath()+(studioProgrammeQueries.has(search)?search:'');
export const collectionKind=value=>value==='courses'?'COURSE':'TAFSEER';
