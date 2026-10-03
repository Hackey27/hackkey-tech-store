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

Guides now have a post-level `operatingSystem`: General, Windows, macOS or Android. Missing values default to General on read/save, so existing posts need no bulk migration. The filter strip includes All plus these four options.

Each tutorial step optionally supports `copyText`, `actionLabel` and `actionUrl`. Copy text preserves its exact whitespace and line breaks; a labelled step link must use HTTPS. Search and tool-link filtering include these actions. Existing steps remain editable and reorderable. Add step stays below the step list.

The last authored step automatically includes a store support message and links to every other hamburger section. Examples come from the current public catalogues, without changing saved guide steps. For technicians remains labelled Coming soon. Each post card and open post has a share action, using the device share sheet where available and a copy-link fallback otherwise.

Opening tutorial steps hides the post overview. The guide shares the installation progress bar, with the percentage showing the current step out of the total. Post-card metadata and actions sit on a dark green outline-pattern footer, scaled to twice the header pattern. Admin text fields inherit English browser spell checking; corrections use the browser’s spelling suggestions.
