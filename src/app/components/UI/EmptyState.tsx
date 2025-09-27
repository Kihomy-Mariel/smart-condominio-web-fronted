export default function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="card" style={{ textAlign:'center' }}>
      <h3 style={{ marginTop:0 }}>{title}</h3>
      {subtitle && <p style={{ color:'#666' }}>{subtitle}</p>}
    </div>
  )
}
