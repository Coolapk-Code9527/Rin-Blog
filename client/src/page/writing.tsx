import Editor from '@monaco-editor/react';
import i18n from 'i18next';
import _ from 'lodash';
import {editor} from 'monaco-editor';
import * as monaco from 'monaco-editor';
import {Calendar} from 'primereact/calendar';
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import React, {useCallback, useEffect, useRef, useState, useMemo} from "react";
import {Helmet} from "react-helmet-async";
import {useTranslation} from "react-i18next";

import { ToolbarButton, Button } from '../components/button';
import {ShowAlertType, useAlert} from '../components/dialog';
// import {Checkbox, Input} from "../components/input"; // 不再需要，使用内联编辑
import {Markdown} from "../components/markdown";
import {client} from "../main";
import {headersWithAuth} from "../utils/auth";
import {Cache, useCache} from '../utils/cache';
import {siteName} from "../utils/constants";
import {useColorMode} from "../utils/darkModeUtils";

import { HistoryDialog } from "../components/history_dialog";
import { useEditorHistory, HistoryItem } from "../utils/history";
import {DraftDialog} from "../components/draft_dialog";
import {useDraftManager, Draft} from "../utils/draft";
import type { Feed } from '../types/api';  // 根据实际路径调整

import { FileSelectorDialog } from '../components/file_manager/FileSelectorDialog';
import type { FileItem } from '../types/api';
import { MODAL_Z_INDEX } from "../utils/modal-config";

// 处理process.env问题
declare const process: {
  env: {
    NAME?: string;
    AVATAR?: string;
    [key: string]: string | undefined;
  }
};

// 全局变量，使用明确的类型断言
const NAME = (process.env.NAME || '博客') as string;
const AVATAR = (process.env.AVATAR || '') as string;

// 添加自定义滚动条样式
const scrollbarStyles = `
  /* 自定义滚动条样式 */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(155, 155, 155, 0.5);
    border-radius: 20px;
    border: none;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(155, 155, 155, 0.7);
  }
  
  /* 暗色模式下的滚动条 */
  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(100, 100, 100, 0.5);
  }
  
  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(100, 100, 100, 0.7);
  }
  
  /* 针对编辑器滚动条的特殊处理 */
  .monaco-editor .scrollbar .slider {
    background-color: rgba(155, 155, 155, 0.5) !important;
    border-radius: 20px !important;
  }
  
  .dark .monaco-editor .scrollbar .slider {
    background-color: rgba(100, 100, 100, 0.5) !important;
  }
  
  /* 动画效果 */
  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .animate-slide-up {
    animation: slideUp 0.3s ease-out forwards;
  }
  
  /* 针对不同屏幕尺寸的编辑器容器高度调整 */
  @media (max-width: 1024px) {
    /* 移动端和平板端布局调整 */
    .writing-layout {
      flex-direction: column !important;
      gap: 1rem !important;
    }

    .writing-main-area {
      width: 100% !important;
      flex: none !important;
    }

    .writing-sidebar {
      width: 100% !important;
      flex-shrink: 1 !important;
    }
  }

  @media (max-width: 640px) {
    .editor-container {
      height: calc(100vh - 280px) !important; /* 为移动端功能面板留出更多空间 */
    }

    /* 移动端功能面板优化 */
    .mobile-function-panel {
      position: relative !important;
      height: auto !important;
      min-height: 300px !important;
      max-height: none !important;
    }

    /* 移动端工具按钮优化 */
    .mobile-tool-grid {
      grid-template-columns: repeat(3, 1fr) !important; /* 3列布局更适合移动端 */
      gap: 0.75rem !important;
    }

    .mobile-tool-button {
      min-height: 44px !important; /* 符合移动端触控标准 */
      padding: 0.75rem !important;
      font-size: 0.75rem !important;
    }

    /* 移动端发布设置优化 */
    .mobile-publish-settings {
      padding: 1rem !important;
      gap: 1rem !important;
    }

    .mobile-publish-input {
      min-height: 44px !important;
      padding: 0.75rem !important;
      font-size: 1rem !important;
    }

    .mobile-publish-button {
      min-height: 48px !important;
      padding: 0.75rem 1rem !important;
      font-size: 1rem !important;
    }

    /* 移动端顶部工具栏优化 - 超紧凑设计，完全遵循PageContainer间距 */
    .mobile-top-toolbar {
      padding-top: 0.5rem !important;
      padding-bottom: 0.5rem !important;
      padding-left: 0 !important; /* 让PageContainer控制间距 */
      padding-right: 0 !important; /* 让PageContainer控制间距 */
      gap: 0.25rem !important;
    }

    /* 移动端写作页面内容区域宽度限制 - 遵循PageContainer标准 */
    .writing-content-wrapper {
      width: 100% !important;
    }

    /* 移动端编辑器卡片宽度统一 */
    .mobile-editor-card {
      width: 100% !important;
      margin: 0 !important;
    }
  }

  /* 桌面端左右面板高度对齐 */
  @media (min-width: 1024px) {
    .writing-layout {
      align-items: stretch !important; /* 确保子元素高度一致 */
    }

    .writing-main-area,
    .writing-sidebar {
      min-height: 600px !important; /* 桌面端最小高度 */
    }

    /* 确保编辑器和功能面板高度完全一致 */
    .editor-container {
      height: calc(100vh - 200px) !important;
      max-height: calc(100vh - 150px) !important;
    }

    .mobile-function-panel {
      height: calc(100vh - 200px) !important;
      max-height: calc(100vh - 150px) !important;
    }

    .mobile-preview-buttons {
      gap: 0.125rem !important;
    }

    .mobile-preview-button {
      min-height: 32px !important;
      padding: 0.375rem 0.5rem !important;
      font-size: 0.6875rem !important;
      touch-action: manipulation;
      border-radius: 0.375rem !important;
    }

    .mobile-stats-info {
      gap: 0.25rem !important;
    }

    .mobile-stats-compact {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      font-size: 0.625rem !important;
    }

    .mobile-focus-button {
      min-height: 32px !important;
      padding: 0.375rem 0.5rem !important;
      font-size: 0.6875rem !important;
      border-radius: 0.375rem !important;
    }

    /* 移动端工具栏隐藏优化 */
    .mobile-toolbar-hidden {
      height: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      opacity: 0 !important;
    }
  }

  @media (min-width: 641px) and (max-width: 768px) {
    .editor-container {
      height: calc(100vh - 200px) !important; /* 与右侧面板统一高度 */
    }

    .mobile-function-panel {
      height: calc(100vh - 200px) !important; /* 与左侧编辑器统一高度 */
    }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .editor-container {
      height: calc(100vh - 200px) !important; /* 与右侧面板统一高度 */
    }

    .mobile-function-panel {
      height: calc(100vh - 200px) !important; /* 与左侧编辑器统一高度 */
    }
  }

  @media (min-width: 1025px) {
    .editor-container {
      height: calc(100vh - 200px) !important; /* 与右侧面板统一高度 */
    }

    .mobile-function-panel {
      height: calc(100vh - 200px) !important; /* 与左侧编辑器统一高度 */
    }
  }
`;

// 扩展Feed类型以包含我们需要的属性
interface ExtendedFeed extends Feed {
  alias?: string;
  listed?: number;
  draft?: number;
}

// 优化的文章信息编辑器 - 移到组件外部避免重新创建
function ArticleInfoEditor({ title, setTitle }: {
  title: string;
  setTitle: (title: string) => void;
}): JSX.Element {
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, [setTitle]);

  return (
    <div className="w-full">
      {/* 标题区域 - 减小高度和内边距 */}
      <div className="relative bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-lg p-2">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="输入文章标题..."
          className="w-full text-lg font-bold bg-transparent border-none outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:ring-0 py-1"
        />
      </div>
    </div>
  );
}

// 优化的标签管理组件 - 移到组件外部
function TagManager({ tags, setTags }: {
  tags: string;
  setTags: (tags: string) => void;
}): JSX.Element {
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // 解析标签字符串为数组
  const tagArray = useMemo(() =>
    tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
  , [tags]);

  // 标签颜色配置
  const tagColors = useMemo(() => [
    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700',
    'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700',
    'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-700',
    'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-700',
    'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700',
    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700',
    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700',
    'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-700',
  ], []);

  // 根据标签内容生成颜色索引
  const getTagColor = useCallback((tag: string) => {
    const hash = tag.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return tagColors[Math.abs(hash) % tagColors.length];
  }, [tagColors]);

  // 添加标签
  const addTag = useCallback(() => {
    if (tagInput.trim() && !tagArray.includes(tagInput.trim())) {
      const newTags = [...tagArray, tagInput.trim()];
      setTags(newTags.join(', '));
      setTagInput('');
      setShowTagInput(false);
    }
  }, [tagInput, tagArray, setTags]);

  // 删除标签
  const removeTag = useCallback((tagToRemove: string) => {
    const newTags = tagArray.filter(tag => tag !== tagToRemove);
    setTags(newTags.join(', '));
  }, [tagArray, setTags]);

  return (
    <div className="flex items-center flex-wrap gap-2 flex-1 py-2">
      {tagArray.map((tag, index) => (
        <span
          key={index}
          className={`inline-flex items-center px-3 py-2 rounded-lg text-xs border ${getTagColor(tag)} shadow-sm backdrop-blur-sm h-8 font-medium`}
        >
          <i className="ri-price-tag-3-fill mr-1.5 text-xs"></i>
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="ml-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-1 transition-colors"
          >
            <i className="ri-close-line text-xs"></i>
          </button>
        </span>
      ))}

      {/* 添加标签按钮或输入框 */}
      {showTagInput ? (
        <div className="flex items-center space-x-2 h-8">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            onBlur={() => {
              if (!tagInput.trim()) {
                setShowTagInput(false);
              }
            }}
            placeholder="标签名称"
            className="px-3 py-2 text-xs border border-orange-300 dark:border-orange-600 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent w-28 backdrop-blur-sm shadow-sm h-8"
            autoFocus
          />
          <button
            onClick={addTag}
            className="text-orange-500 hover:text-orange-600 text-sm p-1.5 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-full transition-colors"
          >
            <i className="ri-check-line"></i>
          </button>
          <button
            onClick={() => {
              setShowTagInput(false);
              setTagInput('');
            }}
            className="text-gray-400 hover:text-gray-600 text-sm p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTagInput(true)}
          className="inline-flex items-center px-3 py-2 rounded-lg text-xs border border-dashed border-orange-300/60 dark:border-orange-600/60 text-orange-500 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/80 dark:hover:bg-orange-900/20 transition-all shadow-sm backdrop-blur-sm h-8 font-medium hover:shadow-md"
        >
          <i className="ri-add-line mr-1.5 text-xs"></i>
          添加标签
        </button>
      )}
    </div>
  );
}

