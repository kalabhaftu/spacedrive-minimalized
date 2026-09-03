import { ArrowRight } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlatform } from "../../contexts/PlatformContext";
import { useLibraryQuery } from "@sd/ts-client";
import { getIcon } from "@sd/assets/util";

interface ShortcutDef {
	name: string;
	description: string;
	defaultPath: string;
	iconName: string;
}

const SHORTCUT_DEFS: ShortcutDef[] = [
	{
		name: "Home",
		description: "User home directory",
		defaultPath: "~",
		iconName: "Home",
	},
	{
		name: "Desktop",
		description: "Desktop items and shortcuts",
		defaultPath: "~/Desktop",
		iconName: "Laptop",
	},
	{
		name: "Documents",
		description: "Personal and work documents",
		defaultPath: "~/Documents",
		iconName: "Document",
	},
	{
		name: "Downloads",
		description: "Downloaded files and installers",
		defaultPath: "~/Downloads",
		iconName: "Package",
	},
	{
		name: "Pictures",
		description: "Photos, screenshots and graphics",
		defaultPath: "~/Pictures",
		iconName: "Image",
	},
	{
		name: "Movies",
		description: "Videos, recordings and films",
		defaultPath: "~/Movies",
		iconName: "Movie",
	},
	{
		name: "Music",
		description: "Audio tracks and music library",
		defaultPath: "~/Music",
		iconName: "Audio",
	}
];

export function FavoritesView() {
	const navigate = useNavigate();
	const platform = usePlatform();
	const [resolvedPaths, setResolvedPaths] = useState<Record<string, string>>({});

	const { data: suggestedData } = useLibraryQuery({
		type: "locations.suggested",
		input: null as any
	});

	useEffect(() => {
		let isMounted = true;

		// 1. Try platform-level resolution (Tauri native dirs)
		if (platform?.getSystemDirectories) {
			platform
				.getSystemDirectories()
				.then((dirs) => {
					if (isMounted && dirs && Object.keys(dirs).length > 0) {
						setResolvedPaths((prev) => ({ ...prev, ...dirs }));
					}
				})
				.catch((err) => {
					console.warn("Failed to get system directories from platform:", err);
				});
		}

		return () => {
			isMounted = false;
		};
	}, [platform]);

	// 2. Also incorporate locations.suggested from core daemon
	useEffect(() => {
		if (suggestedData?.locations && suggestedData.locations.length > 0) {
			const coreMap: Record<string, string> = {};
			for (const loc of suggestedData.locations) {
				if (loc.name && loc.path) {
					coreMap[loc.name] = loc.path;
				}
			}
			setResolvedPaths((prev) => ({ ...coreMap, ...prev }));
		}
	}, [suggestedData]);

	const handleOpen = (item: ShortcutDef) => {
		const targetPath = resolvedPaths[item.name] || item.defaultPath;
		const sdPath = {
			Physical: {
				device_slug: "local",
				path: targetPath
			}
		};
		navigate(`/explorer?path=${encodeURIComponent(JSON.stringify(sdPath))}`);
	};

	return (
		<div className="h-full overflow-y-auto px-8 py-8 select-none">
			<div className="max-w-4xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl font-semibold text-white tracking-tight">
						Favorites & Shortcuts
					</h1>
					<p className="text-sm text-ink-dull mt-1">
						Quick access to primary local folders and directories on this device
					</p>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
					{SHORTCUT_DEFS.map((item) => {
						const iconSrc = getIcon(item.iconName, true, null, false);
						const activePath = resolvedPaths[item.name] || item.defaultPath;

						return (
							<button
								key={item.name}
								onClick={() => handleOpen(item)}
								className="group text-left p-4 rounded-xl bg-app-box/40 hover:bg-app-box/80 border border-app-line hover:border-white/20 transition-all duration-200 flex flex-col justify-between h-36 cursor-pointer"
							>
								<div className="flex items-center justify-between w-full">
									<div className="p-1.5 rounded-lg bg-app-box/60 border border-app-line/40 flex items-center justify-center">
										<img
											src={iconSrc}
											alt={item.name}
											className="w-10 h-10 object-contain drop-shadow-md transition-transform group-hover:scale-105"
										/>
									</div>
									<ArrowRight
										size={16}
										className="text-white/20 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all duration-200"
									/>
								</div>
								<div>
									<div className="text-base font-medium text-white group-hover:text-accent-bright transition-colors">
										{item.name}
									</div>
									<div className="text-xs text-ink-dull truncate mt-0.5 font-mono" title={activePath}>
										{activePath}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
