import { useCallback, useEffect, useState } from 'react';

// 历史记录项目接口
export interface HistoryItem {
  id: string;
  content: string;
  title: string;
  timestamp: number;
  description: string;
}

// 最大历史记录数量
const MAX_HISTORY_ITEMS = 30;

// 历史记录管理类
export class EditorHistory {
  private static instance: EditorHistory;
  
  // 获取单例实例
  public static getInstance(): EditorHistory {
    if (!EditorHistory.instance) {
      EditorHistory.instance = new EditorHistory();
    }
    return EditorHistory.instance;
  }
  
  // 根据文章ID获取历史记录键
  private getHistoryKey(id?: number): string {
    return `editor_history_${id || 'new'}`;
  }
  
  // 获取特定文章的所有历史记录
  public getHistory(id?: number): HistoryItem[] {
    const key = this.getHistoryKey(id);
    const historyJson = localStorage.getItem(key);
    if (!historyJson) return [];
    
    try {
      return JSON.parse(historyJson) as HistoryItem[];
    } catch (e) {
      console.error('Failed to parse history:', e);
      return [];
    }
  }
  
  // 保存历史记录
  public saveHistory(item: Omit<HistoryItem, 'id'>, id?: number): void {
    const history = this.getHistory(id);
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString(), // 使用时间戳作为唯一ID
    };
    
    // 检查是否有内容变化
    const latestItem = history[0];
    if (latestItem && latestItem.content === newItem.content) {
      return; // 内容没有变化，不保存
    }
    
    // 添加新记录到历史开头
    const updatedHistory = [newItem, ...history];
    
    // 限制历史记录数量
    if (updatedHistory.length > MAX_HISTORY_ITEMS) {
      updatedHistory.splice(MAX_HISTORY_ITEMS);
    }
    
    // 保存到本地存储
    const key = this.getHistoryKey(id);
    localStorage.setItem(key, JSON.stringify(updatedHistory));
  }
  
  // 删除特定历史记录
  public deleteHistoryItem(historyId: string, id?: number): void {
    const history = this.getHistory(id);
    const updatedHistory = history.filter(item => item.id !== historyId);
    
    const key = this.getHistoryKey(id);
    localStorage.setItem(key, JSON.stringify(updatedHistory));
  }
  
  // 清除所有历史记录
  public clearHistory(id?: number): void {
    const key = this.getHistoryKey(id);
    localStorage.removeItem(key);
  }
}

// 自定义Hook，用于在组件中使用历史记录
export function useEditorHistory(id?: number) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyManager = EditorHistory.getInstance();
  
  // 加载历史记录
  const loadHistory = useCallback(() => {
    const items = historyManager.getHistory(id);
    setHistory(items);
  }, [id]);
  
  // 保存历史记录
  const saveHistory = useCallback((content: string, title: string, description: string = '自动保存') => {
    historyManager.saveHistory({
      content,
      title,
      timestamp: Date.now(),
      description
    }, id);
    loadHistory(); // 重新加载历史记录以更新状态
  }, [id, loadHistory]);
  
  // 删除历史记录
  const deleteHistoryItem = useCallback((historyId: string) => {
    historyManager.deleteHistoryItem(historyId, id);
    loadHistory(); // 重新加载历史记录以更新状态
  }, [id, loadHistory]);
  
  // 清除所有历史记录
  const clearHistory = useCallback(() => {
    historyManager.clearHistory(id);
    loadHistory(); // 重新加载历史记录以更新状态
  }, [id, loadHistory]);
  
  // 初始加载历史记录
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  
  return {
    history,
    saveHistory,
    deleteHistoryItem,
    clearHistory,
    loadHistory
  };
} 