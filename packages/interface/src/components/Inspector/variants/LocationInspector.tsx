import {
	Info,
	Gear,
	Briefcase,
	ClockCounterClockwise,
	HardDrive,
	DotsThree,
	Sparkle,
	Image,
	MagnifyingGlass,
	Trash,
	FunnelX,
	ToggleLeft,
	ToggleRight,
	X,
	Play,
	FilmStrip,
	VideoCamera,
	FolderOpen,
	ArrowsClockwise,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
	InfoRow,
	Section,
	Divider,
	Tabs,
	TabContent,
} from "../Inspector";
import clsx from "clsx";
import type { Location } from "@sd/ts-client";
import { Button, Dialog, dialogManager, useDialog, CircleButton, type UseDialogProps } from "@spacedrive/primitives";
import { useLibraryMutation, useNormalizedQuery } from "../../../contexts/SpacedriveContext";
import { useJobsContext } from "../../../components/JobManager/hooks/JobsContext";
import { useContextMenu } from "../../../hooks/useContextMenu";
import LocationIcon from "@sd/assets/icons/Location.png";

interface LocationInspectorProps {
	location: Location;
}

export function LocationInspector({ location }: LocationInspectorProps) {
	const [activeTab, setActiveTab] = useState("overview");

	const tabs = [
		{ id: "overview", label: "Overview", icon: Info },
		{ id: "indexing", label: "Indexing", icon: Gear },
		{ id: "jobs", label: "Jobs", icon: Briefcase },
		{ id: "activity", label: "Activity", icon: ClockCounterClockwise },
		{ id: "devices", label: "Devices", icon: HardDrive },
		{ id: "more", label: "More", icon: DotsThree },
	];

	return (
		<>
			{/* Tabs */}
			<Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

			{/* Tab Content */}
			<div className="flex-1 overflow-hidden flex flex-col mt-2.5">
				<TabContent id="overview" activeTab={activeTab}>
					<OverviewTab location={location} />
				</TabContent>

				<TabContent id="indexing" activeTab={activeTab}>
					<IndexingTab location={location} />
				</TabContent>

				<TabContent id="jobs" activeTab={activeTab}>
					<JobsTab location={location} />
				</TabContent>

				<TabContent id="activity" activeTab={activeTab}>
					<ActivityTab location={location} />
				</TabContent>

				<TabContent id="devices" activeTab={activeTab}>
					<DevicesTab location={location} />
				</TabContent>

				<TabContent id="more" activeTab={activeTab}>
					<MoreTab location={location} />
				</TabContent>
			</div>
		</>
	);
}

