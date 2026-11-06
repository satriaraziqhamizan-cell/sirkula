import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Facility, PeriodReport, Batch, Anomaly, Shipment } from '../../types';
import { useDashboard } from '../../features/dashboard/useDashboard';
import {
  Building2,
  AlertTriangle,
  Scale,
  MapPin,
  TrendingDown,
  Download,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Loader2,
  BarChart3,
  Layers,
  Info,
} from 'lucide-react';
import { interpretGap } from '../../engine';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DinasDashboardProps {
  facilities?: Facility[];
  reports?: PeriodReport[];
  batches?: Batch[];
  shipments?: Shipment[];
  anomalies?: Anomaly[];
  onNavigateToPublicVerification?: (reportId: string) => void;
}

// Custom Marker Pin for Leaflet
const createPinIcon = (openAnomalies: number, gap: number) => {
  const bgColor = openAnomalies > 0 || gap > 0.1 ? '#DC2626' : gap > 0.05 ? '#D97706' : '#0F6B4F';
  return L.divIcon({
    className: 'custom-facility-pin',
    html: `<div style="background-color: ${bgColor}; width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">🏢</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

export const DinasDashboard: React.FC<DinasDashboardProps> = (props) => {
  const navigate = useNavigate();
  const hookData = useDashboard();

  const facilities = props.facilities || hookData.facilities;
  const reports = props.reports || hookData.reports;
  const batches = props.batches || hookData.batches;
  const shipments = props.shipments || hookData.shipments;
  const anomalies = props.anomalies || hookData.anomalies;
  const onNavigateToPublicVerification =
    props.onNavigateToPublicVerification || ((id: string) => navigate(`/verifikasi/${id}`));

  const [activeTab, setActiveTab] = useState<'priority' | 'trends' | 'map'>('priority');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Overall aggregates
  const totalIn = reports.reduce((acc, r) => acc + (r.total_in_kg || 0), 0);
  const totalVerified = reports.reduce((acc, r) => acc + (r.verified_kg || 0), 0);
  const totalReported = reports.reduce((acc, r) => acc + ((r.rr || 0) * (r.total_in_kg || 0)), 0);

  const avgVRR = totalIn > 0 ? (totalVerified / totalIn) * 100 : 0;
  const avgRR = totalIn > 0 ? (totalReported / totalIn) * 100 : 0;
  const avgGap = avgRR - avgVRR;

  // Combine facility with latest report
  const facilityRows = facilities.map((fac) => {
    const rep = reports.find((r) => r.facility_id === fac.id);
    const facBatches = batches.filter((b) => b.facility_id === fac.id);
    const facAnoms = anomalies.filter((a) => a.facility_id === fac.id && a.status === 'open');
    const facShipments = shipments.filter((s) => s.facility_id === fac.id);

    const vrr = rep?.vrr ?? 0;
    const rr = rep?.rr ?? 0;
    const gap = rep?.gap ?? (rr - vrr);
    const coverage = rep?.coverage?.traceablePct ?? 1.0;
    const lowCoverage = coverage < 0.6;

    return {
      facility: fac,
      report: rep,
      vrr,
      rr,
      gap,
      lowCoverage,
      coverage,
      openAnomaliesCount: facAnoms.length,
      shipmentsCount: facShipments.length,
      batchesCount: facBatches.length,
    };
  });

  // Sort priority: high gap first, high open anomalies
  const rankedFacilities = [...facilityRows]
    .filter(
      (f) =>
        f.facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.facility.city.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (b.openAnomaliesCount !== a.openAnomaliesCount) {
        return b.openAnomaliesCount - a.openAnomaliesCount;
      }
      return b.gap - a.gap;
    });

  // Trend data for recharts
  const trendData = reports
    .map((r) => ({
      period: `${r.period_start?.slice(5)} s.d. ${r.period_end?.slice(5)}`,
      rr: Number(((r.rr || 0) * 100).toFixed(1)),
      vrr: Number(((r.vrr || 0) * 100).toFixed(1)),
      gap: Number(((r.gap || 0) * 100).toFixed(1)),
    }))
    .slice(0, 8);

  const handleExportCSV = () => {
    const headers = [
      'Facility_Name',
      'Province',
      'City',
      'Reported_RR_Pct',
      'Verified_VRR_Pct',
      'Gap_Pct',
      'Open_Anomalies',
      'Total_Batches',
    ];
    const rows = facilityRows.map((f) => [
      f.facility.name,
      f.facility.province,
      f.facility.city,
      (f.rr * 100).toFixed(1) + '%',
      (f.vrr * 100).toFixed(1) + '%',
      (f.gap * 100).toFixed(1) + '%',
      f.openAnomaliesCount,
      f.batchesCount,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `SIRKULA_Dinas_Prioritas_Audit_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-[#E4E7EC] px-4 py-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#0F6B4F] uppercase tracking-wider">
                Portal Pengawasan Daerah
              </span>
              <span className="text-xs font-semibold text-[#667085]">
                · Wilayah: Jawa Tengah
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#101828] mt-0.5">
              Dinas Lingkungan Hidup &amp; Pengelolaan Sampah
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white border border-[#E4E7EC] hover:bg-slate-50 text-xs font-bold text-[#344054] rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#0F6B4F]" />
              <span>Unduh CSV Rekap</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-[#E4E7EC] shadow-2xs space-y-1">
            <span className="text-xs text-[#667085]">Verified Recycling Rate (VRR)</span>
            <div className="text-2xl font-extrabold text-[#0B3D2E] font-mono">
              {avgVRR.toFixed(1)}%
            </div>
            <span className="text-[11px] text-[#0F6B4F] block">
              Dikonfirmasi timbangan penerima resmi
            </span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#E4E7EC] shadow-2xs space-y-1">
            <span className="text-xs text-[#667085]">Klaim Laporan Pengelola (RR)</span>
            <div className="text-2xl font-extrabold text-slate-800 font-mono">
              {avgRR.toFixed(1)}%
            </div>
            <span className="text-[11px] text-[#667085] block">
              Berdasarkan catatan timbangan keluar
            </span>
          </div>

          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
            <span className="text-xs font-bold text-amber-900">Selisih Verifikasi (Gap)</span>
            <div className="text-2xl font-extrabold text-amber-950 font-mono">
              {avgGap >= 0 ? '+' : ''}{avgGap.toFixed(1)}%
            </div>
            <span className="text-[11px] text-amber-800 block">
              {interpretGap(avgGap / 100)}
            </span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#E4E7EC] shadow-2xs space-y-1">
            <span className="text-xs text-[#667085]">Fasilitas Aktif Terpantau</span>
            <div className="text-2xl font-extrabold text-[#101828] font-mono">
              {facilities.length} Lokasi
            </div>
            <span className="text-[11px] text-[#667085] block">
              {anomalies.filter((a) => a.status === 'open').length} anomali memerlukan tinjauan
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[#E4E7EC] pb-2">
          {[
            { id: 'priority', label: `Daftar Prioritas Audit (${rankedFacilities.length})` },
            { id: 'trends', label: 'Grafik Tren Verifikasi' },
            { id: 'map', label: 'Peta Fasilitas Terpantau' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#0F6B4F] text-white shadow-2xs font-bold'
                  : 'text-[#667085] hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: PRIORITY AUDIT LIST */}
        {activeTab === 'priority' && (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#101828]">Daftar Prioritas Audit Fasilitas</h2>
                <p className="text-xs text-[#667085] mt-0.5">
                  Fasilitas diurutkan berdasarkan jumlah anomali terbuka dan besaran selisih (Gap).
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#667085]" />
                <input
                  type="text"
                  placeholder="Cari fasilitas / kota..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAF9] border border-[#E4E7EC] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-[#E4E7EC] rounded-xl overflow-hidden">
                <thead className="bg-[#F8FAF9] text-[#101828] font-bold border-b border-[#E4E7EC]">
                  <tr>
                    <th className="p-3">Nama Fasilitas</th>
                    <th className="p-3">Lokasi</th>
                    <th className="p-3">Klaim (RR)</th>
                    <th className="p-3">Terverifikasi (VRR)</th>
                    <th className="p-3">Selisih (Gap)</th>
                    <th className="p-3">Anomali Terbuka</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {rankedFacilities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[#667085]">
                        Tidak ada data fasilitas yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    rankedFacilities.map((f) => (
                      <tr key={f.facility.id} className="hover:bg-[#F8FAF9]/80 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-[#101828] block">{f.facility.name}</span>
                          <span className="text-[11px] text-[#667085]">
                            {f.facility.public_alias || f.facility.id.slice(0, 8)} {f.facility.is_demo ? '· (Demo)' : ''}
                          </span>
                        </td>
                        <td className="p-3 text-[#667085]">
                          {f.facility.city}, {f.facility.province}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-800">
                          {(f.rr * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 font-mono font-bold text-[#0F6B4F]">
                          {(f.vrr * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              f.gap > 0.1
                                ? 'bg-rose-50 text-rose-700'
                                : f.gap > 0.05
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {f.gap >= 0 ? '+' : ''}{(f.gap * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">
                          {f.openAnomaliesCount > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[11px]">
                              {f.openAnomaliesCount} Perlu Tinjauan
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Nihil
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedFacility(f.facility)}
                            className="px-3 py-1 bg-slate-100 hover:bg-[#0F6B4F] hover:text-white text-[#344054] rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Inspeksi
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: RECHARTS TRENDS */}
        {activeTab === 'trends' && (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-2xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#101828]">Grafik Tren Verifikasi Neraca Massa</h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Perbandingan laju daur ulang yang diklaim (RR) dengan hasil terverifikasi penerima (VRR).
              </p>
            </div>

            {trendData.length === 0 ? (
              <div className="p-12 text-center text-[#667085] text-xs">
                Belum ada data laporan periode resmi untuk menampilkan grafik tren.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#667085' }} />
                    <YAxis unit="%" tick={{ fontSize: 11, fill: '#667085' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#E4E7EC',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="rr"
                      name="Klaim Laporan (RR %)"
                      stroke="#475467"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="vrr"
                      name="Terverifikasi (VRR %)"
                      stroke="#0F6B4F"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gap"
                      name="Selisih (Gap %)"
                      stroke="#D97706"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LEAFLET MAP */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#101828]">Peta Distribusi Fasilitas TPS 3R</h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Titik koordinat geografis fasilitas terpantau dengan indikator status verifikasi.
              </p>
            </div>

            <div className="h-96 w-full rounded-2xl overflow-hidden border border-[#E4E7EC] relative z-0">
              <MapContainer
                center={[-7.0, 110.42]}
                zoom={10}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {facilityRows.map((f) => (
                  <Marker
                    key={f.facility.id}
                    position={[Number(f.facility.lat || -7.0), Number(f.facility.lng || 110.42)]}
                    icon={createPinIcon(f.openAnomaliesCount, f.gap)}
                  >
                    <Popup>
                      <div className="text-xs space-y-1.5 p-1 min-w-[160px]">
                        <strong className="block text-sm text-[#101828]">{f.facility.name}</strong>
                        <span className="text-[#667085] block">{f.facility.city}</span>
                        <div className="pt-1 border-t border-[#E4E7EC] flex justify-between">
                          <span>VRR:</span>
                          <strong className="text-[#0F6B4F]">{(f.vrr * 100).toFixed(1)}%</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Anomali:</span>
                          <strong className={f.openAnomaliesCount > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                            {f.openAnomaliesCount}
                          </strong>
                        </div>
                        <button
                          onClick={() => setSelectedFacility(f.facility)}
                          className="w-full mt-2 py-1 bg-[#0F6B4F] text-white rounded text-[11px] font-bold cursor-pointer"
                        >
                          Lihat Detail
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </div>

      {/* Facility Inspection Drawer/Modal */}
      {selectedFacility && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-[#E4E7EC] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAF9]">
              <div>
                <span className="text-xs font-bold text-[#0F6B4F] uppercase">Inspeksi Fasilitas</span>
                <h3 className="text-base font-bold text-[#101828]">{selectedFacility.name}</h3>
              </div>
              <button
                onClick={() => setSelectedFacility(null)}
                className="p-1.5 text-[#667085] hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F8FAF9] border border-[#E4E7EC]">
                <div>
                  <span className="text-[#667085]">Tipe Fasilitas:</span>
                  <span className="font-bold text-[#101828] block uppercase">
                    {selectedFacility.facility_type}
                  </span>
                </div>
                <div>
                  <span className="text-[#667085]">Koordinat:</span>
                  <span className="font-mono text-[#101828] block">
                    {selectedFacility.lat}, {selectedFacility.lng}
                  </span>
                </div>
                <div>
                  <span className="text-[#667085]">Resolusi Timbangan:</span>
                  <span className="font-mono text-[#101828] block">
                    {selectedFacility.scale_resolution_kg || 0.1} kg
                  </span>
                </div>
                <div>
                  <span className="text-[#667085]">Toleransi Waktu Konfirmasi:</span>
                  <span className="font-mono text-[#101828] block">
                    {selectedFacility.ack_timeout_hours || 72} jam
                  </span>
                </div>
              </div>

              {/* Anomaly list for this facility */}
              <div className="space-y-2">
                <span className="font-bold text-[#344054] block">Anomali Terbuka:</span>
                {anomalies.filter((a) => a.facility_id === selectedFacility.id && a.status === 'open').length === 0 ? (
                  <p className="p-3 bg-emerald-50 rounded-xl text-emerald-800 text-xs">
                    ✓ Tidak ada anomali terbuka pada fasilitas ini.
                  </p>
                ) : (
                  anomalies
                    .filter((a) => a.facility_id === selectedFacility.id && a.status === 'open')
                    .map((a) => (
                      <div key={a.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs space-y-1">
                        <div className="flex justify-between font-bold text-rose-900">
                          <span>Aturan {a.rule_code}</span>
                          <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-rose-200">
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-rose-800 text-[11px]">{a.reason_text}</p>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#E4E7EC] bg-[#F8FAF9] flex justify-end">
              <button
                onClick={() => setSelectedFacility(null)}
                className="px-4 py-2 bg-[#0F6B4F] text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
