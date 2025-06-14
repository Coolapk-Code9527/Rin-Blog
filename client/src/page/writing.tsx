import Editor from '@monaco-editor/react';
import i18n from 'i18next';
import _ from 'lodash';
import {editor} from 'monaco-editor';
import * as monaco from 'monaco-editor';
import {Calendar} from 'primereact/calendar';
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import React, {useCallback, useEffect, useRef, useState} from "react";
import {Helmet} from "react-helmet-async";
import {useTranslation} from "react-i18next";
import { InlineSpinner } from '../components/loading';
import { ToolbarButton, Button } from '../components/button';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
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
import { PageContainer } from "../components/container";
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

// 扩展Feed类型以包含我们需要的属性
interface ExtendedFeed extends Feed {
  alias?: string;
  listed?: number;
  draft?: number;
}

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

// 更新Markdown工具栏组件，增加模板功能
const MarkdownToolbar = React.memo(({ 
  editor, 
  setDraftDialogOpen, 
  setHistoryDialogOpen, 
  manualSaveHistory, 
  setFileSelectorOpen // 新增
}: { 
  editor?: editor.IStandaloneCodeEditor,
  setDraftDialogOpen: (open: boolean) => void,
  setHistoryDialogOpen: (open: boolean) => void,
  manualSaveHistory: () => void,
  setFileSelectorOpen: (open: boolean) => void // 新增
}) => {
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
      {/* 所有工具按钮线性排列 - 使用统一的ToolbarButton组件 */}
      <ToolbarButton icon="ri-heading" onClick={() => insertText('# ')} title={t('markdown.heading')} />
      <ToolbarButton icon="ri-bold" onClick={() => insertText('**', '**', '粗体文本')} title={t('markdown.bold')} />
      <ToolbarButton icon="ri-italic" onClick={() => insertText('*', '*', '斜体文本')} title={t('markdown.italic')} />
      <ToolbarButton icon="ri-strikethrough" onClick={() => insertText('~~', '~~', '删除线文本')} title={t('markdown.strikethrough')} />
      <ToolbarButton icon="ri-mark-pen-line" onClick={() => insertText('==', '==', '高亮文本')} title={t('markdown.highlight')} />

      <ToolbarButton icon="ri-list-unordered" onClick={() => insertText('- ')} title={t('markdown.unordered_list')} />
      <ToolbarButton icon="ri-list-ordered" onClick={() => insertText('1. ')} title={t('markdown.ordered_list')} />
      <ToolbarButton icon="ri-checkbox-line" onClick={() => insertText('- [ ] ')} title={t('markdown.task_list')} />

      <ToolbarButton icon="ri-link" onClick={() => insertText('[', '](url)', '链接文本')} title={t('markdown.link')} />
      <ToolbarButton icon="ri-image-line" onClick={() => insertText('![', '](url)', '图片描述')} title={t('markdown.image')} />
      <ToolbarButton icon="ri-double-quotes-l" onClick={() => insertText('> ')} title={t('markdown.quote')} />
      <ToolbarButton icon="ri-code-s-slash-line" onClick={() => insertText('```\n', '\n```', '代码块')} title={t('markdown.code')} />
      <ToolbarButton icon="ri-separator" onClick={() => insertText('---\n')} title={t('markdown.divider')} />
    
      <ToolbarButton
        icon="ri-table-line"
        onClick={() => insertText('| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n')}
        title={t('markdown.table')}
      />
      <ToolbarButton icon="ri-superscript" onClick={() => insertText('^', '', '上标')} title={t('markdown.superscript')} />
      <ToolbarButton icon="ri-subscript" onClick={() => insertText('~', '', '下标')} title={t('markdown.subscript')} />
      <ToolbarButton
        icon="ri-calendar-line"
        onClick={() => {
          const now = new Date();
          insertText(now.toISOString().split('T')[0]);
        }}
        title={t('markdown.date')}
      />
      
      {/* 模板工具 */}
      {/* @ts-ignore */}
      <ContentTemplates editor={editor} />

      {/* 文档管理工具组 - 靠右 */}
      <div className="ml-auto flex items-center gap-1">
        <ToolbarButton
          icon="ri-draft-line"
          onClick={() => setDraftDialogOpen(true)}
          title={t('drafts.title')}
          variant="info"
          showText={true}
          text={t('drafts.title')}
        />

        <ToolbarButton
          icon="ri-history-line"
          onClick={() => setHistoryDialogOpen(true)}
          title={t('history.title')}
          variant="success"
          showText={true}
          text={t('history.title')}
        />

        <ToolbarButton
          icon="ri-save-line"
          onClick={manualSaveHistory}
          title={t('history.save_snapshot')}
          variant="warning"
          showText={true}
          text={t('history.save_snapshot')}
        />

        {/* 插入文件按钮 */}
        <ToolbarButton
          icon="ri-attachment-2"
          onClick={() => setFileSelectorOpen(true)}
          title={t('markdown.insert_file', { defaultValue: '插入文件' })}
          variant="purple"
          showText={true}
          text={t('markdown.insert_file', { defaultValue: '插入文件' })}
        />
      </div>
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
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saveStatus, setSaveStatus] = useState(t('save'));
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [scrollSync, setScrollSync] = useState(true); // 滚动同步状态
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
    updateDraft,
    deleteDraft,
    clearAllDrafts,
    getDraft,
    loadDrafts
  } = useDraftManager();

  // 添加一个发布状态标记
  const [isPublishing, setIsPublishing] = useState(false);

  // 文件选择弹窗状态
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  // 记录选择的文件（后续插入用）
  const [selectedFiles, setSelectedFiles] = useState<FileItem | FileItem[] | null>(null);

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
      // @ts-ignore - 忽略类型错误
      clientHeight: editorRef.current.getLayoutInfo().height
    };
    
    const previewElement = previewRef.current;
    // @ts-ignore - 忽略clientHeight类型错误
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
      // @ts-ignore - 忽略类型错误
      clientHeight: editorRef.current.getLayoutInfo().height
    };
    
    // @ts-ignore - 忽略clientHeight类型错误
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
          <p className="text-xs text-gray-400 mt-1 ml-1">{t("writing.title_hint")}</p>
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
            className="select-none flex flex-row justify-between items-center mt-6 mb-2 px-4"
            onClick={() => setDraft(!draft)}
          >
            <p>{t('visible.self_only')}</p>
            <Checkbox
              id="draft"
              value={draft}
              setValue={setDraft}
              placeholder={t('draft')}
            />
          </div>
          <div
            className="select-none flex flex-row justify-between items-center mt-6 mb-2 px-4"
            onClick={() => setListed(!listed)}
          >
            <p>{t('listed')}</p>
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
        <title>{`${t('writing.title')} - ${NAME}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('writing.title')} />
        <meta property="og:image" content={AVATAR} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
        <style>{scrollbarStyles}</style>
      </Helmet>
      <div className="grid grid-cols-1 md:grid-cols-3 t-primary mt-2 md:pb-0">
        <div className="col-span-2 pb-8">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-enhanced-xl hover:shadow-enhanced-2xl transition-all duration-300 p-4 border border-neutral-200/60 dark:border-neutral-700/60">
            {MetaInput({ className: "visible md:hidden mb-8" })}
            <PageContainer>
              <div className="flex flex-row space-x-2 border-b border-gray-200 dark:border-gray-700 mb-4">
                <button 
                  className={`py-2 font-medium transition-colors border-b-2 ${preview === 'edit' 
                    ? 'border-theme text-theme' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} 
                  onClick={() => setPreview('edit')}
                >
                  {t("edit")}
                </button>
                <button 
                  className={`py-2 font-medium transition-colors border-b-2 ${preview === 'preview' 
                    ? 'border-theme text-theme' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setPreview('preview')}
                >
                  {t("preview")}
                </button>
                <button 
                  className={`py-2 font-medium transition-colors border-b-2 ${preview === 'comparison' 
                    ? 'border-theme text-theme' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setPreview('comparison')}
                >
                  {t("comparison")}
                </button>
                <div className="flex-grow" />
                {uploading &&
                  <div className="flex flex-row space-x-2 items-center">
                    <InlineSpinner size="small" />
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
                  className={`flex flex-col ${preview === 'preview' ? "hidden" : ""} ${preview === 'comparison' ? "w-1/2" : "w-full"} editor-container custom-scrollbar relative ${
                    dragDropHandlers.isDragging ? 'border-2 border-dashed border-theme bg-theme/5' : ''
                  }`}
                  onDragOver={dragDropHandlers.handleDragOver}
                  onDragLeave={dragDropHandlers.handleDragLeave}
                  onDrop={dragDropHandlers.handleDrop}
                  onPaste={handlePasteProxy}
                >
                  {/* 拖放上传提示覆盖层 */}
                  {dragDropHandlers.isDragging && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-theme/10 backdrop-blur-sm rounded-lg">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-theme/20 flex items-center justify-center">
                          <i className="ri-upload-cloud-2-line text-3xl text-theme" />
                        </div>
                        <p className="text-lg font-medium text-theme">{t('upload.drop_files_here')}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('upload.all_file_types_supported')}</p>
                      </div>
                    </div>
                  )}

                  {/* 上传进度提示 */}
                  {dragDropHandlers.isUploading && (
                    <div className="absolute top-4 right-4 z-20 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg shadow-enhanced p-3 border border-neutral-200/60 dark:border-neutral-700/60">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-theme/20 flex items-center justify-center">
                          <i className="ri-upload-cloud-line text-theme animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('uploading')} {dragDropHandlers.uploadingFiles.length} {t('files')}
                          </p>
                          <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                            <div
                              className="h-1.5 bg-gradient-to-r from-pink-500 to-theme rounded-full transition-all duration-300"
                              style={{ width: `${dragDropHandlers.uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* @ts-ignore - 忽略MarkdownToolbar组件类型问题 */}
                  <MarkdownToolbar 
                    editor={editorRef.current} 
                    setDraftDialogOpen={setDraftDialogOpen} 
                    setHistoryDialogOpen={setHistoryDialogOpen} 
                    manualSaveHistory={manualSaveHistory}
                    setFileSelectorOpen={setFileSelectorOpen}
                  />
                  
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
                        lineNumbers: "on",
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
                        formatOnType: true,
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
                  >
                    <Markdown content={content ? content : `> ${t('content.writing_placeholder')}`} />
                  </div>
                </div>
              </div>
            </PageContainer>
          </div>
          <div className="visible md:hidden flex flex-row justify-center mt-8">
            <button
              onClick={publishButton}
              className="basis-1/2 bg-gradient-to-r from-pink-500 to-theme text-white py-4 rounded-full shadow-enhanced-xl hover:shadow-enhanced-2xl hover:scale-[0.98] active:scale-[0.96] transition-all duration-300 flex flex-row justify-center items-center space-x-2"
            >
              {publishing ? (
                <div className="flex items-center">
                  <InlineSpinner size="small" className="mr-2" />
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
          {MetaInput({ className: "bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-enhanced-xl hover:shadow-enhanced-2xl transition-all duration-300 p-4 w-full border border-neutral-200/60 dark:border-neutral-700/60" })}
          <div className="flex flex-row justify-center mt-8">
            <Button
              title={publishing ? t('publishing') : t('publish.title')}
              onClick={publishButton}
            />
          </div>
        </div>
      </div>
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
    </>
  );
}

