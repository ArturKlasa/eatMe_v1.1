'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAdminRestaurantBasics } from './actions/restaurant';

interface Props {
  restaurantId: string;
  name: string;
  description: string | null;
  address: string;
  city: string | null;
  phone: string | null;
  website: string | null;
  // Read-only metadata rendered in the same card. restaurant_type and
  // cuisine_types aren't covered by updateAdminRestaurantBasics, so they stay
  // display-only here.
  ownerId: string | null;
  restaurantType: string | null;
  cuisineTypes: string[] | null;
  createdAt: string | null;
}

type Draft = {
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  website: string;
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground break-all">{value || '—'}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <label className="text-xs">
      <span className="block text-muted-foreground mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
      />
    </label>
  );
}

export function BasicInfoSection({
  restaurantId,
  name,
  description,
  address,
  city,
  phone,
  website,
  ownerId,
  restaurantType,
  cuisineTypes,
  createdAt,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const initialDraft = (): Draft => ({
    name,
    description: description ?? '',
    address,
    city: city ?? '',
    phone: phone ?? '',
    website: website ?? '',
  });
  const [draft, setDraft] = useState<Draft>(initialDraft);

  const set = (key: keyof Draft) => (value: string) => setDraft(d => ({ ...d, [key]: value }));

  function handleSave() {
    setError('');
    if (draft.name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    startTransition(async () => {
      // Empty strings are passed through — the action coerces them to null
      // (description/city/phone/website) or '' (address) so fields can be
      // cleared. country/currency are deliberately omitted: they belong to
      // LocationCurrencySection and the action leaves absent fields untouched.
      const result = await updateAdminRestaurantBasics(restaurantId, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        address: draft.address.trim(),
        city: draft.city.trim(),
        phone: draft.phone.trim(),
        website: draft.website.trim(),
      });
      if (!result.ok) {
        const fieldMsg = result.fieldErrors
          ? Object.entries(result.fieldErrors)
              .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
              .join('; ')
          : null;
        setError(fieldMsg || result.formError || 'Update failed');
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  }

  if (!isEditing) {
    return (
      <section className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Basic info</h2>
          <button
            type="button"
            onClick={() => {
              setDraft(initialDraft());
              setError('');
              setIsEditing(true);
            }}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        <InfoRow label="ID" value={restaurantId} />
        <InfoRow label="Owner" value={ownerId} />
        <InfoRow label="Description" value={description} />
        <InfoRow label="Address" value={address} />
        <InfoRow label="City" value={city} />
        <InfoRow label="Phone" value={phone} />
        <InfoRow label="Website" value={website} />
        <InfoRow label="Type" value={restaurantType} />
        <InfoRow label="Cuisines" value={cuisineTypes?.join(', ') ?? null} />
        <InfoRow label="Created" value={createdAt ? new Date(createdAt).toLocaleString() : null} />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-primary/40 bg-muted/20 p-4 space-y-3">
      <h2 className="font-semibold text-sm">Basic info</h2>

      <Field label="Name" value={draft.name} onChange={set('name')} disabled={isPending} />

      <label className="block text-xs">
        <span className="block text-muted-foreground mb-1">Description</span>
        <textarea
          value={draft.description}
          onChange={e => set('description')(e.target.value)}
          disabled={isPending}
          rows={3}
          placeholder="Shown to consumers in the mobile app (optional)"
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50 resize-y"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Address"
          value={draft.address}
          onChange={set('address')}
          disabled={isPending}
        />
        <Field label="City" value={draft.city} onChange={set('city')} disabled={isPending} />
        <Field
          label="Phone"
          value={draft.phone}
          onChange={set('phone')}
          disabled={isPending}
          placeholder="+52 55 1234 5678"
        />
        <Field
          label="Website"
          value={draft.website}
          onChange={set('website')}
          disabled={isPending}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-1 pt-1 border-t border-border/60">
        <InfoRow label="ID" value={restaurantId} />
        <InfoRow label="Owner" value={ownerId} />
        <InfoRow label="Type" value={restaurantType} />
        <InfoRow label="Cuisines" value={cuisineTypes?.join(', ') ?? null} />
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setError('');
          }}
          disabled={isPending}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
