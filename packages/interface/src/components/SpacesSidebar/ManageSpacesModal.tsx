import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
	Button,
	Input,
	Label,
	dialogManager,
	useDialog,
	Dialog,
	type UseDialogProps,
} from '@spacedrive/primitives';
import { useLibraryMutation, useSidebarStore, type Space } from '@sd/ts-client';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import {
	Planet,
	Folder,
	Briefcase,
	House,
	Camera,
	MusicNotes,
	GameController,
	Code,
	Trash,
	Plus,
	Check,
	GearSix,
} from '@phosphor-icons/react';
import { useSpaces } from './hooks/useSpaces';
import { useCreateSpaceDialog } from './CreateSpaceModal';

const PRESET_COLORS = [
	'#3B82F6', // Blue
	'#8B5CF6', // Purple
	'#EC4899', // Pink
	'#10B981', // Green
	'#F59E0B', // Amber
	'#EF4444', // Red
	'#06B6D4', // Cyan
	'#6366F1', // Indigo
];

const PRESET_ICONS = [
	'Planet',
	'Folder',
	'Briefcase',
	'House',
	'Camera',
	'MusicNotes',
	'GameController',
	'Code',
];

const ICON_COMPONENTS: Record<string, any> = {
	Planet,
	Folder,
	Briefcase,
	House,
	Camera,
	MusicNotes,
	GameController,
	Code,
};

export function useManageSpacesDialog() {
	return {
		open: (initialSpaceId?: string) =>
			dialogManager.create((props: UseDialogProps) => (
				<ManageSpacesDialog initialSpaceId={initialSpaceId} {...props} />
			)),
	};
}

interface ManageSpacesDialogProps extends UseDialogProps {
	initialSpaceId?: string;
}

