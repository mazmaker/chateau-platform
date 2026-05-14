
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface StatusData {
  label: string;
  percent: number;
  value: number;
  color: string;
}

export const StatusReport = () => {
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxValue, setMaxValue] = useState(100);

  useEffect(() => {
    fetchStatusData();
  }, []);

  const fetchStatusData = async () => {
    setLoading(true);
    try {
      // Fetch invoice status data
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('status');

      if (error) throw error;

      if (invoices && invoices.length > 0) {
        // Count invoices by status
        const statusCount = invoices.reduce((acc, invoice) => {
          acc[invoice.status] = (acc[invoice.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const total = invoices.length;
        const maxVal = Math.max(...(Object.values(statusCount) as number[]));

        const statusMapping = [
          { key: 'pending', label: "รอชำระ", color: "hsl(276, 42%, 53%)" },
          { key: 'paid', label: "ชำระแล้ว", color: "hsl(145, 63%, 49%)" },
          { key: 'overdue', label: "เกินกำหนด", color: "hsl(4, 78%, 56%)" },
          { key: 'cancelled', label: "ยกเลิก", color: "hsl(340, 82%, 65%)" },
        ];

        const processedData = statusMapping
          .filter(status => statusCount[status.key] > 0)
          .map(status => ({
            label: status.label,
            value: statusCount[status.key] || 0,
            percent: total > 0 ? Number(((statusCount[status.key] || 0) / total * 100).toFixed(1)) : 0,
            color: status.color
          }))
          .sort((a, b) => b.value - a.value);

        setStatusData(processedData);
        setMaxValue(maxVal > 0 ? maxVal : 100);
      } else {
        setStatusData([]);
        setMaxValue(100);
      }
    } catch (error) {
      console.error('Error fetching status data:', error);
      setStatusData([]);
      setMaxValue(100);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 card-shadow h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">รายงานสถานะใบแจ้งหนี้</h3>
      <div className="space-y-3">
        {statusData.length > 0 ? (
          statusData.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-16 text-xs text-muted-foreground truncate">{item.label}</span>
              <div
                className="px-2 py-0.5 rounded text-white text-[10px] font-medium min-w-[40px] text-center"
                style={{ backgroundColor: item.color }}
              >
                {item.percent}%
              </div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
              <span className="w-10 text-right text-xs font-medium text-foreground">{item.value}</span>
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            ไม่มีข้อมูลใบแจ้งหนี้
          </div>
        )}
      </div>
      {statusData.length > 0 && (
        <div className="flex justify-between text-[10px] text-muted-foreground mt-3 pl-[100px]">
          <span>0</span>
          <span>{Math.floor(maxValue * 0.2)}</span>
          <span>{Math.floor(maxValue * 0.4)}</span>
          <span>{Math.floor(maxValue * 0.6)}</span>
          <span>{Math.floor(maxValue * 0.8)}</span>
          <span>{maxValue}</span>
        </div>
      )}
    </div>
  );
};
