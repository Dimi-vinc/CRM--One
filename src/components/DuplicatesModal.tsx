import { useState } from 'react';
import { Copy, Merge, Loader2 } from 'lucide-react';
import { Modal, Button, Badge } from './ui';
import type { DuplicateGroup } from '../lib/dedup';

interface Props<T extends { id: string; created_at: string }> {
  open: boolean;
  onClose: () => void;
  groups: DuplicateGroup<T>[];
  renderLabel: (item: T) => string;
  renderDetail: (item: T) => string;
  onMerge: (primaryId: string, duplicateIds: string[]) => Promise<void>;
}

export function DuplicatesModal<T extends { id: string; created_at: string }>({
  open, onClose, groups, renderLabel, renderDetail, onMerge,
}: Props<T>) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const pickedFor = (group: DuplicateGroup<T>) =>
    picked[group.key] || [...group.items].sort((a, b) => a.created_at.localeCompare(b.created_at))[0].id;

  const merge = async (group: DuplicateGroup<T>) => {
    const primaryId = pickedFor(group);
    const duplicateIds = group.items.map(i => i.id).filter(id => id !== primaryId);
    setMerging(group.key);
    await onMerge(primaryId, duplicateIds);
    setMerging(null);
    setDone(prev => new Set(prev).add(group.key));
  };

  const pending = groups.filter(g => !done.has(g.key));

  return (
    <Modal open={open} onClose={onClose} title="Doublons détectés" size="xl">
      {pending.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          <Copy size={28} className="mx-auto mb-2 text-gray-300" />
          {groups.length === 0 ? 'Aucun doublon détecté.' : 'Tous les doublons trouvés ont été traités.'}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Détection basée sur des correspondances exactes (email, nom, site web) — pas de correspondance approximative,
            pour éviter les fusions incorrectes. Choisissez la fiche à conserver ; les autres seront fusionnées dedans puis supprimées.
          </p>
          {pending.map(group => {
            const primaryId = pickedFor(group);
            return (
              <div key={group.key} className="rounded-xl border border-gray-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge color="orange">{group.reason}</Badge>
                  <Button
                    size="sm"
                    onClick={() => merge(group)}
                    disabled={merging === group.key}
                  >
                    {merging === group.key ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />} Fusionner
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {group.items.map(item => (
                    <label key={item.id} className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm ${primaryId === item.id ? 'bg-mint-50' : 'hover:bg-gray-50'}`}>
                      <input
                        type="radio"
                        name={group.key}
                        checked={primaryId === item.id}
                        onChange={() => setPicked(prev => ({ ...prev, [group.key]: item.id }))}
                      />
                      <span className="font-medium text-gray-900">{renderLabel(item)}</span>
                      <span className="text-xs text-gray-500">{renderDetail(item)}</span>
                      {primaryId === item.id && <Badge color="green" className="ml-auto">Conservé</Badge>}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
