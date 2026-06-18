export default function ClientsLoading() {
  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div className="shimmer" style={{ height: '32px', width: '150px', borderRadius: '6px' }} />
          <div className="shimmer" style={{ height: '18px', width: '100px', borderRadius: '4px' }} />
        </div>
        <div className="shimmer" style={{ height: '40px', width: '130px', borderRadius: '10px' }} />
      </div>

      {/* Search Input Skeleton */}
      <div className="shimmer" style={{ height: '42px', width: '100%', maxWidth: '420px', borderRadius: '10px', marginBottom: '24px' }} />

      {/* Table Skeleton */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th>Plans</th>
              <th>Total Invested</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="shimmer" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <div className="shimmer" style={{ height: '16px', width: '120px', borderRadius: '4px' }} />
                      <div className="shimmer" style={{ height: '12px', width: '80px', borderRadius: '4px' }} />
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <div className="shimmer" style={{ height: '14px', width: '100px', borderRadius: '4px' }} />
                  </div>
                </td>
                <td>
                  <div className="shimmer" style={{ height: '16px', width: '40px', borderRadius: '4px' }} />
                </td>
                <td>
                  <div className="shimmer" style={{ height: '16px', width: '85px', borderRadius: '4px' }} />
                </td>
                <td>
                  <div className="shimmer" style={{ height: '14px', width: '80px', borderRadius: '4px' }} />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="shimmer" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                    <div className="shimmer" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                    <div className="shimmer" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
