import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DraggedItem {
	type: 'file' | 'space-item' | 'space-group';
	data: any;
}

interface SidebarStore {
	// Persisted state
	currentSpaceId: string | null;
	setCurrentSpace: (id: string | null) => void;

	// Internal/system volumes visibility setting
	showInternalVolumes: boolean;
	setShowInternalVolumes: (show: boolean) => void;

	// Collapsed state per group ID (persisted Record)
	collapsedGroups: Record<string, boolean>;
	toggleGroup: (groupId: string, defaultCollapsed?: boolean) => void;
	setGroupCollapsed: (groupId: string, isCollapsed: boolean) => void;
	collapseAll: (groupIds: string[]) => void;
	expandAll: () => void;

	// Drag state
	draggedItem: DraggedItem | null;
	setDraggedItem: (item: DraggedItem | null) => void;
}

export const useSidebarStore = create<SidebarStore>()(
	persist(
		(set) => ({
			// Persisted
			currentSpaceId: null,
			setCurrentSpace: (id) => set({ currentSpaceId: id }),

			showInternalVolumes: false,
			setShowInternalVolumes: (show) => set({ showInternalVolumes: show }),

			collapsedGroups: {},
			toggleGroup: (groupId, defaultCollapsed = false) =>
				set((state) => {
					const current =
						state.collapsedGroups[groupId] !== undefined
							? state.collapsedGroups[groupId]
							: defaultCollapsed;
					return {
						collapsedGroups: {
							...state.collapsedGroups,
							[groupId]: !current,
						},
					};
				}),
			setGroupCollapsed: (groupId, isCollapsed) =>
				set((state) => ({
					collapsedGroups: {
						...state.collapsedGroups,
						[groupId]: isCollapsed,
					},
				})),
			collapseAll: (groupIds) =>
				set({
					collapsedGroups: groupIds.reduce(
						(acc, id) => ({ ...acc, [id]: true }),
						{}
					),
				}),
			expandAll: () => set({ collapsedGroups: {} }),

			// Drag
			draggedItem: null,
			setDraggedItem: (item) => set({ draggedItem: item }),
		}),
		{
			name: 'spacedrive-sidebar',
			partialize: (state) => ({
				currentSpaceId: state.currentSpaceId,
				showInternalVolumes: state.showInternalVolumes,
				collapsedGroups: state.collapsedGroups,
			}),
		}
	)
);
