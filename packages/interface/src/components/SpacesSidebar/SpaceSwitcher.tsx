import {Check, GearSix, Plus} from '@phosphor-icons/react';
import type {Space} from '@sd/ts-client';
import {DropdownMenu, SelectPill} from '@spacedrive/primitives';
import clsx from 'clsx';
import {useCreateSpaceDialog} from './CreateSpaceModal';
import {useManageSpacesDialog} from './ManageSpacesModal';

interface SpaceSwitcherProps {
	spaces?: Space[];
	currentSpace?: Space;
	onSwitch: (spaceId: string) => void;
	onOpenSettings?: () => void;
}

export function SpaceSwitcher({
	spaces,
	currentSpace,
	onSwitch,
	onOpenSettings,
}: SpaceSwitcherProps) {
	const createSpaceDialog = useCreateSpaceDialog();
	const manageSpacesDialog = useManageSpacesDialog();

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<SelectPill variant="sidebar" size="lg" className="shrink-0">
					<div
						className="size-2 rounded-full"
						style={{backgroundColor: currentSpace?.color || '#666'}}
					/>
					<span className="flex-1 truncate text-left font-medium">
						{currentSpace?.name === 'All Devices' ? 'Local Library' : currentSpace?.name || 'Local Library'}
					</span>
				</SelectPill>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				className="z-[99999] min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border p-1 shadow-2xl"
				style={{
					backgroundColor: 'var(--color-menu, #15151c)',
					borderColor: 'var(--color-menu-line, #242430)',
					color: 'var(--color-menu-ink, #ededf0)',
					opacity: 1,
					boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)'
				}}
			>
				{spaces && spaces.length > 0 && (
					<>
						{spaces.map((space) => {
							const displayName = space.name === 'All Devices' ? 'Local Library' : space.name;
							const isCurrent = space.id === currentSpace?.id;

							return (
								<DropdownMenu.Item
									key={space.id}
									onClick={() => onSwitch(space.id)}
									className={clsx(
										'rounded-lg px-2.5 py-1.5 text-sm cursor-pointer transition-colors',
										isCurrent
											? 'bg-accent text-white font-medium'
											: 'text-menu-ink hover:bg-menu-hover'
									)}
								>
									<div className="flex items-center gap-2">
										<div
											className="size-2 rounded-full shrink-0"
											style={{backgroundColor: space.color || '#3b82f6'}}
										/>
										<span className="truncate flex-1">{displayName}</span>
										{isCurrent && (
											<Check className="size-3.5 shrink-0" weight="bold" />
										)}
									</div>
								</DropdownMenu.Item>
							);
						})}
						<DropdownMenu.Separator className="border-menu-line my-1" />
					</>
				)}
				<DropdownMenu.Item
					onClick={() => createSpaceDialog.open()}
					className="hover:bg-menu-hover text-menu-ink rounded-lg px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-colors"
				>
					<Plus className="mr-2 size-4" weight="bold" />
					New Space
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onClick={() => {
						if (onOpenSettings) {
							onOpenSettings();
						} else {
							manageSpacesDialog.open(currentSpace?.id);
						}
					}}
					className="hover:bg-menu-hover text-menu-ink rounded-lg px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-colors"
				>
					<GearSix className="mr-2 size-4" weight="bold" />
					Space Settings
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
}
