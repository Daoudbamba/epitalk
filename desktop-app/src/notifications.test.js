import { describe, it, expect } from "vitest";
import { getReadyNotificationOptions, shouldShowReadyNotification } from "./notifications";

describe("notifications.getReadyNotificationOptions", () => {
  it("retourne un titre et un corps par défaut pour EpiTalk", () => {
    const opts = getReadyNotificationOptions();
    expect(opts.title).toBe("EpiTalk est prêt");
    expect(opts.body).toContain("chat");
  });

  it("utilise le nom d'application fourni dans le titre", () => {
    const opts = getReadyNotificationOptions("MonApp");
    expect(opts.title).toBe("MonApp est prêt");
  });
});

describe("notifications.shouldShowReadyNotification", () => {
  it("retourne true uniquement au premier lancement sans focus", () => {
    expect(shouldShowReadyNotification({ isFirstLaunch: true, hasFocus: false })).toBe(true);
    expect(shouldShowReadyNotification({ isFirstLaunch: false, hasFocus: false })).toBe(false);
    expect(shouldShowReadyNotification({ isFirstLaunch: true, hasFocus: true })).toBe(false);
  });
});
