import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatePicker } from "./CalendarPicker";

describe("Date Field display format", () => {
  it("shows DD/MM/AAAA when empty", () => {
    const html = renderToStaticMarkup(<DatePicker label="Data" value="" onChange={() => {}} />);
    expect(html).toContain('placeholder="DD/MM/AAAA"');
    expect(html).toContain('value=""');
  });

  it.each([
    ["2026-10-16", "16/10/2026"],
    ["2026-01-09", "09/01/2026"],
    ["2028-02-29", "29/02/2028"],
  ])("displays %s as %s without changing the stored format", (value, expected) => {
    const html = renderToStaticMarkup(<DatePicker label="Data" value={value} onChange={() => {}} />);
    expect(html).toContain(`value="${expected}"`);
  });

  it("separates numeric manual entry from the calendar button", () => {
    const html = renderToStaticMarkup(<DatePicker label="Data" value="" onChange={() => {}} />);
    expect(html).toMatch(/<input[^>]+type="text"/);
    expect(html).toMatch(/<input[^>]+inputMode="numeric"/i);
    expect(html).toContain('maxLength="10"');
    expect(html).toMatch(/<button[^>]+aria-label="Abrir calendário: Data"[^>]+aria-haspopup="dialog"/);
    expect(html).not.toMatch(/<input[^>]+aria-haspopup/);
  });

  it("shows the exact invalid date hint and associates it with a thicker red field", () => {
    const html = renderToStaticMarkup(<DatePicker label="Data" value="33/15/1990" onChange={() => {}} />);
    expect(html).toContain("Informe uma data válida");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<input[^>]*aria-describedby="[^"]+-error"/);
    expect(html).toContain("aria-[invalid=true]:border-2");
    expect(html).toContain("aria-[invalid=true]:focus:border-negative");
  });

  it("does not show an error before an empty or incomplete field has been left", () => {
    for (const value of ["", "16/1"]) {
      const html = renderToStaticMarkup(<DatePicker label="Data" required value={value} onChange={() => {}} />);
      expect(html).not.toContain('aria-invalid="true"');
      expect(html).not.toContain("Informe uma data válida");
    }
  });
});
