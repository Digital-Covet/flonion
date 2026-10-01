import { describe, expect, it } from "vitest";
import {
  convertFieldValue,
  copyFieldTitle,
  defaultFieldTitle,
  fitsFieldType,
  normalizeFieldTitle,
  parseFieldInput,
  safeHref,
} from "./task-fields";

describe("parseFieldInput", () => {
  it("parses numbers, tolerating separators and rejecting words", () => {
    expect(parseFieldInput("number", "1,250.5")).toEqual({ value: 1250.5 });
    expect(parseFieldInput("number", "  ")).toEqual({ value: null });
    expect(parseFieldInput("number", "twelve")).toHaveProperty("error");
  });

  it("splits tags, trims, and drops case-insensitive duplicates", () => {
    expect(parseFieldInput("tags", "Design, urgent ,design;; Ops")).toEqual({
      value: ["Design", "urgent", "Ops"],
    });
    expect(parseFieldInput("tags", " , ")).toEqual({ value: null });
  });

  it("validates dates and checkbox state", () => {
    expect(parseFieldInput("date", "2026-10-05")).toEqual({
      value: "2026-10-05",
    });
    expect(parseFieldInput("date", "5/10/2026")).toHaveProperty("error");
    expect(parseFieldInput("checkbox", true)).toEqual({ value: true });
    expect(parseFieldInput("checkbox", false)).toEqual({ value: null });
  });

  it("rejects an unsafe link", () => {
    expect(parseFieldInput("link", "javascript:alert(1)")).toHaveProperty(
      "error",
    );
  });
});

describe("safeHref", () => {
  it("only accepts web and email links", () => {
    expect(safeHref("example.com/a")).toBe("https://example.com/a");
    expect(safeHref("me@example.com")).toBe("mailto:me@example.com");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("not a link")).toBeNull();
  });
});

describe("fitsFieldType", () => {
  it("checks stored values against the column's type", () => {
    expect(fitsFieldType("number", 3)).toBe(true);
    expect(fitsFieldType("number", "3")).toBe(false);
    expect(fitsFieldType("number", Number.NaN)).toBe(false);
    expect(fitsFieldType("checkbox", true)).toBe(true);
    expect(fitsFieldType("checkbox", false)).toBe(false);
    expect(fitsFieldType("tags", ["a", "b"])).toBe(true);
    expect(fitsFieldType("tags", [])).toBe(false);
    expect(fitsFieldType("tags", ["a", 1])).toBe(false);
    expect(fitsFieldType("date", "2026-10-05")).toBe(true);
    expect(fitsFieldType("date", "tomorrow")).toBe(false);
    expect(fitsFieldType("text", "")).toBe(false);
    expect(fitsFieldType("text", "x".repeat(501))).toBe(false);
  });

  it("never lets an unsafe address through as a link", () => {
    expect(fitsFieldType("link", "https://example.com")).toBe(true);
    expect(fitsFieldType("link", "javascript:alert(1)")).toBe(false);
  });
});

describe("convertFieldValue", () => {
  it("keeps a value when the type doesn't change", () => {
    expect(convertFieldValue("text", "text", "hi")).toBe("hi");
  });

  it("carries values across through plain text", () => {
    expect(convertFieldValue("text", "number", "42")).toBe(42);
    expect(convertFieldValue("text", "number", "soon")).toBeNull();
    expect(convertFieldValue("number", "text", 3.5)).toBe("3.5");
    expect(convertFieldValue("text", "tags", "a, b")).toEqual(["a", "b"]);
    expect(convertFieldValue("tags", "text", ["a", "b"])).toBe("a, b");
    expect(convertFieldValue("text", "date", "2026-10-05")).toBe("2026-10-05");
    expect(convertFieldValue("text", "date", "tomorrow")).toBeNull();
    expect(convertFieldValue("link", "text", "https://x.dev")).toBe(
      "https://x.dev",
    );
    expect(convertFieldValue("text", "link", "not a link")).toBeNull();
    expect(convertFieldValue("richtext", "text", "a **b**")).toBe("a **b**");
  });

  it("turns yes-like values into a ticked checkbox and nothing else", () => {
    expect(convertFieldValue("text", "checkbox", "Yes")).toBe(true);
    expect(convertFieldValue("text", "checkbox", "maybe")).toBeNull();
    expect(convertFieldValue("number", "checkbox", 2)).toBe(true);
    expect(convertFieldValue("number", "checkbox", 0)).toBeNull();
  });

  it("carries a ticked checkbox over as Yes or 1", () => {
    expect(convertFieldValue("checkbox", "text", true)).toBe("Yes");
    expect(convertFieldValue("checkbox", "number", true)).toBe(1);
    expect(convertFieldValue("checkbox", "date", true)).toBeNull();
  });
});

describe("copyFieldTitle", () => {
  it("adds copy, then numbers further copies", () => {
    expect(copyFieldTitle("Cost", ["Cost"])).toBe("Cost copy");
    expect(copyFieldTitle("Cost", ["Cost", "Cost copy"])).toBe("Cost copy 2");
    expect(copyFieldTitle("Cost", ["cost copy", "Cost copy 2"])).toBe(
      "Cost copy 3",
    );
  });

  it("stays inside the title limit", () => {
    expect(copyFieldTitle("x".repeat(40), []).length).toBeLessThanOrEqual(40);
  });
});

describe("column titles", () => {
  it("names a new column after its type, numbering repeats", () => {
    expect(defaultFieldTitle("tags", [])).toBe("Tags");
    expect(defaultFieldTitle("tags", ["Tags"])).toBe("Tags 2");
    expect(defaultFieldTitle("tags", ["tags", "Tags 2"])).toBe("Tags 3");
  });

  it("trims and caps a title, falling back to the type's name when blank", () => {
    expect(normalizeFieldTitle("  Spec ", "link")).toBe("Spec");
    expect(normalizeFieldTitle(" ", "link")).toBe("Link");
    expect(normalizeFieldTitle("x".repeat(80), "text")).toHaveLength(40);
  });
});
