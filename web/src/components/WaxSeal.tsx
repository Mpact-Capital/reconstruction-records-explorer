/**
 * A wax-seal rendering of the MPact Capital mark: the brand's rising-bar
 * silhouette (see mpact-capital-website/assets/mpact-mark.svg), reduced to
 * a single engraved relief tone -- a real seal press has one die, not a
 * gradient -- and pressed into a hand-dripped wax blob.
 */
export default function WaxSeal({ size = 96, className = "" }: { size?: number; className?: string }) {
  // Relative bar heights sampled from the real mark's 9 principal bars
  // (left -> right), normalized to the tallest.
  const bars = [0.65, 0.54, 0.74, 0.89, 0.7, 0.83, 1.0, 0.88, 0.76];
  const barW = 7;
  const gap = 3.2;
  const maxH = 58;
  const totalW = bars.length * barW + (bars.length - 1) * gap;
  const startX = 110 - totalW / 2;
  const baseline = 132;

  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="MPact Capital wax seal"
    >
      <defs>
        <radialGradient id="wax-body" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="var(--seal-highlight)" />
          <stop offset="55%" stopColor="var(--seal-base)" />
          <stop offset="100%" stopColor="var(--seal-shadow)" />
        </radialGradient>
        <filter id="wax-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>

      {/* dripped wax tail */}
      <path
        d="M 92 188 C 90 205 96 216 104 214 C 110 212 108 200 104 190 Z"
        fill="url(#wax-body)"
      />
      <path
        d="M 118 190 C 119 202 114 210 109 207 C 105 205 107 196 111 189 Z"
        fill="url(#wax-body)"
      />

      {/* main wax blob -- slightly irregular, hand-pressed edge */}
      <path
        d="M 110 14
           C 154 14 192 34 202 72
           C 210 102 204 132 188 156
           C 170 182 142 196 110 196
           C 78 196 50 182 32 156
           C 16 132 10 102 18 72
           C 28 34 66 14 110 14 Z"
        fill="url(#wax-body)"
        filter="url(#wax-blur)"
      />

      {/* beaded ring, pressed by the matrix's outer rim */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = (i / 36) * Math.PI * 2;
        const r = 84;
        const cx = 110 + r * Math.cos(angle);
        const cy = 105 + r * Math.sin(angle);
        return <circle key={i} cx={cx} cy={cy} r={1.6} fill="var(--seal-shadow)" opacity={0.55} />;
      })}

      {/* ring text */}
      <path id="seal-ring-path" d="M 110,105 m -68,0 a 68,68 0 1,1 136,0 a 68,68 0 1,1 -136,0" fill="none" />
      <text fontSize="11.5" letterSpacing="3.2" fill="var(--seal-shadow)" opacity={0.85}>
        <textPath href="#seal-ring-path" startOffset="2%">
          MPACT CAPITAL &#8226; MPACT CAPITAL &#8226;
        </textPath>
      </text>

      {/* engraved emblem: the rising-bar mark, recessed relief */}
      <g transform={`translate(0, -6)`}>
        {bars.map((h, i) => {
          const barH = h * maxH;
          const x = startX + i * (barW + gap);
          const y = baseline - barH;
          return (
            <g key={i}>
              <rect
                x={x + 0.6}
                y={y + 0.6}
                width={barW}
                height={barH}
                rx={1.4}
                fill="var(--seal-shadow)"
                opacity={0.8}
              />
              <rect x={x} y={y} width={barW} height={barH} rx={1.4} fill="var(--seal-emblem)" />
              <rect
                x={x - 0.5}
                y={y - 0.5}
                width={barW * 0.4}
                height={Math.min(barH, 10)}
                rx={1}
                fill="var(--seal-emblem-highlight)"
                opacity={0.5}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
