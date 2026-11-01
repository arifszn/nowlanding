"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/app/actions";
import type { Profile } from "@/lib/data";

const REGIONS = ["US", "GB", "CA", "AU", "IE", "NZ", "IN", "BD", "DE", "FR", "ES", "IT", "NL", "SE", "NO", "DK", "FI", "PL", "BR", "MX", "AR", "JP", "KR", "SG", "AE", "ZA"];

const TOGGLES: Array<[keyof Profile, string]> = [
  ["notify_popular", "Popular releases, even ones I do not follow"],
  ["notify_announced", "When a new date is announced"],
  ["notify_reminder", "A reminder before the date"],
  ["notify_released", "On release day"],
  ["notify_physical", "Blu-ray and DVD release days"],
  ["notify_episodes", "New episodes of series I follow"],
];

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, null);
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [profile.timezone];
  const regionName = new Intl.DisplayNames(["en"], { type: "region" });

  return (
    <form action={action} className="form">
      <fieldset className="fieldset">
        <legend>Where and when</legend>
        <div className="field">
          <label htmlFor="region">Country for release dates</label>
          <select id="region" name="region" defaultValue={profile.region}>
            {[...new Set([profile.region, ...REGIONS])].map((r) => <option key={r} value={r}>{regionName.of(r)}</option>)}
          </select>
          <span className="small muted">Series air dates are the same everywhere.</span>
        </div>
        <div className="field">
          <label htmlFor="timezone">Time zone</label>
          <select id="timezone" name="timezone" defaultValue={profile.timezone}>
            {[...new Set([profile.timezone, ...zones])].map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reminder_days">Reminder, days before</label>
          <input id="reminder_days" name="reminder_days" type="number" min={1} max={60} defaultValue={profile.reminder_days} style={{ maxWidth: 120 }} />
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Send me</legend>
        {TOGGLES.map(([key, label]) => (
          <label className="check" key={key}>
            <input type="checkbox" name={key} defaultChecked={Boolean(profile[key])} />
            {label}
          </label>
        ))}
      </fieldset>
      <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving" : "Save settings"}</button>
        <p role="status" className={state?.ok ? "status-ok" : "small"} style={state && !state.ok ? { color: "var(--color-error)" } : undefined}>{state?.message}</p>
      </div>
    </form>
  );
}
