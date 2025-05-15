import Editor from '@monaco-editor/react';
import i18n from 'i18next';
import _ from 'lodash';
import {editor} from 'monaco-editor';
import * as monaco from 'monaco-editor';
import {Calendar} from 'primereact/calendar';
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import React, {useCallback, useEffect, useRef, useState} from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import Loading from 'react-loading';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
import {Markdown} from "../components/markdown";
import {client} from "../main";
import {headersWithAuth} from "../utils/auth";
import {Cache, useCache} from '../utils/cache';
import {siteName} from "../utils/constants";
import {useColorMode} from "../utils/darkModeUtils";
import mermaid from 'mermaid';
import { HistoryDialog } from "../components/history_dialog";
import { useEditorHistory, HistoryItem } from "../utils/history";
import {DraftDialog} from "../components/draft_dialog";
import {useDraftManager, Draft} from "../utils/draft";

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
  @media (max-width: 640px) {
    .editor-container {
      height: calc(100vh - 240px) !important;
    }
  }
  
  @media (min-width: 641px) and (max-width: 1024px) {
    .editor-container {
      height: 600px !important;
    }
  }
  
  @media (min-width: 1025px) {
    .editor-container {
      height: 600px !important;
    }
  }
`;

// 内容模板组件
const ContentTemplates = React.memo(({ editor }: { editor?: editor.IStandaloneCodeEditor }) => {
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
  }, [editor]);
  
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
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center"
        title={t('templates.insert')}
      >
        <i className="ri-file-list-line text-lg mr-1" />
        <span className="text-sm hidden sm:inline">{t('templates.templates')}</span>
      </button>
      
      {isOpen && (
        <div className="absolute z-20 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
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

// 更新Markdown工具栏组件，增加模板功能
const MarkdownToolbar = React.memo(({ editor }: { editor?: editor.IStandaloneCodeEditor }) => {
  const { t } = useTranslation();
  
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

  return (
    <div className="flex flex-wrap items-center p-2 border-b dark:border-gray-700 mb-2 gap-2">
      {/* 所有工具按钮线性排列 */}
      <button onClick={() => insertText('# ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.heading')}>
        <i className="ri-heading text-base" />
      </button>
      <button onClick={() => insertText('**', '**', '粗体文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.bold')}>
        <i className="ri-bold text-base" />
      </button>
      <button onClick={() => insertText('*', '*', '斜体文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.italic')}>
        <i className="ri-italic text-base" />
      </button>
      <button onClick={() => insertText('~~', '~~', '删除线文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.strikethrough')}>
        <i className="ri-strikethrough text-base" />
      </button>
      <button onClick={() => insertText('==', '==', '高亮文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.highlight')}>
        <i className="ri-mark-pen-line text-base" />
      </button>

      <button onClick={() => insertText('- ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.unordered_list')}>
        <i className="ri-list-unordered text-base" />
      </button>
      <button onClick={() => insertText('1. ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.ordered_list')}>
        <i className="ri-list-ordered text-base" />
      </button>
      <button onClick={() => insertText('- [ ] ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.task_list')}>
        <i className="ri-checkbox-line text-base" />
      </button>

      <button onClick={() => insertText('[', '](url)', '链接文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.link')}>
        <i className="ri-link text-base" />
      </button>
      <button onClick={() => insertText('![', '](url)', '图片描述')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.image')}>
        <i className="ri-image-line text-base" />
      </button>
      <button onClick={() => insertText('> ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.quote')}>
        <i className="ri-double-quotes-l text-base" />
      </button>
      <button onClick={() => insertText('```\n', '\n```', '代码块')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.code')}>
        <i className="ri-code-s-slash-line text-base" />
      </button>
      <button onClick={() => insertText('---\n')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.divider')}>
        <i className="ri-separator text-base" />
      </button>
    
      <button onClick={() => insertText(
        '| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n'
      )} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.table')}>
        <i className="ri-table-line text-base" />
      </button>
      <button onClick={() => insertText('^', '', '上标')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.superscript')}>
        <i className="ri-superscript text-base" />
      </button>
      <button onClick={() => insertText('~', '', '下标')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.subscript')}>
        <i className="ri-subscript text-base" />
      </button>
      <button onClick={() => {
        const now = new Date();
        insertText(now.toISOString().split('T')[0]);
      }} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.date')}>
        <i className="ri-calendar-line text-base" />
      </button>
      
      {/* 模板工具 */}
      <div className="flex items-center rounded overflow-hidden border border-gray-200 dark:border-gray-700">
        <ContentTemplates editor={editor} />
      </div>

      {/* 文档管理工具组 - 靠右 */}
      <div className="ml-auto flex items-center gap-1">
        <button 
          onClick={() => setDraftDialogOpen?.(true)} 
          className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 rounded-md flex items-center border border-blue-200 dark:border-blue-800 transition-all hover:shadow-sm px-3" 
          title={t('drafts.title')}
        >
          <i className="ri-draft-line text-base mr-1" />
          <span className="text-sm hidden sm:inline">{t('drafts.title')}</span>
        </button>
        
        <button 
          onClick={() => setHistoryDialogOpen?.(true)} 
          className="p-1.5 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40 rounded-md flex items-center border border-green-200 dark:border-green-800" 
          title={t('history.title')}
        >
          <i className="ri-history-line text-base mr-1" />
          <span className="text-sm hidden sm:inline">{t('history.title')}</span>
        </button>
        
        <button 
          onClick={manualSaveHistory} 
          className="p-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/40 rounded-md flex items-center border border-purple-200 dark:border-purple-800" 
          title={t('history.save_snapshot')}
        >
          <i className="ri-save-line text-base mr-1" />
          <span className="text-sm hidden sm:inline">{t('history.save_snapshot')}</span>
        </button>
      </div>
    </div>
  );
});

// 移动端底部工具栏
const MobileToolbar = React.memo(({ 
  onPublish, 
  publishing, 
  scrollSync, 
  setScrollSync,
  setDraftDialogOpen,
  setHistoryDialogOpen,
  manualSaveHistory
}: { 
  onPublish: () => void, 
  publishing: boolean,
  scrollSync: boolean,
  setScrollSync: (value: boolean) => void,
  setDraftDialogOpen: (value: boolean) => void,
  setHistoryDialogOpen: (value: boolean) => void,
  manualSaveHistory: () => void
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  const insertText = (before: string, after: string = '', defaultText: string = '') => {
    if (!editorRef.current) return;
    const selection = editorRef.current.getSelection();
    if (!selection) return;
    const selectedText = editorRef.current.getModel()?.getValueInRange(selection) || defaultText;
    editorRef.current.executeEdits('', [{
      range: selection,
      text: before + selectedText + after
    }]);
    editorRef.current.focus();
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;
    
    const file = event.target.files[0];
    if (file.size > 20 * 1024000) {
      showAlert(t("upload.failed$size", { size: 20 }));
      uploadRef.current!.value = "";
      return;
    }
    
    uploadImage(file, (url) => {
      if (!editorRef.current) return;
      const selection = editorRef.current.getSelection();
      if (!selection) return;
      editorRef.current.executeEdits(undefined, [{
        range: selection,
        text: `![${file.name}](${url})\n`,
      }]);
    }, showAlert);
  };
  
  return (
    <>
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 p-2 flex items-center justify-around md:hidden z-10">
        <button 
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center w-10 h-10 shadow-sm"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          title={showMoreOptions ? t('close') : t('more_options')}
        >
          <i className={`ri-${showMoreOptions ? 'close' : 'more'}-line text-lg`} />
        </button>
         
        {/* 常用格式按钮 */}
        <div className="flex space-x-1">
          <button 
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center w-10 h-10 shadow-sm" 
            onClick={() => insertText('**', '**', '粗体文本')}
            title={t('markdown.bold')}
          >
        <i className="ri-bold text-lg" />
      </button>
          <button 
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center w-10 h-10 shadow-sm" 
            onClick={() => insertText('*', '*', '斜体文本')}
            title={t('markdown.italic')}
          >
        <i className="ri-italic text-lg" />
      </button>
        </div>
         
        {/* 常用插入按钮 */}
        <div className="flex space-x-1">
          <button 
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center w-10 h-10 shadow-sm" 
            onClick={() => insertText('[', '](url)', '链接文本')}
            title={t('markdown.link')}
          >
        <i className="ri-link text-lg" />
      </button>
          <button 
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center w-10 h-10 shadow-sm" 
            onClick={() => uploadRef.current?.click()}
            title={t('markdown.image')}
          >
        <input
          ref={uploadRef}
          onChange={handleImageUpload}
          className="hidden"
          type="file"
              accept="image/jpeg, image/png, image/gif, image/webp, image/avif, image/svg+xml"
        />
        <i className="ri-image-add-line text-lg" />
      </button>
        </div>

        {/* 发布按钮 */}
      <button
        onClick={onPublish}
        disabled={publishing}
          className="p-0 rounded-full bg-gradient-to-r from-pink-500 to-theme text-white disabled:opacity-70 flex items-center justify-center w-12 h-12 shadow-md"
          title={t('publish.title')}
      >
        {publishing ? (
          <Loading type="spin" height={16} width={16} />
        ) : (
          <i className="ri-send-plane-fill text-lg" />
        )}
      </button>
    </div>
      
      {/* 扩展的移动工具栏选项 */}
      {showMoreOptions && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 p-4 md:hidden z-10 animate-slide-up max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="w-full flex justify-between items-center mb-3 border-b pb-2 border-gray-200 dark:border-gray-700">
            <h3 className="font-medium">{t('more_options')}</h3>
            <button 
              onClick={() => setShowMoreOptions(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
          
          {/* 工具按钮网格布局 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('# ')}
              >
                <i className="ri-heading text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.heading')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('**', '**', '粗体文本')}
              >
                <i className="ri-bold text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.bold')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('*', '*', '斜体文本')}
              >
                <i className="ri-italic text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.italic')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('~~', '~~', '删除线文本')}
              >
                <i className="ri-strikethrough text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.strikethrough')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('==', '==', '高亮文本')}
              >
                <i className="ri-mark-pen-line text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.highlight')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('- ')}
              >
                <i className="ri-list-unordered text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.unordered_list')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('1. ')}
              >
                <i className="ri-list-ordered text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.ordered_list')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('- [ ] ')}
              >
                <i className="ri-checkbox-line text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.task_list')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('> ')}
              >
                <i className="ri-double-quotes-l text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.quote')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('```\n', '\n```', '代码块')}
              >
                <i className="ri-code-s-slash-line text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.code')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => insertText('[', '](url)', '链接文本')}
              >
                <i className="ri-link text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.link')}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <button 
                className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 w-full flex items-center justify-center shadow-sm" 
                onClick={() => uploadRef.current?.click()}
              >
                <i className="ri-image-add-line text-lg" />
              </button>
              <span className="text-xs text-gray-500">{t('markdown.image')}</span>
            </div>
          </div>

          {/* 管理工具按钮 */}
          <div className="flex gap-2 mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            <button
              onClick={() => setDraftDialogOpen?.(true)}
              className="flex-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 rounded-md flex items-center justify-center py-2 border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow"
            >
              <i className="ri-draft-line mr-1 text-lg" />
              {t('drafts.title')}
            </button>
            
            <button
              onClick={() => setHistoryDialogOpen?.(true)}
              className="flex-1 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40 rounded-md flex items-center justify-center py-2 border border-green-200 dark:border-green-800"
            >
              <i className="ri-history-line mr-1" />
              {t('history.title')}
            </button>
            
            <button
              onClick={manualSaveHistory}
              className="flex-1 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/40 rounded-md flex items-center justify-center py-2 border border-purple-200 dark:border-purple-800"
            >
              <i className="ri-save-line mr-1" />
              {t('save')}
            </button>
          </div>
        </div>
      )}
    </>
  );
});

// 增强的图片拖放上传区域
const ImageDropzone = React.memo(({ onImageUploaded }: { onImageUploaded: (url: string, filename: string) => void }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  
  const handleUpload = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      showAlert(t("upload.image_only"));
      return;
    }
    
    // 创建预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    setIsUploading(true);
    // 模拟进度
    const interval = setInterval(() => {
      setUploadProgress((prev: number) => Math.min(prev + 5, 95));
    }, 100);
    
    uploadImage(file, (url) => {
      clearInterval(interval);
      setUploadProgress(100);
      
      setTimeout(() => {
        onImageUploaded(url, file.name);
        setIsUploading(false);
        setUploadProgress(0);
        setPreviewImage(null); // 上传完成后清除预览
      }, 500);
    }, showAlert);
  }, [onImageUploaded, showAlert, t]);
  
  // 取消上传
  const cancelUpload = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setPreviewImage(null);
  }, []);
  
  const handleDragOver = useCallback((e: DragDropEvent) => { 
    e.preventDefault(); 
    setIsDragging(true); 
  }, []);
  
  const handleDragLeave = useCallback(() => { 
    setIsDragging(false); 
  }, []);
  
  const handleDrop = useCallback((e: DragDropEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
          handleUpload(e.dataTransfer.files[0]);
        }
  }, [handleUpload]);
  
  const handleClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleUpload(e.target.files[0]);
    }
  }, [handleUpload]);
  
  const handleCancelButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    cancelUpload();
  }, [cancelUpload]);
  
  return (
    <div 
      className={`border-2 border-dashed rounded-lg p-4 mb-2 text-center transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
        isDragging 
          ? 'border-theme bg-theme/10 shadow-md' 
          : 'border-gray-300 dark:border-gray-600'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef}
        accept="image/jpeg, image/png, image/gif, image/webp, image/avif, image/svg+xml" 
        onChange={handleFileChange}
      />
      
      {!isUploading && !previewImage && (
        <div className="flex flex-col items-center py-2">
          <div className="w-12 h-12 mb-2 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <i className="ri-image-add-line text-2xl text-theme" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("drop_or_click_to_upload")}</p>
          <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF, WEBP, AVIF, SVG ({t("upload.max_size", {size: 20})})</p>
        </div>
      )}
      
      {previewImage && (
        <div className="relative mb-2">
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-h-40 mx-auto rounded-md object-contain shadow-sm" 
          />
          {!isUploading && (
            <button 
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              onClick={handleCancelButtonClick}
            >
              <i className="ri-close-line text-xs" />
            </button>
          )}
        </div>
      )}
      
      {isUploading && (
        <div className="mt-3">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-theme transition-all duration-300" 
              style={{width: `${uploadProgress}%`}}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">
              <i className={`ri-upload-cloud-line mr-1 ${uploadProgress === 100 ? 'text-green-500' : 'text-theme'}`}></i>
              {uploadProgress === 100 ? t("upload.success") : `${uploadProgress}%`}
            </p>
            {uploadProgress < 100 && (
              <button
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
                onClick={handleCancelButtonClick}
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

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
    window.location.replace("/feed/" + data.insertedId);
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
  }

// 修改uploadImage函数，处理API响应类型
async function uploadImage(file: File, onSuccess: (url: string) => void, showAlert: ShowAlertType) {
  const t = i18n.t;
  try {
    const response = await client.storage.index.post(
      {
        key: file.name,
        file: file,
      },
      {
        headers: headersWithAuth(),
      }
    );
    
    if (response.error) {
      showAlert(t("upload.failed", { error: response.error.value }));
      return;
    }
    
    if (response.data) {
      // 确保data是字符串
      const imageUrl = String(response.data);
      onSuccess(imageUrl);
      }
  } catch (e: any) {
      console.error(e);
      showAlert(t("upload.failed", { error: e.message }));
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
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saveStatus, setSaveStatus] = useState(t('save'));
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [scrollSync, setScrollSync] = useState(true); // 滚动同步状态
  const [editorScrolling, setEditorScrolling] = useState(false);
  const [previewScrolling, setPreviewScrolling] = useState(false);
  const { showAlert, AlertUI } = useAlert()
  
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
    updateDraft,
    deleteDraft,
    clearAllDrafts,
    getDraft,
    loadDrafts
  } = useDraftManager();

  // 添加一个发布状态标记
  const [isPublishing, setIsPublishing] = useState(false);

  const autoSave = useCallback(() => {
    if (cache.get("content") !== content) {
      cache.set("content", content);
      setSaveStatus(t('save'));
      setLastSaved(new Date());
      
      // 保存到历史记录
      saveHistory(content, title || t('history.untitled'), t('history.auto_save'));
    }
  }, [content, cache, t, saveHistory, title]);

  const handleContentChange = useCallback((data: string | undefined) => {
    const newContent = data ?? "";
    setContent(newContent);
    setSaveStatus(t('editing'));
  }, [t]);
  
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
  
  // 手动保存历史记录
  const manualSaveHistory = useCallback(() => {
    saveHistory(content, title || t('history.untitled'), t('history.manual_save'));
    showAlert(t('history.save_success'));
  }, [content, title, saveHistory, showAlert, t]);
  
  // 保存当前内容为草稿
  const saveCurrentAsDraft = useCallback(() => {
    saveDraft({
      title: title || t('drafts.untitled'),
      content,
      summary,
      tags,
      alias
    });
    showAlert(t('drafts.save_success'));
    setDraftDialogOpen(false);
  }, [title, content, summary, tags, alias, saveDraft, showAlert, t]);
  
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
    if (!scrollSync || previewScrolling || !editorRef.current || !previewRef.current) return;
    
    setEditorScrolling(true);
    
    const editorInfo = editorRef.current.getScrollInfo ? editorRef.current.getScrollInfo() : {
      scrollTop: editorRef.current.getScrollTop(),
      scrollHeight: editorRef.current.getScrollHeight(),
      clientHeight: editorRef.current.getLayoutInfo().height
    };
    
    const previewElement = previewRef.current;
    const editorScrollRatio = editorInfo.scrollTop / (editorInfo.scrollHeight - editorInfo.clientHeight);
    
    const previewScrollMax = previewElement.scrollHeight - previewElement.clientHeight;
    previewElement.scrollTop = editorScrollRatio * previewScrollMax;
    
    setTimeout(() => setEditorScrolling(false), 50);
  }, [scrollSync, previewScrolling]);
  
  // 处理预览区域滚动事件
  const handlePreviewScroll = useCallback(() => {
    if (!scrollSync || editorScrolling || !editorRef.current || !previewRef.current) return;
    
    setPreviewScrolling(true);
    
    const previewElement = previewRef.current;
    const previewScrollRatio = previewElement.scrollTop / (previewElement.scrollHeight - previewElement.clientHeight);
    
    const editorInfo = editorRef.current.getScrollInfo ? editorRef.current.getScrollInfo() : {
      scrollHeight: editorRef.current.getScrollHeight(),
      clientHeight: editorRef.current.getLayoutInfo().height
    };
    
    const editorScrollMax = editorInfo.scrollHeight - editorInfo.clientHeight;
    editorRef.current.setScrollTop(previewScrollRatio * editorScrollMax);
    
    setTimeout(() => setPreviewScrolling(false), 50);
  }, [scrollSync, editorScrolling]);
  
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
  const MarkdownToolbarWithHistory = useCallback(({ editor }: { editor?: editor.IStandaloneCodeEditor }) => {
    const { t } = useTranslation();
    
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

    return (
      <div className="flex flex-wrap items-center p-2 border-b dark:border-gray-700 mb-2 gap-2">
        {/* 所有工具按钮线性排列 */}
        <button onClick={() => insertText('# ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.heading')}>
          <i className="ri-heading text-base" />
        </button>
        <button onClick={() => insertText('**', '**', '粗体文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.bold')}>
          <i className="ri-bold text-base" />
        </button>
        <button onClick={() => insertText('*', '*', '斜体文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.italic')}>
          <i className="ri-italic text-base" />
        </button>
        <button onClick={() => insertText('~~', '~~', '删除线文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.strikethrough')}>
          <i className="ri-strikethrough text-base" />
        </button>
        <button onClick={() => insertText('==', '==', '高亮文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.highlight')}>
          <i className="ri-mark-pen-line text-base" />
        </button>

        <button onClick={() => insertText('- ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.unordered_list')}>
          <i className="ri-list-unordered text-base" />
        </button>
        <button onClick={() => insertText('1. ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.ordered_list')}>
          <i className="ri-list-ordered text-base" />
        </button>
        <button onClick={() => insertText('- [ ] ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.task_list')}>
          <i className="ri-checkbox-line text-base" />
        </button>

        <button onClick={() => insertText('[', '](url)', '链接文本')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.link')}>
          <i className="ri-link text-base" />
        </button>
        <button onClick={() => insertText('![', '](url)', '图片描述')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.image')}>
          <i className="ri-image-line text-base" />
        </button>
        <button onClick={() => insertText('> ')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.quote')}>
          <i className="ri-double-quotes-l text-base" />
        </button>
        <button onClick={() => insertText('```\n', '\n```', '代码块')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.code')}>
          <i className="ri-code-s-slash-line text-base" />
        </button>
        <button onClick={() => insertText('---\n')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.divider')}>
          <i className="ri-separator text-base" />
        </button>
      
        <button onClick={() => insertText(
          '| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n'
        )} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.table')}>
          <i className="ri-table-line text-base" />
        </button>
        <button onClick={() => insertText('^', '', '上标')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.superscript')}>
          <i className="ri-superscript text-base" />
        </button>
        <button onClick={() => insertText('~', '', '下标')} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.subscript')}>
          <i className="ri-subscript text-base" />
        </button>
        <button onClick={() => {
          const now = new Date();
          insertText(now.toISOString().split('T')[0]);
        }} className="p-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700" title={t('markdown.date')}>
          <i className="ri-calendar-line text-base" />
        </button>
        
        {/* 模板工具 */}
        <div className="flex items-center rounded overflow-hidden border border-gray-200 dark:border-gray-700">
          <ContentTemplates editor={editor} />
        </div>

        {/* 文档管理工具组 - 靠右 */}
        <div className="ml-auto flex items-center gap-1">
          <button 
            onClick={() => setDraftDialogOpen?.(true)} 
            className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 rounded-md flex items-center border border-blue-200 dark:border-blue-800 transition-all hover:shadow-sm px-3" 
            title={t('drafts.title')}
          >
            <i className="ri-draft-line text-base mr-1" />
            <span className="text-sm hidden sm:inline">{t('drafts.title')}</span>
          </button>
          
          <button 
            onClick={() => setHistoryDialogOpen?.(true)} 
            className="p-1.5 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40 rounded-md flex items-center border border-green-200 dark:border-green-800" 
            title={t('history.title')}
          >
            <i className="ri-history-line text-base mr-1" />
            <span className="text-sm hidden sm:inline">{t('history.title')}</span>
          </button>
          
          <button 
            onClick={manualSaveHistory} 
            className="p-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/40 rounded-md flex items-center border border-purple-200 dark:border-purple-800" 
            title={t('history.save_snapshot')}
          >
            <i className="ri-save-line text-base mr-1" />
            <span className="text-sm hidden sm:inline">{t('history.save_snapshot')}</span>
          </button>
        </div>
      </div>
    );
  }, [manualSaveHistory, setHistoryDialogOpen, setDraftDialogOpen]);
  
  // 配置编辑器快捷键，添加历史记录相关快捷键
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
    if (id !== undefined) {
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
    handlePaste(event, editorRef, setUploading, showAlert);
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
            if (title == "" && data.title) setTitle(data.title);
            if (tags == "" && data.hashtags)
              setTags(data.hashtags.map(({ name }) => `#${name}`).join(" "));
            if (alias == "" && data.alias) setAlias(data.alias);
            if (content == "") setContent(data.content);
            if (summary == "") setSummary(data.summary || "");
            setListed(data.listed === 1);
            setDraft(data.draft === 1);
            setCreatedAt(new Date(data.createdAt));
          }
        });
    }
  }, []);
  const debouncedUpdate = useCallback(
    _.debounce(() => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
      });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_default")
      }).then(()=>{
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
        });
        mermaid.run({
          suppressErrors: true,
          nodes: document.querySelectorAll("pre.mermaid_dark")
        });
      })
    }, 100),
    []
  );
  useEffect(() => {
    debouncedUpdate();
  }, [content, debouncedUpdate]);
  function MetaInput({ className }: { className?: string }) {
    return (
      <>
        <div className={className}>
          <Input
            id={id}
            value={title}
            setValue={setTitle}
            placeholder={t("title")}
          />
          <Input
            id={id}
            value={summary}
            setValue={setSummary}
            placeholder={t("summary")}
            className="mt-4"
          />
          <Input
            id={id}
            value={tags}
            setValue={setTags}
            placeholder={t("tags")}
            className="mt-4"
          />
          <Input
            id={id}
            value={alias}
            setValue={setAlias}
            placeholder={t("alias")}
            className="mt-4"
          />
          <div
            className="select-none flex flex-row justify-between items-center mt-6 mb-2 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 rounded-md py-2"
            onClick={() => setDraft(!draft)}
          >
            <p className="flex items-center">
              <i className="ri-draft-line mr-2 text-gray-500" />
              {t('visible.self_only')}
              <span className="ml-1 text-xs text-gray-500">({t('draft')})</span>
            </p>
            <Checkbox
              id="draft"
              value={draft}
              setValue={setDraft}
              placeholder={t('draft')}
            />
          </div>
          <div
            className="select-none flex flex-row justify-between items-center mt-6 mb-2 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 rounded-md py-2"
            onClick={() => setListed(!listed)}
          >
            <p className="flex items-center">
              <i className="ri-global-line mr-2 text-gray-500" />
              {t('listed')}
              <span className="ml-1 text-xs text-gray-500">({t('visible.feed')})</span>
            </p>
            <Checkbox
              id="listed"
              value={listed}
              setValue={setListed}
              placeholder={t('listed')}
            />
          </div>
          <div className="select-none flex flex-row justify-between items-center mt-4 mb-2 pl-4">
            <p className="break-keep mr-2">
              {t('created_at')}
            </p>
            <Calendar 
              value={createdAt} 
              onChange={(e) => setCreatedAt(e.value as Date)} 
              showTime 
              touchUI 
              hourFormat="24" 
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>{`${t('writing')} - ${NAME}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('writing')} />
        <meta property="og:image" content={AVATAR} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
        <style>{scrollbarStyles}</style>
      </Helmet>
      <div className="grid grid-cols-1 md:grid-cols-3 t-primary mt-2 pb-16 md:pb-0">
        <div className="col-span-2 pb-8">
          <div className="bg-w rounded-2xl shadow-xl shadow-light p-4">
            {MetaInput({ className: "visible md:hidden mb-8" })}
            <div className="flex flex-col mx-4 my-2 md:mx-0 md:my-0 gap-2">
              <div className="flex flex-row space-x-2 border-b border-gray-200 dark:border-gray-700 mb-4">
                <button 
                  className={`px-4 py-2 font-medium transition-colors border-b-2 ${preview === 'edit' 
                    ? 'border-theme text-theme' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} 
                  onClick={() => setPreview('edit')}
                >
                  {t("edit")}
                </button>
                <button 
                  className={`px-4 py-2 font-medium transition-colors border-b-2 ${preview === 'preview' 
                    ? 'border-theme text-theme' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setPreview('preview')}
                >
                  {t("preview")}
                </button>
                <button 
                  className={`px-4 py-2 font-medium transition-colors border-b-2 ${preview === 'comparison' 
                    ? 'border-theme text-theme' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setPreview('comparison')}
                >
                  {t("comparison")}
                </button>
                <div className="flex-grow" />
                {uploading &&
                  <div className="flex flex-row space-x-2 items-center">
                    <Loading type="spin" color="#FC466B" height={16} width={16} />
                    <span className="text-sm text-neutral-500">{t('uploading')}</span>
                  </div>
                }
                <div className="flex flex-row space-x-2 items-center ml-2">
                  <span className="text-sm text-gray-500">
                    {saveStatus === t('save') ? (
                      <>
                        <i className="ri-checkbox-circle-line text-green-500 mr-1" />
                        {saveStatus} {lastSaved && `(${lastSaved.toLocaleTimeString().slice(0, 5)})`}
                      </>
                    ) : (
                      <>
                        <i className="ri-edit-line text-yellow-500 mr-1" />
                        {saveStatus}
                      </>
                    )}
                  </span>
              </div>
                
                {/* 在标题栏添加滚动同步开关，避免占用主内容区域空间 */}
                {preview === 'comparison' && (
                  <div className="flex items-center ml-2">
                    <label className="inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={scrollSync} 
                        onChange={() => setScrollSync(!scrollSync)}
                        className="sr-only peer"
                      />
                      <div className="relative w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-theme/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-theme"></div>
                    </label>
                  </div>
                )}
              </div>
              <div className={`w-full h-full ${preview === 'comparison' ? "flex flex-row space-x-4" : ""}`}>
                <div
                  className={`flex flex-col ${preview === 'preview' ? "hidden" : ""} ${preview === 'comparison' ? "w-1/2" : "w-full"} editor-container custom-scrollbar`}
                  onDrop={(e: DragDropEvent) => {
                    e.preventDefault();
                    const editor = editorRef.current;
                    if (!editor) return;
                    for (let i = 0; i < e.dataTransfer.files.length; i++) {
                      const selection = editor.getSelection();
                      if (!selection) return;
                      const file = e.dataTransfer.files[i];
                      setUploading(true)
                      uploadImage(file, (url) => {
                        setUploading(false)
                        editor.executeEdits(undefined, [{
                          range: selection,
                          text: `![${file.name}](${url})\n`,
                        }]);
                      }, showAlert);
                    }
                  }}
                  onPaste={handlePasteProxy}
                >
                  <div className="mb-2">
                    <ImageDropzone onImageUploaded={(url, filename) => {
                      const editor = editorRef.current;
                      if (!editor) return;
                      const selection = editor.getSelection();
                      if (!selection) return;
                      editor.executeEdits(undefined, [{
                        range: selection,
                        text: `![${filename}](${url})\n`,
                      }]);
                    }} />
                  </div>
                  
                  <MarkdownToolbarWithHistory editor={editorRef.current} />
                  
                  <div className="flex-grow relative h-0">
                    <Editor
                      onMount={(editor, _) => {
                        editorRef.current = editor;
                        // 配置编辑器快捷键，现在使用新的历史记录配置函数
                        configureEditorWithHistory(editor);
                      }}
                      height="100%"
                      defaultLanguage="markdown"
                      className=""
                      value={content}
                      onChange={(data, _) => handleContentChange(data)}
                      theme={colorMode === "dark" ? "vs-dark" : "light"}
                      options={{
                        wordWrap: "on",
                        fontSize: 14,
                        lineNumbers: "off",
                        dragAndDrop: true,
                        pasteAs: { enabled: false },
                        quickSuggestions: {
                          other: true,
                          comments: false,
                          strings: false
                        },
                        // 添加额外选项以增强编辑体验
                        tabSize: 2,
                        insertSpaces: true,
                        autoIndent: "full",
                        formatOnType: true
                      }}
                    />
                  </div>
                </div>
                
                <div
                  className={`${preview !== 'edit' ? "" : "hidden"} ${preview === 'comparison' ? "w-1/2" : "w-full"} border-l dark:border-gray-700 editor-container`}
                >
                  <div 
                    ref={previewRef}
                    onScroll={handlePreviewScroll}
                    style={{height: '100%', overflow: 'auto'}} 
                    className="px-4 py-2 custom-scrollbar"
                  >
                    <Markdown content={content ? content : `> ${t('content.placeholder')}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="visible md:hidden flex flex-row justify-center mt-8">
            <button
              onClick={publishButton}
              className="basis-1/2 bg-gradient-to-r from-pink-500 to-theme text-white py-4 rounded-full shadow-xl shadow-light hover:shadow-2xl transition-all duration-300 flex flex-row justify-center items-center space-x-2"
            >
              {publishing ? (
                <div className="flex items-center">
                  <Loading type="spin" height={16} width={16} className="mr-2" />
                  <span>{t('publishing')}</span>
                </div>
              ) : (
                <>
                  <i className="ri-send-plane-fill mr-1" />
                  <span>{t('publish.title')}</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="hidden md:visible max-w-96 md:flex flex-col">
          {MetaInput({ className: "bg-w rounded-2xl shadow-xl shadow-light p-4 mx-8" })}
          <div className="flex flex-row justify-center mt-8">
            <button
              onClick={publishButton}
              className="basis-1/2 bg-gradient-to-r from-pink-500 to-theme text-white py-4 rounded-full shadow-xl shadow-light hover:shadow-2xl transition-all duration-300 flex flex-row justify-center items-center space-x-2"
            >
              {publishing ? (
                <div className="flex items-center">
                  <Loading type="spin" height={16} width={16} className="mr-2" />
                  <span>{t('publishing')}</span>
                </div>
              ) : (
                <>
                  <i className="ri-send-plane-fill mr-1" />
                  <span>{t('publish.title')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <AlertUI />
      <MobileToolbar onPublish={publishButton} publishing={publishing} scrollSync={scrollSync} setScrollSync={setScrollSync} setDraftDialogOpen={setDraftDialogOpen} setHistoryDialogOpen={setHistoryDialogOpen} manualSaveHistory={manualSaveHistory} />
      
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
    </>
  );
}

