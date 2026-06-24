# slack-webhook-step

A Slack **custom Workflow Builder step** that sends a **generic HTTP request**
(any method, custom headers, arbitrary body) to a URL you configure on the step.
Originally built to "ping a webhook on emoji reaction"; now it's a general
"Send HTTP request" connector you can drop into any workflow.

## Why this exists (the backstory)

The original goal was dead simple: "ping a webhook when someone reacts with a
specific emoji." Slack makes this needlessly hard:

1. **Workflow Builder has an emoji-reaction trigger**, but its native
   **"Send a web request" step has been removed.** It's gone. Not hidden behind
   a toggle, not plan-gated — retired.
2. **There is no generic HTTP / Zapier / Make connector step.** Slack's
   connector list is a fixed catalog of specific SaaS products (Google Sheets,
   Jira, Zoom, etc.). None of them is "POST arbitrary JSON to my URL."
3. **The raw Events API (`reaction_added`)** works, but it's a firehose and
   gives you none of the Workflow Builder UX.

The solution is a **custom function** (= a custom Workflow Builder step) built on
the **Slack CLI + Deno SDK** automations stack. It does the one thing Slack won't
do natively: send an HTTP request to an arbitrary URL. Because URL, method,
headers, and body are all step inputs, a single step works with any trigger and
any endpoint.

## Templating (important)

There is **no `{{...}}` placeholder engine in the function.** When you build a
workflow in the **Workflow Builder GUI**, you insert trigger variables (message
link, who reacted, the emoji, etc.) directly into the step's `body` / `url` /
`headers` fields using Slack's variable picker. **Slack substitutes them before
the function runs**, so the inputs arrive already interpolated. The function just
sends what it's given.

(The CLI-defined trigger path can only map *whole* variables into an input, not
interpolate inside a JSON string. That's why the example trigger uses a fixed
body. For free-form JSON templates, use the GUI.)

## Project layout

```
manifest.ts                          App manifest: function, scopes, outgoing domains
functions/post_webhook.ts            The custom step: sends a generic HTTP request
functions/post_webhook_test.ts       Unit tests (mock fetch)
import_map.json                      Pins deno-slack-sdk / deno-slack-api versions
deno.jsonc                           Deno config (import map + test task)
slack.json                           Slack CLI hooks entrypoint
```

Note: the function file/callback_id is still `post_webhook` (kept to avoid churn);
its display title is "Send HTTP request".

## The step's interface

**Inputs**

| Input     | Required | Notes                                                                 |
|-----------|----------|-----------------------------------------------------------------------|
| `url`     | yes      | Target URL. Host must be in `outgoingDomains` (set via `OUTGOING_DOMAINS`). |
| `method`  | no       | One of GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS. Defaults to `POST`.     |
| `headers` | no       | JSON-object **string**, e.g. `{"Authorization":"Bearer x"}`.          |
| `body`    | no       | Raw string, sent verbatim. Ignored for GET/HEAD. Set Content-Type via `headers`. |

**Outputs**

| Output          | Notes                                  |
|-----------------|----------------------------------------|
| `status`        | HTTP status code.                      |
| `response_body` | Response body as text.                 |

A non-2xx response returns an `error` (so the step is marked failed) *and* still
populates `status` / `response_body`.

## Prerequisites

- **Slack CLI** (the developer tool, NOT the desktop chat app). Install from
  https://tools.slack.dev/slack-cli . The `slack` binary that ships with the
  desktop client is a different program.
- **Deno** (already present on this machine).
- A **paid Slack plan** and admin rights to install/approve the app.

## Setup & deploy

```bash
# 1. Authenticate the CLI against your workspace
slack login

# 2. Deploy, supplying allowed hosts via the build-time OUTGOING_DOMAINS env var
#    (comma-separated). REQUIRED — manifest build throws if unset/empty.
#    No subdomain wildcards — list each exact host.
OUTGOING_DOMAINS="api.apify.com" slack deploy

# 3. Build your workflow in the Workflow Builder GUI:
#    - pick a trigger (e.g. "reaction added")
#    - add the "Send HTTP request" step
#    - fill url/method/headers/body, inserting trigger variables via the picker
```

Triggers are built in the Workflow Builder GUI, not via the CLI. (A CLI-defined
trigger can only map *whole* variables into an input, not interpolate inside a
JSON string — so for free-form JSON bodies the GUI is the only sane path.)

No `WEBHOOK_URL` / `WEBHOOK_SECRET` env vars anymore — the URL and any auth
headers are step inputs now.

## Test

```bash
deno task test
# or:  deno test --allow-read --allow-net --allow-import
```

(Deno 2.x requires `--allow-import` because the pinned SDK pulls some transitive
deps from crux.land.)

## How data flows

```
trigger (e.g. reaction added, in the GUI)
        │   Slack interpolates picked variables into the step inputs
        ▼
GUI-built workflow  ──adds the "Send HTTP request" step──►
        │
        ▼
post_webhook function  ──HTTP request (method/headers/body)──►  your URL
        │
        ▼
outputs: { status, response_body }
```

## Gotchas

- **`outgoingDomains` is set from the build-time `OUTGOING_DOMAINS` env var**
  (comma-separated) and is mandatory — the manifest build throws if it's unset or
  empty. If a target host isn't listed, Slack blocks the outbound `fetch` and the
  step fails. **No subdomain wildcards** — `apify.com` does NOT cover
  `api.apify.com`; list each exact host. Changes only take effect after a
  re-`slack deploy` with the env var set.
- **`headers` is a JSON string, not an object.** Invalid JSON returns an error
  from the step. Values are coerced to strings.
- **Deployed function timeout is 60s.** Your endpoint must respond well within that.
- **Slack Connect / external users** can't run workflows containing custom steps
  (you may see a `home_team_only` warning). That's by design.
- **Build triggers in the Workflow Builder GUI.** Insert the "message link"
  variable there to get a clickable link into the body — Slack interpolates it
  before the step runs.
- **Pinned SDK versions** live in `import_map.json`. Bump them deliberately;
  Slack reorganizes this SDK roughly once per fiscal quarter.
