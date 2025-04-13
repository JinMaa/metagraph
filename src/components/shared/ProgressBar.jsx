import React from 'react';

/**
 * ProgressBar Component
 * 
 * A custom progress bar component styled to look like Windows 98
 * 
 * @param {Object} props - Component props
 * @param {number} props.value - Current value (0-100)
 * @param {string} props.label - Optional label to display
 * @param {Object} props.style - Optional additional styles
 */
const ProgressBar = ({ value, label, style }) => {
  // Ensure value is between 0 and 100
  const safeValue = Math.min(Math.max(0, value), 100);
  
  // Create segments for the progress bar (Windows 98 style)
  const segments = [];
  const totalSegments = 10; // Windows 98 typically had 10 segments
  const filledSegments = Math.round(safeValue / 100 * totalSegments);
  
  for (let i = 0; i < totalSegments; i++) {
    segments.push(
      <div 
        key={i} 
        className={`segment ${i < filledSegments ? 'filled' : ''}`}
        style={{
          width: `${100 / totalSegments}%`,
          height: '8px',
          display: 'inline-block',
          backgroundColor: i < filledSegments ? '#000080' : '#c0c0c0',
          border: '1px solid #808080',
          boxSizing: 'border-box'
        }}
      />
    );
  }
  
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', ...style }}>
      <div 
        style={{ 
          flex: 1,
          height: '8px', 
          backgroundColor: '#c0c0c0',
          border: '1px inset #808080',
          padding: '1px',
          display: 'flex'
        }}
      >
        {segments}
      </div>
      {label && <div style={{ fontSize: '11px', width: '30px', textAlign: 'right' }}>{label}</div>}
    </div>
  );
};

export default ProgressBar;