// 内容模板组件
const ContentTemplates = React.memo(({ editor, onClose }: { editor?: editor.IStandaloneCodeEditor, onClose?: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const { t } = useTranslation();
  const templatesPanelRef = useRef<HTMLDivElement>(null);
  
  // 预定义模板
  const defaultTemplates = [
    {
      name: t('templates.table'),
      content: `| ${t('templates.header')} 1 | ${t('templates.header')} 2 | ${t('templates.header')} 3 |\n| --- | --- | --- |\n| ${t('templates.content')} 1 | ${t('templates.content')} 2 | ${t('templates.content')} 3 |\n| ${t('templates.content')} 4 | ${t('templates.content')} 5 | ${t('templates.content')} 6 |\n`
    },
    {
      name: t('templates.code_block'),
      content: '```javascript\n// 代码示例\nfunction hello() {\n  console.log("Hello World!");\n}\n```\n'
    },
    {
      name: t('templates.quote'),
      content: '> 这是一段引用文本\n> \n> 可以有多行\n'
    },
    {
      name: t('templates.todo_list'),
      content: '- [ ] 待办事项 1\n- [ ] 待办事项 2\n- [x] 已完成事项\n'
    },
    {
      name: t('templates.image_gallery'),
      content: '<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">\n\n![图片1](图片URL1)\n\n![图片2](图片URL2)\n\n![图片3](图片URL3)\n\n</div>\n'
    },
    {
      name: t('templates.callout'),
      content: ':::info\n这是一个信息提示框\n:::\n'
    },
    {
      name: t('templates.mermaid'),
      content: '```mermaid\ngraph TD;\n  A-->B;\n  A-->C;\n  B-->D;\n  C-->D;\n```\n'
    }
  ];
  
  // 从LocalStorage加载自定义模板
  useEffect(() => {
    const savedTemplates = localStorage.getItem('markdown_templates');
    if (savedTemplates) {
      try {
        setCustomTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to parse saved templates', e);
      }
    }
  }, []);
  
  // 保存自定义模板到LocalStorage
  const saveCustomTemplate = useCallback(() => {
    if (!editor || !templateName.trim()) return;
    
    const selection = editor.getSelection();
    if (!selection) return;
    
    const selectedText = editor.getModel()?.getValueInRange(selection) || '';
    if (!selectedText) return;
    
    const newTemplate = { name: templateName.trim(), content: selectedText };
    const updatedTemplates = [...customTemplates, newTemplate];
    
    setCustomTemplates(updatedTemplates);
    localStorage.setItem('markdown_templates', JSON.stringify(updatedTemplates));
    
    setTemplateName('');
    setShowSaveForm(false);
  }, [editor, templateName, customTemplates]);
  
  // 删除自定义模板
  const deleteCustomTemplate = useCallback((index: number) => {
    const updatedTemplates = customTemplates.filter((_: Template, i: number) => i !== index);
    setCustomTemplates(updatedTemplates);
    localStorage.setItem('markdown_templates', JSON.stringify(updatedTemplates));
  }, [customTemplates]);
  
  // 插入模板内容
  const insertTemplate = useCallback((content: string) => {
    if (!editor) return;

    const selection = editor.getSelection();
    if (!selection) return;

    editor.executeEdits('', [{
      range: selection,
      text: content
    }]);

    setIsOpen(false);
    editor.focus();

    // 如果有外部关闭回调，也调用它
    if (onClose) {
      onClose();
    }
  }, [editor, onClose]);
  
  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templatesPanelRef.current && !templatesPanelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="relative inline-block" ref={templatesPanelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3 bg-purple-50/70 dark:bg-purple-900/25 backdrop-blur-md text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/40 border border-purple-200 dark:border-purple-800 shadow-enhanced hover:shadow-enhanced-lg rounded-xl font-medium transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2 dark:focus:ring-offset-gray-900 flex items-center justify-center"
        title={t('templates.insert')}
      >
        <i className="ri-file-list-line text-base mr-1" />
        <span className="text-sm hidden sm:inline">{t('templates.templates')}</span>
      </button>
      
      {isOpen && (
        <div
          className="absolute mt-2 w-64 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-md shadow-enhanced-lg border border-neutral-200/60 dark:border-neutral-700/60"
          style={{ zIndex: MODAL_Z_INDEX.DROPDOWN }}
        >
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-sm">{t('templates.templates')}</h3>
            <button 
              onClick={() => setShowSaveForm(!showSaveForm)}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              {showSaveForm ? t('templates.cancel') : t('templates.save_selection')}
            </button>
          </div>
          
          {showSaveForm && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder={t('templates.template_name')}
                className="w-full p-1 text-sm border border-gray-300 dark:border-gray-600 rounded mb-2 bg-white dark:bg-gray-700"
                value={templateName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplateName(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  onClick={saveCustomTemplate}
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                  disabled={!templateName.trim()}
                >
                  {t('templates.save')}
                </button>
              </div>
            </div>
          )}
          
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <div className="p-1">
              <p className="text-xs text-gray-500 mb-1 px-2">{t('templates.default')}</p>
              {defaultTemplates.map((template, index) => (
                <button
                  key={`default-${index}`}
                  onClick={() => insertTemplate(template.content)}
                  className="w-full text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {template.name}
                </button>
              ))}
            </div>
            
            {customTemplates.length > 0 && (
              <div className="p-1 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1 px-2">{t('templates.custom')}</p>
                {customTemplates.map((template: Template, index: number) => (
                  <div 
                    key={`custom-${index}`}
                    className="group flex items-center"
                  >
                    <button
                      onClick={() => insertTemplate(template.content)}
                      className="flex-grow text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      {template.name}
                    </button>
                    <button
                      onClick={() => deleteCustomTemplate(index)}
                      className="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={t('templates.delete')}
                    >
                      <i className="ri-delete-bin-line text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
// 确保有一个明确的displayName
ContentTemplates.displayName = 'ContentTemplates';

// 改进的Markdown工具栏组件 - 支持多行处理和更多工具
const MarkdownToolbar = React.memo(({
  editor
}: {
  editor?: editor.IStandaloneCodeEditor
}) => {
  const { t } = useTranslation();

  // 基础文本插入函数
  const insertText = useCallback((before: string, after: string = '', defaultText: string = '') => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel()?.getValueInRange(selection) || defaultText;
    editor.executeEdits('', [{
      range: selection,
      text: before + selectedText + after
    }]);
    editor.focus();
  }, [editor]);

  // 多行列表处理函数
  const insertMultiLineList = useCallback((listType: 'ordered' | 'unordered') => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const model = editor.getModel();
    if (!model) return;

    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;

    // 如果是单行且没有选中文本，直接插入列表标记
    const isEmptySelection = selection.startLineNumber === selection.endLineNumber &&
                            selection.startColumn === selection.endColumn;
    if (startLine === endLine && isEmptySelection) {
      const prefix = listType === 'ordered' ? '1. ' : '- ';
      insertText(prefix);
      return;
    }

    // 多行处理
    const edits = [];
    for (let i = startLine; i <= endLine; i++) {
      const lineContent = model.getLineContent(i);
      const trimmedContent = lineContent.trim();

      // 跳过空行
      if (trimmedContent === '') continue;

      const prefix = listType === 'ordered' ? `${i - startLine + 1}. ` : '- ';

      // 检查是否已经是列表项
      const isAlreadyList = /^(\s*)([-+*]|\d+\.)\s/.test(lineContent);

      if (isAlreadyList) {
        // 如果已经是列表，替换列表标记
        const newContent = lineContent.replace(/^(\s*)([-+*]|\d+\.)\s/, `$1${prefix}`);
        edits.push({
          range: new monaco.Range(i, 1, i, lineContent.length + 1),
          text: newContent
        });
      } else {
        // 如果不是列表，在行首添加列表标记
        edits.push({
          range: new monaco.Range(i, 1, i, 1),
          text: prefix
        });
      }
    }

    if (edits.length > 0) {
      editor.executeEdits('', edits);
    }
    editor.focus();
  }, [editor]);

  // 多行引用处理函数
  const insertMultiLineQuote = useCallback(() => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const model = editor.getModel();
    if (!model) return;

    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;

    // 如果是单行且没有选中文本，直接插入引用标记
    const isEmptySelection = selection.startLineNumber === selection.endLineNumber &&
                            selection.startColumn === selection.endColumn;
    if (startLine === endLine && isEmptySelection) {
      insertText('> ');
      return;
    }

    // 多行处理
    const edits = [];
    for (let i = startLine; i <= endLine; i++) {
      const lineContent = model.getLineContent(i);

      // 检查是否已经是引用
      const isAlreadyQuote = /^(\s*)>\s/.test(lineContent);

      if (isAlreadyQuote) {
        // 如果已经是引用，移除引用标记
        const newContent = lineContent.replace(/^(\s*)>\s/, '$1');
        edits.push({
          range: new monaco.Range(i, 1, i, lineContent.length + 1),
          text: newContent
        });
      } else {
        // 如果不是引用，在行首添加引用标记
        edits.push({
          range: new monaco.Range(i, 1, i, 1),
          text: '> '
        });
      }
    }

    if (edits.length > 0) {
      editor.executeEdits('', edits);
    }
    editor.focus();
  }, [editor]);

  // 插入当前时间
  const insertCurrentTime = useCallback(() => {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    insertText(timeString);
  }, [insertText]);

  // 插入任务列表
  const insertTaskList = useCallback(() => {
    insertText('- [ ] ');
  }, [insertText]);

  // 智能链接插入
  const insertSmartLink = useCallback(() => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel()?.getValueInRange(selection) || '';

    // 如果选中的文本看起来像URL，将其作为链接地址
    const urlRegex = /^https?:\/\/.+/;
    if (urlRegex.test(selectedText.trim())) {
      editor.executeEdits('', [{
        range: selection,
        text: `[链接文本](${selectedText.trim()})`
      }]);
    } else {
      // 否则将选中文本作为链接文本
      const linkText = selectedText || '链接文本';
      editor.executeEdits('', [{
        range: selection,
        text: `[${linkText}](url)`
      }]);
    }
    editor.focus();
  }, [editor]);

  // 智能图片插入
  const insertSmartImage = useCallback(() => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel()?.getValueInRange(selection) || '';

    // 如果选中的文本看起来像图片URL，将其作为图片地址
    const imageUrlRegex = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (imageUrlRegex.test(selectedText.trim())) {
      editor.executeEdits('', [{
        range: selection,
        text: `![图片描述](${selectedText.trim()})`
      }]);
    } else {
      // 否则将选中文本作为图片描述
      const altText = selectedText || '图片描述';
      editor.executeEdits('', [{
        range: selection,
        text: `![${altText}](图片链接)`
      }]);
    }
    editor.focus();
  }, [editor]);

  return (
    <div className="flex items-center space-x-1 flex-wrap gap-y-2">
      {/* 基础格式工具 */}
      <ToolbarButton icon="ri-bold" onClick={() => insertText('**', '**', '粗体文本')} title="粗体 (Ctrl+B)" variant="ghost" />
      <ToolbarButton icon="ri-italic" onClick={() => insertText('*', '*', '斜体文本')} title="斜体 (Ctrl+I)" variant="ghost" />
      <ToolbarButton icon="ri-strikethrough" onClick={() => insertText('~~', '~~', '删除线文本')} title="删除线" variant="ghost" />
      <ToolbarButton icon="ri-mark-pen-line" onClick={() => insertText('==', '==', '高亮文本')} title="高亮标记" variant="ghost" />
      <ToolbarButton icon="ri-underline" onClick={() => insertText('<u>', '</u>', '下划线文本')} title="下划线" variant="ghost" />
      <ToolbarButton icon="ri-superscript" onClick={() => insertText('<sup>', '</sup>', '上标')} title="上标文本" variant="ghost" />
      <ToolbarButton icon="ri-subscript" onClick={() => insertText('<sub>', '</sub>', '下标')} title="下标文本" variant="ghost" />

      {/* 标题工具 */}
      <ToolbarButton icon="ri-h-1" onClick={() => insertText('# ')} title="一级标题" variant="ghost" />
      <ToolbarButton icon="ri-h-2" onClick={() => insertText('## ')} title="二级标题" variant="ghost" />
      <ToolbarButton icon="ri-h-3" onClick={() => insertText('### ')} title="三级标题" variant="ghost" />

      {/* 列表工具 */}
      <ToolbarButton icon="ri-list-unordered" onClick={() => insertMultiLineList('unordered')} title="无序列表 (支持多行)" variant="ghost" />
      <ToolbarButton icon="ri-list-ordered" onClick={() => insertMultiLineList('ordered')} title="有序列表 (支持多行)" variant="ghost" />
      <ToolbarButton icon="ri-list-check-2" onClick={insertTaskList} title="任务列表" variant="ghost" />
      <ToolbarButton icon="ri-checkbox-line" onClick={() => insertText('- [x] ', '', '已完成任务')} title="已完成任务" variant="ghost" />
      <ToolbarButton icon="ri-double-quotes-l" onClick={insertMultiLineQuote} title="引用 (支持多行)" variant="ghost" />

      {/* 插入工具 */}
      <ToolbarButton icon="ri-link" onClick={insertSmartLink} title="智能插入链接 (自动识别URL)" variant="ghost" />
      <ToolbarButton icon="ri-image-line" onClick={insertSmartImage} title="智能插入图片 (自动识别图片URL)" variant="ghost" />
      <ToolbarButton icon="ri-video-line" onClick={() => insertText('<video controls>\n  <source src="视频链接" type="video/mp4">\n</video>', '', '')} title="插入视频" variant="ghost" />
      <ToolbarButton icon="ri-music-line" onClick={() => insertText('<audio controls>\n  <source src="音频链接" type="audio/mp3">\n</audio>', '', '')} title="插入音频" variant="ghost" />

      {/* 代码工具 */}
      <ToolbarButton icon="ri-code-line" onClick={() => insertText('`', '`', '行内代码')} title="行内代码" variant="ghost" />
      <ToolbarButton icon="ri-code-s-slash-line" onClick={() => insertText('```\n', '\n```', '代码块')} title="代码块" variant="ghost" />
      <ToolbarButton icon="ri-functions" onClick={() => insertText('$$\n', '\n$$', 'LaTeX公式')} title="数学公式" variant="ghost" />

      {/* 结构工具 */}
      <ToolbarButton
        icon="ri-table-line"
        onClick={() => insertText('| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n')}
        title="插入表格"
        variant="ghost"
      />
      <ToolbarButton icon="ri-separator" onClick={() => insertText('---\n')} title="分隔线" variant="ghost" />
      <ToolbarButton icon="ri-layout-grid-line" onClick={() => insertText('<details>\n<summary>点击展开</summary>\n\n隐藏内容\n\n</details>', '', '')} title="折叠内容" variant="ghost" />

      {/* 样式工具 */}
      <ToolbarButton icon="ri-text-spacing" onClick={() => insertText('<center>', '</center>', '居中文本')} title="居中对齐" variant="ghost" />
      <ToolbarButton icon="ri-palette-line" onClick={() => insertText('<span style="color: red;">', '</span>', '彩色文本')} title="彩色文本" variant="ghost" />

      {/* 标记工具 */}
      <ToolbarButton icon="ri-star-line" onClick={() => insertText('⭐ ', '', '重要标记')} title="重要标记" variant="ghost" />
      <ToolbarButton icon="ri-lightbulb-line" onClick={() => insertText('💡 ', '', '提示')} title="提示标记" variant="ghost" />
      <ToolbarButton icon="ri-fire-line" onClick={() => insertText('🔥 ', '', '热门')} title="热门标记" variant="ghost" />
      <ToolbarButton icon="ri-bookmark-line" onClick={() => insertText('📌 ', '', '重点')} title="重点标记" variant="ghost" />

      {/* 提示工具 */}
      <ToolbarButton icon="ri-information-line" onClick={() => insertText('> [!NOTE]\n> ', '', '注意事项')} title="提示框" variant="ghost" />
      <ToolbarButton icon="ri-alert-line" onClick={() => insertText('> [!WARNING]\n> ', '', '警告信息')} title="警告框" variant="ghost" />
      <ToolbarButton icon="ri-file-text-line" onClick={() => insertText('<!-- ', ' -->', '注释内容')} title="HTML注释" variant="ghost" />

      {/* 快速插入工具 */}
      <ToolbarButton icon="ri-time-line" onClick={insertCurrentTime} title="插入当前时间" variant="ghost" />
      <ToolbarButton icon="ri-calendar-2-line" onClick={() => insertText(new Date().toLocaleDateString('zh-CN'))} title="插入日期" variant="ghost" />
      <ToolbarButton icon="ri-user-line" onClick={() => insertText('@', '', '用户名')} title="提及用户" variant="ghost" />
      <ToolbarButton icon="ri-hashtag" onClick={() => insertText('#', '', '标签')} title="插入标签" variant="ghost" />
      <ToolbarButton icon="ri-external-link-line" onClick={() => insertText('[外部链接](https://)', '', '')} title="外部链接" variant="ghost" />
      <ToolbarButton icon="ri-download-line" onClick={() => insertText('[下载文件](文件链接)', '', '')} title="下载链接" variant="ghost" />
      <ToolbarButton icon="ri-keyboard-line" onClick={() => insertText('<kbd>', '</kbd>', '按键')} title="键盘按键" variant="ghost" />

      {/* 新增常用工具 */}
      <ToolbarButton icon="ri-text-wrap" onClick={() => insertText('<br>', '', '')} title="换行符" variant="ghost" />
    </div>
  );
});
// 确保有一个明确的displayName
MarkdownToolbar.displayName = 'MarkdownToolbar';

// 增强的编辑器拖放上传功能
const useEditorDragDrop = (editorRef: React.RefObject<editor.IStandaloneCodeEditor>, showAlert: ShowAlertType) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const { t } = useTranslation();

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!editorRef.current || files.length === 0) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (!selection) return;

    setIsUploading(true);
    setUploadingFiles(Array.from(files));
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round((i / files.length) * 100));

        await new Promise<void>((resolve, reject) => {
          uploadImage(file, (url) => {
            const currentValue = editor.getModel()?.getValue();
            let insertText = '';

            if (file.type.startsWith('image/')) {
              insertText = `![${file.name}](${url})\n`;
            } else if (file.type.startsWith('audio/')) {
              insertText = `<audio src="${url}" controls></audio>\n`;
            } else if (file.type.startsWith('video/')) {
              insertText = `<video src="${url}" controls></video>\n`;
            } else {
              insertText = `[${file.name}](${url})\n`;
            }

            if (currentValue && currentValue.includes(insertText.trim())) {
              resolve();
              return;
            }

            editor.executeEdits(undefined, [{
              range: selection,
              text: insertText,
            }]);
            resolve();
          }, (error) => {
            showAlert(error);
            reject(new Error(error));
          });
        });
      }
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadingFiles([]);
      }, 500);
    }
  }, [editorRef, showAlert, t]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer?.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  return {
    isDragging,
    isUploading,
    uploadProgress,
    uploadingFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileUpload
  };
};

