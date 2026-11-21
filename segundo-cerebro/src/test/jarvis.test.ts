import { describe, expect, it } from "vitest";
import { getLiveConfig, validateLiveUpgrade } from "../lib/live-relay.server";

describe("Jarvis connection boundaries", () => {
  it("rejects another origin", () => {
    const request = new Request("https://app.example/api/live", { headers: { origin: "https://other.example", upgrade: "websocket" } });
    expect(validateLiveUpgrade(request)?.status).toBe(403);
  });
  it("requires a websocket on the matching origin", () => {
    const request = new Request("https://app.example/api/live", { headers: { origin: "https://app.example" } });
    expect(validateLiveUpgrade(request)?.status).toBe(426);
  });
  it("accepts the matching origin and only allows missing origin in development", () => {
    expect(validateLiveUpgrade(new Request("https://app.example/api/live", { headers: { origin: "https://app.example", upgrade: "websocket" } }))).toBeNull();
    const missing = new Request("https://app.example/api/live", { headers: { upgrade: "websocket" } });
    expect(validateLiveUpgrade(missing)?.status).toBe(403);
    expect(validateLiveUpgrade(missing, { allowMissingOrigin: true })).toBeNull();
  });
  it("keeps the live model and a Portuguese AutoGTEC opening", () => {
    const config = getLiveConfig();
    expect(config.liveModel).toBe("openai/gpt-live-1");
    expect(config.backendModel).toBe("openai/gpt-6-astra");
  });
});
