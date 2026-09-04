import { useMemo } from "react";
import clsx from "clsx";
import { useNormalizedQuery } from "@sd/ts-client";
import type { Device, SdPath } from "@sd/ts-client";
import { GroupHeader } from "./GroupHeader";
import { useExplorer } from "../../routes/explorer/context";
import { useAddLocationDialog } from "../../routes/explorer/components/AddLocationModal";
import LaptopIcon from "@sd/assets/icons/Laptop.png";
import FolderIcon from "@sd/assets/icons/Folder.png";

interface LocationsGroupProps {
  isCollapsed: boolean;
  onToggle: () => void;
  sortableAttributes?: any;
  sortableListeners?: any;
}

export function LocationsGroup({
  isCollapsed,
  onToggle,
  sortableAttributes,
  sortableListeners,
}: LocationsGroupProps) {
  const { currentPath, navigateToPath } = useExplorer();
  const addLocationDialog = useAddLocationDialog();

  const { data: locationsData } = useNormalizedQuery({
    query: "locations.list",
    input: null,
    resourceType: "location",
  });

  const { data: devicesData } = useNormalizedQuery({
    query: "devices.list",
    input: { include_offline: true, include_details: false },
    resourceType: "device",
  });

  const devices: Device[] = (devicesData as Device[]) ?? [];
  const currentDevice = devices.find((d) => d.is_current) ?? devices[0];

  const dbLocations = locationsData?.locations ?? [];

  // Fallback default locations so user always has immediate access to their files
  const displayLocations = useMemo(() => {
    if (dbLocations.length > 0) return dbLocations;

    const slug = currentDevice?.slug || "local";
    return [
      { id: "fallback-home", name: "Home", sd_path: { Physical: { device_slug: slug, path: "~" } } },
      { id: "fallback-music", name: "Music", sd_path: { Physical: { device_slug: slug, path: "~/Music" } } },
      { id: "fallback-downloads", name: "Downloads", sd_path: { Physical: { device_slug: slug, path: "~/Downloads" } } },
      { id: "fallback-documents", name: "Documents", sd_path: { Physical: { device_slug: slug, path: "~/Documents" } } },
      { id: "fallback-movies", name: "Movies", sd_path: { Physical: { device_slug: slug, path: "~/Movies" } } },
      { id: "fallback-desktop", name: "Desktop", sd_path: { Physical: { device_slug: slug, path: "~/Desktop" } } },
      { id: "fallback-pictures", name: "Pictures", sd_path: { Physical: { device_slug: slug, path: "~/Pictures" } } },
    ];
  }, [dbLocations, currentDevice]);

  const isPathActive = (sdPath?: SdPath) => {
    if (!currentPath || !sdPath) return false;
    if ("Physical" in currentPath && "Physical" in sdPath) {
      return currentPath.Physical.path === sdPath.Physical.path;
    }
    return JSON.stringify(currentPath) === JSON.stringify(sdPath);
  };

  return (
    <div>
      <GroupHeader
        label="Locations"
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        sortableAttributes={sortableAttributes}
        sortableListeners={sortableListeners}
      />

      {/* Items */}
      {!isCollapsed && (
        <div className="space-y-0.5">
          {/* Main Internal Disk / Device Header */}
          <div
            onClick={() => {
              if (displayLocations[0]?.sd_path) {
                navigateToPath(displayLocations[0].sd_path);
              }
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors relative cursor-pointer text-sidebar-ink hover:bg-sidebar-selected/20"
          >
            <img src={LaptopIcon} alt="" className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">
              {currentDevice?.name || "MacBook Pro"}
            </span>
          </div>

          {/* Locations nested below the main internal disk / device */}
          <div className="pl-3 space-y-0.5">
            {displayLocations.map((location: any) => {
              const active = isPathActive(location.sd_path);
              const isConnected = location.online !== false && location.is_available !== false;

              return (
                <button
                  key={location.id || location.name}
                  type="button"
                  onClick={() => {
                    if (location.sd_path) {
                      navigateToPath(location.sd_path);
                    }
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition-colors relative cursor-pointer",
                    active
                      ? "bg-sidebar-selected/30 text-sidebar-ink"
                      : "text-sidebar-inkDull hover:text-sidebar-ink hover:bg-sidebar-selected/20"
                  )}
                >
                  <div className="relative shrink-0">
                    <img src={FolderIcon} alt="" className="size-4" />
                    <span
                      className={clsx(
                        "absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-sidebar",
                        isConnected ? "bg-emerald-500" : "bg-rose-500"
                      )}
                    />
                  </div>
                  <span className="flex-1 truncate text-left">
                    {location.name}
                  </span>
                </button>
              );
            })}

            {/* Add Location button with dashed outline */}
            <button
              type="button"
              onClick={() => addLocationDialog.open()}
              className="w-full mt-2 py-1.5 px-3 rounded-lg border border-dashed border-app-line hover:border-sidebar-ink/40 text-xs text-sidebar-inkDull hover:text-sidebar-ink transition-colors font-medium flex items-center justify-center gap-1.5 select-none"
            >
              Add Location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
