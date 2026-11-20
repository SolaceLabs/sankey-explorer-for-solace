/** "1 endpoint", "7 endpoints" - for the regular English nouns the UI counts. */
export const countLabel = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;
