import * as mf from "https://deno.land/x/mock_fetch@0.3.0/mod.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import handler from "./post_webhook.ts";

mf.install();

const { createContext } = SlackFunctionTester("post_webhook");

Deno.test("sends the request and returns status + response body", async () => {
  mf.mock("POST@/hook", () => new Response("ok", { status: 200 }));

  const inputs = {
    url: "https://example.com/hook",
    method: "POST",
    headers: '{"Content-Type":"application/json"}',
    body: '{"hello":"world"}',
  };

  const { outputs, error } = await handler(createContext({ inputs }));

  assertEquals(error, undefined);
  assertEquals(outputs?.status, 200);
  assertEquals(outputs?.response_body, "ok");
});

Deno.test("defaults to POST when method is omitted", async () => {
  let seenMethod: string | undefined;
  mf.mock("POST@/default", (req) => {
    seenMethod = req.method;
    return new Response("", { status: 201 });
  });

  const inputs = { url: "https://example.com/default", body: "x" };

  const { outputs, error } = await handler(createContext({ inputs }));

  assertEquals(error, undefined);
  assertEquals(seenMethod, "POST");
  assertEquals(outputs?.status, 201);
});

Deno.test("forwards custom headers", async () => {
  let auth: string | null = null;
  mf.mock("GET@/headers", (req) => {
    auth = req.headers.get("Authorization");
    return new Response("", { status: 200 });
  });

  const inputs = {
    url: "https://example.com/headers",
    method: "GET",
    headers: '{"Authorization":"Bearer t0ken"}',
  };

  const { error } = await handler(createContext({ inputs }));

  assertEquals(error, undefined);
  assertEquals(auth, "Bearer t0ken");
});

Deno.test("does not send a body for GET", async () => {
  let hadBody = false;
  mf.mock("GET@/nobody", async (req) => {
    hadBody = (await req.text()) !== "";
    return new Response("", { status: 200 });
  });

  const inputs = {
    url: "https://example.com/nobody",
    method: "GET",
    body: "should-be-ignored",
  };

  const { error } = await handler(createContext({ inputs }));

  assertEquals(error, undefined);
  assertEquals(hadBody, false);
});

Deno.test("errors on invalid headers JSON", async () => {
  const inputs = {
    url: "https://example.com/hook",
    headers: "not json",
  };

  const { error } = await handler(createContext({ inputs }));

  assertEquals(typeof error, "string");
});

Deno.test("returns error and status on non-2xx response", async () => {
  mf.mock("POST@/fail", () => new Response("nope", { status: 500 }));

  const inputs = { url: "https://example.com/fail", body: "x" };

  const { outputs, error } = await handler(createContext({ inputs }));

  assertEquals(typeof error, "string");
  assertEquals(outputs?.status, 500);
  assertEquals(outputs?.response_body, "nope");
});
