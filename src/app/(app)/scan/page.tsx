import {
  listPantryLocationSuggestions,
  listPantryUnitSuggestions,
} from "@/actions/pantry";
import { getUserSettings } from "@/actions/settings";
import { ScanClient } from "@/components/ScanClient";

export default async function ScanPage() {
  const [settings, locationSuggestions, unitSuggestions] = await Promise.all([
    getUserSettings(),
    listPantryLocationSuggestions(),
    listPantryUnitSuggestions(),
  ]);
  const defaultLocation = settings?.defaultLocation ?? "";

  return (
    <ScanClient
      defaultLocation={defaultLocation}
      locationSuggestions={locationSuggestions}
      unitSuggestions={unitSuggestions}
    />
  );
}
