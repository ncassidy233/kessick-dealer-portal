import React from 'react';
import { ElevationModel } from '@/lib/elevation-model';
import { INSTALL_CLEARANCE_IN } from '@/lib/design-geometry';

interface ElevationRendererProps {
  model: ElevationModel;
  className?: string;
  showDimensions?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const ElevationRenderer: React.FC<ElevationRendererProps> = ({ model, className = "", showDimensions = true, svgRef }) => {
  const { width_px, height_px, pixelsPerInch, products, openings, obstructions, measures, annotations, issues } = model;
  
  // Format dimension nicely (inches to feet/inches)
  const formatDim = (px: number) => {
    const inches = px / pixelsPerInch;
    const ft = Math.floor(inches / 12);
    const inc = Math.round(inches % 12);
    if (ft === 0) return `${inc}"`;
    return `${ft}'-${inc}"`;
  };

  return (
    <svg 
      ref={svgRef}
      viewBox={`0 0 ${width_px} ${height_px}`} 
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full h-auto bg-white border border-gray-300 font-sans ${className}`}
      style={{ vectorEffect: 'non-scaling-stroke' }}
    >
      <defs>
        <pattern id="hatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#ccc" strokeWidth="1" />
        </pattern>
        <pattern id="clearance-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#f87171" strokeWidth="0.5" strokeDasharray="2 2" />
        </pattern>
      </defs>

      {/* Base Grid / Datum (Optional) */}
      <line x1="0" y1={height_px - 50} x2={width_px} y2={height_px - 50} stroke="#999" strokeWidth="1" strokeDasharray="5 5" />
      <text x="10" y={height_px - 35} fill="#666" fontSize="12" fontFamily="monospace">A.F.F. DATUM</text>

      {/* Openings */}
      {openings.map(op => (
        <g key={op.id}>
          <rect x={op.rect.x} y={op.rect.y} width={op.rect.w} height={op.rect.h} fill="none" stroke="#333" strokeWidth="2" />
          <line x1={op.rect.x} y1={op.rect.y} x2={op.rect.x + op.rect.w} y2={op.rect.y + op.rect.h} stroke="#ccc" strokeWidth="1" />
          <line x1={op.rect.x + op.rect.w} y1={op.rect.y} x2={op.rect.x} y2={op.rect.y + op.rect.h} stroke="#ccc" strokeWidth="1" />
          <text x={op.rect.x + 5} y={op.rect.y + 15} fill="#333" fontSize="12" fontWeight="bold">{op.openingType.toUpperCase()}</text>
          {showDimensions && (
            <text x={op.rect.x + op.rect.w/2} y={op.rect.y + op.rect.h + 15} fill="#666" fontSize="10" textAnchor="middle">
              {formatDim(op.rect.w)} W × {formatDim(op.rect.h)} H
            </text>
          )}
        </g>
      ))}

      {/* Obstructions */}
      {obstructions.map(ob => (
        <g key={ob.id}>
          <rect x={ob.rect.x} y={ob.rect.y} width={ob.rect.w} height={ob.rect.h} fill="url(#hatch)" stroke="#666" strokeWidth="1" />
          
          {/* Clearance Envelope */}
          <rect 
            x={ob.rect.x - (INSTALL_CLEARANCE_IN * pixelsPerInch)} 
            y={ob.rect.y - (INSTALL_CLEARANCE_IN * pixelsPerInch)} 
            width={ob.rect.w + (INSTALL_CLEARANCE_IN * 2 * pixelsPerInch)} 
            height={ob.rect.h + (INSTALL_CLEARANCE_IN * 2 * pixelsPerInch)} 
            fill="url(#clearance-hatch)" 
            stroke="#f87171" 
            strokeWidth="1" 
            strokeDasharray="4 4"
            opacity="0.5"
          />

          <text x={ob.rect.x + ob.rect.w/2} y={ob.rect.y - 5} fill="#333" fontSize="10" textAnchor="middle" fontWeight="bold">
            {ob.obstructionType.toUpperCase()}
          </text>
        </g>
      ))}

      {/* Products */}
      {products.map(({ inst, product }, i) => {
        const w = product.width_in * pixelsPerInch * inst.scaleX;
        const h = product.height_in * pixelsPerInch * inst.scaleY;
        const hasIssue = issues.some(iss => inst.instanceId === iss.instanceId);
        
        return (
          <g key={inst.instanceId} transform={`translate(${inst.x}, ${inst.y})`}>
            <rect 
              x="0" y="0" 
              width={w} height={h} 
              fill="#f8f9fa" 
              stroke={hasIssue ? "#ef4444" : "#000"} 
              strokeWidth={hasIssue ? "3" : "2"} 
            />
            {/* Outline inner to make it look like a cabinet */}
            <rect x="4" y="4" width={w-8} height={h-8} fill="none" stroke="#999" strokeWidth="1" />
            
            <text x={w/2} y={h/2 - 5} fill="#000" fontSize="12" textAnchor="middle" fontWeight="bold">
              {product.sku}
            </text>
            <text x={w/2} y={h/2 + 10} fill="#666" fontSize="10" textAnchor="middle">
              {product.series}
            </text>
            <text x={w/2} y={h/2 + 25} fill="#666" fontSize="9" textAnchor="middle">
              {product.width_in}"W × {product.height_in}"H
            </text>

            <circle cx="15" cy="15" r="10" fill="#000" />
            <text x="15" y="19" fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold">{i + 1}</text>
          </g>
        );
      })}

      {/* Manual Measures */}
      {showDimensions && measures.map(m => (
        <g key={m.id}>
          <line x1={m.start.x} y1={m.start.y} x2={m.end.x} y2={m.end.y} stroke="#0284c7" strokeWidth="1" />
          <line x1={m.start.x-5} y1={m.start.y-5} x2={m.start.x+5} y2={m.start.y+5} stroke="#0284c7" strokeWidth="1" />
          <line x1={m.end.x-5} y1={m.end.y-5} x2={m.end.x+5} y2={m.end.y+5} stroke="#0284c7" strokeWidth="1" />
          
          <rect 
            x={(m.start.x + m.end.x)/2 - 25} 
            y={(m.start.y + m.end.y)/2 - 10} 
            width="50" height="20" 
            fill="white" 
          />
          <text 
            x={(m.start.x + m.end.x)/2} 
            y={(m.start.y + m.end.y)/2 + 4} 
            fill="#0284c7" 
            fontSize="12" 
            textAnchor="middle" 
            fontWeight="bold"
          >
            {formatDim(Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y))}
          </text>
        </g>
      ))}

      {/* Annotations */}
      {annotations.map(a => (
        <g key={a.id} transform={`translate(${a.point.x}, ${a.point.y})`}>
          <circle cx="0" cy="0" r="4" fill={a.severity === 'danger' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#3b82f6'} />
          <text x="8" y="4" fill="#333" fontSize="12" fontWeight="bold" style={{ textShadow: "1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff" }}>
            {a.text}
          </text>
        </g>
      ))}
    </svg>
  );
}