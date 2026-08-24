import assert from "node:assert/strict";
import test from "node:test";

import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from "../app/chatgpt-auth-paths.ts";

test("auth return paths retain safe relative URLs", () => {
  assert.equal(
    chatGPTSignInPath("/board?space=module#today"),
    "/signin-with-chatgpt?return_to=%2Fboard%3Fspace%3Dmodule%23today",
  );
});

test("auth return paths reject external and reserved destinations", () => {
  assert.equal(
    chatGPTSignInPath("https://example.com"),
    "/signin-with-chatgpt?return_to=%2F",
  );
  assert.equal(
    chatGPTSignInPath("//example.com"),
    "/signin-with-chatgpt?return_to=%2F",
  );
  assert.equal(
    chatGPTSignInPath("/signin-with-chatgpt/"),
    "/signin-with-chatgpt?return_to=%2F",
  );
  assert.equal(
    chatGPTSignOutPath("/callback/"),
    "/signout-with-chatgpt?return_to=%2F",
  );
});
