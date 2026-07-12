// Temporary stub - will be replaced with real chart
export default function PnLChart({ data }: { data: { date: string; pnl: number }[] }) {
  if (data.length === 0) return <div className="h-48 flex items-center justify-center text-gray-400">No data</div>;
  
  return (
    <div className="h-48 flex items-end justify-between gap-1">
      {data.map((d, i) => {
        const height = Math.max(10, Math.min(90, 50 + d.pnl));
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div 
              className={`w-full rounded-t ${d.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ height: `${height}%` }}
              title={`${d.date}: $${d.pnl.toFixed(2)}`}
            />
            <span className="text-xs text-gray-500">{d.date}</span>
          </div>
        );
      })}
    </div>
  );
}