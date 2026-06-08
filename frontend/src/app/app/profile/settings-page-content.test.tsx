import "@testing-library/jest-dom/vitest";

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsPageTestObject } from "./settings-page-content.to";

describe("SettingsPageContent", () => {
  it("renders ordered settings sections with read-only email and role", () => {
    const page = new SettingsPageTestObject();
    page.render();

    expect(screen.getByRole("region", { name: "Profile settings" })).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Commission & Target settings" })
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Notification settings" })
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Security settings" })).toBeVisible();
    expect(screen.getByText("ROOMAH v0.1.0")).toBeVisible();
    expect(screen.getByRole("link", { name: /privacy notice/i })).toHaveAttribute(
      "href",
      "/privacy"
    );

    const profile = page.section("Profile settings");
    expect(within(profile).getByText("ren@example.com")).toBeVisible();
    expect(within(profile).getByText("REN")).toBeVisible();
    expect(within(profile).queryByRole("textbox", { name: /email/i })).toBeNull();
  });

  it("shows the profile picture controls with an initials fallback", () => {
    const page = new SettingsPageTestObject();
    page.render();

    const profile = page.section("Profile settings");
    expect(
      within(profile).getByRole("button", { name: /upload photo/i })
    ).toBeVisible();
    expect(within(profile).getByLabelText(/profile picture/i)).toBeInTheDocument();
    expect(within(profile).getByText("RR")).toBeVisible();
    expect(
      within(profile).queryByRole("button", { name: /remove photo/i })
    ).toBeNull();
  });

  it("uploads a selected profile picture", async () => {
    const page = new SettingsPageTestObject();
    page.render();

    const file = new File(["avatar-bytes"], "avatar.png", { type: "image/png" });
    await page.uploadAvatar(file);

    expect(page.onUploadAvatar).toHaveBeenCalledTimes(1);
    expect(page.onUploadAvatar).toHaveBeenCalledWith(file);
  });

  it("renders the existing avatar and supports removal", async () => {
    const page = new SettingsPageTestObject();
    page.render({
      user: {
        email: "ren@example.com",
        full_name: "Rina Ren",
        role: "REN",
        avatar_url: "https://cdn.example.com/avatars/rina.png",
      },
    });

    const profile = page.section("Profile settings");
    expect(within(profile).getByRole("img", { name: /profile photo/i })).toHaveAttribute(
      "src",
      "https://cdn.example.com/avatars/rina.png"
    );

    await page.removeAvatar();
    expect(page.onRemoveAvatar).toHaveBeenCalledTimes(1);
  });

  it("submits editable profile fields", async () => {
    const page = new SettingsPageTestObject();
    page.render();

    await page.replaceField(/full name/i, "Alyssa Ren");
    await page.replaceField(/phone number/i, "+60123456789");
    await page.saveProfile();

    expect(page.onSaveProfile).toHaveBeenCalledWith({
      full_name: "Alyssa Ren",
      phone_number: "+60123456789",
    });
  });

  it("submits commission, target, notification, and idle timeout preferences", async () => {
    const page = new SettingsPageTestObject();
    page.render();

    await page.replaceField(/commission rate/i, "3.5");
    await page.replaceField(/personal monthly target/i, "600000");
    await page.saveCommissionTarget();

    expect(page.onSaveCommissionTarget).toHaveBeenCalledWith({
      commission_rate: 0.035,
      monthly_target_amount: 600000,
    });

    await page.user.click(
      screen.getByRole("checkbox", { name: /email follow-ups due/i })
    );
    await page.saveNotifications();

    expect(page.onSaveNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        follow_ups_due: { in_app: true, email: true },
      })
    );

    await page.user.selectOptions(
      screen.getByLabelText(/idle session timeout/i),
      "60"
    );
    await page.saveSecurity();

    expect(page.onSaveSecurity).toHaveBeenCalledWith({
      session_timeout_minutes: 60,
    });
  });

  it("validates password confirmation before submitting password changes", async () => {
    const page = new SettingsPageTestObject();
    page.render();

    await page.replaceField(/current password/i, "current-secret");
    await page.replaceField(/^new password$/i, "new-secret-1");
    await page.replaceField(/confirm new password/i, "new-secret-2");
    await page.changePassword();

    expect(page.onChangePassword).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords do not match/i)).toBeVisible();

    await page.replaceField(/confirm new password/i, "new-secret-1");
    await page.changePassword();

    expect(page.onChangePassword).toHaveBeenCalledWith({
      currentPassword: "current-secret",
      newPassword: "new-secret-1",
    });
  });
});
