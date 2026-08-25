import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney, getLocale } from '../../lib/utils';
import type { Deal, Activity, Task } from '../../lib/types';

export function Calendar() {
  const { tenant } = useAuth();
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<{ date: string; label: string; color: string; amount?: string }[]>([]);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const [d, a, t] = await Promise.all([
        supabase.from('deals').select('*').limit(3000),
        supabase.from('activities').select('*').limit(3000),
        supabase.from('tasks').select('*').limit(3000),
      ]);
      const ev: { date: string; label: string; color: string; amount?: string }[] = [];
      (d.data as Deal[] || []).forEach(x => x.expected_close_date && ev.push({ date: x.expected_close_date, label: x.title, color: 'coral', amount: formatMoney(x.amount, x.currency_code) }));
      (a.data as Activity[] || []).forEach(x => x.due_at && ev.push({ date: x.due_at.slice(0, 10), label: x.title, color: 'blue' }));
      (t.data as Task[] || []).forEach(x => x.due_date && ev.push({ date: x.due_date, label: x.title, color: 'teal' }));
      setEvents(ev);
    })();
  }, [tenant]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const days = Array.from({ length: last.getDate() }, (_, i) => i + 1);
  const cells = [...Array(startPad).fill(null), ...days];
  const monthLabel = cursor.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
  // Jan 1, 2024 was a Monday, so days 1..7 of that month give Mon..Sun in order for any locale —
  // avoids hardcoding weekday names in one language (was previously French-only, regardless of
  // the app's selected language).
  const weekdayFormatter = new Intl.DateTimeFormat(getLocale(), { weekday: 'short' });
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map(d => weekdayFormatter.format(new Date(2024, 0, d)));
  const evOn = (day: number) => events.filter(e => e.date === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div>
      <PageHeader title="Calendrier" subtitle="Deals, activités et tâches"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></Button>
            <span className="min-w-[140px] text-center text-sm font-medium capitalize">{monthLabel}</span>
            <Button variant="secondary" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></Button>
            <Button variant="ghost" onClick={() => setCursor(new Date())}>Aujourd'hui</Button>
          </div>
        } />

      <Card className="p-4">
        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-gray-500">
          {weekdays.map(d => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => (
            <div key={i} className={`min-h-[88px] rounded-lg border p-1.5 ${d ? 'border-gray-100 bg-white' : 'border-transparent'}`}>
              {d && (
                <>
                  <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday(d) ? 'bg-coral-500 text-white' : 'text-gray-600'}`}>{d}</div>
                  <div className="space-y-1">
                    {evOn(d).slice(0, 3).map((e, j) => (
                      <div key={j} className={`truncate rounded px-1.5 py-0.5 text-[10px] ${e.color === 'coral' ? 'bg-coral-50 text-coral-700' : e.color === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-tealx-50 text-tealx-700'}`} title={e.label}>
                        {e.label}
                      </div>
                    ))}
                    {evOn(d).length > 3 && <p className="text-[10px] text-gray-400">+{evOn(d).length - 3} autres</p>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
