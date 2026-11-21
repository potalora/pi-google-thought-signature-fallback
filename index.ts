import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Google Gemini 3+ / 4+ APIs (Google AI Studio and Vertex AI) reject requests
 * when a model turn in the active conversation contains a `functionCall` part
 * without a `thoughtSignature` (HTTP 400 INVALID_ARGUMENT).
 *
 * When switching mid-session or mid-turn from another provider/model (e.g.,
 * OpenRouter) to Pi's built-in `google` or `google-vertex` provider, Pi's
 * cross-provider message conversion intentionally strips foreign thought
 * signatures and leaves prior `functionCall` parts unsigned.
 *
 * Google's documented sentinel `"skip_thought_signature_validator"` tells the
 * Gemini API to bypass strict thought-signature validation for migrated or
 * cross-provider function calls. If Pi fixes this upstream and attaches a
 * `thoughtSignature` itself, this handler becomes a no-op.
 */
export const SKIP_THOUGHT_SIGNATURE_VALIDATOR = "skip_thought_signature_validator";

export interface GooglePart {
	functionCall?: Record<string, unknown>;
	thoughtSignature?: string;
	[key: string]: unknown;
}

export interface GoogleContent {
	role?: string;
	parts?: GooglePart[];
	[key: string]: unknown;
}

export interface GoogleGenerateContentPayload {
	model: string;
	contents: GoogleContent[];
	[key: string]: unknown;
}

function isGoogleGenerateContentPayload(payload: unknown): payload is GoogleGenerateContentPayload {
	if (typeof payload !== "object" || payload === null) return false;
	const candidate = payload as Record<string, unknown>;
	return typeof candidate.model === "string" && Array.isArray(candidate.contents);
}

export function patchGooglePayload(payload: unknown): GoogleGenerateContentPayload | undefined {
	if (!isGoogleGenerateContentPayload(payload)) return undefined;

	let modified = false;
	const nextContents = payload.contents.map((content) => {
		if (content?.role !== "model" || !Array.isArray(content.parts)) {
			return content;
		}

		const firstFunctionCallIndex = content.parts.findIndex(
			(part) => part && typeof part === "object" && part.functionCall !== undefined,
		);
		if (firstFunctionCallIndex === -1) {
			return content;
		}

		const hasAnyFunctionCallSignature = content.parts.some(
			(part) =>
				part &&
				typeof part === "object" &&
				part.functionCall !== undefined &&
				typeof part.thoughtSignature === "string" &&
				part.thoughtSignature.length > 0,
		);
		if (hasAnyFunctionCallSignature) {
			return content;
		}

		modified = true;
		const nextParts = content.parts.map((part, index) =>
			index === firstFunctionCallIndex
				? { ...part, thoughtSignature: SKIP_THOUGHT_SIGNATURE_VALIDATOR }
				: part,
		);
		return { ...content, parts: nextParts };
	});

	if (!modified) return undefined;
	return { ...payload, contents: nextContents };
}

export default function googleThoughtSignatureFallback(pi: ExtensionAPI) {
	pi.on("before_provider_request", (event) => patchGooglePayload(event.payload));
}
