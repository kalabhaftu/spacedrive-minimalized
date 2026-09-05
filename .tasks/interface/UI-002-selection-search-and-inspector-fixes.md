---
id: UI-002
title: "Fix explorer selection, search deduplication, and inspector synchronization"
status: "Done"
assignee: "antigravity"
priority: "High"
tags: ["interface", "explorer", "search", "inspector"]
---

## Description
Resolve issues reported in file browsing, search results, and inspector state:
1. Search result deduplication when overlapping/nested locations are indexed.
2. Space Settings dropdown action wiring in SpaceSwitcher.
3. Clearing file selection and inspector state on directory/location/volume navigation.
4. Deselecting selected items when clicking empty space in explorer views.
5. Clarification of internal macOS Cryptex .AssetData volumes and external volume auto-tracking.

## Implementation Steps
- [x] Add search result deduplication by resolved physical path in core/src/ops/search/query.rs
- [x] Wire onOpenSettings in SpaceSwitcher.tsx to open SpaceCustomizationPanel in SpacesSidebar/index.tsx
- [x] Clear selection in SelectionContext.tsx and ExplorerProvider on path navigation
- [x] Fix empty space click detection in GridView.tsx, ListView.tsx, and MediaView.tsx
- [x] Verify builds (bun run build, cargo build -p spacedrive --bin Spacedrive)
