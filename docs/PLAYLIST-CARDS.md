# Playlist cards: Studio backend

Studio0014 adds automatic default artwork for registered playlists. The native
playlist table owns the editable name; card metadata holds no independent name.
`websites.title` remains the canonical draft value, and `published_title` is its
publication snapshot. Canonical editor exports use the current draft name;
readers, published discovery and recording-list headers use the published name.
Saving draft text or card settings never updates that published snapshot.

## Design and Teacher fields

`mou-playlist-save` accepts optional `card` and `teacherIds` fields:

```json
{
  "card": {
    "version": 1,
    "style": "gradient",
    "colour": "#759786",
    "gradient": "sage",
    "image": null,
    "teacher": null
  },
  "teacherIds": []
}
```

Styles: default, colour, gradient, image. Presets: sage, plum, rose, gold, ocean,
sunset. Colour is normalised to uppercase six-digit hex. Default preserves the
existing Tafseer presentation. Default/colour styles require null gradient/image; gradient style requires a
preset with no image. Image style requires a picture and can retain a preset
gradient for its label band. Ambiguous style combinations are rejected.

Teacher selection is optional. Nonempty IDs are checked through the existing
current native Teacher bridge on Save; the saved `teacher:string|null` is derived
from checked names. Client teacher labels and image URLs are ignored. Omitted
design/Teacher fields preserve current settings. Empty Teacher IDs clear only the
card line; recording Teacher validation still requires at least one Teacher.

Admin table rows add `card`, `publishedCard`, `teacherIds`, `publishedName`,
`cardImageRequired`, `canEdit` and `editorHref`. Learner/catalogue rows include
only published card metadata and current Admin edit capability, through the
existing bounded SQL projections. No per-card Source, D1 or R2 metadata calls.

## Decorative upload and preview

Native Source proxy commands:

- `mou-playlist-card-options`: current checked Teachers, optional Teacher flag,
  preset names and compressed upload limit. Load on explicit editing only.
- `mou-playlist-cover-upload`: operationId, playlistId, revision, type, sha256,
  data (base64). Returns `{image:{assetId,sha256,type,size,alt,url:null}}`.
- `mou-playlist-cover-preview`: playlistId, assetId. Returns the image metadata
  and base64 data under current scoped Admin authority.

Only upload uses the dedicated Source POST
`/api/admin/platform/studio-access/playlist-cover` and signed Target POST
`/internal/studio/playlist-cover`. Both force the upload action. The general
Source request/signed-envelope limits and Target signed parser remain unchanged.
Upload-only envelopes are at most 1,000,000 bytes; images at most 512 KiB decoded /
700 KiB base64. PNG, JPEG and WebP require matching MIME/magic/size/SHA. UI may
resize originals up to 5 MB before this request. Pending deliveries keep ordered
ACK/drain and exact retry behavior. Only preview responses use a 1 MB allowance.

Direct Studio current-cookie clients can PUT raw bytes to
`/api/admin/:offering/playlist-cover?playlistId=&operationId=&revision=&sha256=`
with the exact image Content-Type, and GET with `playlistId=&assetId=` for a
private no-store preview. Explicit prospective playlist IDs are supported.

Artwork uses a dedicated ownership table and private CONTENT prefix. It never
adopts recording/PDF/website asset objects or fetches remote image URLs. Upload
and private Save cannot create a public cover. Current scoped ownership,
account/session/epoch, sensitive authority and revision checks still apply.

## Publication and recovery

Both playlist Publish and canonical website Publish take a card/name snapshot
in the guarded database transaction. New/private never-published Courses keep an image requirement on every
publication, including after withdrawal. Image style and an exact scoped artwork
reference are both required. A database trigger fences alternative website
publish paths too. Already-published and withdrawn legacy rows are grandfathered
with image_required=0 and remain valid.

After the exact publication commits, artwork is copied to the existing immutable
`/api/public/circles/covers/:sha256` route. Cover bytes require zero D1 reads and
have no short-lived token that could break the twelve-hour screen cache. Published DTO URLs are absolute and use the configured Studio WEBSITE_ORIGIN,
so a Source-hosted table cannot resolve an artwork path against the wrong host.
Stored card JSON/hashes remain origin-free. Local fixtures use their own origin.
Decorative artwork becomes public on publication and may remain public after
withdrawal. Protected recording/PDF permissions are independent and unchanged.

If storage promotion fails, `CARD_PUBLICATION_PENDING` asks for an exact retry.
The successful transaction's immutable operation receipt retains the approved
image, so a later private edit cannot change what that retry promotes. A stale
or denied publication never promotes artwork.

Apply only the new 0014 migration once. Recovery must retain 0014-aware published
title/card projections, Teacher checks and the persistent Course-image barrier;
unmodified 109.5 can expose a privately edited title. Root owns compatible paired
recovery and deployment. This feature performs no hosted migration, publication,
rights change or deployment.