function OverviewTab({ location }: { location: Location }) {
	const rescanLocation = useLibraryMutation("locations.rescan");
	const routeLocation = useLocation();
	const navigate = useNavigate();
	const isOverview = routeLocation.pathname === '/';

	const reindexMenu = useContextMenu({
		items: [
			{
				icon: MagnifyingGlass,
				label: "Quick Reindex",
				onClick: () => {
					rescanLocation.mutate({
						location_id: location.id,
						full_rescan: false,
					});
				},
			},
			{
				icon: Sparkle,
				label: "Full Reindex",
				onClick: () => {
					rescanLocation.mutate({
						location_id: location.id,
						full_rescan: true,
					});
				},
			},
		],
	});

	const formatBytes = (bytes: number | null | undefined) => {
		if (!bytes || bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const { jobs } = useJobsContext();
	const activeJob = jobs.find((j: any) => {
		if (j.status !== "running" && j.status !== "queued" && j.status !== "paused") return false;
		if (j.location_id === location.id) return true;
		const inputPath = j.action_context?.action_input?.path || j.action_context?.context?.path;
		const locPath = 'Physical' in (location.sd_path || {}) ? (location.sd_path as any).Physical?.path : null;
		if (inputPath && locPath && inputPath === locPath) return true;
		return false;
	});

	const formatScanState = (scanState: any) => {
		if (activeJob) {
			const progressPercent = Math.round((activeJob.progress || 0) * 100);
			if (activeJob.status === "paused") return `Paused (${progressPercent}%)`;
			if (activeJob.status === "queued") return "Queued";
			return progressPercent > 0 ? `Scanning (${progressPercent}%)` : "Scanning...";
		}
		if (!scanState) return "Idle";
		if (typeof scanState === "string") {
			const s = scanState.toLowerCase();
			if (s === "pending") return "Pending";
			if (s === "running" || s === "scanning") return "Scanning";
			if (s === "completed") return "Completed";
			if (s === "failed" || s === "error") return "Failed";
			if (s === "idle" || s === "unknown") return "Idle";
			return scanState.charAt(0).toUpperCase() + scanState.slice(1);
		}
		if (scanState.Idle) return "Idle";
		if (scanState.Scanning) return `Scanning ${scanState.Scanning.progress}%`;
		if (scanState.Completed) return "Completed";
		if (scanState.Failed) return "Failed";
		return "Idle";
	};

	return (
		<div className="no-scrollbar mask-fade-out flex flex-col space-y-5 overflow-x-hidden overflow-y-scroll pb-10">
			{/* Location icon */}
			<div className="flex justify-center h-48 items-center w-full px-4">
				<img src={LocationIcon} className="size-24" alt="Location" />
			</div>

			{/* Location name */}
			<div className="px-2 text-center">
				<h4 className="text-sm font-semibold text-sidebar-ink truncate">
					{location.name || "Unnamed Location"}
				</h4>
				<p className="text-xs text-sidebar-inkDull mt-0.5">
					Local Storage
				</p>
			</div>

			<Divider />

			{/* Action Buttons */}
			<div className="px-2 mb-5 flex gap-2">
				{isOverview && (
					<CircleButton
						icon={FolderOpen}
						onClick={() => {
							const encodedPath = encodeURIComponent(JSON.stringify(location.sd_path));
							navigate(`/explorer?path=${encodedPath}`);
						}}
						className="flex-1"
					>
						Open Location
					</CircleButton>
				)}

				<CircleButton
					icon={ArrowsClockwise}
					onClick={reindexMenu.show}
					title="Reindex location"
				/>
			</div>

			{/* Details */}
			<Section title="Details" icon={Info}>
				<InfoRow label="Path" value={'Physical' in location.sd_path ? location.sd_path.Physical.path : 'Cloud' in location.sd_path ? location.sd_path.Cloud.path : location.name} mono />
			{location.file_count != null && (
				<InfoRow
					label="Total Files"
					value={location.file_count?.toLocaleString() ?? "0"}
				/>
			)}
				<InfoRow
					label="Total Size"
					value={formatBytes(location.total_size)}
				/>
				<InfoRow label="Scan State" value={formatScanState(location.scan_state)} />
				{location.last_scan_at && (
					<InfoRow
						label="Last Scan"
						value={formatDate(location.last_scan_at)}
					/>
				)}
			</Section>

			{/* Index Mode */}
			<Section title="Index Mode" icon={Gear}>
				<InfoRow
					label="Mode"
					value={
						location.index_mode.charAt(0).toUpperCase() +
						location.index_mode.slice(1)
					}
				/>
			</Section>
		</div>
	);
}

function IndexingTab({ location }: { location: Location }) {
	const [indexMode, setIndexMode] = useState<"shallow" | "content" | "deep">(
		(location.index_mode as "shallow" | "content" | "deep") || "deep",
	);
	const enableIndexing = useLibraryMutation("locations.enable_indexing");

	const handleModeChange = async (mode: "shallow" | "content" | "deep") => {
		setIndexMode(mode);
		try {
			await enableIndexing.mutateAsync({
				id: location.id,
				index_mode: mode,
			});
		} catch (error) {
			console.error("Failed to update index mode:", error);
		}
	};

	const [ignoreRules, setIgnoreRules] = useState([
		".git",
		"node_modules",
		"*.tmp",
		".DS_Store",
	]);

	return (
		<div className="no-scrollbar mask-fade-out flex flex-col space-y-5 overflow-x-hidden overflow-y-scroll pb-10 px-2 pt-2">
			<Section title="Index Mode" icon={Gear}>
				<p className="text-xs text-sidebar-ink mb-3">
					Controls how deeply this location is indexed
				</p>

				<div className="space-y-2">
					<RadioOption
						value="shallow"
						label="Shallow"
						description="Just filesystem metadata (fastest)"
						checked={indexMode === "shallow"}
						onChange={() => handleModeChange("shallow")}
					/>
					<RadioOption
						value="content"
						label="Content"
						description="Generate content identities"
						checked={indexMode === "content"}
						onChange={() => handleModeChange("content")}
					/>
					<RadioOption
						value="deep"
						label="Deep"
						description="Full indexing with thumbnails and text extraction"
						checked={indexMode === "deep"}
						onChange={() => handleModeChange("deep")}
					/>
				</div>
			</Section>

			<Section title="Ignore Rules" icon={FunnelX}>
				<p className="text-xs text-sidebar-inkDull mb-3">
					Files and folders matching these patterns will be ignored
				</p>

				<div className="space-y-1">
					{ignoreRules.map((pattern, i) => (
						<IgnoreRule
							key={i}
							pattern={pattern}
							onRemove={() => {
								setIgnoreRules(
									ignoreRules.filter((_, idx) => idx !== i),
								);
							}}
						/>
					))}
				</div>

				<button className="mt-2 text-xs text-accent hover:text-accent/80 transition-colors">
					+ Add Rule
				</button>
			</Section>
		</div>
	);
}

function JobsTab({ location }: { location: Location }) {
	const updateLocation = useLibraryMutation("locations.update");
	const triggerJob = useLibraryMutation("locations.triggerJob");

	const updatePolicy = async (
		updates: Partial<typeof location.job_policies>,
	) => {
		await updateLocation.mutateAsync({
			id: location.id,
			name: null,
			job_policies: {
				...location.job_policies,
				...updates,
			},
		});
	};

	const thumbnails = location.job_policies?.thumbnail?.enabled ?? true;
	const thumbstrips = location.job_policies?.thumbstrip?.enabled ?? true;
	const proxies = location.job_policies?.proxy?.enabled ?? false;
	const ocr = location.job_policies?.ocr?.enabled ?? false;
	const speech = location.job_policies?.speech_to_text?.enabled ?? false;

	return (
		<div className="no-scrollbar mask-fade-out flex flex-col space-y-5 overflow-x-hidden overflow-y-scroll pb-10 px-2 pt-2">
			<p className="text-xs text-sidebar-inkDull">
				Configure which processing jobs run automatically for this
				location
			</p>

			<Section title="Media Processing" icon={Image}>
				<div className="space-y-2.5">
					<JobConfigRow
						label="Generate Thumbnails"
						description="Create preview thumbnails for images and videos"
						enabled={thumbnails}
						onToggle={(enabled) =>
							updatePolicy({
								thumbnail: {
									sizes: [],
									quality: 80,
									regenerate: false,
									...location.job_policies?.thumbnail,
									enabled,
								},
							})
						}
						onTrigger={() =>
							triggerJob.mutate({
								location_id: location.id,
								job_type: "thumbnail",
								force: false,
							})
						}
						isTriggering={triggerJob.isPending}
					/>
					<JobConfigRow
						label="Generate Thumbstrips"
						description="Create video storyboard grids (5×5 grid of frames)"
						enabled={thumbstrips}
						onToggle={(enabled) =>
							updatePolicy({
								thumbstrip: {
									regenerate: false,
									...location.job_policies?.thumbstrip,
									enabled,
								},
							})
						}
						onTrigger={() =>
							triggerJob.mutate({
								location_id: location.id,
								job_type: "thumbstrip",
								force: false,
							})
						}
						isTriggering={triggerJob.isPending}
						icon={FilmStrip}
					/>
					<JobConfigRow
						label="Generate Proxies"
						description="Create scrubbing proxies for videos (180p @ 15fps)"
						enabled={proxies}
						onToggle={(enabled) =>
							updatePolicy({
								proxy: {
									regenerate: false,
									...location.job_policies?.proxy,
									enabled,
								},
							})
						}
						onTrigger={() =>
							triggerJob.mutate({
								location_id: location.id,
								job_type: "thumbnail" as const,
								force: false,
							})
						}
						isTriggering={triggerJob.isPending}
						icon={VideoCamera}
					/>
				</div>
			</Section>

			<Section title="AI Processing" icon={Sparkle}>
				<div className="space-y-2.5">
					<JobConfigRow
						label="Extract Text (OCR)"
						description="Scan images for text content"
						enabled={ocr}
						onToggle={(enabled) =>
							updatePolicy({
								ocr: {
									languages: ['eng'],
									min_confidence: 0.5,
									reprocess: false,
									...location.job_policies?.ocr,
									enabled,
								},
							})
						}
						onTrigger={() =>
							triggerJob.mutate({
								location_id: location.id,
								job_type: "ocr",
								force: false,
							})
						}
						isTriggering={triggerJob.isPending}
					/>
					<JobConfigRow
						label="Speech to Text"
						description="Transcribe audio and video files"
						enabled={speech}
						onToggle={(enabled) =>
							updatePolicy({
								speech_to_text: {
									language: null,
									model: 'base',
									reprocess: false,
									...location.job_policies?.speech_to_text,
									enabled,
								},
							})
						}
						onTrigger={() =>
							triggerJob.mutate({
								location_id: location.id,
								job_type: "speech_to_text",
								force: false,
							})
						}
						isTriggering={triggerJob.isPending}
					/>
				</div>
			</Section>
		</div>
	);
}

function ActivityTab({ location }: { location: Location }) {
	const { jobs } = useJobsContext();
	const locationJobs = jobs.filter((j: any) => j.location_id === location.id || !j.location_id);

	return (
		<div className="no-scrollbar mask-fade-out flex flex-col space-y-4 overflow-x-hidden overflow-y-scroll pb-10 px-2 pt-2">
			<p className="text-xs text-sidebar-inkDull">
				Recent indexing activity and job history
			</p>

			{locationJobs.length > 0 ? (
				<div className="space-y-1">
					{locationJobs.map((job: any, i: number) => (
						<div
							key={job.id || i}
							className="flex items-start gap-3 p-2 hover:bg-app-box/40 rounded-lg transition-colors"
						>
							<ClockCounterClockwise
								className={clsx(
									"size-4 shrink-0 mt-0.5",
									job.status === "running" ? "text-accent animate-spin" : "text-sidebar-inkDull"
								)}
								weight="bold"
							/>
							<div className="flex-1 min-w-0">
								<div className="text-xs font-medium text-sidebar-ink capitalize">
									{job.name?.replace(/_/g, " ") || "Background Job"}
								</div>
								<div className="text-[11px] text-sidebar-inkDull mt-0.5">
									{job.status} {job.progress ? `· ${Math.round(job.progress * 100)}%` : ""}
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="py-6 text-center text-xs text-sidebar-inkDull space-y-1">
					<p>No active background jobs</p>
					{location.last_scan_at && (
						<p className="text-[11px]">Last scan: {new Date(location.last_scan_at).toLocaleString()}</p>
					)}
				</div>
			)}
		</div>
	);
}

function DevicesTab({ location: _location }: { location: Location }) {
	const { data: devicesData } = useNormalizedQuery({
		query: "devices.list",
		input: { include_offline: true, include_details: false },
		resourceType: "device",
	});

	const devices = ((devicesData as any) ?? []).map((d: any) => ({
		name: d.name || "Local Device",
		status: (d.is_online !== false ? "online" : "offline") as "online" | "offline",
		isCurrent: d.is_current,
	}));

	return (
		<div className="no-scrollbar mask-fade-out flex flex-col space-y-4 overflow-x-hidden overflow-y-scroll pb-10 px-2 pt-2">
			<p className="text-xs text-sidebar-inkDull">
				Devices that have access to this location
			</p>

			<div className="space-y-2">
				{devices.length === 0 ? (
					<div className="py-6 text-center text-xs text-sidebar-inkDull">
						No devices found
					</div>
				) : (
					devices.map((device: any, i: number) => (
						<div
							key={i}
							className="p-2.5 bg-app-box/40 rounded-lg border border-app-line/50"
						>
							<div className="flex items-center gap-2">
								<HardDrive
									className="size-4 text-accent"
									weight="bold"
								/>
								<div className="flex-1 min-w-0">
									<div className="text-xs font-medium text-sidebar-ink flex items-center gap-1.5">
										<span>{device.name}</span>
										{device.isCurrent && (
											<span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.2 rounded font-normal">This Device</span>
										)}
									</div>
									<div className="text-[11px] text-sidebar-inkDull flex items-center gap-1 mt-0.5">
										<div
											className={clsx(
												"size-1.5 rounded-full",
												device.status === "online"
													? "bg-green-500"
													: "bg-sidebar-inkDull",
											)}
										/>
										<span>
											{device.status === "online"
												? "Online"
												: "Offline"}
										</span>
									</div>
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

interface DeleteLocationDialogProps extends UseDialogProps {
	locationId: string;
	locationName: string;
}

function useDeleteLocationDialog() {
	return (locationId: string, locationName: string) => {
		const controller = dialogManager.create((props: UseDialogProps) => (
			<DeleteLocationDialog {...props} locationId={locationId} locationName={locationName} />
		));
		controller.open();
		return controller;
	};
}

function DeleteLocationDialog({ locationId, locationName, ...props }: DeleteLocationDialogProps) {
	const dialog = useDialog(props);
	const form = useForm();
	const queryClient = useQueryClient();
	const removeLocation = useLibraryMutation("locations.remove", {
		onSuccess: () => {
			// Manually invalidate the locations query until the backend emits ResourceDeleted events
			// This forces a refetch so the location disappears from the sidebar immediately
			queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === "query:locations.list";
				},
			});

			// Close the dialog
			dialogManager.setState(dialog.id, { open: false });
		},
	});

	const handleDelete = async () => {
		try {
			await removeLocation.mutateAsync({
				location_id: String(locationId),
			});
		} catch (error) {
			console.error("Failed to remove location:", error);
		}
	};

	return (
		<Dialog
			dialog={dialog}
			form={form}
			title="Remove Location"
			description={`Are you sure you want to remove "${locationName}"? Your files will not be deleted from disk.`}
			icon={<Trash className="text-red-400" weight="bold" />}
			ctaLabel="Remove Location"
			ctaDanger
			cancelLabel="Cancel"
			cancelBtn
			onSubmit={form.handleSubmit(handleDelete)}
			loading={removeLocation.isPending}
		/>
	);
}

function MoreTab({ location }: { location: Location }) {
	const openDeleteDialog = useDeleteLocationDialog();

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="no-scrollbar mask-fade-out flex flex-col space-y-5 overflow-x-hidden overflow-y-scroll pb-10 px-2 pt-2">
			<Section title="Advanced" icon={Gear}>
				<InfoRow
					label="Location ID"
					value={String(location.id).slice(0, 8) + "..."}
					mono
				/>
				{location.created_at && (
					<InfoRow
						label="Created"
						value={formatDate(location.created_at)}
					/>
				)}
				{location.last_scan_at && (
					<InfoRow
						label="Last Scan"
						value={formatDate(location.last_scan_at)}
					/>
				)}
			</Section>

			<Section title="Danger Zone" icon={Trash}>
				<p className="text-xs text-sidebar-inkDull mb-3">
					Removing this location will not delete your files
				</p>
				<button
					onClick={() => openDeleteDialog(location.id, location.name)}
					className="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-medium text-red-400 transition-colors"
				>
					<div className="flex items-center justify-center gap-2">
						<Trash className="size-4" weight="bold" />
						<span>Remove Location</span>
					</div>
				</button>
			</Section>
		</div>
	);
}

// Helper Components

interface RadioOptionProps {
	value: string;
	label: string;
	description: string;
	checked: boolean;
	onChange: () => void;
}

function RadioOption({
	value: _value,
	label,
	description,
	checked,
	onChange,
}: RadioOptionProps) {
	return (
		<button
			onClick={onChange}
			className={clsx(
				"w-full p-2.5 rounded-lg border transition-colors text-left",
				checked
					? "bg-accent/10 border-accent/30"
					: "bg-app-box/40 border-app-line/50 hover:bg-app-box/60",
			)}
		>
			<div className="flex items-start gap-2">
				<div
					className={clsx(
						"size-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center",
						checked ? "border-accent" : "border-sidebar-inkDull",
					)}
				>
					{checked && (
						<div className="size-2 rounded-full bg-accent" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<div className="text-xs font-medium text-sidebar-ink">
						{label}
					</div>
					<div className="text-[11px] text-sidebar-inkDull mt-0.5">
						{description}
					</div>
				</div>
			</div>
		</button>
	);
}

interface IgnoreRuleProps {
	pattern: string;
	onRemove: () => void;
}

function IgnoreRule({ pattern, onRemove }: IgnoreRuleProps) {
	return (
		<div className="flex items-center gap-2 p-2 bg-app-box/40 rounded-lg border border-app-line/50 group">
			<code className="flex-1 text-xs text-sidebar-ink font-mono">
				{pattern}
			</code>
			<button
				onClick={onRemove}
				className="size-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
				title="Remove rule"
			>
				<X className="size-3 text-red-400" weight="bold" />
			</button>
		</div>
	);
}

interface JobConfigRowProps {
	label: string;
	description: string;
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
	onTrigger: () => void;
	isTriggering: boolean;
	icon?: React.ComponentType<any>;
}

function JobConfigRow({
	label,
	description,
	enabled,
	onToggle,
	onTrigger,
	isTriggering,
	icon: Icon,
}: JobConfigRowProps) {
	return (
		<div className="w-full p-3 bg-app-box/40 rounded-lg border border-app-line/50">
			{/* Header with toggle and icon */}
			<div className="space-y-1.5">
				<button
					onClick={() => onToggle(!enabled)}
					className="flex items-center gap-2.5 w-full text-left group"
				>
					{enabled ? (
						<ToggleRight
							className="size-5 text-accent shrink-0"
							weight="fill"
						/>
					) : (
						<ToggleLeft
							className="size-5 text-sidebar-inkDull shrink-0 group-hover:text-sidebar-ink transition-colors"
							weight="fill"
						/>
					)}
					<div className="flex items-center gap-2 flex-1 min-w-0">
						{Icon && (
							<Icon
								className="size-4 text-sidebar-inkDull shrink-0"
								weight="bold"
							/>
						)}
						<div className="flex-1 min-w-0">
							<div className="text-xs font-medium text-sidebar-ink">
								{label}
							</div>
						</div>
					</div>
				</button>

				{/* Description */}
				<p className="text-[11px] text-sidebar-inkDull leading-relaxed pl-7">
					{description}
				</p>
			</div>

			{/* Run button */}
			<Button
				onClick={onTrigger}
				disabled={!enabled || isTriggering}
				variant="gray"
				size="sm"
				className="w-full flex items-center justify-center gap-1.5 mt-2.5"
				title={enabled ? "Run job now" : "Enable job first"}
			>
				<Play className="size-3" weight="fill" />
				{isTriggering ? "Running..." : "Run Now"}
			</Button>
		</div>
	);
}