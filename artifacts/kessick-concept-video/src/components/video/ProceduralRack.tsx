export function KessickTowerElevation({ finish }: { finish: 'walnut' | 'matte-black' }) {
  // Dimensions for Kessick Tower 2888 (28" W x 88.5" H)
  // Scale by 10 for viewBox to ensure crisp lines
  const w = 280;
  const h = 885;
  const isBlack = finish === 'matte-black';
  const woodColor = isBlack ? '#222222' : '#3e302c';
  const frameColor = isBlack ? '#111111' : '#2d2522';
  const hardwareColor = isBlack ? '#555555' : '#8D794E'; // Satin black vs Gold/Brushed
  return (
    <div className="w-full h-full relative flex items-end justify-center drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <filter id="inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feOffset dx="0" dy="5" />
            <feGaussianBlur stdDeviation="5" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.5" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* Outer Frame (Base Structure) */}
        <rect x="0" y="0" width={w} height={h} fill={frameColor} />
        <rect x="15" y="15" width={w - 30} height={h - 30} fill={woodColor} filter="url(#inner-shadow)" />

        {/* Upper Rack Section (Parallel metal hardware, label forward) */}
        <rect x="15" y="15" width={w - 30} height={h - 365} fill="#000000" opacity="0.6" />

        {/* Grid lines representing hardware */}
        {[...Array(14)].map((_, i) => (
           <line key={`hline-${i}`} x1="15" y1={40 + i * 36} x2={w - 15} y2={40 + i * 36} stroke={hardwareColor} strokeWidth="2" opacity="0.7" />
        ))}
        {/* Bottles on upper rack (3 columns, 14 rows) */}
        {[...Array(14)].map((_, r) => (
          [...Array(3)].map((_, c) => (
            <rect key={`bot-${r}-${c}`} x={45 + c * 75} y={28 + r * 36} width="40" height="10" rx="3" fill="#1a1a1a" stroke="#222" strokeWidth="1" />
          ))
        ))}

        {/* Display Row (Middle section, angled display) */}
        <rect x="15" y={h - 350} width={w - 30} height="120" fill="#000000" opacity="0.8" />
        {/* Display Row Bottles */}
        {[...Array(5)].map((_, i) => (
           <rect key={`disp-${i}`} x={35 + i * 45} y={h - 335} width="20" height="90" rx="8" fill="#1a1a1a" stroke={hardwareColor} strokeWidth="1.5" />
        ))}

        {/* Base Cabinet (Lower section, solid wood doors) */}
        <rect x="15" y={h - 230} width={w - 30} height="215" fill={frameColor} />
        {/* Cabinet Doors */}
        <rect x="25" y={h - 220} width={w/2 - 30} height="195" fill={woodColor} rx="2" />
        <rect x={w/2 + 5} y={h - 220} width={w/2 - 30} height="195" fill={woodColor} rx="2" />
        {/* Door details/shaker style */}
        <rect x="35" y={h - 210} width={w/2 - 50} height="175" fill="none" stroke={frameColor} strokeWidth="3" />
        <rect x={w/2 + 15} y={h - 210} width={w/2 - 50} height="175" fill="none" stroke={frameColor} strokeWidth="3" />

        {/* Hardware handles */}
        <rect x={w/2 - 25} y={h - 150} width="6" height="50" rx="3" fill={hardwareColor} />
        <rect x={w/2 + 19} y={h - 150} width="6" height="50" rx="3" fill={hardwareColor} />

        {/* Depth shadows for realism */}
        <rect x="15" y="15" width="10" height={h - 30} fill="#000000" opacity="0.4" />
        <rect x="15" y="15" width={w - 30} height="10" fill="#000000" opacity="0.4" />
      </svg>
      {/* Lighting / Polish Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 mix-blend-overlay pointer-events-none" />
    </div>
  );
}
