import { useState, useEffect } from 'react';
import { SkillList } from '@/features/skills/components/SkillList';
import { SkillDetail } from '@/features/skills/components/SkillDetail';
import { SkillsToolbar } from '@/features/skills/components/SkillsToolbar';
import { SummaryChips } from '@/features/skills/components/SummaryChips';
import { useSkillsStore } from '@/features/skills/store';

export default function SkillsPage() {
  // §一: store selectedSkillId (not a stale Skill snapshot) so the detail
  // panel always reflects the latest store state after edits.
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const { fetchSources, skills } = useSkillsStore();

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const selectedSkill = selectedSkillId
    ? skills.find((s) => s.id === selectedSkillId) ?? null
    : null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        <SkillsToolbar globalFilter={globalFilter} setGlobalFilter={setGlobalFilter} />
        <SummaryChips />
        
        <div className="flex-1 min-h-0 p-4 lg:p-6 overflow-hidden flex flex-col">
          <SkillList onSelectSkill={(skill) => setSelectedSkillId(skill.id)} globalFilter={globalFilter} />
        </div>
      </div>
      
      {selectedSkill && (
        <SkillDetail skill={selectedSkill} onClose={() => setSelectedSkillId(null)} />
      )}
    </div>
  );
}
