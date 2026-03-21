import { ScanClient } from "@/components/ScanClient";
import { getUserSettings } from "@/actions/settings";

export default async function ScanPage() {
  const settings = await getUserSettings();
  const defaultLocation = settings?.defaultLocation ?? "";

  return <ScanClient defaultLocation={defaultLocation} />;
}
