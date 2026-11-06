// Presentation routes only. Every reader/editor request still uses its normal
// server session, publication and entitlement gate.
import {canonicalCirclesDestination} from './canonical-circles.mjs';
export const legacyStudioDestination=url=>canonicalCirclesDestination(url);
export const applicationPath=()=>'/studio/';
export const collectionKind=value=>value==='courses'?'COURSE':'TAFSEER';
