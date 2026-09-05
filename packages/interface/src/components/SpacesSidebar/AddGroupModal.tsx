import { useState } from 'react';
import { Input, Label, dialogManager, useDialog, Dialog } from '@spacedrive/primitives';
import { useLibraryMutation } from '@sd/ts-client';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import type { GroupType } from '@sd/ts-client';

interface FormData {
	groupName: string;
}

export function useAddGroupDialog(spaceId: string) {
	return {
		open: () => dialogManager.create((props) => <AddGroupDialog {...props} spaceId={spaceId} />),
	};
}

function AddGroupDialog(props: { id: number; spaceId: string }) {
	const dialog = useDialog(props);
	const queryClient = useQueryClient();
	const [groupType, setGroupType] = useState<GroupType>('Custom');

	const form = useForm<FormData>({
		mode: 'onChange',
		defaultValues: { groupName: '' },
	});

	const addGroup = useLibraryMutation('spaces.add_group', {
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) => {
					const key = query.queryKey;
					return Array.isArray(key) && key[0] === 'query:spaces.get_layout';
				},
			});
		},
	});

	const onSubmit = form.handleSubmit(async (data) => {
		try {
			await addGroup.mutateAsync({
				space_id: props.spaceId,
				name: data.groupName || getDefaultName(groupType),
				group_type: groupType,
			});
			form.reset();
			setGroupType('Custom');
			dialogManager.setState(dialog.id, { open: false });
		} catch (error) {
			console.error('Failed to add group:', error);
		}
	});

	return (
		<Dialog form={form} dialog={dialog} title="Add Group" onSubmit={onSubmit} ctaLabel="Create">
			<div className="space-y-4">
				<div>
					<Label>Group Type</Label>
					<select
						value={typeof groupType === 'string' ? groupType : 'Custom'}
						onChange={(e) => setGroupType(e.target.value as GroupType)}
						className="w-full rounded-lg border border-app-line bg-app-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
					>
						<option value="Devices" className="bg-app-box text-ink">All Devices</option>
						<option value="Locations" className="bg-app-box text-ink">All Locations</option>
						<option value="Tags" className="bg-app-box text-ink">Tags</option>
						<option value="Cloud" className="bg-app-box text-ink">Cloud Storage</option>
						<option value="Custom" className="bg-app-box text-ink">Custom</option>
					</select>
				</div>

				{groupType === 'Custom' && (
					<div>
						<Label>Group Name</Label>
						<Input
							{...form.register('groupName')}
							placeholder="Enter group name"
						/>
					</div>
				)}
			</div>
		</Dialog>
	);
}

function getDefaultName(groupType: GroupType): string {
	if (groupType === 'Devices') return 'Devices';
	if (groupType === 'Locations') return 'Locations';
	if (groupType === 'Tags') return 'Tags';
	if (groupType === 'Cloud') return 'Cloud';
	if (groupType === 'Custom') return 'Custom Group';
	if (typeof groupType === 'object' && 'Device' in groupType) return 'Device';
	return 'Group';
}

