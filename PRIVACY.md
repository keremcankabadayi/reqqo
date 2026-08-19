# Privacy Policy — Reqqo

_Last updated: 2026-08-19_

Reqqo is a browser-based HTTP client. It runs entirely on your own machine.

## What Reqqo collects

**Nothing.** Reqqo has no analytics, no telemetry, no crash reporting, and no
accounts. The developer receives no data from your use of the extension, and
there is no server component to receive it.

## What Reqqo stores, and where

Everything you create in Reqqo is written to your browser's local IndexedDB
database (`RestClientDB`) on your own device:

| Stored data | What it is |
|---|---|
| Collections | Folders you create to organize requests |
| Requests | URLs, HTTP methods, headers, query parameters, and request bodies you enter |
| History | A local log of requests you have sent |
| Environments | Variables you define, such as base URLs |
| Auth | Authentication values you enter, such as bearer tokens, API keys, or basic-auth credentials |

This data never leaves your device. It is not synced, uploaded, or backed up by
Reqqo. Removing the extension, or clearing your browser's site data for it,
deletes this data permanently.

**Note on credentials:** authentication values are stored unencrypted in local
browser storage, in the same way they are in comparable developer tools. Anyone
with access to your browser profile can read them. Do not use Reqqo to store
credentials you would not keep in a local text file.

## Network requests

Reqqo sends HTTP requests to the addresses you type into it, only when you ask
it to, and only with the headers and body you supply. Neither those requests nor
their responses are sent anywhere else, and none of them reach any server
belonging to the developer.

Separately, Reqqo's interface loads its fonts from Google Fonts
(`fonts.googleapis.com` and `fonts.gstatic.com`) when you open it. Google
receives the standard information any web request carries — your IP address and
browser user-agent — as described in Google's own privacy policy. No information
about your requests, collections, or credentials is included. This is the only
network connection Reqqo makes that you did not initiate.

## Why Reqqo asks for access to all websites

The extension declares the `<all_urls>` host permission. This is required
because an HTTP client cannot know in advance which endpoints you will want to
call — the permission is what allows Reqqo to send your request to whatever
address you enter.

Reqqo does not read, modify, or inject scripts into the web pages you browse. It
does not run content scripts at all. The permission is used solely to issue the
requests you explicitly compose and send from the Reqqo tab.

## Third parties

Reqqo bundles the Monaco editor and JSONEditor for editing and syntax
highlighting. Both are included in the extension package, load from your local
disk, and make no network calls of their own.

Google Fonts is the one third-party service Reqqo contacts, and only to fetch
the fonts described above.

Beyond that, Reqqo shares no data with any third party, because it collects
none.

## Changes

Any change to this policy will be published at this document's URL, with the
date above updated.

## Contact

Questions about this policy can be sent to the contact address listed on the
Reqqo Chrome Web Store listing.
