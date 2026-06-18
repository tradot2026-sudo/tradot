export default function DashboardLoading() {
  return (
    <div style={{ padding: '32px', display: 'grid', gap: '24px' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'grid', gap: '8px', maxWidth: '400px' }}>
        <div className="shimmer" style={{ height: '32px', width: '200px', borderRadius: '6px' }} />
        <div className="shimmer" style={{ height: '18px', width: '300px', borderRadius: '4px' }} />
      </div>

      {/* Stat Cards Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card shimmer" style={{ height: '130px', opacity: 0.7 }} />
        ))}
      </div>

      {/* Alert Cards Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card shimmer" style={{ height: '90px', opacity: 0.6 }} />
        ))}
      </div>

      {/* Content Grid Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card shimmer" style={{ height: '300px', opacity: 0.5 }} />
        ))}
      </div>
    </div>
  );
}
