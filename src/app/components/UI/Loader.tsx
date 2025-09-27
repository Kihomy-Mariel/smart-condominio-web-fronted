export function Loader({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div style={{ display:'grid', placeItems:'center', minHeight: '50vh' }}>
      <div className="card" style={{ textAlign:'center' }}>
        <div className="spinner" style={{ width:32, height:32, border:'3px solid #eee', borderTopColor:'#088fcd', borderRadius:'50%', margin:'0 auto 12px', animation:'spin 1s linear infinite' }} />
        <div>{label}</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
