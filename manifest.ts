import { Manifest } from "deno-slack-sdk/mod.ts";
import { PostWebhookDefinition } from "./functions/post_webhook.ts";

/**
 * Allowed outbound hosts, supplied at BUILD time via the OUTGOING_DOMAINS env
 * var (comma-separated). This is read when the Slack CLI builds the manifest
 * (the GetManifest hook already runs with --allow-env), NOT at function runtime.
 *
 *   OUTGOING_DOMAINS="api.apify.com,example.com" slack deploy
 *
 * It is REQUIRED and must be non-empty. No subdomain wildcards — list every
 * exact host you call (e.g. api.apify.com, not apify.com). If it's missing or
 * empty the build throws, so you can never deploy a step that silently blocks
 * every request.
 */
function getOutgoingDomains(): string[] {
  const raw = Deno.env.get("OUTGOING_DOMAINS");
  const domains = (raw ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  if (domains.length === 0) {
    throw new Error(
      'OUTGOING_DOMAINS is required and must list at least one host. ' +
        'Example: OUTGOING_DOMAINS="api.apify.com" slack deploy',
    );
  }

  return domains;
}

/**
 * App manifest. Declares the function (the custom Workflow Builder step) and the
 * scopes required.
 *
 * There's no workflow here on purpose: workflows are built in the Workflow
 * Builder GUI, which just needs the published function to offer it as a step.
 *
 * Scopes:
 *   - triggers:write   -> needed to create triggers
 *   - reactions:read   -> only needed if you use a reaction-based trigger
 */
export default Manifest({
  name: "HTTP Request Step",
  description: "A generic custom step that sends an HTTP request to any URL",
  icon: "assets/icon.png",
  functions: [PostWebhookDefinition],
  outgoingDomains: getOutgoingDomains(),
  botScopes: [
    "triggers:write",
    "reactions:read",
  ],
});
