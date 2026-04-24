import { verifyAdminSession } from '@/lib/auth/dal';
import { CsvImportTab } from './CsvImportTab';
import { PlacesImportTab } from './PlacesImportTab';

export default async function ImportsPage() {
  await verifyAdminSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Bulk Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import restaurants via CSV upload or Google Places search. All imports land as drafts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border p-6 space-y-4">
          <h2 className="font-medium">CSV Upload</h2>
          <p className="text-sm text-muted-foreground">
            Upload a CSV with columns: name, address, city, lat, lng, phone, website,
            google_place_id, cuisine_types.
          </p>
          <CsvImportTab />
        </section>

        <section className="rounded-lg border border-border p-6 space-y-4">
          <h2 className="font-medium">Google Places Search</h2>
          <p className="text-sm text-muted-foreground">
            Search nearby restaurants using the Google Places API. Capped at 1,000 results.
          </p>
          <PlacesImportTab />
        </section>
      </div>
    </div>
  );
}
