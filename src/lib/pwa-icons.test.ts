import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import config from "../../pwa-assets.config";

const publicFile = (name: string) => new URL(`../../public/${name}`, import.meta.url);

describe("PWA icons", () => {
  it("keeps the new artwork as the source without extra padding", () => {
    expect(config.images).toEqual(["public/orange-finance-icon.svg"]);
    expect(config.preset).toMatchObject({
      transparent: { padding: 0 },
      maskable: { padding: 0, resizeOptions: { background: "#FF7A1A" } },
      apple: { padding: 0, resizeOptions: { background: "#FF7A1A" } },
    });
  });

  it.each([
    ["maskable-icon-512x512.png", 512],
    ["apple-touch-icon-180x180.png", 180],
  ] as const)("fills the entire background of %s and keeps the white mark in the maskable safe zone", async (name, size) => {
    const { data, info } = await sharp(await readFile(publicFile(name)))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([size, size, 4]);
    let whitePixels = 0;
    let nonOpaquePixels = 0;
    let incorrectBorderPixels = 0;
    let maxWhiteRadius = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        if (data[offset + 3] !== 255) nonOpaquePixels++;
        if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
          if (data[offset] !== 255 || data[offset + 1] !== 122 || data[offset + 2] !== 26) {
            incorrectBorderPixels++;
          }
        }
        if (data[offset] > 245 && data[offset + 1] > 245 && data[offset + 2] > 245) {
          whitePixels++;
          maxWhiteRadius = Math.max(maxWhiteRadius, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2));
        }
      }
    }
    expect(nonOpaquePixels).toBe(0);
    expect(incorrectBorderPixels).toBe(0);
    expect(maxWhiteRadius).toBeLessThan(size * 0.4);
    expect(whitePixels).toBeGreaterThan(size * size * 0.1);
  });
});
