import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

/**
 * Generic HTTP-request step (= a custom Workflow Builder step).
 *
 * It fires an arbitrary HTTP request to a URL you configure on the step in
 * Workflow Builder. URL, method, headers and body are all step inputs, so a
 * single step can talk to any webhook / API.
 *
 * Templating note: when you build the workflow in the Workflow Builder GUI you
 * can insert workflow variables (e.g. the message link of a reaction trigger)
 * straight into the `body` (or `url` / `headers`) field using Slack's variable
 * picker. Slack substitutes them BEFORE this function runs, so there's no
 * placeholder engine here — the inputs arrive already interpolated.
 */
export const PostWebhookDefinition = DefineFunction({
  callback_id: "post_webhook",
  title: "Send HTTP request",
  description: "Sends an HTTP request (any method) to a URL with optional headers and body",
  source_file: "functions/post_webhook.ts",
  input_parameters: {
    properties: {
      url: {
        type: Schema.types.string,
        description: "The URL to send the request to",
      },
      method: {
        type: Schema.types.string,
        description: "HTTP method (GET, POST, PUT, PATCH, DELETE, ...). Defaults to POST.",
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        default: "POST",
      },
      headers: {
        type: Schema.types.string,
        description:
          'Request headers as a JSON object string, e.g. {"Authorization":"Bearer abc","Content-Type":"application/json"}',
      },
      body: {
        type: Schema.types.string,
        description:
          "Request body, sent verbatim. Set Content-Type via headers. Ignored for GET/HEAD.",
      },
    },
    required: ["url"],
  },
  output_parameters: {
    properties: {
      status: {
        type: Schema.types.integer,
        description: "HTTP status code returned by the endpoint",
      },
      response_body: {
        type: Schema.types.string,
        description: "Response body returned by the endpoint",
      },
    },
    required: [],
  },
});

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

export default SlackFunction(
  PostWebhookDefinition,
  async ({ inputs }) => {
    const { url } = inputs;

    const method = (inputs.method ?? "POST").toUpperCase();

    // Parse the headers JSON string into a plain object. Empty/absent -> {}.
    let headers: Record<string, string> = {};
    if (inputs.headers && inputs.headers.trim() !== "") {
      try {
        const parsed = JSON.parse(inputs.headers);
        if (
          typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
        ) {
          throw new Error("headers must be a JSON object");
        }
        // Coerce every value to a string; fetch wants string values.
        headers = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, String(v)]),
        );
      } catch (err) {
        return {
          error: `Invalid headers JSON: ${
            err instanceof Error ? err.message : String(err)
          }`,
          outputs: {},
        };
      }
    }

    const init: RequestInit = { method, headers };
    if (!METHODS_WITHOUT_BODY.has(method) && inputs.body !== undefined) {
      init.body = inputs.body;
    }

    try {
      const res = await fetch(url, init);
      const responseBody = await res.text();

      if (!res.ok) {
        return {
          error: `Request returned non-2xx status: ${res.status}: ${responseBody}`,
          outputs: { status: res.status, response_body: responseBody },
        };
      }

      return { outputs: { status: res.status, response_body: responseBody } };
    } catch (err) {
      return {
        error: `Failed to send request: ${
          err instanceof Error ? err.message : String(err)
        }`,
        outputs: {},
      };
    }
  },
);
