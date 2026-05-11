interface SimpleUnit {
  id: string;
  unit_number: string;
  status?: string;
}

interface MasterPlanSVGProps {
  units: SimpleUnit[];
  highlightedUnitId?: string;
  projectName: string;
}

const MasterPlanSVG = ({ units, highlightedUnitId, projectName }: MasterPlanSVGProps) => {
  if (!units || units.length === 0) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-700 text-sm">
        ยังไม่มียูนิตในโครงการนี้
      </div>
    );
  }

  const total = units.length;
  const cols = Math.max(3, Math.ceil(Math.sqrt(total * 1.6)));
  const rows = Math.ceil(total / cols);

  const boxW = 64;
  const boxH = 42;
  const gap = 8;
  const padX = 24;
  const padTop = 40;
  const facilityH = 70;
  const legendH = 30;

  const canvasW = padX * 2 + cols * boxW + (cols - 1) * gap;
  const canvasH = padTop + rows * boxH + (rows - 1) * gap + 14 + facilityH + legendH;

  const statusColor = (s?: string) =>
    s === 'available' ? '#10b981' :
    s === 'reserved'  ? '#f59e0b' :
    s === 'sold'      ? '#ef4444' :
                        '#94a3b8';

  const facilityY = padTop + rows * boxH + (rows - 1) * gap + 14;
  const legendY = facilityY + facilityH + 5;

  return (
    <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className="w-full h-auto rounded-lg border border-emerald-200" style={{ maxHeight: 480 }}>
      <defs>
        <pattern id="mp-grass" patternUnits="userSpaceOnUse" width="20" height="20">
          <rect width="20" height="20" fill="#ecfdf5" />
          <circle cx="6" cy="6" r="0.6" fill="#a7f3d0" />
          <circle cx="14" cy="14" r="0.6" fill="#a7f3d0" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mp-grass)" />

      {/* Title */}
      <text x={canvasW / 2} y="22" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#065f46">
        {projectName} · Site Plan
      </text>

      {/* Entrance arrow */}
      <text x={padX} y="22" fontSize="10" fill="#047857">↗ ทางเข้าโครงการ</text>

      {/* Plot boxes */}
      {units.map((unit, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const x = padX + col * (boxW + gap);
        const y = padTop + row * (boxH + gap);
        const fill = statusColor(unit.status);
        const isHighlight = unit.id === highlightedUnitId;

        return (
          <g key={unit.id}>
            <rect
              x={x}
              y={y}
              width={boxW}
              height={boxH}
              fill={fill}
              fillOpacity={isHighlight ? 1 : 0.55}
              stroke={isHighlight ? '#dc2626' : '#ffffff'}
              strokeWidth={isHighlight ? 3 : 1.5}
              rx={4}
            />
            <text
              x={x + boxW / 2}
              y={y + boxH / 2 + 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight={isHighlight ? 'bold' : 'normal'}
              fill="#ffffff"
            >
              {unit.unit_number.length > 8 ? unit.unit_number.slice(0, 8) : unit.unit_number}
            </text>
            {isHighlight && (
              <text
                x={x + boxW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#dc2626"
              >
                ★ ยูนิตนี้
              </text>
            )}
          </g>
        );
      })}

      {/* Facility area */}
      <g>
        <rect
          x={padX}
          y={facilityY}
          width={canvasW - padX * 2}
          height={facilityH}
          fill="#dbeafe"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          rx={8}
        />
        <text
          x={canvasW / 2}
          y={facilityY + facilityH / 2 + 4}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#1e40af"
        >
          🏊 สระว่ายน้ำ · 🏢 Club House · 🌳 สวนกลาง · 🚗 ที่จอดส่วนกลาง
        </text>
      </g>

      {/* Legend */}
      <g transform={`translate(${padX}, ${legendY})`}>
        <rect x={0} y={0} width={14} height={10} fill="#10b981" rx={2} />
        <text x={18} y={9} fontSize="10" fill="#374151">ว่าง</text>
        <rect x={60} y={0} width={14} height={10} fill="#f59e0b" rx={2} />
        <text x={78} y={9} fontSize="10" fill="#374151">จอง</text>
        <rect x={120} y={0} width={14} height={10} fill="#ef4444" rx={2} />
        <text x={138} y={9} fontSize="10" fill="#374151">ขายแล้ว</text>
        <rect x={200} y={0} width={14} height={10} fill="#dc2626" stroke="#dc2626" strokeWidth={2} fillOpacity={0.7} rx={2} />
        <text x={218} y={9} fontSize="10" fill="#374151">ยูนิตที่กำลังดู</text>
      </g>
    </svg>
  );
};

export default MasterPlanSVG;
