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
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '使用中' },
  { value: 'deprecated', label: '弃用' },
  { value: 'broken', label: '失效' },
] as const;
const IMPROVEMENT_STATUSES = [
  { value: '', label: '未设置' },
  { value: 'planned', label: '计划中' },
  { value: 'in_progress', label: '进化中' },
  { value: 'done', label: '已进化' },
] as const;

export function SkillDetail({ skill, onClose }: SkillDetailProps) {
  const { t } = useTranslation();
  const {
    updateDescription, scanSource, isScanning,
    setCategory, setStatus, toggleFavorite, toggleNeedsReview, toggleNeedsImprovement,
    archive, deleteIndex, updateImprovementNote, updateReviewNote, recordUsage,
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
    recordUsage(skill.id, 'set_status');
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
    recordUsage(skill.id, 'archive');
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
    recordUsage(skill.id, 'delete_index');
    await deleteIndex(skill.id);
    setShowDeleteDialog(false);
    onClose();
  };

  const getSourceLabel = (src: string | null) => {
    switch (src) {
      case 'manual': return '手动编辑';
      case 'metadata': return '元数据';
      case 'readme': return 'README';
      case 'skill_file': return '主文件提取';
      case 'filename_guess': return '名称推测';
      case 'ai': return 'AI 生成';
      default: return src || '未知';
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
          {skill.is_favorite === 1 && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />}
          <h3 className="font-semibold text-foreground truncate text-lg">{skill.name}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-6">

        {/* Lifecycle status — single choice */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">生命周期</h4>
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
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orthogonal tags — stackable */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">管理标记</h4>
          <div className="flex flex-wrap gap-1.5">
            <TagBtn active={skill.is_favorite === 1} onClick={handleToggleFav} activeClass="bg-yellow-500 text-white">
              <Star className="w-3 h-3" />常用
            </TagBtn>
            <TagBtn active={skill.needs_review === 1} onClick={handleToggleReview} activeClass="bg-blue-500 text-white">
              待整理
            </TagBtn>
            <TagBtn active={skill.needs_improvement === 1} onClick={handleToggleImproveTag} activeClass="bg-purple-500 text-white">
              待进化
            </TagBtn>
            <TagBtn active={skill.is_archived === 1} onClick={handleArchive} activeClass="bg-zinc-600 text-white">
              <Archive className="w-3 h-3" />已归档
            </TagBtn>
          </div>
        </div>

        {/* §七/§二 Suspected duplicate — real-time detection, persistable via 保存标记 */}
        {(duplicateAssignment[skill.id] || skill.duplicate_group_id) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">重复检测</h4>
            <div className="space-y-2 bg-card rounded-lg p-3 border border-border">
              {duplicateReasons[skill.id] && duplicateReasons[skill.id].length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="text-muted-foreground/70">命中规则：</span>
                  {duplicateReasons[skill.id].join('、')}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground/60">
                {skill.duplicate_group_id
                  ? '已保存重复标记（持久化，刷新不丢失）'
                  : '实时检测结果，未保存。刷新或规则变化后可能改变。'}
              </div>
              {skill.duplicate_group_id ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markDuplicate(skill.id, null)}
                >
                  清除已保存标记
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markDuplicate(skill.id, duplicateAssignment[skill.id])}
                >
                  保存重复标记
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">描述</h4>
            {!isEditingDesc && (
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground px-2" onClick={() => setIsEditingDesc(true)}>
                <Edit2 className="w-3 h-3 mr-1" /> 编辑
              </Button>
            )}
          </div>
          {isEditingDesc ? (
            <div className="space-y-2">
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-card border-border min-h-[100px] text-foreground resize-y"
                placeholder="在此输入技能描述..."
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setIsEditingDesc(false)}>取消</Button>
                <Button variant="secondary" size="sm" onClick={handleSaveDesc}>保存</Button>
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
                <div className="text-sm text-muted-foreground italic py-2">暂无描述，可手动编辑描述</div>
              )}
              {skill.description_source && (
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground uppercase">来源: {getSourceLabel(skill.description_source)}</span>
                  {skill.description_confidence && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      skill.description_confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      skill.description_confidence === 'medium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {skill.description_confidence.toUpperCase()}
                    </span>
                  )}
                  {skill.description_is_manual === 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">已锁定</span>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs bg-card text-muted-foreground border-border" disabled>
              <Wand2 className="w-3 h-3 mr-1.5" /> AI 未启用
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs bg-card text-foreground border-border" onClick={handleReExtract} disabled={isScanning || skill.description_is_manual === 1}>
              <RefreshCw className={`w-3 h-3 mr-1.5 ${isScanning ? 'animate-spin' : ''}`} /> 重新提取
            </Button>
          </div>
        </div>

        {/* Category — inline editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">分类</h4>
            {!isEditingCategory && (
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground px-2" onClick={() => setIsEditingCategory(true)}>
                <Edit2 className="w-3 h-3 mr-1" /> 编辑
              </Button>
            )}
          </div>
          {isEditingCategory ? (
            <div className="flex gap-2">
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="输入分类，留空清除"
                className="bg-card border-border text-foreground h-8"
              />
              <Button variant="ghost" size="sm" onClick={() => setIsEditingCategory(false)}>取消</Button>
              <Button variant="secondary" size="sm" onClick={handleSaveCategory}>保存</Button>
            </div>
          ) : (
            <div className="text-sm text-foreground/90">{skill.category || <span className="text-muted-foreground/60 italic">未分类</span>}</div>
          )}
        </div>

        {/* Improvement note + status — §六 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">进化备注</h4>
          <div className="space-y-2 bg-card rounded-lg p-3 border border-border">
            <Textarea
              value={editImproveNote}
              onChange={(e) => setEditImproveNote(e.target.value)}
              placeholder="这个 Skill 哪里不好？想怎么改？下次怎么处理？"
              className="bg-background border-border min-h-[70px] text-sm resize-y"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">进化状态</span>
              <select
                value={editImproveStatus}
                onChange={(e) => setEditImproveStatus(e.target.value)}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
              >
                {IMPROVEMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <Button variant="secondary" size="sm" className="ml-auto h-7" onClick={handleSaveImprove}>保存</Button>
            </div>
            {skill.last_improved_at && (
              <div className="text-[10px] text-muted-foreground/70">上次进化: {new Date(skill.last_improved_at).toLocaleString()}</div>
            )}
          </div>
        </div>

        {/* Review note */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">整理备注</h4>
          <div className="flex gap-2">
            <Textarea
              value={editReviewNote}
              onChange={(e) => setEditReviewNote(e.target.value)}
              placeholder="整理/复核时记录的备注..."
              className="bg-card border-border min-h-[50px] text-sm resize-y"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={handleSaveReview}>保存整理备注</Button>
          </div>
        </div>

        {/* Panel-operation count — §八 wording */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="w-3.5 h-3.5" />
          <span>面板操作次数: <span className="font-medium text-foreground/80">{skill.total_usage_count}</span></span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground/60">Harness 内使用记录</span>
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
              {LIFECYCLE_STATUSES.find((s) => s.value === skill.status)?.label || skill.status}
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
              <Folder className="w-4 h-4" /> 目录
            </Button>
            <Button variant="outline" className="gap-1.5 border-border hover:bg-accent text-foreground" onClick={handleCopyPath}>
              <LinkIcon className="w-4 h-4" /> 路径
            </Button>
            <Button variant="outline" className="gap-1.5 border-border hover:bg-accent text-foreground" onClick={handleCopyRef}>
              <Quote className="w-4 h-4" /> 引用
            </Button>
          </div>
        </div>

        {/* §五 Delete index — Dialog confirm (replaces two-step click) */}
        <div className="pt-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4" />
            删除 Harness 索引
          </Button>
        </div>
      </div>

      {/* §五 Delete confirm Dialog — makes the consequence explicit */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 Harness 索引</DialogTitle>
            <DialogDescription>
              仅删除 Harness 索引，不删除本地文件。下次扫描可能重新出现。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>确认删除索引</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
