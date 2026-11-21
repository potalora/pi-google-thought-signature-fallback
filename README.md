# pi-google-thought-signature-fallback

Pi extension package that prevents HTTP 400 `Function call is missing a thought_signature in functionCall parts` errors when switching mid-session or mid-turn from another provider/model (e.g. OpenRouter) to Google AI Studio (`google`) or Vertex AI (`google-vertex`) Gemini 3+/4+ models.

## Behavior

On `before_provider_request`, for Google GenerateContent payloads (`{ model, contents }`), if a `model` turn contains `functionCall` parts and none carry a `thoughtSignature`, this extension attaches Google's documented sentinel `"skip_thought_signature_validator"` to the first `functionCall` part in that turn.

If Pi fixes this upstream and attaches a `thoughtSignature` (real or sentinel), this extension returns `undefined` and is a complete no-op.

## Install

```bash
pi install git:github.com/potalora/pi-google-thought-signature-fallback@<commit-sha> --approve
```

## Removal

Once upstream Pi handles unsigned cross-provider `functionCall` parts natively:

```bash
pi remove git:github.com/potalora/pi-google-thought-signature-fallback@<commit-sha>
```
