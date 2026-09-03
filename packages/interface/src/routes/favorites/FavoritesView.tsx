import {
	House,
	Desktop,
	FileText,
	DownloadSimple,
	Image,
	FilmStrip,
	MusicNotes,
	FolderSimple,
	ArrowRight
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

interface ShortcutItem {
	name: string;
	description: string;
	path: string;
	icon: any;
	color: string;
}

const SHORTCUTS: ShortcutItem[] = [
	{
		name: "Home",
		description: "User home directory",
		path: "~",
		icon: House,
		color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
	},
	{
		name: "Desktop",
		description: "Desktop items and shortcuts",
		path: "~/Desktop",
		icon: Desktop,
		color: "text-purple-400 bg-purple-500/10 border-purple-500/20"
	},
	{
		name: "Documents",
		description: "Personal and work documents",
		path: "~/Documents",
		icon: FileText,
		color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
	},
	{
		name: "Downloads",
		description: "Downloaded files and installers",
		path: "~/Downloads",
		icon: DownloadSimple,
		color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
	},
	{
		name: "Pictures",
		description: "Photos, screenshots and graphics",
		path: "~/Pictures",
		icon: Image,
		color: "text-pink-400 bg-pink-500/10 border-pink-500/20"
	},
	{
		name: "Movies",
		description: "Videos, recordings and films",
		path: "~/Movies",
		icon: FilmStrip,
		color: "text-red-400 bg-red-500/10 border-red-500/20"
	},
	{
		name: "Music",
		description: "Audio tracks and music library",
		path: "~/Music",
		icon: MusicNotes,
		color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
	}
];

export function FavoritesView() {
	const navigate = useNavigate();

	const handleOpen = (path: string) => {
		navigate(`/explorer?path=${encodeURIComponent(path)}`);
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
					{SHORTCUTS.map((item) => {
						const IconComponent = item.icon;
						return (
							<button
								key={item.name}
								onClick={() => handleOpen(item.path)}
								className="group text-left p-4 rounded-xl bg-app-box/40 hover:bg-app-box/80 border border-app-line hover:border-white/20 transition-all duration-200 flex flex-col justify-between h-36"
							>
								<div className="flex items-center justify-between w-full">
									<div className={`p-2.5 rounded-lg border ${item.color}`}>
										<IconComponent size={22} weight="bold" />
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
									<div className="text-xs text-ink-dull truncate mt-0.5">
										{item.description}
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
