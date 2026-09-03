// Stub implementation of @spacebot/api-client when spacebot is not cloned

export type WorkerListItem = any;
export type TimelineItem = any;
export type PortalConversationSummary = any;
export type PortalHistoryMessage = any;
export type InboundMessageEvent = any;
export type OutboundMessageDeltaEvent = any;
export type OutboundMessageEvent = any;
export type PortalConversationResponse = any;
export type TypingStateEvent = any;

export const apiClient: any = new Proxy({}, {
	get: () => async () => null,
});

export const getEventsUrl = () => '';
export const setServerUrl = (_url: string) => {};
