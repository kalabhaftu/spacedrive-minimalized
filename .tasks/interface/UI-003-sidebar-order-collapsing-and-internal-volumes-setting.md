---
id: UI-003
title: "Sidebar order, empty group collapsing, and internal volumes setting"
status: "Done"
assignee: "antigravity"
priority: "High"
tags: ["interface", "sidebar", "settings", "volumes"]
---

## Description
Implements sidebar improvements:
1. Re-orders sidebar groups so Locations is positioned on top (directly beneath pinned space items Overview, Recents, Favorites, File Kinds), followed by Volumes and Tags.
2. Automatically collapses empty sidebar groups by default (Tags with 0 tags, empty Volumes, empty custom groups) while persisting explicit user expand/collapse toggles across app restarts.
3. Adds a Settings toggle to show/hide internal and system volumes (such as macOS Cryptex, Recovery, Preboot, and AssetsV2 disk images like Creedence), defaulting to hidden.

## Implementation Steps
- [x] Create task file in /.tasks/interface/
- [x] Update useSidebarStore with persisted collapsedGroups Record and showInternalVolumes flag
- [x] Add "Show internal & system volumes" toggle in LibrarySettings.tsx and GeneralSettings.tsx
- [x] Implement internal system volume filtering in VolumesGroup.tsx based on showInternalVolumes setting
- [x] Update core volume classification to properly classify cryptex/assets disk images as System / non-user-visible
- [x] Re-order sidebar groups in SpacesSidebar/index.tsx to place Locations first, Volumes second, Tags third
- [x] Configure default collapsing for empty groups in SpaceGroup.tsx and TagsGroup.tsx
- [x] Verify build and validate task file

## Acceptance Criteria
- Locations group appears above Volumes and Tags in the sidebar
- Empty groups (like Tags with 0 tags) start collapsed by default
- User toggling of group expand/collapse persists across reload
- Internal system disk images (e.g. Creedence/AssetData) are hidden by default
- Enabling "Show internal & system volumes" in Settings makes internal volumes visible
- Project builds cleanly with no type errors
