import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Batch, Shipment, PeriodReport, Facility, Anomaly } from '../../types';
import { periodMetrics, MetricBatch, MetricShipment } from '../../engine';

export function useDashboard() {
  // 1. Facilities
  const { data: facilities = [], isLoading: isLoadingFac } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      const { data } = await supabase.from('facilities').select('*').order('name');
      return (data || []) as Facility[];
    },
  });

  // 2. Closed Period Reports
  const { data: reports = [], isLoading: isLoadingRep } = useQuery<PeriodReport[]>({
    queryKey: ['period_reports', 'all', 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      const { data } = await supabase.from('period_reports').select('*').order('period_end', { ascending: false });
      return (data || []) as PeriodReport[];
    },
  });

  // 3. Batches
  const { data: batches = [], isLoading: isLoadingBatch } = useQuery<Batch[]>({
    queryKey: ['dashboard_batches'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      const { data } = await supabase.from('batches').select('*');
      return (data || []) as Batch[];
    },
  });

  // 4. Shipments with lines & confirmations
  const { data: shipments = [], isLoading: isLoadingShp } = useQuery<Shipment[]>({
    queryKey: ['dashboard_shipments'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      const { data } = await supabase
        .from('shipments')
        .select(`
          *,
          lines:shipment_lines(*),
          confirmation:confirmations(*)
        `);
      return (data || []).map((r: any) => ({
        ...r,
        confirmation: r.confirmation?.[0] || r.confirmation || null,
        weight_sent_kg: (r.lines || []).reduce((sum: number, l: any) => sum + Number(l.weight_kg || 0), 0),
      })) as Shipment[];
    },
  });

  // 5. Anomalies
  const { data: anomalies = [], isLoading: isLoadingAnom } = useQuery<Anomaly[]>({
    queryKey: ['anomalies', 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      const { data } = await supabase.from('anomalies').select('*');
      return (data || []) as Anomaly[];
    },
  });

  // Real-time aggregate metric calculation using engine periodMetrics
  const aggregateMetrics = useMemo(() => {
    const metricBatches: MetricBatch[] = batches.map((b) => ({
      id: b.id,
      mIn: b.weight_in_total_kg,
      closed: b.status === 'ditutup',
      r12: b.balance_status === 'ditandai' ? 'active' : 'none',
    }));

    const metricShipments: MetricShipment[] = shipments.map((s) => ({
      id: s.id,
      purpose: s.purpose as any,
      wSent: s.weight_sent_kg || 0,
      wReceived: s.confirmation?.weight_received_kg ?? null,
      confirmed: s.status === 'dikonfirmasi',
      batchIds: (s.lines || []).map((l: any) => l.batch_id).filter(Boolean),
    }));

    const totalReportedRecycled = reports.reduce((sum, r) => sum + (r.reported_recycled_kg || 0), 0);

    return periodMetrics({
      batches: metricBatches,
      shipments: metricShipments,
      reportedRecycledKg: totalReportedRecycled,
      tauD: 0.05,
    });
  }, [batches, shipments, reports]);

  const isLoading = isLoadingFac || isLoadingRep || isLoadingBatch || isLoadingShp || isLoadingAnom;

  return {
    facilities,
    reports,
    batches,
    shipments,
    anomalies,
    aggregateMetrics,
    isLoading,
  };
}
