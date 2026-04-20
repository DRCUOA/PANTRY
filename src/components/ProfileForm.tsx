"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  removeAvatarAction,
  updateProfileAction,
  uploadAvatarAction,
  type AvatarState,
  type ProfileState,
} from "@/actions/settings";

const PRESET_PREFERENCES = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
  "Low carb",
  "Keto",
  "Mediterranean",
  "Low sodium",
  "High protein",
];

const PRESET_INTOLERANCES = [
  "Gluten",
  "Wheat",
  "Dairy",
  "Lactose",
  "Eggs",
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Fish",
  "Soy",
  "Sesame",
  "Sulphites",
];

type Profile = {
  timezone: string | null;
  avatarMime: string | null;
  avatarUpdatedAt: number | null;
  foodPreferences: string[];
  foodIntolerances: string[];
  foodNotes: string | null;
};

const AVATAR_INITIAL: AvatarState = { ok: false };
const PROFILE_INITIAL: ProfileState = { ok: false };

export function ProfileForm({
  profile,
  allTimezones,
}: {
  profile: Profile;
  allTimezones: string[];
}) {
  return (
    <div className="space-y-5">
      <AvatarCard hasAvatar={!!profile.avatarMime} avatarVersion={profile.avatarUpdatedAt} />
      <ProfileFieldsCard profile={profile} allTimezones={allTimezones} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function AvatarCard({
  hasAvatar,
  avatarVersion,
}: {
  hasAvatar: boolean;
  avatarVersion: number | null;
}) {
  const [state, formAction, pending] = useActionState(
    uploadAvatarAction,
    AVATAR_INITIAL,
  );
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview the freshly-picked file before the server round trip completes.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLocalError("Image is too large (max 5MB).");
      e.target.value = "";
      setPreviewUrl(null);
      return;
    }
    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(file.type)) {
      setLocalError("Use JPEG, PNG, WebP, or GIF.");
      e.target.value = "";
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset the previewed URL once the server reports success — the live image
  // behind /api/avatar is now authoritative. Using a ref for the last-seen
  // state keeps us from reacting to the same success twice.
  const lastAckedRef = useRef<AvatarState>(AVATAR_INITIAL);
  useEffect(() => {
    if (state === lastAckedRef.current) return;
    lastAckedRef.current = state;
    if (state.ok && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      // Syncs an object-URL resource lifecycle with the external server-action result.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [state, previewUrl]);

  const liveAvatarSrc = hasAvatar
    ? `/api/avatar${avatarVersion ? `?v=${avatarVersion}` : ""}`
    : null;
  const shown = previewUrl ?? liveAvatarSrc;

  return (
    <section className="ui-card space-y-4 p-4">
      <p className="font-semibold">Avatar</p>

      <div className="flex items-center gap-4">
        <div
          className="relative h-20 w-20 overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-inset)]"
          aria-hidden={shown ? undefined : true}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt="Your avatar"
              className="h-full w-full object-cover"
              width={80}
              height={80}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
              None
            </div>
          )}
        </div>

        <form action={formAction} className="flex-1 space-y-2" encType="multipart/form-data">
          <label
            htmlFor={fileInputId}
            className="ui-btn ui-btn--ghost inline-flex cursor-pointer"
          >
            Choose image…
          </label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onFileChange}
          />
          <p className="text-xs text-[var(--muted)]">
            JPEG / PNG / WebP / GIF, up to 5MB. Stored in Postgres — no disk needed.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || !previewUrl}
              className="ui-btn ui-btn--primary flex-1"
            >
              {pending ? "Uploading…" : "Upload"}
            </button>
            {hasAvatar && (
              <button
                type="button"
                onClick={async () => {
                  await removeAvatarAction();
                }}
                className="ui-btn ui-btn--ghost"
              >
                Remove
              </button>
            )}
          </div>
        </form>
      </div>

      {localError && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      )}
      {!localError && state.message && (
        <p
          className={`text-sm ${state.ok ? "text-[var(--muted)]" : "text-[var(--danger)]"}`}
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Timezone + food prefs/intolerances + notes
// ---------------------------------------------------------------------------

function ProfileFieldsCard({
  profile,
  allTimezones,
}: {
  profile: Profile;
  allTimezones: string[];
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    PROFILE_INITIAL,
  );

  // The initial source of truth for tag selection comes from the server; we
  // manage local edits client-side and mirror them into hidden fields on the
  // same form so multi-select submissions work without JS on the action side.
  const [prefs, setPrefs] = useState<string[]>(profile.foodPreferences ?? []);
  const [intols, setIntols] = useState<string[]>(profile.foodIntolerances ?? []);

  const browserTz = useMemo(() => {
    if (typeof Intl === "undefined") return null;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      return null;
    }
  }, []);

  // Merge the user's existing zone into the dropdown if it isn't in the
  // supported list for some reason — keeps the form from silently dropping it.
  const timezoneOptions = useMemo(() => {
    const base = [...allTimezones];
    if (profile.timezone && !base.includes(profile.timezone)) {
      base.push(profile.timezone);
      base.sort();
    }
    return base;
  }, [allTimezones, profile.timezone]);

  return (
    <form action={formAction} className="ui-card space-y-5 p-4">
      <div>
        <p className="font-semibold">Time zone</p>
        <p className="text-xs text-[var(--muted)]">
          We use this to interpret &ldquo;today&rdquo; across the app. Leave empty to follow
          your browser{browserTz ? ` (${browserTz})` : ""}.
        </p>
        <label className="mt-2 block">
          <select
            name="timezone"
            defaultValue={profile.timezone ?? ""}
            className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
          >
            <option value="">Use browser default{browserTz ? ` · ${browserTz}` : ""}</option>
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TagField
        legend="Food preferences"
        description="What you like to eat. Tap a chip to toggle; type below to add your own."
        name="foodPreferences"
        presets={PRESET_PREFERENCES}
        values={prefs}
        onChange={setPrefs}
      />

      <TagField
        legend="Intolerances & allergies"
        description="What to avoid. The planner will flag recipes that clash."
        name="foodIntolerances"
        presets={PRESET_INTOLERANCES}
        values={intols}
        onChange={setIntols}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Notes
        </span>
        <textarea
          name="foodNotes"
          rows={3}
          defaultValue={profile.foodNotes ?? ""}
          placeholder="Anything else worth remembering — e.g. cooking for two, dislike cilantro…"
          className="input-touch min-h-[90px] w-full resize-y rounded-lg border border-[var(--border-strong)] bg-[var(--background)] placeholder:text-[var(--muted)]"
        />
      </label>

      <div className="space-y-2">
        <button type="submit" disabled={pending} className="ui-btn ui-btn--primary w-full">
          {pending ? "Saving…" : "Save profile"}
        </button>
        {state.message && (
          <p
            className={`text-sm ${state.ok ? "text-[var(--muted)]" : "text-[var(--danger)]"}`}
            role="status"
            aria-live="polite"
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function TagField({
  legend,
  description,
  name,
  presets,
  values,
  onChange,
}: {
  legend: string;
  description: string;
  name: string;
  presets: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const customInputId = useId();

  const selectedLower = useMemo(
    () => new Set(values.map((v) => v.trim().toLowerCase())),
    [values],
  );

  function toggle(tag: string) {
    const lower = tag.trim().toLowerCase();
    if (!lower) return;
    if (selectedLower.has(lower)) {
      onChange(values.filter((v) => v.trim().toLowerCase() !== lower));
    } else {
      onChange([...values, tag.trim()]);
    }
  }

  function addDraft() {
    const t = draft.trim();
    if (!t) return;
    if (!selectedLower.has(t.toLowerCase())) {
      onChange([...values, t]);
    }
    setDraft("");
  }

  // Everything the user has selected that isn't in the preset list — so we
  // can show their custom tags back to them as removable chips.
  const presetLower = useMemo(() => new Set(presets.map((p) => p.toLowerCase())), [presets]);
  const customSelected = values.filter((v) => !presetLower.has(v.trim().toLowerCase()));

  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">{legend}</legend>
      <p className="text-xs text-[var(--muted)]">{description}</p>

      {/* Hidden inputs carry the real submitted values. */}
      {values.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <div className="ui-chip-row flex-wrap !overflow-visible">
        {presets.map((preset) => {
          const active = selectedLower.has(preset.toLowerCase());
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              data-active={active ? "true" : undefined}
              onClick={() => toggle(preset)}
              className="ui-chip"
            >
              {preset}
            </button>
          );
        })}
        {customSelected.map((tag) => (
          <button
            key={`custom-${tag}`}
            type="button"
            aria-pressed
            data-active="true"
            onClick={() => toggle(tag)}
            className="ui-chip"
            title="Remove"
          >
            {tag} ×
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          id={customInputId}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Add your own…"
          className="input-touch flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--background)] placeholder:text-[var(--muted)]"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={!draft.trim()}
          className="ui-btn ui-btn--ghost"
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}
