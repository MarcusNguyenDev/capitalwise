// Shapes of the ids the model copies from tool results. A wrong shape is
// answered with INVALID_ARGUMENTS before anything reaches the api.
export const ACCOUNT_ID_PATTERN = /^ACC-[0-9]+$/;
export const CARD_ID_PATTERN = /^CRD-[A-Z0-9-]+$/;
export const TRANSACTION_ID_PATTERN = /^TXN-[A-Z0-9-]+$/;
