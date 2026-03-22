import { listPantryLocationSuggestions } from "@/actions/pantry";
import { getUserSettings } from "@/actions/settings";
import { ScanClient } from "@/components/ScanClient";

export default async function ScanPage() {
  const settings = await getUserSettings();
  const defaultLocation = settings?.defaultLocation ?? "";
  const locationSuggestions = await listPantryLocationSuggestions();

  return (
    <ScanClient defaultLocation={defaultLocation} locationSuggestions={locationSuggestions} />
  );
}
