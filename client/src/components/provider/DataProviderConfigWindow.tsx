/**
 * Data Provider Configuration Window
 *
 * Standalone window component for managing data provider configurations.
 * Launched from the dock's Tools dropdown menu.
 */

import { DataProviderEditor } from '@/components/provider/editors/DataProviderEditor';
import { useOpenfinTheme } from '@stern/openfin-platform';

/**
 * DataProviderConfigWindow Component
 *
 * Wraps the DataProviderEditor in a full-screen layout optimized
 * for a standalone OpenFin window.
 */
export default function DataProviderConfigWindow() {
  // Apply OpenFin theme (dark/light mode)
  useOpenfinTheme();

  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      <DataProviderEditor userId="System" />
    </div>
  );
}
