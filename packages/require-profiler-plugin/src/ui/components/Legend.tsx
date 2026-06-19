export const Legend = () => {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-surface border-t border-border text-xs shrink-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#e63946' }} />
        <span className="text-muted whitespace-nowrap">Expensive init ({'>'}70%)</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#f4a261' }} />
        <span className="text-muted whitespace-nowrap">Moderate init (40–70%)</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#2a9d8f' }} />
        <span className="text-muted whitespace-nowrap">Light init (20–40%)</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#457b9d' }} />
        <span className="text-muted whitespace-nowrap">Minimal init ({'<'}20%)</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: '#3d5a80' }} />
        <span className="text-muted whitespace-nowrap">No own time (0ms)</span>
      </div>
    </div>
  );
};
