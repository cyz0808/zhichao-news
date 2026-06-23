import test from "node:test";
import assert from "node:assert/strict";
import { assessXCredibility } from "../lib/x-signals.js";

test("trusted verified X accounts can pass credibility threshold", () => {
  const credibility = assessXCredibility(
    {
      public_metrics: {
        retweet_count: 80,
        quote_count: 20,
        reply_count: 100,
        like_count: 2000
      }
    },
    {
      username: "NVIDIA",
      verified: true,
      verified_type: "business",
      public_metrics: { followers_count: 3000000 }
    },
    ["NVIDIA"]
  );

  assert.equal(credibility.passed, true);
  assert.equal(credibility.isTrustedAccount, true);
});

test("unverified low-impact X accounts fail credibility threshold", () => {
  const credibility = assessXCredibility(
    {
      public_metrics: {
        retweet_count: 1,
        quote_count: 0,
        reply_count: 1,
        like_count: 5
      }
    },
    {
      username: "random_user",
      verified: false,
      public_metrics: { followers_count: 300 }
    },
    ["NVIDIA"]
  );

  assert.equal(credibility.passed, false);
  assert.equal(credibility.isTrustedAccount, false);
});
