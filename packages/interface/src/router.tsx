import { createBrowserRouter, Navigate } from "react-router-dom";
import { Overview } from "./routes/overview";
import { ExplorerView } from "./routes/explorer";
import { ShellLayout } from "./ShellLayout";
import { JobsScreen } from "./components/JobManager";
import { DaemonManager } from "./routes/daemon";
import { TagView } from "./routes/tag";
import { FileKindsView } from "./routes/file-kinds";
import { RecentsView } from "./routes/explorer/views/RecentsView";
import { FavoritesView } from "./routes/favorites/FavoritesView";
import { Settings } from "./routes/settings";
import { NotFound } from "./routes/NotFound";

/**
 * Router routes configuration (without router instance)
 */
export const explorerRoutes = [
	{
		path: "/",
		element: <ShellLayout />,
		children: [
			{
				index: true,
				element: <Overview />,
			},
			{
				path: "explorer",
				element: <ExplorerView />,
			},
			{
				path: "favorites",
				element: <FavoritesView />,
			},
			{
				path: "recents",
				element: <RecentsView />,
			},
			{
				path: "file-kinds",
				element: <FileKindsView />,
			},
			{
				path: "tag/:tagId",
				element: <TagView />,
			},
			{
				path: "search",
				element: (
					<div className="flex items-center justify-center h-full text-ink">
						Search
					</div>
				),
			},
			{
				path: "jobs",
				element: <JobsScreen />,
			},
			{
				path: "daemon",
				element: <DaemonManager />,
			},
			{
				path: "settings",
				element: <Settings />,
			},
			{
				path: "settings/:page",
				element: <Settings />,
			},
			{
				path: "sync",
				element: <Navigate to="/" replace />,
			},
			{
				path: "sources",
				element: <Navigate to="/" replace />,
			},
			{
				path: "sources/:sourceId",
				element: <Navigate to="/" replace />,
			},
			{
				path: "*",
				element: <NotFound />,
			},
		],
	},
];

/**
 * Router for the main Explorer interface
 */
export function createExplorerRouter(): ReturnType<typeof createBrowserRouter> {
	return createBrowserRouter(explorerRoutes);
}
