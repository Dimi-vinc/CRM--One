import { useEffect, useState } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, EmptyState, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../lib/utils';
import type { NotificationRow } from '../../lib/types';

export function Notifications() {
  const { tenant, profile } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);

  const load = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('notifications').select('*').eq('user_id', profile?.id).order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [tenant, profile?.id]);

  const markRead = async (n: NotificationRow) => {
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
  };

  const markAll = async () => {
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile?.id);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  const unread = items.filter(n => !n.read).length;

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread} non lue${unread > 1 ? 's' : ''}`}
        actions={unread > 0 && <Button variant="secondary" onClick={markAll}><Check size={16} /> Tout marquer lu</Button>} />
      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Bell} title="Aucune notification" description="Vous serez notifié des activités importantes ici." /></Card>
      ) : (
        <Card className="divide-y divide-gray-50">
          {items.map(n => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read ? 'bg-coral-50/30' : ''}`}>
              <div className={`rounded-lg p-2.5 ${!n.read ? 'bg-coral-100 text-coral-700' : 'bg-gray-100 text-gray-500'}`}><Bell size={18} /></div>
              <div className="flex-1">
                <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                {n.body && <p className="text-sm text-gray-500">{n.body}</p>}
                <p className="mt-0.5 text-xs text-gray-400">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && <button onClick={() => markRead(n)} className="rounded-lg p-1.5 text-gray-400 hover:bg-mint-50 hover:text-mint-600"><Check size={15} /></button>}
              <button onClick={() => remove(n.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
