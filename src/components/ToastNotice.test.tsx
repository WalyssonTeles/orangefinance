import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToastNotice } from "./ToastNotice";

describe("top nonblocking notification", () => {
  it("places the message at the top with pointer passthrough and an independently clickable close button", () => {
    const html = renderToStaticMarkup(<ToastNotice toast={{ id: 1, message: "Informe a categoria." }} onDismiss={() => {}} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("pointer-events-none fixed");
    expect(html).toContain("top-[max(1rem,env(safe-area-inset-top))]");
    expect(html).not.toContain("bottom-");
    expect(html).toMatch(/<button[^>]*aria-label="Fechar notificação"[^>]*class="pointer-events-auto/);
    expect(html).toContain("size-11");
    expect(html).toContain("[@media(hover:hover)]:grid");
  });
  it("separates undo and close into independent targets with a safe gap", () => {
    const html = renderToStaticMarkup(<ToastNotice toast={{ id: 2, message: "Excluído", action: { label: "Desfazer", run: () => {} } }} onDismiss={() => {}} />);
    expect(html).toContain("gap-4");
    expect(html).toContain("pointer-events-auto min-h-11");
    expect(html).toContain(">Desfazer</button>");
    expect(html.match(/<button/g)).toHaveLength(2);
  });
});