// 增强的粘贴处理函数，支持预览
function handlePaste(event: React.ClipboardEvent<HTMLDivElement>, editorRef: React.RefObject<editor.IStandaloneCodeEditor>, setUploading: (value: boolean) => void, showAlert: ShowAlertType) {
  const clipboardData = event.clipboardData;
  const t = i18n.t;
  
  // 检查是否包含图片文件
  if (clipboardData.files.length === 1 && clipboardData.files[0].type.startsWith('image/')) {
    event.preventDefault(); // 阻止默认粘贴行为
    
    const editor = editorRef.current;
    if (!editor) return;
    
    // 撤销默认粘贴操作
    editor.trigger(undefined, "undo", undefined);
    
    const file = clipboardData.files[0] as File;
    
    // 检查文件大小
    if (file.size > 20 * 1024000) {
      showAlert(t("upload.failed$size", { size: 20 }));
      return;
    }
    
    setUploading(true);
    
    // 创建临时预览并插入编辑器
    const reader = new FileReader();
    let tempMarkerId: string | undefined;
    
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      const selection = editor.getSelection();
      if (!selection) return;
      
      // 在编辑器中插入临时预览，使用t函数翻译"上传中..."
      const tempMarker = `![${file.name} (${t('uploading')})](${imageUrl})\n`;
      editor.executeEdits(undefined, [{
        range: selection,
        text: tempMarker,
      }]);
      
      // 添加临时装饰
      const model = editor.getModel();
      if (model) {
        const position = editor.getPosition();
        if (position) {
          tempMarkerId = editor.deltaDecorations([], [
            {
              range: new monaco.Range(position.lineNumber, 1, position.lineNumber, tempMarker.length),
              options: {
                isWholeLine: true,
                className: 'uploading-image-line',
                inlineClassName: 'uploading-image-text'
              }
            }
          ])[0];
        }
      }
      
      // 上传图片
      uploadImage(file, (url) => {
        setUploading(false);
        
        // 用实际URL替换临时预览
        const model = editor.getModel();
        if (model) {
          // 查找临时预览的行
          const lineCount = model.getLineCount();
          for (let i = 1; i <= lineCount; i++) {
            const lineContent = model.getLineContent(i);
            if (lineContent.includes(`${file.name} (${t('uploading')})`)) {
              const finalText = `![${file.name}](${url})\n`;
              const range = new monaco.Range(i, 1, i, lineContent.length + 1);
              editor.executeEdits(undefined, [{
                range,
                text: finalText,
              }]);
              break;
            }
          }
        }
        
        // 移除临时装饰
        if (tempMarkerId) {
          editor.deltaDecorations([tempMarkerId], []);
        }
      }, showAlert);
    };
    
    reader.readAsDataURL(file);
  }
}

