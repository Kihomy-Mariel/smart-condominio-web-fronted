// src/app/pages/reportes/ReportesUsoAreasPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  listAllSolicitudes,
  filtrarSolicitudes,
  kpisPorArea
} from "../../../services/reportes.service";
import type { Solicitud, EstadoSolicitud } from "../../../services/reportes.service";
import { api } from "../../../services/api";
import { Loader } from "../../components/UI/Loader"; // usa export nombrado
import { RotateCw, Download } from "lucide-react"; // 👈 íconos

// --- Tipos locales ---
type Area = { id: number; nombre: string; estado: "ACTIVO" | "INACTIVO" };

// --- Normalizador de DRF ---
function normalizeList<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  return [];
}

// --- Cargar áreas ---
async function listAreas(): Promise<Area[]> {
  const { data } = await api.get("/espacioscomunes/", { params: { page_size: 1000 } });
  return normalizeList<Area>(data).filter((a: Area) => a.estado === "ACTIVO");
}

// --- CSV simple ---
function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => JSON.stringify((r as any)[h] ?? "")).join(","));
  return [headers.join(","), ...body].join("\n");
}

export default function ReportesUsoAreasPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // filtros
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 29 * 24 * 60 * 60 * 1000);
  const [areaId, setAreaId] = useState<number | "all">("all");
  const [desde, setDesde] = useState<string>(hace30.toISOString().slice(0, 10));
  const [hasta, setHasta] = useState<string>(hoy.toISOString().slice(0, 10));
  const [estado, setEstado] = useState<EstadoSolicitud | "all">("all");

  // carga inicial
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [rows, ars] = await Promise.all([
          listAllSolicitudes(200, 200),
          listAreas(),
        ]);
        if (!alive) return;
        setSolicitudes(rows);
        setAreas(ars);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error cargando datos";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false };
  }, []);

  // diccionario id->nombre
  const areaNameById = useMemo(() => {
    const m: Record<number, string> = {};
    areas.forEach((a: Area) => { m[a.id] = a.nombre });
    return m;
  }, [areas]);

  // aplicar filtros
  const filtradas = useMemo(() => {
    return filtrarSolicitudes(solicitudes, {
      areaId: areaId === "all" ? undefined : areaId,
      desde,
      hasta,
      estado: estado === "all" ? undefined : estado,
    });
  }, [solicitudes, areaId, desde, hasta, estado]);

  // KPIs por área
  const kpis = useMemo(() => {
    const rows = kpisPorArea(filtradas).map((r) => ({
      areaId: r.areaId,
      area: areaNameById[r.areaId] ?? `Área ${r.areaId}`,
      total: r.total,
      aprobadas: r.aprobadas,
      canceladas: r.canceladas,
      rechazadas: r.rechazadas,
      horasReservadas: Number(r.horasReservadas.toFixed(2)),
    }));
    rows.sort((a, b) => b.horasReservadas - a.horasReservadas);
    return rows;
  }, [filtradas, areaNameById]);

  // exportar CSV
  const handleExportCSV = () => {
    const csv = toCSV(kpis as unknown as Record<string, unknown>[]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_uso_areas_${desde}_a_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader />;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">📊 Reporte de uso de áreas comunes</h1>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Área</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={areaId === "all" ? "all" : String(areaId)}
            onChange={(e) => {
              const v = e.target.value;
              setAreaId(v === "all" ? "all" : Number(v));
            }}
          >
            <option value="all">Todas</option>
            {areas.map((a: Area) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Desde</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Hasta</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Estado</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoSolicitud | "all")}
          >
            <option value="all">Todos</option>
            <option value="APROBADA">APROBADA</option>
            <option value="CANCELADA">CANCELADA</option>
            <option value="RECHAZADA">RECHAZADA</option>
            <option value="PENDIENTE">PENDIENTE</option>
          </select>
        </div>

        {/* Botones mejorados */}
        <div className="flex gap-2">
          <button
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 font-medium shadow hover:bg-blue-700 transition"
            onClick={async () => {
              try {
                setLoading(true);
                const rows = await listAllSolicitudes(200, 200);
                setSolicitudes(rows);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error recargando solicitudes";
                setError(msg);
              } finally {
                setLoading(false);
              }
            }}
          >
            <RotateCw className="h-4 w-4" />
            Recargar
          </button>

          <button
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white px-4 py-2 font-medium shadow hover:bg-green-700 transition"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Mostrando <b>{filtradas.length}</b> solicitudes (filtros aplicados).
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Área</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">Aprobadas</th>
              <th className="text-right px-3 py-2">Canceladas</th>
              <th className="text-right px-3 py-2">Rechazadas</th>
              <th className="text-right px-3 py-2">Horas reservadas</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((row) => (
              <tr key={row.areaId} className="border-t">
                <td className="px-3 py-2">{row.area}</td>
                <td className="px-3 py-2 text-right">{row.total}</td>
                <td className="px-3 py-2 text-right">{row.aprobadas}</td>
                <td className="px-3 py-2 text-right">{row.canceladas}</td>
                <td className="px-3 py-2 text-right">{row.rechazadas}</td>
                <td className="px-3 py-2 text-right">{row.horasReservadas.toFixed(2)}</td>
              </tr>
            ))}
            {!kpis.length && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                  No hay datos para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
