import { describe, expect, it } from "vitest";

import { edgeFieldsFromRows, rowsFromEdge } from "./properties";

const edge = {
  function: "choose_intent",
  description: "Record the intent.",
  target: "next",
  properties: {
    intent: { type: "string", description: "What they want.", enum: ["book", "cancel"] },
    notes: { type: "string" },
  },
  required: ["intent"],
};

describe("property rows", () => {
  it("turn an edge's schema into rows", () => {
    expect(rowsFromEdge(edge)).toEqual([
      { name: "intent", type: "string", description: "What they want.", required: true, options: "book, cancel" },
      { name: "notes", type: "string", description: "", required: false, options: "" },
    ]);
  });

  it("handle an edge that collects nothing", () => {
    expect(rowsFromEdge({ function: "go", description: "Go.", target: "next" })).toEqual([]);
  });

  it("turn back into the same schema", () => {
    expect(edgeFieldsFromRows(rowsFromEdge(edge))).toEqual({
      properties: edge.properties,
      required: ["intent"],
    });
  });

  it("ignore empty allowed values", () => {
    const fields = edgeFieldsFromRows([
      { name: "slot", type: "string", description: "", required: false, options: " Tue , , Thu " },
    ]);

    expect(fields.properties?.slot).toEqual({ type: "string", enum: ["Tue", "Thu"] });
  });
});