async function publish({
  title,
  alias,
  listed,
  content,
  summary,
  tags,
  draft,
  createdAt,
  onCompleted,
  showAlert
}: {
  title: string;
  listed: boolean;
  content: string;
  summary: string;
  tags: string[];
  draft: boolean;
  alias?: string;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
  const { data, error } = await client.feed.index.post(
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      createdAt,
    },
    {
      headers: headersWithAuth(),
    }
  );
  if (onCompleted) {
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('file-upload-success'));
    }
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
    return; // 发生错误时提前返回
  }
  if (data && typeof data !== "string") {
    // 直接跳转到文章页面，不显示提示弹窗
    Cache.with().set("content", content); // 将当前内容写入缓存，避免beforeunload触发
    Cache.with().clear();
    // 使用replace方法替换当前页面，避免返回按钮返回到编辑页
    // @ts-ignore - 忽略insertedId类型错误
    window.location.replace("/feed/" + data.insertedId);
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('file-upload-success'));
    }
  }
}

async function update({
  id,
  title,
  alias,
  content,
  summary,
  tags,
  listed,
  draft,
  createdAt,
  onCompleted,
  showAlert
}: {
  id: number;
  listed: boolean;
  title?: string;
  alias?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  draft?: boolean;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
  const { error } = await client.feed({ id }).post(
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      createdAt,
    },
    {
      headers: headersWithAuth(),
    }
  );
  if (onCompleted) {
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('file-upload-success'));
    }
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
    return; // 发生错误时提前返回
  }
  
  // 直接跳转到文章页面，不显示提示弹窗
  if (content) {
    Cache.with(id).set("content", content); // 将当前内容写入缓存，避免beforeunload触发
  }
      Cache.with(id).clear();
  // 使用replace方法替换当前页面，避免返回按钮返回到编辑页
  window.location.replace("/feed/" + id);
  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('file-upload-success'));
  }
  }

// 修改uploadImage函数，处理API响应类型
async function uploadImage(file: File, onSuccess: (url: string) => void, showAlert: ShowAlertType) {
  const t = i18n.t;
  try {
    const config = JSON.parse(sessionStorage.getItem('config') || '{}');
    const S3_FOLDER = config.S3_FOLDER || 'images';
    const response = await client.files.index.post(
      {
        file,
        name: file.name,
        parentPath: '/' + S3_FOLDER,
      },
      {
        headers: headersWithAuth(),
      }
    );
    if (response.error) {
      let errMsg = typeof response.error.value === 'object'
        ? JSON.stringify(response.error.value)
        : response.error.value;
      showAlert(t("upload.failed", { error: errMsg }));
      return;
    }
    let imageUrl = '';
    if (response.data && typeof response.data === 'object') {
      imageUrl = response.data.url || response.data.path || '';
    }
    if (!imageUrl && typeof response.data === 'string') {
      imageUrl = response.data;
    }
    if (imageUrl) {
      // 只用接口返回的url字段，不再拼接host
      onSuccess(imageUrl);
      // 上传成功后刷新文件管理（如有）
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('file-upload-success'));
      }
    } else {
      showAlert(t("upload.failed", { error: 'No url returned' }));
    }
  } catch (e: any) {
    console.error(e);
    showAlert(t("upload.failed", { error: e.message || JSON.stringify(e) || 'Server error' }));
  }
}

// Monaco编辑器实例初始化和自定义快捷键配置
function configureEditorKeybindings(editor: editor.IStandaloneCodeEditor, autoSave: () => void, setSaveStatus: (status: string) => void) {
  const t = i18n.t;
  
  // Ctrl+B: 加粗
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel()?.getValueInRange(selection) || '';
    
    editor.executeEdits('', [{
      range: selection,
      text: `**${selectedText}**`
    }]);
    
    // 定位光标到加粗文本后
    if (selectedText.length === 0) {
      const newPosition = new monaco.Position(
        selection.startLineNumber,
        selection.startColumn + 2
      );
      editor.setPosition(newPosition);
    }
  });
  
  // Ctrl+I: 斜体
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel()?.getValueInRange(selection) || '';
    
    editor.executeEdits('', [{
      range: selection,
      text: `*${selectedText}*`
    }]);
    
    // 定位光标到斜体文本后
    if (selectedText.length === 0) {
      const newPosition = new monaco.Position(
        selection.startLineNumber,
        selection.startColumn + 1
      );
      editor.setPosition(newPosition);
    }
  });
  
  // Ctrl+K: 链接
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel()?.getValueInRange(selection) || '链接文本';
    
    editor.executeEdits('', [{
      range: selection,
      text: `[${selectedText}](url)`
    }]);
    
    // 如果没有选择文本，则选中"链接文本"让用户修改
    if (selectedText === '链接文本') {
      const newSelection = new monaco.Selection(
        selection.startLineNumber,
        selection.startColumn + 1,
        selection.startLineNumber,
        selection.startColumn + 5
      );
      editor.setSelection(newSelection);
    }
  });
  
  // Ctrl+`: 代码
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => {
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel()?.getValueInRange(selection) || '';
    
    editor.executeEdits('', [{
      range: selection,
      text: '`' + selectedText + '`'
    }]);
  });
  
  // Ctrl+Shift+`: 代码块
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backquote, () => {
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel()?.getValueInRange(selection) || '';
    
    editor.executeEdits('', [{
      range: selection,
      text: '```\n' + selectedText + '\n```'
    }]);
  });
  
  // Tab键处理 - 支持缩进和列表项目自动延续
  editor.addCommand(monaco.KeyCode.Tab, () => {
    const selection = editor.getSelection();
    if (!selection) return;
    
    // 检查是否为多行选择
    if (selection.startLineNumber !== selection.endLineNumber) {
      // 多行选择 - 缩进所有行
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      
      const edits = [];
      for (let i = startLine; i <= endLine; i++) {
        const lineContent = editor.getModel()?.getLineContent(i) || '';
        edits.push({
          range: new monaco.Range(i, 1, i, 1),
          text: '  '
        });
      }
      
      editor.executeEdits('', edits);
      return;
    }
    
    // 单行处理 - 检查是否在列表项目中
    const lineContent = editor.getModel()?.getLineContent(selection.startLineNumber) || '';
    const listItemRegex = /^(\s*)([-+*]|\d+\.)\s/;
    const match = lineContent.match(listItemRegex);
    
    if (match && selection.startColumn > match[0].length) {
      // 在列表项目中 - 插入缩进
      editor.executeEdits('', [{
        range: new monaco.Range(selection.startLineNumber, 1, selection.startLineNumber, 1),
        text: '  '
      }]);
    } else {
      // 普通情况 - 插入两个空格
      editor.executeEdits('', [{
        range: selection,
        text: '  '
      }]);
    }
  });
  
  // Shift+Tab - 减少缩进
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => {
    const selection = editor.getSelection();
    if (!selection) return;
    
    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;
    
    const edits = [];
    for (let i = startLine; i <= endLine; i++) {
      const lineContent = editor.getModel()?.getLineContent(i) || '';
      if (lineContent.startsWith('  ')) {
        // 如果行以两个空格开始，删除它们
        edits.push({
          range: new monaco.Range(i, 1, i, 3),
          text: ''
        });
      } else if (lineContent.startsWith(' ')) {
        // 如果行以一个空格开始，删除它
        edits.push({
          range: new monaco.Range(i, 1, i, 2),
          text: ''
        });
      }
    }
    
    if (edits.length > 0) {
      editor.executeEdits('', edits);
    }
  });
  
  // Ctrl+S: 保存
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    autoSave();
    setSaveStatus(t('save'));
    });
}