export function ManageSpacesDialog({ initialSpaceId, ...props }: ManageSpacesDialogProps) {
	const dialog = useDialog(props);
	const queryClient = useQueryClient();
	const createSpaceDialog = useCreateSpaceDialog();

	const { data: spacesData } = useSpaces();
	const spaces = ((spacesData as any)?.spaces || []) as Space[];

	const { currentSpaceId, setCurrentSpace } = useSidebarStore();

	const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(
		initialSpaceId || currentSpaceId || (spaces[0]?.id ?? null)
	);

	const selectedSpace = spaces.find((s) => s.id === selectedSpaceId) || spaces[0];

	const [name, setName] = useState('');
	const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
	const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0]);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Sync local state when selected space changes
	useEffect(() => {
		if (selectedSpace) {
			setSelectedSpaceId(selectedSpace.id);
			setName(selectedSpace.name === 'All Devices' ? 'Local Library' : selectedSpace.name);
			setSelectedColor(selectedSpace.color || PRESET_COLORS[0]);
			setSelectedIcon(selectedSpace.icon || PRESET_ICONS[0]);
			setSaveSuccess(false);
			setErrorMessage(null);
		}
	}, [selectedSpace?.id]);

	const updateSpace = useLibraryMutation('spaces.update', {
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === 'query:spaces.list';
				},
			});
		},
	});

	const deleteSpace = useLibraryMutation('spaces.delete', {
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === 'query:spaces.list';
				},
			});
		},
	});

	const form = useForm();

	const handleSave = async () => {
		if (!selectedSpace) return;
		if (!name.trim()) {
			setErrorMessage('Space name cannot be empty');
			return;
		}

		setIsSaving(true);
		setErrorMessage(null);
		try {
			await updateSpace.mutateAsync({
				space_id: selectedSpace.id,
				name: name.trim(),
				color: selectedColor,
				icon: selectedIcon,
			});
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 2000);
		} catch (err: any) {
			console.error('Failed to update space:', err);
			setErrorMessage(err?.message || 'Failed to update space');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedSpace) return;
		if (spaces.length <= 1) {
			setErrorMessage('Cannot delete the only remaining space');
			return;
		}

		const confirmDelete = window.confirm(
			`Are you sure you want to delete "${selectedSpace.name}"? This action cannot be undone.`
		);
		if (!confirmDelete) return;

		setIsDeleting(true);
		setErrorMessage(null);
		try {
			// If we're deleting the active space, switch to another first
			if (selectedSpace.id === currentSpaceId) {
				const nextSpace = spaces.find((s) => s.id !== selectedSpace.id);
				if (nextSpace) {
					setCurrentSpace(nextSpace.id);
				}
			}

			await deleteSpace.mutateAsync({
				space_id: selectedSpace.id,
			});

			const remaining = spaces.filter((s) => s.id !== selectedSpace.id);
			if (remaining.length > 0) {
				setSelectedSpaceId(remaining[0].id);
			}
		} catch (err: any) {
			console.error('Failed to delete space:', err);
			setErrorMessage(err?.message || 'Failed to delete space');
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Dialog
			dialog={dialog}
			form={form}
			title="Manage Spaces"
			description="Customize, rename, or delete your spaces"
			icon={<GearSix className="text-accent" weight="bold" />}
		>
			<div className="grid grid-cols-1 md:grid-cols-12 gap-5 min-h-[340px]">
				{/* Spaces List Column */}
				<div className="md:col-span-4 border-r border-app-line pr-3 flex flex-col justify-between">
					<div className="space-y-1">
						<div className="flex items-center justify-between pb-2 mb-1 border-b border-app-line/50">
							<span className="text-xs font-semibold uppercase tracking-wider text-ink-dull">
								All Spaces ({spaces.length})
							</span>
							<button
								type="button"
								onClick={() => createSpaceDialog.open()}
								className="text-xs flex items-center gap-1 text-accent hover:underline font-medium"
								title="Create a new space"
							>
								<Plus className="size-3" weight="bold" />
								New
							</button>
						</div>

						<div className="space-y-1 max-h-[260px] overflow-y-auto no-scrollbar">
							{spaces.map((space) => {
								const isSelected = space.id === selectedSpace?.id;
								const isActive = space.id === currentSpaceId;
								const IconComp = ICON_COMPONENTS[space.icon || 'Planet'] || Planet;
								const displayName =
									space.name === 'All Devices' ? 'Local Library' : space.name;

								return (
									<button
										key={space.id}
										type="button"
										onClick={() => setSelectedSpaceId(space.id)}
										className={clsx(
											'w-full text-left px-2.5 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors',
											isSelected
												? 'bg-accent/15 text-accent font-medium'
												: 'text-ink hover:bg-app-hover'
										)}
									>
										<div className="flex items-center gap-2 truncate">
											<div
												className="size-2 rounded-full shrink-0"
												style={{ backgroundColor: space.color || '#3b82f6' }}
											/>
											<IconComp className="size-4 shrink-0 opacity-70" weight="bold" />
											<span className="truncate">{displayName}</span>
										</div>
										{isActive && (
											<span className="text-[10px] px-1.5 py-0.5 rounded bg-app-box text-ink-dull border border-app-line shrink-0">
												Active
											</span>
										)}
									</button>
								);
							})}
						</div>
					</div>

					<Button
						variant="gray"
						size="sm"
						className="w-full mt-3 flex items-center justify-center gap-1.5"
						onClick={() => createSpaceDialog.open()}
					>
						<Plus className="size-3.5" weight="bold" />
						Create Space
					</Button>
				</div>

				{/* Space Edit Column */}
				<div className="md:col-span-8 flex flex-col justify-between space-y-4">
					{selectedSpace ? (
						<div className="space-y-4">
							{errorMessage && (
								<div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
									{errorMessage}
								</div>
							)}

							<div>
								<Label>Space Name</Label>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g., Work, Personal"
								/>
							</div>

							<div>
								<Label>Accent Color</Label>
								<div className="flex flex-wrap gap-2 pt-1">
									{PRESET_COLORS.map((color) => (
										<button
											key={color}
											type="button"
											onClick={() => setSelectedColor(color)}
											className={clsx(
												'h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center',
												selectedColor === color
													? 'scale-110 border-white shadow-md'
													: 'border-transparent opacity-80 hover:opacity-100'
											)}
											style={{ backgroundColor: color }}
										>
											{selectedColor === color && (
												<Check className="size-3.5 text-white" weight="bold" />
											)}
										</button>
									))}
								</div>
							</div>

							<div>
								<Label>Icon</Label>
								<div className="grid grid-cols-4 gap-2 pt-1">
									{PRESET_ICONS.map((iconName) => {
										const IconComp = ICON_COMPONENTS[iconName] || Planet;
										const isSelected = selectedIcon === iconName;
										return (
											<button
												key={iconName}
												type="button"
												onClick={() => setSelectedIcon(iconName)}
												className={clsx(
													'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors border',
													isSelected
														? 'bg-accent/20 text-accent border-accent/40'
														: 'bg-app-box text-ink-dull border-app-line hover:bg-app-hover hover:text-ink'
												)}
											>
												<IconComp className="size-4" weight="bold" />
												<span>{iconName}</span>
											</button>
										);
									})}
								</div>
							</div>
						</div>
					) : (
						<div className="flex items-center justify-center h-full text-ink-dull text-sm">
							Select a space to edit
						</div>
					)}

					{selectedSpace && (
						<div className="flex items-center justify-between pt-4 border-t border-app-line mt-4">
							<Button
								variant="outline"
								size="sm"
								disabled={isDeleting || spaces.length <= 1}
								onClick={handleDelete}
								className="flex items-center gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
								title={
									spaces.length <= 1
										? 'Cannot delete your only space'
										: 'Delete this space'
								}
							>
								<Trash className="size-3.5" weight="bold" />
								{isDeleting ? 'Deleting...' : 'Delete Space'}
							</Button>

							<div className="flex items-center gap-2">
								{saveSuccess && (
									<span className="text-xs text-green-400 flex items-center gap-1 font-medium">
										<Check className="size-3" weight="bold" />
										Saved
									</span>
								)}
								<Button
									variant="accent"
									size="sm"
									disabled={isSaving}
									onClick={handleSave}
								>
									{isSaving ? 'Saving...' : 'Save Changes'}
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</Dialog>
	);
}
