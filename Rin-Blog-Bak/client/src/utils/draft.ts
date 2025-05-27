import { useCallback, useEffect, useState } from 'react';

// 草稿结构
export interface Draft {
  id: string; // 草稿唯一ID
  title: string;
  content: string;
  summary: string;
  tags: string;
  alias: string;
  timestamp: number; // 创建/更新时间
  lastEditTime: number; // 最后编辑时间
}

// 草稿管理类
export class DraftManager {
  private static instance: DraftManager;
  
  // 单例模式获取实例
  public static getInstance(): DraftManager {
    if (!DraftManager.instance) {
      DraftManager.instance = new DraftManager();
    }
    return DraftManager.instance;
  }
  
  // 草稿在localStorage中的键
  private readonly DRAFTS_KEY = 'markdown_drafts';
  
  // 获取所有草稿
  public getAllDrafts(): Draft[] {
    const draftsJson = localStorage.getItem(this.DRAFTS_KEY);
    if (!draftsJson) return [];
    
    try {
      return JSON.parse(draftsJson) as Draft[];
    } catch (e) {
      console.error('Failed to parse drafts:', e);
      return [];
    }
  }
  
  // 保存草稿
  public saveDraft(draft: Omit<Draft, 'id' | 'timestamp' | 'lastEditTime'>): string {
    const drafts = this.getAllDrafts();
    const now = Date.now();
    
    // 创建新草稿
    const newDraft: Draft = {
      ...draft,
      id: `draft_${now}`,
      timestamp: now,
      lastEditTime: now
    };
    
    // 添加到列表并保存
    const updatedDrafts = [newDraft, ...drafts];
    localStorage.setItem(this.DRAFTS_KEY, JSON.stringify(updatedDrafts));
    
    return newDraft.id;
  }
  
  // 更新现有草稿
  public updateDraft(id: string, data: Partial<Omit<Draft, 'id' | 'timestamp'>>): boolean {
    const drafts = this.getAllDrafts();
    const draftIndex = drafts.findIndex(d => d.id === id);
    
    if (draftIndex === -1) return false;
    
    // 更新草稿
    drafts[draftIndex] = {
      ...drafts[draftIndex],
      ...data,
      lastEditTime: Date.now()
    };
    
    localStorage.setItem(this.DRAFTS_KEY, JSON.stringify(drafts));
    return true;
  }
  
  // 获取草稿
  public getDraft(id: string): Draft | null {
    const drafts = this.getAllDrafts();
    return drafts.find(d => d.id === id) || null;
  }
  
  // 删除草稿
  public deleteDraft(id: string): boolean {
    const drafts = this.getAllDrafts();
    const updatedDrafts = drafts.filter(d => d.id !== id);
    
    if (updatedDrafts.length === drafts.length) return false;
    
    localStorage.setItem(this.DRAFTS_KEY, JSON.stringify(updatedDrafts));
    return true;
  }
  
  // 清除所有草稿
  public clearAllDrafts(): void {
    localStorage.removeItem(this.DRAFTS_KEY);
  }
}

// 草稿管理Hook
export function useDraftManager() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const manager = DraftManager.getInstance();
  
  // 加载草稿列表
  const loadDrafts = useCallback(() => {
    const allDrafts = manager.getAllDrafts();
    setDrafts(allDrafts);
  }, []);
  
  // 保存新草稿
  const saveDraft = useCallback((draft: Omit<Draft, 'id' | 'timestamp' | 'lastEditTime'>) => {
    const id = manager.saveDraft(draft);
    loadDrafts();
    return id;
  }, [loadDrafts]);
  
  // 更新草稿
  const updateDraft = useCallback((id: string, data: Partial<Omit<Draft, 'id' | 'timestamp'>>) => {
    const success = manager.updateDraft(id, data);
    if (success) loadDrafts();
    return success;
  }, [loadDrafts]);
  
  // 删除草稿
  const deleteDraft = useCallback((id: string) => {
    const success = manager.deleteDraft(id);
    if (success) loadDrafts();
    return success;
  }, [loadDrafts]);
  
  // 清除所有草稿
  const clearAllDrafts = useCallback(() => {
    manager.clearAllDrafts();
    loadDrafts();
  }, [loadDrafts]);
  
  // 获取特定草稿
  const getDraft = useCallback((id: string) => {
    return manager.getDraft(id);
  }, []);
  
  // 初始加载草稿
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);
  
  return {
    drafts,
    saveDraft,
    updateDraft,
    deleteDraft,
    clearAllDrafts,
    getDraft,
    loadDrafts
  };
} 