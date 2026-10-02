# Hack-this

Hack-this content lives in Firestore `hackThemes` and `hackPosts`. The admin
portal's Hack-this section manages both. A post appears publicly only when
the post and its theme are published. Theme display order controls breadcrumb
and category ordering; categories show published post counts.

Posts support a message, optional tutorial steps, and HTTPS tool links with
custom button labels. Step titles are optional; step descriptions are required.
Save a post before uploading screenshots. Screenshot click markers reuse the
installation guide editor. Save again to publish image and marker changes.
Tutorial steps can be moved up and down. Hide a post or theme to unpublish it.

Header search matches all message, theme, link, step, screenshot description,
and marker text. Matching tutorial steps are indicated in results and selected
when the reader opens steps. Popular sorts by recorded post opens, with newer
posts breaking ties. Opens are counted once per browser session and rate
limited by the server; this is a browsing signal, not unique-user analytics.

Laptop issues are saved as `laptop-issue` requests in the existing private
Requests inbox, with the existing seller notification flow. They are never
returned by the public Hack-this API. All content mutations and image uploads
require admin authentication and produce audit entries.

New software versions are inserted at the start of their product's embedded
version list. Version IDs remain permanent, preserving old order and licence
references. Editing an existing version preserves its position.
