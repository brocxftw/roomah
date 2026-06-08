import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  SettingsPageContent,
  type DashboardTargets,
  type SettingsUser,
} from "./settings-page-content";

const defaultUser: SettingsUser = {
  email: "ren@example.com",
  full_name: "Rina Ren",
  phone_number: "+60111111111",
  role: "REN",
  commission_rate: "0.02",
  monthly_target_amount: "500000",
  notification_preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  session_timeout_minutes: 30,
  avatar_url: null,
};

const defaultTargets: DashboardTargets = {
  target_progress: {
    scope: "personal",
    target_amount: "500000",
    current_amount: "125000",
    progress_ratio: 0.25,
    date_range: "month",
  },
  personal_progress: null,
};

export class SettingsPageTestObject {
  readonly onSaveProfile = vi.fn().mockResolvedValue(undefined);
  readonly onSaveCommissionTarget = vi.fn().mockResolvedValue(undefined);
  readonly onSaveNotifications = vi.fn().mockResolvedValue(undefined);
  readonly onSaveSecurity = vi.fn().mockResolvedValue(undefined);
  readonly onChangePassword = vi.fn().mockResolvedValue(undefined);
  readonly onSaveTeamTarget = vi.fn().mockResolvedValue(undefined);
  readonly onUploadAvatar = vi.fn().mockResolvedValue(undefined);
  readonly onRemoveAvatar = vi.fn().mockResolvedValue(undefined);
  readonly user = userEvent.setup();

  render(
    overrides: Partial<{
      user: SettingsUser;
      targets: DashboardTargets;
    }> = {}
  ) {
    render(
      <SettingsPageContent
        user={overrides.user ?? defaultUser}
        targets={overrides.targets ?? defaultTargets}
        appVersion="0.1.0"
        onSaveProfile={this.onSaveProfile}
        onSaveCommissionTarget={this.onSaveCommissionTarget}
        onSaveNotifications={this.onSaveNotifications}
        onSaveSecurity={this.onSaveSecurity}
        onChangePassword={this.onChangePassword}
        onSaveTeamTarget={this.onSaveTeamTarget}
        onUploadAvatar={this.onUploadAvatar}
        onRemoveAvatar={this.onRemoveAvatar}
      />
    );
  }

  async uploadAvatar(file: File) {
    await this.user.upload(
      within(this.section("Profile settings")).getByLabelText(
        /profile picture/i
      ),
      file
    );
  }

  async removeAvatar() {
    await this.user.click(
      within(this.section("Profile settings")).getByRole("button", {
        name: /remove photo/i,
      })
    );
  }

  section(name: string) {
    return screen.getByRole("region", { name });
  }

  async replaceField(label: RegExp | string, value: string) {
    const input = screen.getByLabelText(label);
    await this.user.clear(input);
    await this.user.type(input, value);
  }

  async saveProfile() {
    await this.user.click(
      within(this.section("Profile settings")).getByRole("button", {
        name: /save profile/i,
      })
    );
  }

  async saveCommissionTarget() {
    await this.user.click(
      within(this.section("Commission & Target settings")).getByRole("button", {
        name: /save commission and target/i,
      })
    );
  }

  async saveNotifications() {
    await this.user.click(
      within(this.section("Notification settings")).getByRole("button", {
        name: /save notification preferences/i,
      })
    );
  }

  async saveSecurity() {
    await this.user.click(
      within(this.section("Security settings")).getByRole("button", {
        name: /save security preferences/i,
      })
    );
  }

  async changePassword() {
    await this.user.click(
      within(this.section("Security settings")).getByRole("button", {
        name: /update password/i,
      })
    );
  }
}
