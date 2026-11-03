import {installPageHistory} from './page-history.mjs';
// This static public page has no account bootstrap; never reuse a private trace.
installPageHistory().update(null);
