import test from "node:test";
import assert from "node:assert/strict";
import { patchGooglePayload, SKIP_THOUGHT_SIGNATURE_VALIDATOR } from "./index.ts";

test("ignores non-Google payloads", () => {
	assert.equal(patchGooglePayload(null), undefined);
	assert.equal(patchGooglePayload({ messages: [] }), undefined);
	assert.equal(patchGooglePayload({ model: "gpt-5", input: [] }), undefined);
});

test("returns undefined when model turn already carries a thoughtSignature", () => {
	const payload = {
		model: "gemini-4-neon",
		contents: [
			{ role: "user", parts: [{ text: "hi" }] },
			{
				role: "model",
				parts: [
					{ functionCall: { name: "bash", args: {} }, thoughtSignature: "AAAA" },
					{ functionCall: { name: "read", args: {} } },
				],
			},
		],
	};
	assert.equal(patchGooglePayload(payload), undefined);
});

test("injects sentinel on the first functionCall of an unsigned model turn", () => {
	const payload = {
		model: "gemini-4-neon",
		contents: [
			{ role: "user", parts: [{ text: "run commands" }] },
			{
				role: "model",
				parts: [
					{ text: "Running both" },
					{ functionCall: { name: "bash", args: { command: "echo one" } } },
					{ functionCall: { name: "bash", args: { command: "echo two" } } },
				],
			},
			{
				role: "user",
				parts: [{ functionResponse: { name: "bash", response: { output: "one" } } }],
			},
		],
	};

	const patched = patchGooglePayload(payload);
	assert.ok(patched);
	assert.equal(patched.contents[1].parts[0].thoughtSignature, undefined);
	assert.equal(patched.contents[1].parts[1].thoughtSignature, SKIP_THOUGHT_SIGNATURE_VALIDATOR);
	assert.equal(patched.contents[1].parts[2].thoughtSignature, undefined);
	// Original payload is not mutated.
	assert.equal(payload.contents[1].parts[1].thoughtSignature, undefined);
});

test("leaves text-only model turns untouched", () => {
	const payload = {
		model: "gemini-4-neon",
		contents: [
			{ role: "user", parts: [{ text: "hi" }] },
			{ role: "model", parts: [{ text: "hello" }] },
		],
	};
	assert.equal(patchGooglePayload(payload), undefined);
});
