import { Plus } from '@phosphor-icons/react';
import { useAddGroupDialog } from './AddGroupModal';

interface AddGroupButtonProps {
	spaceId: string;
}

export function AddGroupButton({ spaceId }: AddGroupButtonProps) {
	const addGroupDialog = useAddGroupDialog(spaceId);

	return (
		<button
			type="button"
			onClick={() => addGroupDialog.open()}
			className="flex w-full items-center gap-2 rounded-lg border border-dashed border-sidebar-line/70 px-2 py-1.5 text-sm font-medium text-sidebar-ink hover:border-sidebar-line hover:bg-sidebar-selected/20 hover:text-white transition-colors cursor-pointer"
		>
			<Plus size={16} weight="bold" />
			<span>Add Group</span>
		</button>
	);
}
