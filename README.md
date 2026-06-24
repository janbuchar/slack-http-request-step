# Send HTTP request — a custom Slack Workflow step

A custom **Workflow Builder step** that sends an HTTP request to any URL. Pick
the method, set headers (for auth), pass a body — all as step inputs. Drop it
into any workflow and any trigger.

It exists because Slack retired the native "Send a web request" step and offers
no generic HTTP/Zapier/Make connector. This fills that gap.

## What the step does

**Inputs**

| Input     | Required | Description                                                            |
|-----------|----------|-----------------------------------------------------------------------|
| `url`     | yes      | Where to send the request. The host must be in `OUTGOING_DOMAINS` at deploy time. |
| `method`  | no       | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, or `OPTIONS`. Defaults to `POST`. |
| `headers` | no       | A JSON **string** of headers, e.g. `{"Authorization":"Bearer abc","Content-Type":"application/json"}`. |
| `body`    | no       | Raw request body, sent as-is. Ignored for `GET`/`HEAD`. Set its content type via `headers`. |

**Outputs**

| Output          | Description              |
|-----------------|--------------------------|
| `status`        | HTTP status code.        |
| `response_body` | Response body, as text.  |

A non-2xx response marks the step as failed but still returns `status` and
`response_body`.

## Inserting workflow variables (templating)

The function has **no placeholder engine**, and it doesn't need one. In the
Workflow Builder GUI, click into the `body` (or `url` / `headers`) field and use
Slack's variable picker to insert trigger variables — the message link, who
reacted, the emoji, whatever your trigger provides. Slack substitutes them
**before** the step runs, so the request goes out fully filled in.

Example body for a reaction trigger (the bracketed bits are picked variables):

```json
{
  "text": "Reaction added",
  "link": "[message link]",
  "user": "[person who reacted]"
}
```

## Prerequisites

- **Slack CLI** — the developer tool from https://tools.slack.dev/slack-cli
  (NOT the `slack` binary bundled with the desktop chat app; that's a different
  program).
- **Deno**.
- A **paid Slack plan** and admin rights to install/approve the app.

## Setup & deploy

```bash
# 1. Log the CLI into your workspace
slack login

# 2. Deploy, passing the allowed hosts via the OUTGOING_DOMAINS env var
#    (comma-separated, build-time). It is REQUIRED — the build fails if unset.
#    No subdomain wildcards — list each exact host (e.g. api.apify.com, not apify.com).
OUTGOING_DOMAINS="api.apify.com" slack deploy
```

Then, in **Workflow Builder**:

1. Create a workflow and choose a trigger (e.g. "reaction added").
2. Add the **Send HTTP request** step.
3. Fill in `url`, `method`, `headers`, `body`, inserting trigger variables via
   the picker.
4. Publish.

Triggers are built here in the GUI, not via the CLI — the CLI can only map whole
variables into an input, so it can't interpolate them inside a JSON body.

## Test

```bash
deno task test
# or:  deno test --allow-read --allow-net --allow-import
```

## Common pitfalls

- **Host not in `OUTGOING_DOMAINS`** → Slack blocks the request and the step
  fails (`Requires net access to "<host>:443"`). This is the #1 cause of "it just
  doesn't work." `OUTGOING_DOMAINS` is a comma-separated, build-time env var
  (required — the build throws if unset). No subdomain wildcards: `apify.com`
  does NOT cover `api.apify.com`. List each exact host, and re-`slack deploy`
  (with the env var set) after changing it.
- **`headers` must be valid JSON** (an object). Invalid JSON returns an error.
- **60-second timeout** on the deployed function — your endpoint must respond in
  time.
- **Slack Connect / external users** can't run workflows that contain custom
  steps (`home_team_only`). By design.
