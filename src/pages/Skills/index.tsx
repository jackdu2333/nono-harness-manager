import { useState, useEffect } from 'react';
import { SkillList } from '@/features/skills/components/SkillList';
import { SkillDetail } from '@/features/skills/components/SkillDetail';
import { SkillsToolbar } from '@/features/skills/components/SkillsToolbar';
import { SummaryChips } from '@/features/skills/components/SummaryChips';
import { Skill } from '@/features/skills/types';
import { useSkillsStore } from '@/features/skills/store';

export default function SkillsPage() {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const { fetchSources } = useSkillsStore();

  useEffect(() => {
    // Initial fetch to get correct counts for toolbar
    fetchSources();
  }, [fetchSources]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        <SkillsToolbar globalFilter={globalFilter} setGlobalFilter={setGlobalFilter} />
        <SummaryChips />
        
        <div className="flex-1 min-h-0 p-4 lg:p-6 overflow-hidden flex flex-col">
          <SkillList onSelectSkill={setSelectedSkill} globalFilter={globalFilter} />
        </div>
      </div>
      
      {selectedSkill && (
        <SkillDetail skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
