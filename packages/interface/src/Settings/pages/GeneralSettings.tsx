import { useState } from "react";
import { useForm } from "react-hook-form";
import { useCoreQuery, useCoreMutation } from "../../contexts/SpacedriveContext";
import { useSidebarStore } from "@sd/ts-client";

interface DeviceSettingsForm {
  name: string;
  slug: string;
}

export function GeneralSettings() {
  const { showInternalVolumes, setShowInternalVolumes } = useSidebarStore();
  const [rememberLastTab, setRememberLastTab] = useState<boolean>(() => {
    const val = localStorage.getItem("sd_remember_last_tab");
    return val === null ? true : val === "true";
  });

  const [showImageThumbnails, setShowImageThumbnails] = useState<boolean>(() => {
    const val = localStorage.getItem("sd_show_image_thumbnails");
    return val === null ? true : val === "true";
  });

  const statusQuery = useCoreQuery({ type: "core.status", input: null as any });
  const configQuery = useCoreQuery({ type: "config.app.get", input: null as any });
  const updateDevice = useCoreMutation("device.update");
  const resetData = useCoreMutation("core.reset");

  const { data: status } = statusQuery;
  const { data: config } = configQuery;

  const deviceForm = useForm<DeviceSettingsForm>({
    values: {
      name: status?.device_info?.name || "",
      slug: status?.device_info?.slug || "",
    },
  });

  const onDeviceSubmit = deviceForm.handleSubmit(async (data) => {
    await updateDevice.mutateAsync({
      name: data.name,
      slug: data.slug,
    });
    statusQuery.refetch();
  });

  const handleResetData = () => {
    const confirmed = window.confirm(
      "Reset All Data\n\nThis will permanently delete all libraries, settings, and cached data. The app will need to be restarted. Are you sure?"
    );

    if (confirmed) {
      resetData.mutate(
        { confirm: true },
        {
          onSuccess: (result) => {
            alert(
              result.message || "Data has been reset. Please restart the application."
            );
          },
          onError: (error) => {
            alert("Error: " + (error.message || "Failed to reset data"));
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-2">General</h2>
        <p className="text-sm text-ink-dull">
          Configure general application settings.
        </p>
      </div>

      <div className="space-y-4">
        {/* Startup & Navigation */}
        <div className="p-4 bg-app-box rounded-lg border border-app-line space-y-4">
          <h3 className="text-sm font-medium text-ink">Startup & Navigation</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-sm font-medium text-ink block">
                Remember last opened tab
              </span>
              <p className="text-xs text-ink-dull">
                Automatically reopen your last visited directory or tab on startup. When disabled, Spacedrive always opens at Home.
              </p>
            </div>
            <input
              type="checkbox"
              checked={rememberLastTab}
              onChange={(e) => {
                const newVal = e.target.checked;
                setRememberLastTab(newVal);
                localStorage.setItem("sd_remember_last_tab", String(newVal));
              }}
              className="h-4 w-4 rounded border-app-line text-accent focus:ring-accent accent-accent cursor-pointer"
            />
          </div>
        </div>

        {/* Media & Previews */}
        <div className="p-4 bg-app-box rounded-lg border border-app-line space-y-4">
          <h3 className="text-sm font-medium text-ink">Media & Previews</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-sm font-medium text-ink block">
                Show image thumbnails
              </span>
              <p className="text-xs text-ink-dull">
                Display image previews in file listings and explorer views instead of generic file icons.
              </p>
            </div>
            <input
              type="checkbox"
              checked={showImageThumbnails}
              onChange={(e) => {
                const newVal = e.target.checked;
                setShowImageThumbnails(newVal);
                localStorage.setItem("sd_show_image_thumbnails", String(newVal));
                window.dispatchEvent(new Event("sd_thumbnails_setting_changed"));
              }}
              className="h-4 w-4 rounded border-app-line text-accent focus:ring-accent accent-accent cursor-pointer"
            />
          </div>
        </div>

        {/* Sidebar & Storage */}
        <div className="p-4 bg-app-box rounded-lg border border-app-line space-y-4">
          <h3 className="text-sm font-medium text-ink">Sidebar & Storage</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 max-w-[80%]">
              <span className="text-sm font-medium text-ink block">
                Show internal & system volumes
              </span>
              <p className="text-xs text-ink-dull">
                Display internal OS disk images, Cryptex assets, and system partitions in the sidebar Volumes list.
              </p>
            </div>
            <input
              type="checkbox"
              checked={showInternalVolumes}
              onChange={(e) => setShowInternalVolumes(e.target.checked)}
              className="h-4 w-4 rounded border-app-line text-accent focus:ring-accent accent-accent cursor-pointer"
            />
          </div>
        </div>

        {/* Device Configuration */}
        <form onSubmit={onDeviceSubmit} className="p-4 bg-app-box rounded-lg border border-app-line space-y-4">
          <h3 className="text-sm font-medium text-ink">Device</h3>

          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Device Name</span>
            <p className="text-xs text-ink-dull mb-2">
              User-friendly name for this device
            </p>
            <input
              type="text"
              {...deviceForm.register("name")}
              className="w-full px-3 py-2 bg-app border border-app-line rounded-md text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="My Computer"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Device Slug</span>
            <p className="text-xs text-ink-dull mb-2">
              Unique identifier for this device (alphanumeric and hyphens only)
            </p>
            <input
              type="text"
              {...deviceForm.register("slug")}
              className="w-full px-3 py-2 bg-app border border-app-line rounded-md text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              placeholder="my-computer"
            />
          </label>

          {deviceForm.formState.isDirty && (
            <button
              type="submit"
              disabled={updateDevice.isPending}
              className="px-4 py-2 bg-accent hover:bg-accent-deep text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              {updateDevice.isPending ? "Saving..." : "Save Changes"}
            </button>
          )}
        </form>

        {/* Version Info */}
        <div className="p-4 bg-app-box rounded-lg border border-app-line space-y-3">
          <h3 className="text-sm font-medium text-ink">Version Information</h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-ink">Version</span>
            <span className="text-sm text-ink-dull font-mono">
              {status?.version || "Loading..."}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-ink">Built</span>
            <span className="text-sm text-ink-dull font-mono">
              {status?.built_at || "Loading..."}
            </span>
          </div>
        </div>

        <div className="p-4 bg-app-box rounded-lg border border-app-line">
          <h3 className="text-sm font-medium text-ink mb-1">Data Directory</h3>
          <p className="text-xs text-ink-dull mb-2">Where Spacedrive stores its data</p>
          <code className="block text-xs text-ink-dull bg-app rounded px-2 py-1 overflow-x-auto">
            {config?.data_dir || status?.system?.data_directory || "Loading..."}
          </code>
        </div>

        <div className="p-4 bg-app-box rounded-lg border border-app-line">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-ink mb-1">Reset All Data</h3>
              <p className="text-xs text-ink-dull">
                Permanently delete all libraries and settings
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetData}
              disabled={resetData.isPending}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {resetData.isPending ? "Resetting..." : "Reset"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
