import type {
	SpaceGroup as SpaceGroupType,
	SpaceItem as SpaceItemType,
} from "@sd/ts-client";
import { useSidebarStore, useLibraryMutation } from "@sd/ts-client";
import { SpaceItem } from "./SpaceItem";
import { LocationsGroup } from "./LocationsGroup";
import { VolumesGroup } from "./VolumesGroup";
import { TagsGroup } from "./TagsGroup";
import { GroupHeader } from "./GroupHeader";
import { isRedundancyItem, isSourcesItem, isSourceItem } from "./hooks/spaceItemUtils";
import { useDroppable, useDndContext } from "@dnd-kit/core";

interface SpaceGroupProps {
	group: SpaceGroupType;
	items: SpaceItemType[];
	spaceId?: string;
	sortableAttributes?: any;
	sortableListeners?: any;
}

export function SpaceGroup({
	group,
	items,
	spaceId,
	sortableAttributes,
	sortableListeners,
}: SpaceGroupProps) {
	const { collapsedGroups, toggleGroup: toggleGroupLocal } = useSidebarStore();
	const updateGroup = useLibraryMutation("spaces.update_group");
	const { active } = useDndContext();

	const isCollapsed = collapsedGroups.has(group.id);

	const handleToggle = async () => {
		// Optimistically toggle in local store for instant UI response
		toggleGroupLocal(group.id);

		// Persist to database in background
		try {
			await updateGroup.mutateAsync({
				group_id: group.id,
				name: null,
				is_collapsed: !isCollapsed,
			});
		} catch (error) {
			console.warn("Failed to persist group collapse state to DB:", error);
		}
	};

	// Disable insertion drop zones when dragging groups or space items (they have 'label' in their data)
	const isDraggingSortableItem = active?.data?.current?.label != null;

	// System groups (Locations, Volumes, etc.) are dynamic - don't allow insertion/reordering
	// Custom/QuickAccess groups allow insertion
	const allowInsertion =
		group.group_type === "QuickAccess" || group.group_type === "Custom";

	// Devices group - disabled for minimal local mode
	if (group.group_type === "Devices") {
		return null;
	}

	// Locations group - fetches all locations
	if (group.group_type === "Locations") {
		return (
			<div data-group-id={group.id}>
				<LocationsGroup
					isCollapsed={isCollapsed}
					onToggle={handleToggle}
					sortableAttributes={sortableAttributes}
					sortableListeners={sortableListeners}
				/>
			</div>
		);
	}

	// Volumes group - fetches all volumes
	if (group.group_type === "Volumes") {
		return (
			<div data-group-id={group.id}>
				<VolumesGroup
					isCollapsed={isCollapsed}
					onToggle={handleToggle}
					sortableAttributes={sortableAttributes}
					sortableListeners={sortableListeners}
				/>
			</div>
		);
	}

	// Tags group - fetches all tags
	if (group.group_type === "Tags") {
		return (
			<div data-group-id={group.id}>
				<TagsGroup
					isCollapsed={isCollapsed}
					onToggle={handleToggle}
					sortableAttributes={sortableAttributes}
					sortableListeners={sortableListeners}
				/>
			</div>
		);
	}

	// Sources group - disabled for minimal local mode
	if (group.group_type === "Sources") {
		return null;
	}

	// Empty drop zone for groups with no items
	const { setNodeRef: setEmptyRef, isOver: isOverEmpty } = useDroppable({
		id: `group-${group.id}-empty`,
		disabled: !allowInsertion || isCollapsed || isDraggingSortableItem,
		data: {
			action: "add-to-group",
			groupId: group.id,
			spaceId,
		},
	});

	const visibleItems = items.filter(
		(item) =>
			!isRedundancyItem(item.item_type) &&
			!isSourcesItem(item.item_type) &&
			!isSourceItem(item.item_type)
	);

	// QuickAccess and Custom groups render stored items
	return (
		<div className="rounded-lg" data-group-id={group.id}>
			<GroupHeader
				label={group.name}
				isCollapsed={isCollapsed}
				onToggle={handleToggle}
				sortableAttributes={sortableAttributes}
				sortableListeners={sortableListeners}
				group={group}
				allowCustomization={allowInsertion}
			/>

			{/* Items */}
			{!isCollapsed && (
				<div className="space-y-0.5 relative min-h-[20px]">
					{visibleItems.length > 0 ? (
						visibleItems.map((item, index) => (
							<SpaceItem
								key={item.id}
								item={item}
								isLastItem={index === visibleItems.length - 1}
								allowInsertion={allowInsertion}
								spaceId={spaceId}
								groupId={group.id}
							/>
						))
					) : (
						<div
							ref={setEmptyRef}
							className="absolute inset-0 z-10"
						>
					{isOverEmpty && !isDraggingSortableItem && (
						<div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 h-[2px] bg-accent rounded-full" />
					)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
