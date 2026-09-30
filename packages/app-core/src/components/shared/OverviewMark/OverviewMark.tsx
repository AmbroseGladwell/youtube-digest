// The mark, in currentColor so the ground it sits on decides: the shell paints it in
// --mark, and the shared page's own head does the same (docs/features/stone-theme.md).
export function OverviewMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <circle cx="16" cy="14.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="7" y="25" width="18" height="2.5" fill="currentColor" />
    </svg>
  );
}
