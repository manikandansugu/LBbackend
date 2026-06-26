export const getConversationKey = (firstUserId: string, secondUserId: string) =>
  [firstUserId, secondUserId].sort().join(":");
