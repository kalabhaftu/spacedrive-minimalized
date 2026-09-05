import {useMemo} from 'react';
import {EyeSlash} from '@phosphor-icons/react';
import {getVolumeIcon, useNormalizedQuery, useSidebarStore} from '@sd/ts-client';
import type {Device, Volume} from '@sd/ts-client';
import {GroupHeader} from './GroupHeader';
import {SpaceItem} from './SpaceItem';
import {useVolumeContextMenu} from './hooks/useVolumeContextMenu';

interface VolumesGroupProps {
	groupId?: string;
	isCollapsed: boolean;
	onToggle: () => void;
	/** Filter to show tracked, untracked, or all volumes (default: "All") */
	filter?: 'TrackedOnly' | 'UntrackedOnly' | 'All';
	sortableAttributes?: any;
	sortableListeners?: any;
}

/**
 * Determines if a volume is an internal system volume (cryptex, asset data, recovery, preboot, VM, etc.)
 */
export function isInternalSystemVolume(volume: Volume): boolean {
	if (volume.volume_type === 'System') return true;
	if (volume.is_user_visible === false) return true;
	const mount = (volume.mount_point || '').toLowerCase();
	const name = (volume.name || '').toLowerCase();
	if (
		mount.includes('/assetsv2/') ||
		mount.includes('.assetdata') ||
		mount.includes('cryptex') ||
		mount.startsWith('/system/volumes/preboot') ||
		mount.startsWith('/system/volumes/vm') ||
		mount.startsWith('/system/volumes/update') ||
		mount.startsWith('/system/volumes/hardware') ||
		mount.startsWith('/system/volumes/xarts') ||
		mount.startsWith('/system/volumes/iscpreboot') ||
		mount.startsWith('/private/var/') ||
		mount.startsWith('/private/preboot/') ||
		name.includes('cryptex') ||
		name.includes('pkitruststore')
	) {
		return true;
	}
	return false;
}

// Helper to render volume status indicator
const getVolumeIndicator = (volume: Volume) => (
	<>
		{!volume.is_tracked && (
			<EyeSlash
				size={14}
				weight="bold"
				className="text-ink-faint/50"
			/>
		)}
	</>
);

// Component for individual volume items with context menu
function VolumeItem({volume, index, volumesLength, devices}: {volume: Volume; index: number; volumesLength: number; devices: Device[]}) {
	const contextMenu = useVolumeContextMenu({volume});

	// Look up the device by ID to get the slug (not the UUID)
	const device = devices.find((d) => d.id === volume.device_id);
	const deviceSlug = device?.slug;

	return (
		<SpaceItem
			key={volume.id}
			item={
				{
					id: volume.id,
					item_type: {
						Volume: {
							volume_id: volume.id,
							name: volume.display_name || volume.name
						}
					}
				} as any
			}
			volumeData={deviceSlug ? {
				device_slug: deviceSlug,
				mount_path: volume.mount_point || '/'
			} : undefined}
			rightComponent={getVolumeIndicator(volume)}
			customIcon={getVolumeIcon(volume as any)}
			allowInsertion={false}
			isLastItem={index === volumesLength - 1}
			onContextMenu={contextMenu.show}
		/>
	);
}

export function VolumesGroup({
	groupId,
	isCollapsed: propIsCollapsed,
	onToggle,
	filter = 'All',
	sortableAttributes,
	sortableListeners
}: VolumesGroupProps) {
	const { showInternalVolumes, collapsedGroups, toggleGroup } = useSidebarStore();

	const {data: volumesData} = useNormalizedQuery({
		query: 'volumes.list',
		input: {filter},
		resourceType: 'volume'
	});

	const {data: devicesData} = useNormalizedQuery({
		query: 'devices.list',
		input: {include_offline: true, include_details: false},
		resourceType: 'device'
	});

	const rawVolumes: Volume[] = volumesData?.volumes || [];
	const devices: Device[] = (devicesData as Device[]) ?? [];

	const volumes = useMemo(() => {
		if (showInternalVolumes) {
			return rawVolumes;
		}
		return rawVolumes.filter((vol) => !isInternalSystemVolume(vol));
	}, [rawVolumes, showInternalVolumes]);

	// If user hasn't explicitly set collapse state, collapse if empty (0 visible volumes)
	const userCollapsed = groupId ? collapsedGroups[groupId] : undefined;
	const isCollapsed =
		userCollapsed !== undefined
			? userCollapsed
			: (volumes.length === 0 ? true : propIsCollapsed);

	const handleToggle = () => {
		if (groupId) {
			toggleGroup(groupId, isCollapsed);
		}
		onToggle();
	};

	return (
		<div>
			<GroupHeader
				label="Volumes"
				isCollapsed={isCollapsed}
				onToggle={handleToggle}
				sortableAttributes={sortableAttributes}
				sortableListeners={sortableListeners}
				rightComponent={
					volumes.length > 0 && (
						<span className="text-sidebar-ink-faint ml-auto">
							{volumes.length}
						</span>
					)
				}
			/>

			{/* Volumes List */}
			{!isCollapsed && (
				<div className="space-y-0.5">
					{volumes.length === 0 ? (
						<div className="text-ink-faint px-2 py-1 text-xs">
							No volumes
						</div>
					) : (
						volumes.map((volume: Volume, index: number) => (
							<VolumeItem
								key={volume.id}
								volume={volume}
								index={index}
								volumesLength={volumes.length}
								devices={devices}
							/>
						))
					)}
				</div>
			)}
		</div>
	);
}
