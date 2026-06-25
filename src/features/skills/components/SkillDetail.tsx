import { useState, useEffect } from 'react';
import { Skill } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Folder, Link as LinkIcon, Edit2, RefreshCw, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSkillsStore } from '../store';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SkillDetailProps {
  skill: Skill | null;
  onClose: () => void;
}

export function SkillDetail({ skill, onClose }: SkillDetailProps) {
  const { t } = useTranslation();
  const { updateDescription, scanSource, isScanning } = useSkillsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (skill) {
      setEditContent(skill.description || '');
      setIsEditing(false);
    }
  }, [skill]);

  if (!skill) return null;

  const handleOpenFolder = async () => {
    if (!skill) return;
    try {
      await revealItemInDir(skill.path);
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(skill.path);
  };

  const handleSaveDescription = async () => {
    if (!skill) return;
    await updateDescription(skill.id, editContent);
    setIsEditing(false);
  };

  const handleReExtract = async () => {
    if (!skill || !skill.source_id) return;
    if (skill.description_is_manual === 1) {
      return;
    }
    await scanSource(skill.source_id);
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

  return (
    <div className="w-[400px] border-l border-border bg-background flex flex-col overflow-hidden shadow-2xl relative z-20">
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-foreground truncate pr-4 text-lg">{skill.name}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="p-5 overflow-y-auto flex-1 space-y-6">
        
        {/* Description Section - Highest Priority */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">描述</h4>
            {!isEditing && (
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground px-2" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-3 h-3 mr-1" /> 编辑
              </Button>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)}
                className="bg-card border-border min-h-[100px] text-foreground resize-y"
                placeholder="在此输入技能描述..."
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>取消</Button>
                <Button variant="secondary" size="sm" onClick={handleSaveDescription}>保存</Button>
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
	        <div className="text-sm text-muted-foreground italic py-2">
	          暂无描述，可手动编辑描述
	        </div>
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

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground/80 mb-1 font-medium">{t('skills.type')}</div>
            <div className="text-sm text-foreground/90 capitalize">{skill.skill_type?.replace('_', ' ') || t('common.unknown')}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground/80 mb-1 font-medium">{t('skills.status')}</div>
            <div className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {skill.status}
            </div>
          </div>
          {skill.category && (
            <div>
              <div className="text-xs text-muted-foreground/80 mb-1 font-medium">分类</div>
              <div className="text-sm text-foreground/90">{skill.category}</div>
            </div>
          )}
        </div>

        {/* Path - Lowest Priority */}
        <div className="pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground/80 mb-2 font-medium">{t('skills.path')}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground font-mono truncate flex-1 bg-card p-2 rounded border border-border shadow-inner" title={skill.path}>
              {skill.path}
            </div>
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          <Button variant="secondary" className="flex-1 gap-2 bg-muted hover:bg-muted/80 text-foreground" onClick={handleOpenFolder}>
            <Folder className="w-4 h-4" /> 打开目录
          </Button>
          <Button variant="outline" className="flex-1 gap-2 border-border hover:bg-accent text-foreground" onClick={handleCopyPath}>
            <LinkIcon className="w-4 h-4" /> 复制路径
          </Button>
        </div>
      </div>
    </div>
  );
}
