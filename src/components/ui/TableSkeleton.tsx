import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 6, columns = 7 }) => {
  return (
    <div className="w-full space-y-3 animate-pulse p-4">
      {/* Header Skeleton */}
      <div className="h-10 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full flex items-center px-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded flex-1" />
        ))}
      </div>

      {/* Row Skeletons */}
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div 
          key={rIdx} 
          className="h-14 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 rounded-xl w-full flex items-center px-4 gap-4"
        >
          <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700/60 rounded shrink-0" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded flex-1" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded flex-1" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700/60 rounded shrink-0" />
          <div className="h-6 w-28 bg-slate-200 dark:bg-slate-700/60 rounded-lg shrink-0" />
          <div className="h-6 w-28 bg-slate-200 dark:bg-slate-700/60 rounded-lg shrink-0" />
          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700/60 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
};