// 写作页面
export function WritingPage({ id }: { id?: number }) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const cache = Cache.with(id);
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const previewRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = cache.useCache("title", "");
  const [summary, setSummary] = cache.useCache("summary", "");
  const [tags, setTags] = cache.useCache("tags", "");
  const [alias, setAlias] = cache.useCache("alias", "");
  const [draft, setDraft] = useState(false);
  const [listed, setListed] = useState(true);
  const [content, setContent] = cache.useCache("content", "");
  const [createdAt, setCreatedAt] = useState<Date | undefined>(new Date());
  const [preview, setPreview] = useCache<'edit' | 'preview' | 'comparison'>("preview", 'edit');
  const [publishing, setPublishing] = useState(false)
  const [saveStatus, setSaveStatus] = useState(t('save'));
  const [editorScrolling, setEditorScrolling] = useState(false);
  const [previewScrolling, setPreviewScrolling] = useState(false);
  const { showAlert, AlertUI } = useAlert()

  // 使用新的拖放功能
  const dragDropHandlers = useEditorDragDrop(editorRef, showAlert);
  
  // 历史记录状态
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const { 
    history, 
    saveHistory, 
    deleteHistoryItem, 
    clearHistory 
  } = useEditorHistory(id);
  
  // 草稿管理状态
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const {
    drafts,
    saveDraft,
    deleteDraft,
    clearAllDrafts
  } = useDraftManager();

  // 添加一个发布状态标记
  const [isPublishing, setIsPublishing] = useState(false);

  // 文件选择弹窗状态
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  // 记录选择的文件（后续插入用）
  const [selectedFiles, setSelectedFiles] = useState<FileItem | FileItem[] | null>(null);



  // 专注写作模式状态
  const [focusMode, setFocusMode] = useState(false);

  // 移除复杂的高度计算，使用CSS Grid来解决布局问题

  // 写作目标和进度
  const [wordTarget] = useState(0);

  // 模板功能状态
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<{name: string, content: string}[]>([]);
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // 优化的写作统计计算 - 使用 useMemo 避免重复计算
  const writingStats = useMemo(() => {
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const charCount = content.length;
    const lineCount = content.split('\n').length;
    const progress = wordTarget > 0 ? Math.min((wordCount / wordTarget) * 100, 100) : 0;
    const readingTime = Math.ceil(wordCount / 200);

    return { wordCount, charCount, lineCount, progress, readingTime };
  }, [content, wordTarget]);

  const { wordCount } = writingStats;

  // 专注模式快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 或 Ctrl/Cmd + Shift + F 切换专注模式
      if (e.key === 'F11' || (e.key === 'F' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        setFocusMode(!focusMode);
      }
      // Escape 退出专注模式
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusMode]);

  const autoSave = useCallback(() => {
    if (cache.get("content") !== content) {
      cache.set("content", content);
      setSaveStatus(t('save'));

      // 保存到历史记录，使用当前值而不是依赖
      const currentTitle = title || t('history.untitled');
      saveHistory(content, currentTitle, t('history.auto_save'));
    }
  }, [content, cache, t, saveHistory]); // 移除 title 依赖

  const handleContentChange = useCallback((data: string | undefined) => {
    const newContent = data ?? "";
    setContent(newContent);
    setSaveStatus(t('editing'));
  }, [setContent, setSaveStatus, t]);
  
  // 恢复历史记录
  const restoreHistory = useCallback((historyItem: HistoryItem) => {
    setContent(historyItem.content);
    
    // 如果编辑器实例存在，更新其内容
    if (editorRef.current) {
      editorRef.current.setValue(historyItem.content);
    }
    
    // 关闭历史记录对话框
    setHistoryDialogOpen(false);
    
    // 更新保存状态
    setSaveStatus(t('history.restored'));
    
    // 显示提示
    showAlert(t('history.restore_success'));
  }, [showAlert, t]);
  
  // 手动保存历史记录 - 优化依赖项
  const manualSaveHistory = useCallback(() => {
    const currentTitle = title || t('history.untitled');
    saveHistory(content, currentTitle, t('history.manual_save'));
    showAlert(t('history.save_success'));
  }, [content, saveHistory, showAlert, t]); // 移除 title 依赖
  
  // 保存当前内容为草稿 - 优化依赖项
  const saveCurrentAsDraft = useCallback(() => {
    const currentTitle = title || t('drafts.untitled');
    saveDraft({
      title: currentTitle,
      content,
      summary,
      tags,
      alias
    });
    showAlert(t('drafts.save_success'));
    setDraftDialogOpen(false);
  }, [content, summary, tags, alias, saveDraft, showAlert, t]); // 移除 title 依赖
  
  // 加载草稿
  const loadDraftContent = useCallback((draft: Draft) => {
    // 更新编辑器内容
    setContent(draft.content);
    setTitle(draft.title);
    setSummary(draft.summary);
    setTags(draft.tags);
    setAlias(draft.alias);
    
    // 如果编辑器实例存在，更新其内容
    if (editorRef.current) {
      editorRef.current.setValue(draft.content);
    }
    
    // 关闭草稿对话框
    setDraftDialogOpen(false);
    
    // 显示提示
    showAlert(t('drafts.load_success'));
  }, [setContent, setTitle, setSummary, setTags, setAlias, showAlert, t]);

  // 处理编辑器滚动事件
  const handleEditorScroll = useCallback(() => {
    if (previewScrolling || !editorRef.current || !previewRef.current) return;
    
    setEditorScrolling(true);
    
    const editorInfo = editorRef.current.getScrollInfo ? editorRef.current.getScrollInfo() : {
      scrollTop: editorRef.current.getScrollTop(),
      scrollHeight: editorRef.current.getScrollHeight(),
      // @ts-ignore - 忽略类型错误
      clientHeight: editorRef.current.getLayoutInfo().height
    };
    
    const previewElement = previewRef.current;
    // @ts-ignore - 忽略clientHeight类型错误
    const editorScrollRatio = editorInfo.scrollTop / (editorInfo.scrollHeight - editorInfo.clientHeight);
    
    const previewScrollMax = previewElement.scrollHeight - previewElement.clientHeight;
    previewElement.scrollTop = editorScrollRatio * previewScrollMax;
    
    setTimeout(() => setEditorScrolling(false), 50);
  }, [previewScrolling]);
  
  // 处理预览区域滚动事件
  const handlePreviewScroll = useCallback(() => {
    if (editorScrolling || !editorRef.current || !previewRef.current) return;
    
    setPreviewScrolling(true);
    
    const previewElement = previewRef.current;
    const previewScrollRatio = previewElement.scrollTop / (previewElement.scrollHeight - previewElement.clientHeight);
    
    const editorInfo = editorRef.current.getScrollInfo ? editorRef.current.getScrollInfo() : {
      scrollHeight: editorRef.current.getScrollHeight(),
      // @ts-ignore - 忽略类型错误
      clientHeight: editorRef.current.getLayoutInfo().height
    };
    
    // @ts-ignore - 忽略clientHeight类型错误
    const editorScrollMax = editorInfo.scrollHeight - editorInfo.clientHeight;
    editorRef.current.setScrollTop(previewScrollRatio * editorScrollMax);
    
    setTimeout(() => setPreviewScrolling(false), 50);
  }, [editorScrolling]);
  
  // 设置编辑器滚动事件监听
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const onScrollDisposable = editor.onDidScrollChange(() => {
      handleEditorScroll();
    });
    
    return () => {
      onScrollDisposable.dispose();
    };
  }, [handleEditorScroll]);

  // 在应用工具栏(MarkdownToolbar)中添加历史记录按钮
  const configureEditorWithHistory = useCallback((editor: editor.IStandaloneCodeEditor) => {
    // 原有的编辑器配置
    configureEditorKeybindings(editor, autoSave, setSaveStatus);
    
    // 添加手动保存到历史记录的快捷键 (Ctrl+Shift+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      manualSaveHistory();
    });
    
    // 添加快速保存草稿的快捷键 (Ctrl+Alt+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyS, () => {
      saveCurrentAsDraft();
    });
  }, [autoSave, setSaveStatus, manualSaveHistory, saveCurrentAsDraft]);

  useEffect(() => {
    const timer = setInterval(() => {
      autoSave();
    }, 30000);
    
    return () => clearInterval(timer);
  }, [autoSave]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 只有当编辑器内容与缓存内容不同，且不是在发布/更新中，且不是在文章页面的情况下提示
      if (cache.get("content") !== content && !isPublishing && !window.location.pathname.includes('/feed/')) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [content, cache, isPublishing]);

  function publishButton() {
    if (publishing) return;
    const tagsplit =
      tags
        .split("#")
        .filter((tag: string) => tag !== "")
        .map((tag: string) => tag.trim()) || [];
    if (typeof id === 'number' && id > 0) {
      setPublishing(true)
      setIsPublishing(true); // 设置发布状态为true
      update({
        id,
        title,
        content,
        summary,
        alias,
        tags: tagsplit,
        draft,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
          setIsPublishing(false); // 重置发布状态
        },
        showAlert
      });
    } else {
      if (!title) {
        showAlert(t("title_empty"))
        return;
      }
      if (!content) {
        showAlert(t("content.empty"))
        return;
      }
      setPublishing(true)
      setIsPublishing(true); // 设置发布状态为true
      publish({
        title,
        content,
        summary,
        tags: tagsplit,
        draft,
        alias,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
          setIsPublishing(false); // 重置发布状态
        },
        showAlert
      });
    }
  }

  // 优化的粘贴处理函数
  const handlePasteProxy = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    handlePaste(event, editorRef, () => {}, showAlert);
  }, [showAlert]);

  useEffect(() => {
    if (id) {
      client
        .feed({ id })
        .get({
          headers: headersWithAuth(),
        })
        .then((response) => {
          const { data } = response;
          if (data && typeof data !== "string") {
            // 使用ExtendedFeed类型
            const feedData = data as unknown as ExtendedFeed;
            
            if (title == "" && feedData.title) setTitle(feedData.title);
            if (tags == "" && feedData.hashtags)
              setTags(feedData.hashtags.map(({ name }) => `#${name}`).join(" "));
            if (alias == "" && feedData.alias) setAlias(feedData.alias);
            if (content == "") setContent(feedData.content);
            if (summary == "") setSummary(feedData.summary || "");
            setListed(feedData.listed === 1);
            setDraft(feedData.draft === 1);
            setCreatedAt(new Date(feedData.createdAt));
          }
        });
    }
  }, []);

  // 加载自定义模板
  useEffect(() => {
    const savedTemplates = localStorage.getItem('custom_templates');
    if (savedTemplates) {
      try {
        setCustomTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to parse saved templates', e);
      }
    }
  }, []);

  // 保存自定义模板
  const saveCustomTemplate = useCallback(() => {
    if (!newTemplateName.trim() || !editorRef.current) return;

    const selection = editorRef.current.getSelection();
    if (!selection) {
      showAlert('请先选择要保存为模板的文本');
      return;
    }

    const selectedText = editorRef.current.getModel()?.getValueInRange(selection) || '';
    if (!selectedText.trim()) {
      showAlert('请先选择要保存为模板的文本');
      return;
    }

    const newTemplate = {
      name: newTemplateName.trim(),
      content: selectedText
    };

    const updatedTemplates = [...customTemplates, newTemplate];
    setCustomTemplates(updatedTemplates);
    localStorage.setItem('custom_templates', JSON.stringify(updatedTemplates));

    setNewTemplateName('');
    setShowSaveTemplateForm(false);
    showAlert('自定义模板保存成功！');
  }, [newTemplateName, customTemplates, showAlert]);

  // 删除自定义模板
  const deleteCustomTemplate = useCallback((index: number) => {
    const updatedTemplates = customTemplates.filter((_, i) => i !== index);
    setCustomTemplates(updatedTemplates);
    localStorage.setItem('custom_templates', JSON.stringify(updatedTemplates));
    showAlert('模板删除成功！');
  }, [customTemplates, showAlert]);

  // 文件插入逻辑
  useEffect(() => {
    if (!selectedFiles || !editorRef.current) return;
    const files = Array.isArray(selectedFiles) ? selectedFiles : [selectedFiles];
    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (!selection) return;
    let insertText = '';
    files.forEach((file, idx) => {
      if (!file.url) return;
      // 每个文件引用前后都加一个空行，避免多文件插入时换行混乱
      let block = '';
      if (file.mimeType.startsWith('image/')) {
        block = `![${file.name}](${file.url})`;
      } else if (file.mimeType.startsWith('audio/')) {
        block = `<audio src=\"${file.url}\" controls></audio>`;
      } else if (file.mimeType.startsWith('video/')) {
        block = `<video src=\"${file.url}\" controls></video>`;
      } else {
        block = `[${file.name}](${file.url})`;
      }
      // 保证首尾都有空行，且多文件插入时不会产生多余空行
      if (idx === 0) {
        insertText += `\n${block}\n\n`;
      } else {
        insertText += `${block}\n\n`;
      }
    });
    // 合并多余空行
    insertText = insertText.replace(/\n{3,}/g, '\n\n');
    if (insertText) {
      editor.executeEdits('', [{ range: selection, text: insertText }]);
      editor.focus();
    }
    setSelectedFiles(null);
  }, [selectedFiles]);



  // 移除内部组件定义，将在组件外部定义

  // 移除内部组件定义，使用外部定义的组件

  return (
    <>
      <Helmet>
        <title>{`${t('writing.title')} - ${NAME}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('writing.title')} />
        <meta property="og:image" content={AVATAR} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
        <style>{scrollbarStyles}</style>
      </Helmet>

      {/* 写作页面特殊处理：补偿Padding组件差异，确保与其他页面宽度一致 */}
      <div className="max-w-6xl mx-auto w-full px-2 sm:px-6 md:px-8">
        <div className="py-6 writing-content-wrapper">
          {/* 响应式布局：移动端单列，桌面端左右分栏 */}
          <div className="flex flex-col lg:flex-row gap-6 writing-layout">

            {/* 主编辑器区域 - 与其他页面卡片样式统一 */}
            <div className="flex-1 lg:flex-[3] writing-main-area">
              {/* 编辑器卡片 - 统一卡片样式，高度与右侧面板对齐 */}
              <div
                className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden editor-container mobile-editor-card h-full"
                style={{
                  height: 'calc(100vh - 200px)', // 与右侧面板相同的高度
                  minHeight: '400px', // 移动端最小高度调整
                  maxHeight: 'calc(100vh - 150px)', // 最大高度限制
                  display: 'grid',
                  gridTemplateRows: 'auto auto auto auto 1fr', // 前4行自适应，最后一行占剩余空间
                  gridTemplateColumns: '1fr'
                }}
              >

                {/* 区域1：顶部状态栏 - Grid第1行 */}
                <div className="px-4 py-1.5" style={{ gridRow: '1' }}>

                  {/* 超紧凑顶部状态栏 - 移动端优化，遵循PageContainer间距 */}
                  <div className="flex items-center justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-700/60 mobile-top-toolbar">
                    {/* 左侧：预览模式切换 - 紧凑图标设计 */}
                    <div className="flex items-center space-x-0.5 mobile-preview-buttons">
                      <button
                        className={`px-1.5 py-1 rounded-md text-xs font-medium transition-all duration-200 mobile-preview-button ${
                          preview === 'edit'
                            ? 'bg-theme/10 dark:bg-theme/20 text-theme dark:text-theme-light'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setPreview('edit')}
                        title="编辑模式"
                      >
                        <i className="ri-edit-line text-sm"></i>
                        <span className="ml-1 hidden sm:inline text-xs">编辑</span>
                      </button>
                      <button
                        className={`px-1.5 py-1 rounded-md text-xs font-medium transition-all duration-200 mobile-preview-button ${
                          preview === 'preview'
                            ? 'bg-success/10 dark:bg-success/20 text-success dark:text-success-light'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setPreview('preview')}
                        title="预览模式"
                      >
                        <i className="ri-eye-line text-sm"></i>
                        <span className="ml-1 hidden sm:inline text-xs">预览</span>
                      </button>
                      <button
                        className={`px-1.5 py-1 rounded-md text-xs font-medium transition-all duration-200 mobile-preview-button ${
                          preview === 'comparison'
                            ? 'bg-info/10 dark:bg-info/20 text-info dark:text-info-light'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setPreview('comparison')}
                        title="对比模式"
                      >
                        <i className="ri-layout-column-line text-sm"></i>
                        <span className="ml-1 hidden sm:inline text-xs">对比</span>
                      </button>
                    </div>

                    {/* 右侧：紧凑状态信息 */}
                    <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400 mobile-stats-info">
                      {/* 紧凑统计信息 */}
                      <div className="flex items-center space-x-1.5 mobile-stats-compact">
                        <span className="flex items-center">
                          <i className="ri-character-recognition-line text-xs mr-0.5"></i>
                          <span className="font-medium text-xs">{wordCount}</span>
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span className="flex items-center">
                          <i className="ri-time-line text-xs mr-0.5"></i>
                          <span className="font-medium text-xs">{writingStats.readingTime}min</span>
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        {/* 保存状态图标 */}
                        <div className={`flex items-center ${
                          saveStatus === t('save')
                            ? 'text-success dark:text-success-light'
                            : 'text-warning dark:text-warning-light'
                        }`}>
                          <i className={`text-xs ${saveStatus === t('save') ? 'ri-checkbox-circle-line' : 'ri-edit-line'}`}></i>
                        </div>
                      </div>

                      {/* 专注模式按钮 - 仅图标 */}
                      <button
                        onClick={() => setFocusMode(!focusMode)}
                        className={`px-1.5 py-1 rounded-md transition-all duration-200 mobile-focus-button ${focusMode
                          ? 'bg-info/10 dark:bg-info/20 text-info dark:text-info-light'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={focusMode ? '退出专注模式' : '进入专注模式'}
                      >
                        <i className="ri-focus-3-line text-sm"></i>
                      </button>
                    </div>
                  </div>

                </div>

                {/* 区域2：工具栏 - Grid第2行，移动端可隐藏，减小间距 */}
                <div
                  className={`px-4 py-0 transition-all duration-300 ${focusMode ? 'mobile-toolbar-hidden' : 'opacity-100'}`}
                  style={{ gridRow: '2' }}
                >
                  <div className="pb-0 border-b border-neutral-200/60 dark:border-neutral-700/60">
                    {/* @ts-ignore */}
                    <MarkdownToolbar editor={editorRef.current} />
                  </div>
                </div>

                {/* 区域3：标签区域 - Grid第3行，减小高度和间距 */}
                <div className="px-4 py-0" style={{ gridRow: '3' }}>
                  <div className="flex items-center gap-1 sm:gap-2 pb-0 border-b border-neutral-200/60 dark:border-neutral-700/60 min-h-[32px]">
                    <TagManager tags={tags} setTags={setTags} />
                  </div>
                </div>

                {/* 区域4：标题区域 - Grid第4行，减小高度和间距 */}
                <div className="px-4 py-0" style={{ gridRow: '4' }}>
                  <div className="min-h-[28px] flex items-center">
                    <ArticleInfoEditor title={title} setTitle={setTitle} />
                  </div>
                </div>

                {/* 编辑器和预览区域 - Grid第5行，占据剩余空间 */}
                <div
                  className={`${preview === 'comparison' ? "flex" : ""} relative bg-white/50 dark:bg-gray-800/50 overflow-hidden`}
                  style={{
                    gridRow: '5',
                    minHeight: '0' // 重要：允许Grid子项收缩
                  }}
                >
                  {/* 编辑器区域 */}
                  <div
                    className={`${preview === 'preview' ? "hidden" : ""} ${preview === 'comparison' ? "w-1/2" : "w-full"} relative h-full overflow-hidden`}
                    onDragOver={dragDropHandlers.handleDragOver}
                    onDragLeave={dragDropHandlers.handleDragLeave}
                    onDrop={dragDropHandlers.handleDrop}
                    onPaste={handlePasteProxy}
                  >
                    {/* 拖放提示 - 不影响布局 */}
                    {dragDropHandlers.isDragging && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/90 dark:bg-blue-900/20 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-lg pointer-events-none">
                        <div className="text-center">
                          <i className="ri-upload-cloud-2-line text-4xl text-blue-500 mb-2"></i>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">{t('upload.drop_files_here')}</p>
                        </div>
                      </div>
                    )}

                    <div className="w-full h-full">
                      <Editor
                        onMount={(editor, _) => {
                          editorRef.current = editor;
                          configureEditorWithHistory(editor);
                        }}
                        height="100%"
                        width="100%"
                        defaultLanguage="markdown"
                        value={content}
                        onChange={(data, _) => handleContentChange(data)}
                        theme={colorMode === "dark" ? "vs-dark" : "light"}
                        options={{
                          wordWrap: "on",
                          fontSize: focusMode ? 16 : 14,
                          lineNumbers: focusMode ? "off" : "on",
                          lineNumbersMinChars: 3,
                          minimap: { enabled: !focusMode },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          overviewRulerLanes: 0,
                          hideCursorInOverviewRuler: true,
                          overviewRulerBorder: false,
                          scrollbar: {
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                            alwaysConsumeMouseWheel: false
                          },
                          padding: {
                            top: focusMode ? 30 : 15,
                            bottom: 0, // 完全移除底部padding
                            left: focusMode ? 20 : 10,
                            right: focusMode ? 20 : 10
                          },
                        }}
                      />
                    </div>
                  </div>

                  {/* 预览区域 */}
                  {preview !== 'edit' && (
                    <div className={`${preview === 'comparison' ? "w-1/2 border-l border-neutral-200/60 dark:border-neutral-700/60" : "w-full"} h-full`}>
                      <div
                        ref={previewRef}
                        onScroll={handlePreviewScroll}
                        className="h-full overflow-auto p-4 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm"
                      >
                        <div className="prose prose-lg dark:prose-invert max-w-none">
                          <Markdown content={content ? content : `> ${t('content.writing_placeholder')}`} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 右侧功能面板 - 与其他页面侧边栏样式统一 */}
            <div className="w-full lg:w-[320px] lg:flex-shrink-0 writing-sidebar">
              <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden flex flex-col mobile-function-panel"
                style={{
                  height: 'calc(100vh - 200px)', // 与左侧编辑器完全相同的高度
                  minHeight: '400px', // 移动端最小高度调整
                  maxHeight: 'calc(100vh - 150px)' // 与左侧编辑器完全相同的最大高度
                }}
              >
                {/* 高级工具区域 - 移除背景颜色 */}
                <div className="p-2.5 sm:p-3 flex-shrink-0 border-b border-neutral-200/60 dark:border-neutral-700/60">
                  <div className="flex items-center mb-2 sm:mb-3">
                    <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-1.5 shadow-sm">
                      <i className="ri-tools-fill text-xs text-blue-600 dark:text-blue-400"></i>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm">高级工具</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-1.5 sm:gap-2 mobile-tool-grid">
                    <button
                      onClick={() => setDraftDialogOpen(true)}
                      className="flex flex-col items-center p-1.5 sm:p-2 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm rounded-lg hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-all duration-200 border border-blue-200/40 dark:border-blue-800/40 mobile-tool-button min-h-[44px] touch-manipulation"
                    >
                      <i className="ri-draft-fill text-sm sm:text-base text-blue-600 dark:text-blue-400 mb-0.5"></i>
                      <span className="text-xs sm:text-xs text-gray-600 dark:text-gray-400 font-medium">草稿</span>
                    </button>

                    <button
                      onClick={() => setHistoryDialogOpen(true)}
                      className="flex flex-col items-center p-1.5 sm:p-2 bg-green-50/80 dark:bg-green-900/30 backdrop-blur-sm rounded-lg hover:bg-green-100/80 dark:hover:bg-green-900/40 transition-all duration-200 border border-green-200/40 dark:border-green-800/40 mobile-tool-button min-h-[44px] touch-manipulation"
                    >
                      <i className="ri-history-fill text-sm sm:text-base text-green-600 dark:text-green-400 mb-0.5"></i>
                      <span className="text-xs sm:text-xs text-gray-600 dark:text-gray-400 font-medium">历史</span>
                    </button>

                    <button
                      onClick={manualSaveHistory}
                      className="flex flex-col items-center p-1.5 sm:p-2 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm rounded-lg hover:bg-purple-100/80 dark:hover:bg-purple-900/40 transition-all duration-200 border border-purple-200/40 dark:border-purple-800/40 mobile-tool-button min-h-[44px] touch-manipulation"
                    >
                      <i className="ri-save-fill text-sm sm:text-base text-purple-600 dark:text-purple-400 mb-0.5"></i>
                      <span className="text-xs sm:text-xs text-gray-600 dark:text-gray-400 font-medium">快照</span>
                    </button>

                    <button
                      onClick={() => setFileSelectorOpen(true)}
                      className="flex flex-col items-center p-1.5 sm:p-2 bg-orange-50/80 dark:bg-orange-900/30 backdrop-blur-sm rounded-lg hover:bg-orange-100/80 dark:hover:bg-orange-900/40 transition-all duration-200 border border-orange-200/40 dark:border-orange-800/40 mobile-tool-button min-h-[44px] touch-manipulation"
                    >
                      <i className="ri-file-add-fill text-sm sm:text-base text-orange-600 dark:text-orange-400 mb-0.5"></i>
                      <span className="text-xs sm:text-xs text-gray-600 dark:text-gray-400 font-medium">文件</span>
                    </button>

                    <button
                      onClick={() => setShowTemplateDialog(true)}
                      className="flex flex-col items-center p-1.5 sm:p-2 bg-pink-50/80 dark:bg-pink-900/30 backdrop-blur-sm rounded-lg hover:bg-pink-100/80 dark:hover:bg-pink-900/40 transition-all duration-200 border border-pink-200/40 dark:border-pink-800/40 mobile-tool-button min-h-[44px] touch-manipulation"
                    >
                      <i className="ri-layout-fill text-sm sm:text-base text-pink-600 dark:text-pink-400 mb-0.5"></i>
                      <span className="text-xs sm:text-xs text-gray-600 dark:text-gray-400 font-medium">模板</span>
                    </button>

                    <button
                      onClick={() => {
                        // 预留功能：可以添加AI写作助手、导出功能等
                        console.log('更多功能待开发');
                      }}
                      className="flex flex-col items-center p-1.5 sm:p-2 bg-gray-50/80 dark:bg-gray-700/30 backdrop-blur-sm rounded-lg hover:bg-gray-100/80 dark:hover:bg-gray-700/40 transition-all duration-200 border border-gray-200/40 dark:border-gray-700/40 mobile-tool-button min-h-[44px] touch-manipulation"
                    >
                      <i className="ri-more-fill text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-0.5"></i>
                      <span className="text-xs sm:text-xs text-gray-600 dark:text-gray-400 font-medium">更多</span>
                    </button>
                  </div>
                </div>

                {/* 发布设置区域 - 移除背景颜色 */}
                <div className="p-2.5 sm:p-3 flex-1 flex flex-col mobile-publish-settings overflow-y-auto">
                  <div className="flex items-center mb-2 sm:mb-3">
                    <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-1.5 shadow-sm">
                      <i className="ri-settings-3-fill text-xs text-green-600 dark:text-green-400"></i>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm">发布设置</h3>
                  </div>

                  {/* 均匀分布的设置区域 */}
                  <div className="flex-1 flex flex-col space-y-2.5">
                    {/* 别名设置卡片 */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 shadow-sm flex-1 min-h-0 flex flex-col justify-center">
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center mb-1.5">
                        <i className="ri-link mr-1.5 text-blue-600 dark:text-blue-400"></i>
                        <span className="hidden sm:inline">文章别名</span>
                        <span className="sm:hidden">别名</span>
                      </label>
                      <input
                        type="text"
                        value={alias}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlias(e.target.value)}
                        placeholder="about"
                        className="w-full px-2.5 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent mobile-publish-input min-h-[44px] touch-manipulation"
                      />
                    </div>

                    {/* 可见性设置卡片 */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2.5 shadow-sm flex-1 min-h-0 flex flex-col justify-center">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                            <i className="ri-eye-close-line mr-1.5 text-purple-600 dark:text-purple-400 text-sm"></i>
                            <span className="hidden sm:inline">仅自己可见</span>
                            <span className="sm:hidden">私密</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={draft}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.checked)}
                            className="w-3.5 h-3.5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                            <i className="ri-list-settings-line mr-1.5 text-purple-600 dark:text-purple-400 text-sm"></i>
                            <span className="hidden sm:inline">显示在文章列表</span>
                            <span className="sm:hidden">列表显示</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={listed}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setListed(e.target.checked)}
                            className="w-3.5 h-3.5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 发布时间卡片 */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2.5 shadow-sm flex-1 min-h-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center">
                          <i className="ri-calendar-fill mr-1.5 text-orange-600 dark:text-orange-400 text-sm"></i>
                          <span className="hidden sm:inline">发布时间</span>
                          <span className="sm:hidden">时间</span>
                        </span>
                      </div>
                      <Calendar
                        value={createdAt}
                        onChange={(e: any) => setCreatedAt(e.value as Date)}
                        showTime
                        touchUI
                        hourFormat="24"
                        dateFormat="yy/mm/dd"
                        className="w-full text-xs"
                        inputClassName="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left"
                      />
                    </div>

                    {/* 操作按钮卡片 - 苹果macOS蓝色风格 */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 shadow-sm flex-1 min-h-0">
                      <div className="h-full flex flex-col justify-center">
                        <button
                          onClick={publishButton}
                          disabled={publishing}
                          className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400 text-white py-2.5 sm:py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 text-sm sm:text-base mobile-publish-button min-h-[48px] touch-manipulation shadow-sm hover:shadow-md"
                        >
                          {publishing ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>发布中...</span>
                            </>
                          ) : (
                            <>
                              <i className="ri-send-plane-fill text-sm sm:text-base"></i>
                              <span>发布文章</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 对话框组件 */}
      <AlertUI />
      {/* 历史记录对话框 */}
      <HistoryDialog
        isOpen={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        history={history}
        onRestore={restoreHistory}
        onDelete={deleteHistoryItem}
        onClear={clearHistory}
      />

      {/* 草稿管理对话框 */}
      <DraftDialog
        isOpen={draftDialogOpen}
        onClose={() => setDraftDialogOpen(false)}
        drafts={drafts}
        onLoad={loadDraftContent}
        onDelete={deleteDraft}
        onClear={clearAllDrafts}
        onSaveCurrent={saveCurrentAsDraft}
      />

      {/* 文件选择弹窗 */}
      <FileSelectorDialog
        isOpen={fileSelectorOpen}
        onClose={() => setFileSelectorOpen(false)}
        onSelect={(files) => setSelectedFiles(files)}
        allowedTypes={undefined} // 后续可根据需要传递类型
        title="选择要插入的文件"
      />

      {/* 模板对话框 - 重新设计 */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 max-w-5xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">选择模板</h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowSaveTemplateForm(!showSaveTemplateForm)}
                  className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <i className="ri-add-line mr-1"></i>
                  保存模板
                </button>
                <button
                  onClick={() => setShowTemplateDialog(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            </div>

            {/* 保存自定义模板表单 */}
            {showSaveTemplateForm && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">保存选中文本为模板</h4>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="输入模板名称"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={saveCustomTemplate}
                    disabled={!newTemplateName.trim()}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveTemplateForm(false);
                      setNewTemplateName('');
                    }}
                    className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    取消
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  请先在编辑器中选择要保存为模板的文本，然后输入模板名称并保存
                </p>
              </div>
            )}

            {/* 自定义模板区域 */}
            {customTemplates.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <i className="ri-star-line mr-2 text-yellow-500"></i>
                  我的模板
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customTemplates.map((template, index) => (
                    <div
                      key={index}
                      className="group relative p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-yellow-300 dark:hover:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 cursor-pointer transition-all"
                      onClick={() => {
                        if (editorRef.current) {
                          const selection = editorRef.current.getSelection();
                          if (selection) {
                            editorRef.current.executeEdits('', [{
                              range: selection,
                              text: template.content
                            }]);
                            editorRef.current.focus();
                          }
                        }
                        setShowTemplateDialog(false);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <i className="ri-file-text-line text-xl text-yellow-600 dark:text-yellow-400 mr-2"></i>
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{template.name}</h5>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomTemplate(index);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 transition-opacity"
                          title="删除模板"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {template.content.substring(0, 60)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 预设模板区域 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                <i className="ri-layout-grid-line mr-2 text-blue-500"></i>
                预设模板
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 文章模板 */}
              <div
                onClick={() => {
                  const template = `# 文章标题

## 简介
在这里写文章的简介...

## 主要内容

### 第一部分
内容描述...

### 第二部分
内容描述...

## 总结
总结文章要点...
`;
                  if (editorRef.current) {
                    const selection = editorRef.current.getSelection();
                    if (selection) {
                      editorRef.current.executeEdits('', [{
                        range: selection,
                        text: template
                      }]);
                      editorRef.current.focus();
                    }
                  }
                  setShowTemplateDialog(false);
                }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
              >
                <div className="flex items-center mb-3">
                  <i className="ri-article-line text-2xl text-blue-600 dark:text-blue-400 mr-3"></i>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">文章模板</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">标准文章结构，包含简介、主要内容和总结</p>
              </div>

              {/* 技术文档模板 */}
              <div
                onClick={() => {
                  const template = `# 技术文档

## 概述
项目/技术概述...

## 环境要求
- Node.js >= 16
- 其他依赖...

## 安装步骤
\`\`\`bash
npm install
\`\`\`

## 使用方法
\`\`\`javascript
// 代码示例
function hello() {
  console.log("Hello World!");
}
\`\`\`

## API 文档
### 方法名
- 参数：
- 返回值：

## 常见问题
Q: 问题描述
A: 解决方案
`;
                  if (editorRef.current) {
                    const selection = editorRef.current.getSelection();
                    if (selection) {
                      editorRef.current.executeEdits('', [{
                        range: selection,
                        text: template
                      }]);
                      editorRef.current.focus();
                    }
                  }
                  setShowTemplateDialog(false);
                }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer transition-all"
              >
                <div className="flex items-center mb-3">
                  <i className="ri-code-line text-2xl text-green-600 dark:text-green-400 mr-3"></i>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">技术文档</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">API文档结构，包含安装、使用和常见问题</p>
              </div>

              {/* 日记模板 */}
              <div
                onClick={() => {
                  const today = new Date().toLocaleDateString('zh-CN');
                  const template = `# ${today} 日记

## 今日天气
☀️ 晴朗

## 今日心情
😊 愉快

## 今日事件
- 事件1
- 事件2
- 事件3

## 今日感悟
今天的感悟和思考...

## 明日计划
- [ ] 计划1
- [ ] 计划2
- [ ] 计划3
`;
                  if (editorRef.current) {
                    const selection = editorRef.current.getSelection();
                    if (selection) {
                      editorRef.current.executeEdits('', [{
                        range: selection,
                        text: template
                      }]);
                      editorRef.current.focus();
                    }
                  }
                  setShowTemplateDialog(false);
                }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer transition-all"
              >
                <div className="flex items-center mb-3">
                  <i className="ri-calendar-line text-2xl text-purple-600 dark:text-purple-400 mr-3"></i>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">日记模板</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">日常记录格式，包含天气、心情和计划</p>
              </div>

              {/* 会议记录模板 */}
              <div
                onClick={() => {
                  const today = new Date().toLocaleDateString('zh-CN');
                  const template = `# 会议记录 - ${today}

## 会议信息
- **时间**：${today}
- **地点**：
- **主持人**：
- **参会人员**：

## 会议议程
1. 议题一
2. 议题二
3. 议题三

## 讨论内容
### 议题一
讨论内容...

### 议题二
讨论内容...

## 决议事项
- [ ] 行动项1 - 负责人：XXX - 截止时间：
- [ ] 行动项2 - 负责人：XXX - 截止时间：

## 下次会议
- **时间**：
- **议题**：
`;
                  if (editorRef.current) {
                    const selection = editorRef.current.getSelection();
                    if (selection) {
                      editorRef.current.executeEdits('', [{
                        range: selection,
                        text: template
                      }]);
                      editorRef.current.focus();
                    }
                  }
                  setShowTemplateDialog(false);
                }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-orange-300 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 cursor-pointer transition-all"
              >
                <div className="flex items-center mb-3">
                  <i className="ri-team-line text-2xl text-orange-600 dark:text-orange-400 mr-3"></i>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">会议记录</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">会议纪要格式，包含议程和决议事项</p>
              </div>

              {/* 表格模板 */}
              <div
                onClick={() => {
                  const template = `| 表头1 | 表头2 | 表头3 |
| --- | --- | --- |
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |
`;
                  if (editorRef.current) {
                    const selection = editorRef.current.getSelection();
                    if (selection) {
                      editorRef.current.executeEdits('', [{
                        range: selection,
                        text: template
                      }]);
                      editorRef.current.focus();
                    }
                  }
                  setShowTemplateDialog(false);
                }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-all"
              >
                <div className="flex items-center mb-3">
                  <i className="ri-table-line text-2xl text-indigo-600 dark:text-indigo-400 mr-3"></i>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">表格模板</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">标准表格结构，3列示例</p>
              </div>

              {/* 代码块模板 */}
              <div
                onClick={() => {
                  const template = `\`\`\`javascript
// 代码示例
function hello() {
  console.log("Hello World!");
}

// 调用函数
hello();
\`\`\`
`;
                  if (editorRef.current) {
                    const selection = editorRef.current.getSelection();
                    if (selection) {
                      editorRef.current.executeEdits('', [{
                        range: selection,
                        text: template
                      }]);
                      editorRef.current.focus();
                    }
                  }
                  setShowTemplateDialog(false);
                }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-300 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-all"
              >
                <div className="flex items-center mb-3">
                  <i className="ri-code-s-slash-line text-2xl text-red-600 dark:text-red-400 mr-3"></i>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">代码块</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">代码示例模板，支持语法高亮</p>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 添加CSS动画样式
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fade-in 0.3s ease-out;
    }
  `;
  if (!document.head.querySelector('style[data-writing-animations]')) {
    style.setAttribute('data-writing-animations', 'true');
    document.head.appendChild(style);
  }
}

