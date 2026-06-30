import { useState, useEffect } from 'react';
import { Skill } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  X, Folder, Link as LinkIcon, Edit2, RefreshCw, Wand2, Star, Archive,
  Trash2, Quote, ClipboardList, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSkillsStore } from '../store';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SkillDetailProps {
  skill: Skill | null;
  onClose: () => void;
}

// §四 生命周期（单选）：draft/active/deprecated/broken — 中文 label 消除"归档还 active 吗"的歧义
const LIFECYCLE_STATUSES = [
  { value: 'draft', labelKey: 'skills.status_draft' },
  { value: 'active', labelKey: 'skills.status_using' },
  { value: 'deprecated', labelKey: 'skills.lifecycle_deprecated' },
  { value: 'broken', labelKey: 'skills.lifecycle_invalid' },
] as const;
const IMPROVEMENT_STATUSES = [
  { value: '', labelKey: 'common.not_set' },
  { value: 'planned', labelKey: 'skills.ai_ready_planned' },
  { value: 'in_progress', labelKey: 'skills.ai_ready_evolving' },
  { value: 'done', labelKey: 'skills.ai_ready_evolved' },
] as const;

export function SkillDetail({ skill, onClose }: SkillDetailProps) {
  const { t } = useTranslation();
  const {
    updateDescription, scanSource, isScanning,
    setCategory, setStatus, toggleFavorite, toggleNeedsReview, toggleNeedsImprovement,
    archive, deleteIndex, updateImprovementNote, updateReviewNote, recordUsage,
    deleteSourceFile,
    duplicateAssignment, duplicateReasons, markDuplicate,
  } = useSkillsStore();

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editImproveNote, setEditImproveNote] = useState('');
  const [editImproveStatus, setEditImproveStatus] = useState('');
  const [editReviewNote, setEditReviewNote] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRemoveIndexDialog, setShowRemoveIndexDialog] = useState(false);
  const [showSourceDeleteDialog, setShowSourceDeleteDialog] = useState(false);
  const [sourceDeleteMode, setSourceDeleteMode] = useState<'trash' | 'permanent'>('trash');
  const [sourceDeleteConfirmName, setSourceDeleteConfirmName] = useState('');
  const [sourceDeleteError, setSourceDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (skill) {
      setEditDesc(skill.description || '');
      setIsEditingDesc(false);
      setEditCategory(skill.category || '');
      setIsEditingCategory(false);
      setEditImproveNote(skill.improvement_note || '');
      setEditImproveStatus(skill.improvement_status || '');
      setEditReviewNote(skill.review_note || '');
      setShowDeleteDialog(false);
    }
  }, [skill]);

  if (!skill) return null;

  // --- handlers (each logs a panel-operation event; §八) ---
  const handleOpenFolder = async () => {
    recordUsage(skill.id, 'open_dir');
    try {
      await revealItemInDir(skill.path);
    } catch (e) {
      console.error('Failed to open folder:', e);
    }
  };
  const handleCopyPath = () => {
    recordUsage(skill.id, 'copy_path');
    navigator.clipboard.writeText(skill.path);
  };
  const handleCopyRef = () => {
    recordUsage(skill.id, 'copy_ref');
    // Reference = skill name (identifier other tools can cite)
    navigator.clipboard.writeText(skill.name);
  };
  const handleSaveDesc = async () => {
    recordUsage(skill.id, 'edit_description');
    await updateDescription(skill.id, editDesc);
    setIsEditingDesc(false);
  };
  const handleReExtract = async () => {
    if (!skill.source_id || skill.description_is_manual === 1) return;
    await scanSource(skill.source_id);
  };
  const handleSaveCategory = async () => {
    recordUsage(skill.id, 'set_category');
    await setCategory(skill.id, editCategory.trim() || null);
    setIsEditingCategory(false);
  };
  const handleSetStatus = async (s: string) => {
    await recordUsage(skill.id, 'set_status');
    await setStatus(skill.id, s);
  };
  const handleToggleFav = async () => {
    recordUsage(skill.id, 'toggle_favorite');
    await toggleFavorite(skill.id, skill.is_favorite !== 1);
  };
  const handleToggleReview = async () => {
    recordUsage(skill.id, 'toggle_needs_review');
    await toggleNeedsReview(skill.id, skill.needs_review !== 1);
  };
  const handleToggleImproveTag = async () => {
    recordUsage(skill.id, 'toggle_needs_improvement');
    await toggleNeedsImprovement(skill.id, skill.needs_improvement !== 1);
  };
  const handleArchive = async () => {
    await recordUsage(skill.id, 'archive');
    await archive(skill.id, skill.is_archived !== 1);
  };
  const handleSaveImprove = async () => {
    recordUsage(skill.id, 'update_improvement_note');
    await updateImprovementNote(skill.id, editImproveNote.trim() || null, editImproveStatus || null);
  };
  const handleSaveReview = async () => {
    recordUsage(skill.id, 'update_review_note');
    await updateReviewNote(skill.id, editReviewNote.trim() || null);
  };
  // §五 删除索引：通过 Dialog 明确确认（替代二次点击按钮），确认后执行
  const handleDelete = async () => {
    await recordUsage(skill.id, 'remove_index');
    await deleteIndex(skill.id);
    setShowRemoveIndexDialog(false);
    onClose();
  };

  // 子需求 §一.3/§四: 删除本地源文件 — trash 优先，permanent 需要输入名称确认
  const handleDeleteSourceFile = async () => {
    setSourceDeleteError(null);
    if (sourceDeleteMode === 'permanent' && sourceDeleteConfirmName !== skill.name) {
      setSourceDeleteError(t('skills.confirm_permanent_delete', { name: skill.name }));
      return;
    }
    try {
      await recordUsage(
        skill.id,
        sourceDeleteMode === 'trash' ? 'move_source_to_trash' : 'delete_source_file',
      );
      await deleteSourceFile(skill.id, sourceDeleteMode);
      setShowSourceDeleteDialog(false);
      setSourceDeleteConfirmName('');
      onClose();
    } catch (e) {
      setSourceDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  const openSourceDelete = (mode: 'trash' | 'permanent') => {
    setSourceDeleteMode(mode);
    setSourceDeleteConfirmName('');
    setSourceDeleteError(null);
    setShowSourceDeleteDialog(true);
  };

  const getSourceLabel = (src: string | null) => {
    switch (src) {
      case 'manual': return t('skills.desc_confidence_manual');
      case 'metadata': return t('skills.desc_confidence_metadata');
      case 'readme': return t('skills.desc_confidence_readme');
      case 'skill_file': return t('skills.desc_confidence_main');
      case 'filename_guess': return t('skills.desc_confidence_name');
      case 'ai': return t('skills.desc_confidence_ai');
      default: return src || t('common.unknown');
    }
  };

  // Tag toggle button renderer
  const TagBtn = ({ active, onClick, children, activeClass }: {
    active: boolean; onClick: () => void; children: React.ReactNode; activeClass: string;
  }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        active
          ? `${activeClass} border-transparent`
          : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
      }`}
    >
      {active && <Check className="w-3 h-3" />}
      {children}
    </button>
  );

  return (
    <div className="w-[420px] border-l border-border bg-background flex flex-col overflow-hidden shadow-2xl relative z-20">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0 pr-4">
          {skill.is_favorite === 1 && <Star className="w-4 h-4 text-warning fill-warning shrink-0" />}
          <h3 className="font-semibold text-foreground truncate text-lg">{skill.name}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-6">

        {/* Lifecycle status — single choice */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{t('skills.lifecycle')}</h4>
          <div className="flex flex-wrap gap-1.5">
            {LIFECYCLE_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => handleSetStatus(s.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  skill.status === s.value
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Orthogonal tags — stackable */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{t('skills.manage_tags')}</h4>
          <div className="flex flex-wrap gap-1.5">
            <TagBtn active={skill.is_favorite === 1} onClick={handleToggleFav} activeClass="bg-warning text-warning-foreground">
              <Star className="w-3 h-3" />{t('skills.tag_frequent')}
            </TagBtn>
            <TagBtn active={skill.needs_review === 1} onClick={handleToggleReview} activeClass="bg-primary text-primary-foreground">
              {t('skills.tag_organize')}
            </TagBtn>
            <TagBtn active={skill.needs_improvement === 1} onClick={handleToggleImproveTag} activeClass="bg-purple-500 text-primary-foreground">
              {t('skills.tag_evolve')}
            </TagBtn>
            <TagBtn active={skill.is_archived === 1} onClick={handleArchive} activeClass="bg-muted-foreground text-foreground">
              <Archive className="w-3 h-3" />{t('skills.tag_archived')}
            </TagBtn>
          </div>
        </div>

        {/* §七/§二 Suspected duplicate — real-time detection, persistable via 保存标记 */}
        {(duplicateAssignment[skill.id] || skill.duplicate_group_id) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">{t('skills.dup_detection')}</h4>
            <div className="space-y-2 bg-card rounded-lg p-3 border border-border">
              {duplicateReasons[skill.id] && duplicateReasons[skill.id].length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="text-muted-foreground/70">{t('skills.hit_rule')}</span>
                  {duplicateReasons[skill.id].join('、')}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground/60">
                {skill.duplicate_group_id
                  ? t('skills.dup_saved')
                  : t('skills.dup_realtime')}
              </div>
              {skill.duplicate_group_id ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markDuplicate(skill.id, null)}
                >
                  {t('skills.clear_dup_tag')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markDuplicate(skill.id, duplicateAssignment[skill.id])}
                >
                  {t('skills.save_dup_tag')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">{t('common.description')}</h4>
            {!isEditingDesc && (
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground px-2" onClick={() => setIsEditingDesc(true)}>
                <Edit2 className="w-3 h-3 mr-1" /> {t('skills.edit_desc')}
              </Button>
            )}
          </div>
          {isEditingDesc ? (
            <div className="space-y-2">
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-card border-border min-h-[100px] text-foreground resize-y"
                placeholder={t('skills.desc_placeholder')}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setIsEditingDesc(false)}>{t('common.cancel')}</Button>
                <Button variant="secondary" size="sm" onClick={handleSaveDesc}>{t('common.save')}</Button>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-lg p-3 border border-border shadow-sm">
              {skill.description ? (
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {skill.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic py-2">{t('skills.no_desc_hint')}</div>
              )}
              {skill.description_source && (
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground uppercase">{t('skills.source_prefix')}{getSourceLabel(skill.description_source)}</span>
                  {skill.description_confidence && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      skill.description_confidence === 'high' ? 'bg-success/10 text-success' :
                      skill.description_confidence === 'medium' ? 'bg-primary/10 text-primary' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {skill.description_confidence.toUpperCase()}
                    </span>
                  )}
                  {skill.description_is_manual === 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{t('skills.locked')}</span>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs bg-card text-muted-foreground border-border" disabled>
              <Wand2 className="w-3 h-3 mr-1.5" /> {t('skills.ai_not_enabled')}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs bg-card text-foreground border-border" onClick={handleReExtract} disabled={isScanning || skill.description_is_manual === 1}>
              <RefreshCw className={`w-3 h-3 mr-1.5 ${isScanning ? 'animate-spin' : ''}`} /> {t('skills.re_extract')}
            </Button>
          </div>
        </div>

        {/* Category — inline editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">{t('common.category')}</h4>
            {!isEditingCategory && (
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground px-2" onClick={() => setIsEditingCategory(true)}>
                <Edit2 className="w-3 h-3 mr-1" /> {t('skills.edit_category')}
              </Button>
            )}
          </div>
          {isEditingCategory ? (
            <div className="flex gap-2">
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder={t('skills.category_placeholder')}
                className="bg-card border-border text-foreground h-8"
              />
              <Button variant="ghost" size="sm" onClick={() => setIsEditingCategory(false)}>{t('common.cancel')}</Button>
              <Button variant="secondary" size="sm" onClick={handleSaveCategory}>{t('common.save')}</Button>
            </div>
          ) : (
            <div className="text-sm text-foreground/90">{skill.category || <span className="text-muted-foreground/60 italic">{t('common.uncategorized')}</span>}</div>
          )}
        </div>

        {/* Improvement note + status — §六 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{t('skills.evolution_notes')}</h4>
          <div className="space-y-2 bg-card rounded-lg p-3 border border-border">
            <Textarea
              value={editImproveNote}
              onChange={(e) => setEditImproveNote(e.target.value)}
              placeholder={t('skills.evolution_placeholder')}
              className="bg-background border-border min-h-[70px] text-sm resize-y"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">{t('skills.evolution_status')}</span>
              <select
                value={editImproveStatus}
                onChange={(e) => setEditImproveStatus(e.target.value)}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
              >
                {IMPROVEMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
              <Button variant="secondary" size="sm" className="ml-auto h-7" onClick={handleSaveImprove}>{t('common.save')}</Button>
            </div>
            {skill.last_improved_at && (
              <div className="text-[10px] text-muted-foreground/70">{t('skills.last_evolution')}: {new Date(skill.last_improved_at).toLocaleString()}</div>
            )}
          </div>
        </div>

        {/* Review note */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{t('skills.organize_notes')}</h4>
          <div className="flex gap-2">
            <Textarea
              value={editReviewNote}
              onChange={(e) => setEditReviewNote(e.target.value)}
              placeholder={t('skills.organize_placeholder')}
              className="bg-card border-border min-h-[50px] text-sm resize-y"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={handleSaveReview}>{t('skills.save_organize')}</Button>
          </div>
        </div>

        {/* Panel-operation count — §八 wording */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="w-3.5 h-3.5" />
          <span>{t('skills.panel_ops')} <span className="font-medium text-foreground/80">{skill.total_usage_count}</span></span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground/60">{t('skills.harness_usage')}</span>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground/80 mb-1 font-medium">{t('skills.type')}</div>
            <div className="text-sm text-foreground/90 capitalize">{skill.skill_type?.replace('_', ' ') || t('common.unknown')}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground/80 mb-1 font-medium">{t('skills.status')}</div>
            <div className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {LIFECYCLE_STATUSES.find((s) => s.value === skill.status)?.labelKey ? t(LIFECYCLE_STATUSES.find((s) => s.value === skill.status)!.labelKey) : skill.status}
            </div>
          </div>
        </div>

        {/* Path + actions */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="text-xs text-muted-foreground/80 mb-2 font-medium">{t('skills.path')}</div>
          <div className="text-xs text-muted-foreground font-mono truncate flex-1 bg-card p-2 rounded border border-border shadow-inner" title={skill.path}>
            {skill.path}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button variant="secondary" className="gap-1.5 bg-muted hover:bg-muted/80 text-foreground" onClick={handleOpenFolder}>
              <Folder className="w-4 h-4" /> {t('skills.dir_label')}
            </Button>
            <Button variant="outline" className="gap-1.5 border-border hover:bg-accent text-foreground" onClick={handleCopyPath}>
              <LinkIcon className="w-4 h-4" /> {t('common.path')}
            </Button>
            <Button variant="outline" className="gap-1.5 border-border hover:bg-accent text-foreground" onClick={handleCopyRef}>
              <Quote className="w-4 h-4" /> {t('skills.ref_label')}
            </Button>
          </div>
        </div>

        {/* 子需求 §七: 三层操作 — 归档 / 移除索引 / 删除本地源文件 */}
        <div className="pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground/80 mb-2 font-medium">{t('skills.advanced_ops')}</div>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2 text-muted-foreground"
              onClick={() => setShowRemoveIndexDialog(true)}
            >
              <Archive className="w-4 h-4" />
              {t('skills.remove_index')}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive hover:bg-destructive/5"
              onClick={() => openSourceDelete('trash')}
            >
              <Trash2 className="w-4 h-4" />
              {t('skills.delete_source_file')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1 text-xs text-muted-foreground/60 hover:text-destructive"
              onClick={() => openSourceDelete('permanent')}
            >
              {t('skills.delete_permanent')}
            </Button>
          </div>
        </div>
      </div>

      {/* 移除索引确认 Dialog */}
      <Dialog open={showRemoveIndexDialog} onOpenChange={setShowRemoveIndexDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('skills.remove_index_title')}</DialogTitle>
            <DialogDescription>
              {t('skills.remove_index_desc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRemoveIndexDialog(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('skills.confirm_delete_index')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除本地源文件确认 Dialog — 子需求 §五 */}
      <Dialog open={showSourceDeleteDialog} onOpenChange={setShowSourceDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('skills.delete_file_title')}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {sourceDeleteMode === 'trash' ? t('skills.delete_file_desc_trash') : t('skills.delete_file_desc_permanent')}
                </p>
                <div className="rounded border border-border bg-muted/40 p-3 text-sm space-y-1">
                  <div><span className="text-muted-foreground">{t('skills.skill_name_label')}</span>{skill.name}</div>
                  <div><span className="text-muted-foreground">{t('skills.delete_path_label')}</span><code className="text-xs">{skill.path}</code></div>
                  <div>
                    <span className="text-muted-foreground">{t('skills.recoverable_label')}</span>
                    {sourceDeleteMode === 'trash' ? t('skills.trash_recoverable') : t('skills.permanent_delete')}
                  </div>
                </div>
                {sourceDeleteMode === 'permanent' && (
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {t('skills.confirm_delete_prompt', { name: skill.name })}
                    </label>
                    <input
                      value={sourceDeleteConfirmName}
                      onChange={(e) => setSourceDeleteConfirmName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder={skill.name}
                    />
                  </div>
                )}
                {sourceDeleteError && (
                  <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {sourceDeleteError}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSourceDeleteDialog(false)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSourceFile}
            >
              {sourceDeleteMode === 'trash' ? t('skills.move_to_trash_short') : t('skills.permanent_delete_short')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
