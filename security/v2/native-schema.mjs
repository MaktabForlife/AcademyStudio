import {studioAccessCompletionSchemaSQL} from '../../src/studio-access-completion.mjs';
import {studioCoursePublicationSchemaSQL} from '../../src/v111-course-publication.mjs';
import {studioSourceAuthoritySchemaSQL} from '../../src/v111-source-authority.mjs';
// App-owned recipes; no schema is automatically applied to an existing DB.
export const nativeSchemaSQL=[studioAccessCompletionSchemaSQL,studioSourceAuthoritySchemaSQL,studioCoursePublicationSchemaSQL].join("\n");
