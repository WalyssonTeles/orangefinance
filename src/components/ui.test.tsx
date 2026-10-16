import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoneyInput } from "./MoneyInput";
import { Field, Switch } from "./ui";

describe("precise form control targets", () => {
  it("keeps labels and hints outside interactive labels while naming nested native inputs", () => {
    const html = renderToStaticMarkup(<Field label="Descrição" hint="Texto de ajuda"><div><input /></div></Field>);
    expect(html).not.toContain("<label");
    const labelId = html.match(/<span id="([^"]+)"[^>]*>Descrição/)?.[1];
    const hintId = html.match(/<span id="([^"]+)"[^>]*>Texto de ajuda/)?.[1];
    expect(labelId).toBeTruthy();
    expect(hintId).toBeTruthy();
    expect(html).toMatch(new RegExp(`<input[^>]*aria-labelledby="${labelId}"`));
    expect(html).toMatch(new RegExp(`<input[^>]*aria-describedby="${hintId}"`));
  });

  it("preserves explicit accessible names and descriptions", () => {
    const html = renderToStaticMarkup(<Field label="Campo"><input aria-label="Nome específico" aria-describedby="extra" /></Field>);
    expect(html).toMatch(/<input[^>]*aria-label="Nome específico"[^>]*aria-describedby="extra"/);
    expect(html).not.toMatch(/<input[^>]*aria-labelledby/);
  });

  it("makes only the switch control a button", () => {
    const html = renderToStaticMarkup(<Switch label="Recebido" checked onChange={() => {}} />);
    expect(html).toContain("<span>Recebido</span><button");
    expect(html).toContain('aria-label="Recebido"');
    expect(html).toContain('role="switch"');
    expect(html).not.toMatch(/<button[^>]*>Recebido/);
  });

  it("does not forward clicks from the currency prefix", () => {
    const html = renderToStaticMarkup(<MoneyInput label="Valor" value={100} onChange={() => {}} />);
    expect(html).not.toContain("<label");
    expect(html).toContain('aria-label="Valor"');
  });
});
