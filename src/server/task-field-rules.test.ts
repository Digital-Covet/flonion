import { describe, expect, it } from "vitest";
import { moveInOrder, placeInOrder } from "./task-field-rules";

describe("placeInOrder", () => {
  const ids = ["a", "b", "c"];

  it("appends by default", () => {
    expect(placeInOrder(ids, "n")).toEqual(["a", "b", "c", "n"]);
  });

  it("goes before or after a named column", () => {
    expect(placeInOrder(ids, "n", { beforeId: "b" })).toEqual([
      "a",
      "n",
      "b",
      "c",
    ]);
    expect(placeInOrder(ids, "n", { afterId: "b" })).toEqual([
      "a",
      "b",
      "n",
      "c",
    ]);
    expect(placeInOrder(ids, "n", { beforeId: "a" })).toEqual([
      "n",
      "a",
      "b",
      "c",
    ]);
    expect(placeInOrder(ids, "n", { afterId: "c" })).toEqual([
      "a",
      "b",
      "c",
      "n",
    ]);
  });

  it("says so when the named column isn't there", () => {
    expect(placeInOrder(ids, "n", { afterId: "zzz" })).toBeNull();
  });
});

describe("moveInOrder", () => {
  const ids = ["a", "b", "c"];

  it("swaps a place left or right", () => {
    expect(moveInOrder(ids, "b", "left")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(ids, "b", "right")).toEqual(["a", "c", "b"]);
  });

  it("leaves the order alone at an edge or for an unknown column", () => {
    expect(moveInOrder(ids, "a", "left")).toEqual(ids);
    expect(moveInOrder(ids, "c", "right")).toEqual(ids);
    expect(moveInOrder(ids, "zzz", "left")).toEqual(ids);
  });
});
