import { Link } from 'react-router-dom'
export default function NotFoundPage(){
  return (
    <div className="card" style={{ textAlign:'center' }}>
      <h2>404</h2>
      <p>Página no encontrada</p>
      <Link to="/" className="btn">Volver al inicio</Link>
    </div>
  )
}
