import { describe, it, expect } from "vitest";
import { buildMenuTemplate } from "./menu";

describe("menu.buildMenuTemplate", () => {
  it("définit un menu EpiTalk avec quitter", () => {
    const template = buildMenuTemplate();
    const appMenu = template[0];

    expect(appMenu.label).toBe("EpiTalk");
    expect(appMenu.submenu?.some((item) => item.role === "quit")).toBe(true);
  });

  it("définit un menu Affichage avec reload et devtools", () => {
    const template = buildMenuTemplate();
    const viewMenu = template[1];

    const roles = (viewMenu.submenu ?? []).map((item) => item.role);
    expect(roles).toContain("reload");
    expect(roles).toContain("toggleDevTools");
  });
});
