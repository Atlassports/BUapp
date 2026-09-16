import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { decodePending, encodePending, normalizeEmailFor, trustScore } from "../lib/credentials";

const normalizeEmail = (raw: string) => normalizeEmailFor(raw, "bu.edu");

describe("pending verification token", () => {
  // The original bug: the payload was joined with "." and split back apart,
  // so any dot in the address truncated it. first.last@bu.edu became "first".
  const addresses = [
    "mikec@bu.edu",
    "first.last@bu.edu",
    "a.b.c.d@bu.edu",
    "x@bu.edu",
    "name+tag@bu.edu",
    "under_score@bu.edu",
  ];

  for (const email of addresses) {
    it(`round-trips ${email} without losing anything`, () => {
      const exp = Date.now() + 60_000;
      const decoded = decodePending(encodePending({ email, exp }));
      assert.ok(decoded, "token failed to decode");
      assert.equal(decoded.email, email);
      assert.equal(decoded.exp, exp);
    });
  }

  it("keeps the expiry a finite number", () => {
    // NaN was the second half of the bug: `NaN < Date.now()` is false, so an
    // expired token read as valid forever.
    const decoded = decodePending(encodePending({ email: "a.b@bu.edu", exp: Date.now() }));
    assert.ok(decoded);
    assert.ok(Number.isFinite(decoded.exp), "expiry must be finite or it never expires");
  });

  it("rejects a payload that isn't a valid token", () => {
    for (const junk of ["", "not-base64!!", Buffer.from("{}").toString("base64url")]) {
      assert.equal(decodePending(junk), null, `accepted junk: ${junk}`);
    }
  });

  it("rejects a token whose expiry isn't a number", () => {
    const forged = Buffer.from(JSON.stringify({ email: "a@bu.edu", exp: "soon" })).toString("base64url");
    assert.equal(decodePending(forged), null);
  });
});

describe("email gating", () => {
  it("accepts BU addresses, including dotted and subdomained ones", () => {
    assert.equal(normalizeEmail("Mikec@BU.edu"), "mikec@bu.edu");
    assert.equal(normalizeEmail("first.last@bu.edu"), "first.last@bu.edu");
    assert.equal(normalizeEmail(" spaced@bu.edu "), "spaced@bu.edu");
  });

  it("refuses everything else", () => {
    for (const bad of ["someone@gmail.com", "someone@bu.edu.evil.com", "notanemail", "@bu.edu", ""]) {
      assert.equal(normalizeEmail(bad), null, `let through: ${bad}`);
    }
  });
});

describe("trust score", () => {
  const base = { verified: true, rating: 5, review_count: 10, completed_count: 20, created_at: Date.now() };

  it("stays within 0-99", () => {
    assert.ok(trustScore(base) <= 99);
    assert.ok(trustScore({ ...base, verified: false, rating: 1, review_count: 0, completed_count: 0 }) >= 0);
  });

  it("ranks a verified, well-reviewed account above an unverified new one", () => {
    const newcomer = { verified: false, rating: null, review_count: 0, completed_count: 0, created_at: Date.now() };
    assert.ok(trustScore(base) > trustScore(newcomer));
  });
});
