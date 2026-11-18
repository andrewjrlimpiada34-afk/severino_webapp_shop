import test from "node:test";
import assert from "node:assert/strict";
import { protectCookieMutations } from "./csrf.js";

function check({
  method = "POST",
  cookies = {},
  authorization,
  requestHeader,
} = {}) {
  let continued = false;
  let status;
  const req = {
    method,
    cookies,
    headers: { authorization },
    get: (name) => (name === "X-Severino-Request" ? requestHeader : undefined),
  };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  };
  protectCookieMutations(req, res, () => {
    continued = true;
  });
  return { continued, status };
}

test("session-cookie writes keep their request check when an Authorization header is present", () => {
  for (const authorization of [
    undefined,
    "Bearer arbitrary-header",
    "Basic arbitrary-header",
  ]) {
    assert.deepEqual(check({ cookies: { token: "session" }, authorization }), {
      continued: false,
      status: 403,
    });
  }
});

test("Google onboarding-cookie writes require the application request header", () => {
  assert.deepEqual(check({ cookies: { google_onboarding: "pending" } }), {
    continued: false,
    status: 403,
  });
  assert.deepEqual(
    check({ cookies: { google_onboarding: "pending" }, requestHeader: "1" }),
    { continued: true, status: undefined },
  );
});

test("cookie-authenticated writes pass with the exact application request header", () => {
  assert.deepEqual(
    check({ cookies: { token: "session" }, requestHeader: "1" }),
    { continued: true, status: undefined },
  );
  assert.deepEqual(
    check({ cookies: { token: "session" }, requestHeader: "true" }),
    { continued: false, status: 403 },
  );
});

test("safe methods and clients without authentication cookies bypass the cookie request check", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.deepEqual(check({ method, cookies: { token: "session" } }), {
      continued: true,
      status: undefined,
    });
  }
  assert.deepEqual(check({ authorization: "Bearer api-token" }), {
    continued: true,
    status: undefined,
  });
});
