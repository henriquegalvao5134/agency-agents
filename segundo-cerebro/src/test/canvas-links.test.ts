import { describe, expect, it } from "vitest";
import { connectCards } from "../lib/canvas-links";

describe("Canvas connections", () => {
  it("connects a newly created card to an existing card", () => {
    expect(connectCards([["ideas", "writing"]], "new-card", "ideas")).toEqual([["ideas", "writing"], ["new-card", "ideas"]]);
  });
  it("does not duplicate an existing connection", () => {
    expect(connectCards([["ideas", "writing"]], "ideas", "writing")).toHaveLength(1);
  });
  it("does not connect a card to itself", () => {
    expect(connectCards([], "ideas", "ideas")).toEqual([]);
  });
});