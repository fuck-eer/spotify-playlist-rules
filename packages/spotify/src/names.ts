/** Browser-safe naming helpers (no Node imports), exported as "@rulemix/spotify/names". */
export function targetName(mixName: string): string {
  return `Rules: ${mixName}`;
}
