import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatePicker } from "./CalendarPicker";

describe("Date Field display format", () => {
  it("shows DD/MM/AAAA when empty", () => {
    const html = renderToStaticMarkup(<DatePicker label="Data" value="" onChange={() => {}} />);
    expect(html).toContain(">DD/MM/AAAA</span>");
  });

  it.each([
    ["2026-10-16", "16/10/2026"],
    ["2026-01-09", "09/01/2026"],
    ["2028-02-29", "29/02/2028"],
  ])("displays %s as %s without changing the stored format", (value, expected) => {
    const html = renderToStaticMarkup(<DatePicker label="Data" value={value} onChange={() => {}} />);
    expect(html).toContain(`>${expected}</span>`);
  });
});
