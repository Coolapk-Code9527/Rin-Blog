import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { client, endpoint } from '../../main';
import { headersWithAuth } from '../../utils/auth';
import { useFilesCache } from '../../hooks/useQueries';
import { MacOSSpinner } from "../loading";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Pagination } from '../pagination';
import { useToast } from '../../hooks/useToast';
import { useGlobalDialog } from '../dialog';
import Modal from 'react-modal';
import { macOSModalStyles, MODAL_CONTAINER_CLASSES, useModalKeyboard, useModalBodyLock } from '../../utils/modal-config';
import { useNotification } from '../../hooks/useNotification';
import { ClientConfigContext } from '../../state/config';
import { ProfileContext } from '../../state/profile';
import { FilePreview } from './FilePreview';
import { FileTypeSvgIcon } from './FileTypeSvgIcon';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';
import { UnifiedContainer } from '../UnifiedContainer';

// 导入FileItem类型
import type { FileItem } from '../../types/api';
import { uploadFiles } from '../../utils/fileUpload';
// 移除SimpleCacheManager依赖

// 文件大小格式化工具
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 使用macOS风格的Loading组件
const Loading = ({ size = "medium" }: { size?: "small" | "medium" | "large" }) => (
  <MacOSSpinner size={size} />
);

// 使用统一的Button组件
import { Button, IconButton } from '../button';

// 判断文件是否可预览（与FilePreview类型保持一致）
function isPreviewable(file: FileItem): boolean {
  if (file.isFolder) return false;
  if (!file.mimeType && !file.name) return false;
  const mime = file.mimeType || '';
  const name = file.name || '';
  return (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/markdown' ||
    /\.(md|markdown|yaml|yml|toml|ini|conf|txt)$/i.test(name) ||
    // Excel
    /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel|text\/csv|text\/tsv)$/.test(mime) || /\.(xlsx|xls|csv|tsv)$/i.test(name) ||
    // Word
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mime === 'application/msword' || /\.(docx|doc)$/i.test(name) ||
    // PowerPoint
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || mime === 'application/vnd.ms-powerpoint' || /\.(pptx|ppt)$/i.test(name) ||
    // EPUB
    mime === 'application/epub+zip' || /\.epub$/i.test(name) ||
    // 代码/文本
    (mime.startsWith('text/') || /\.(md|markdown|yaml|yml|toml|ini|conf|js|ts|tsx|jsx|py|java|c|cpp|go|sh|json|css|scss|html)$/i.test(name)) && /\.(js|ts|tsx|jsx|py|java|c|cpp|go|sh|json|css|scss|html|md|yaml|yml|toml|ini|conf)$/i.test(name) ||
    mime === 'text/html' || /\.html?$/i.test(name) ||
    // zip
    mime === 'application/zip' || /\.zip$/i.test(name)
  );
}

// 文件管理器组件
export function FileManager({
  onSelect,
  allowedTypes,
  showSelector = true,
  multiple = true
}: {
  onSelect?: (files: FileItem | FileItem[]) => void;
  allowedTypes?: string[];
  showSelector?: boolean;
  multiple?: boolean;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { showConfirm } = useGlobalDialog();
  const notification = useNotification();
  const config = useContext(ClientConfigContext);
  const profile = useContext(ProfileContext);
  const S3_FOLDER = config?.get<string>('S3_FOLDER') || 'images';
  const S3_CACHE_FOLDER = config?.get<string>('S3_CACHE_FOLDER') || 'cache';
  


  // 使用智能Hook系统，按照文档迁移指南使用GLASS_LAYERS.CARD
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  
  // 状态定义
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPageChanging, setIsPageChanging] = useState<boolean>(false);

  // 使用缓存Hook替代直接API调用
  const { data: filesData, loading: isLoading, error: cacheError, invalidate: invalidateFilesCache } = useFilesCache(
    currentPage,
    20 // itemsPerPage
  );

  const files = filesData?.files || [];
  const totalItems = filesData?.total || 0;

  // 清除文件相关缓存的函数
  const clearFilesCaches = useCallback((targetPath?: string) => {
    // 清除指定路径的所有文件缓存
    const pathToClean = targetPath || currentPath;
    const encodedPath = encodeURIComponent(pathToClean);

    // TanStack Query自动处理缓存失效
    console.log(`路径变更，自动刷新缓存: ${pathToClean}`);
  }, [currentPath]);

  // 刷新文件列表的函数（替代loadFiles）
  const refreshFiles = useCallback((reload = false, targetPath?: string) => {
    if (reload) {
      window.location.reload();
    } else {
      // 清除相关路径的所有文件缓存
      clearFilesCaches(targetPath);
      // 然后失效当前缓存以触发重新获取
      invalidateFilesCache();
    }
  }, [invalidateFilesCache, clearFilesCaches]);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, path: string}[]>([{ name: t('files.root'), path: '/' }]);
  
  // 引用
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderNameInputRef = useRef<HTMLInputElement>(null);
  const cleanupTimersRef = useRef<NodeJS.Timeout[]>([]);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState<boolean>(false);
  const [isUploading] = useState<boolean>(false);
  
  // 使用缓存Hook的错误状态，不再需要手动管理
  const errorMessage = cacheError ? String(cacheError) : null;

  // 添加请求取消处理
  const abortControllerRef = useRef<AbortController | null>(null);

  // 新增同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // 新增同步详情弹窗状态
  const [syncDetailOpen, setSyncDetailOpen] = useState(false);
  const [syncDetailList, setSyncDetailList] = useState<any[]>([]);

  // 新增引用详情弹窗状态
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [refDialogFile, setRefDialogFile] = useState<FileItem | null>(null);
  const [refDialogLoading, setRefDialogLoading] = useState(false);
  const [refDialogRefs, setRefDialogRefs] = useState<{id:number,title:string,type:string}[]>([]);
  const [refDialogError, setRefDialogError] = useState<string|null>(null);

  // 新增：管理员全部文件切换
  const [showAll, setShowAll] = useState(false);

  // 权限检查：只有管理员可以使用文件管理器
  const isAdmin = profile?.permission === true;

  if (!isAdmin) {
    return null;
  }

  // 新增多选/单选切换
  const [multipleState, setMultiple] = useState(multiple);
  useEffect(() => { setMultiple(multiple); }, [multiple]);

  // 新增同步菜单状态
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  // 每页数量设置
  const [itemsPerPage, setItemsPerPage] = useState<number>(15);

  // 搜索防抖效果
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300); // 300ms防抖延迟

    return () => clearTimeout(timer);
  }, [search]);

  // 当防抖搜索改变时重置页码
  useEffect(() => {
    if (debouncedSearch !== search) return; // 只有当防抖完成时才执行
    setCurrentPage(1);
  }, [debouncedSearch]);

  // 组件卸载时清理所有定时器，防止内存泄漏
  useEffect(() => {
    return () => {
      // 清理所有定时器
      if (cleanupTimersRef.current) {
        cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
        cleanupTimersRef.current = [];
      }
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 新增拖拽上传状态
  const [dragActive, setDragActive] = useState(false);

  // 上传进度条优化
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState(0);
  const [uploadingPercent, setUploadingPercent] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 新增重命名弹窗状态
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 新增图片预览状态
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 获取当前目录下所有可预览文件（类型与isPreviewable保持一致）
  const previewableFiles = files.filter(isPreviewable);

  // 处理可预览文件点击
  const handlePreviewClick = (file: FileItem) => {
    const idx = previewableFiles.findIndex(f => f.id === file.id);
    if (idx !== -1) {
      setPreviewIndex(idx);
      setPreviewOpen(true);
    }
  };

  // 修改图片点击、文件点击逻辑
  const handleFileClick = (file: FileItem) => {
    if (isLoading) return;
    if (file.isFolder) {
      setCurrentPath(file.path);
      setCurrentPage(1);
      setSelectedFiles([]);
    } else if (!showSelector && isPreviewable(file)) {
      // 非选择模式下，点击直接预览
      handlePreviewClick(file);
    } else if (showSelector) {
      // 选择模式下，点击只做选择
      if (multipleState) {
        setSelectedFiles(prev => {
          const exists = prev.some(f => f.id === file.id);
          return exists 
            ? prev.filter(f => f.id !== file.id)
            : [...prev, file];
        });
      } else {
        setSelectedFiles([file]);
        onSelect?.(file);
      }
    }
  };

  // 移除loadFiles函数，现在由useFilesCache Hook处理数据获取

  // 关闭错误消息对话框（缓存错误会自动处理，这里只需要刷新）
  const closeErrorDialog = () => {
    refreshFiles(true);
  };

  // 移除loadFiles相关的useEffect，现在由useFilesCache Hook自动处理数据获取

  // 首次进入时显示同步提示
  useEffect(() => {
    const hasShownSyncTip = sessionStorage.getItem('file-manager-sync-tip');
    if (!hasShownSyncTip) {
      // 延迟显示提示，避免与加载状态冲突
      const timer = setTimeout(() => {
        notification.info(t('files.performance_tip'), {
          duration: 5000,
          action: {
            label: t('files.got_it'),
            onClick: () => {
              sessionStorage.setItem('file-manager-sync-tip', 'true');
            }
          }
        });
        sessionStorage.setItem('file-manager-sync-tip', 'true');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []); // 只在组件首次挂载时执行

  // 更新面包屑
  useEffect(() => {
    const pathParts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: t('files.root'), path: '/' }];
    
    let currentPathBuilder = '';
    pathParts.forEach(part => {
      currentPathBuilder += '/' + part;
      crumbs.push({
        name: part,
        path: currentPathBuilder
      });
    });
    
    setBreadcrumbs(crumbs);
  }, [currentPath, t]);

  // 处理确认选择
  const handleConfirmSelection = () => {
    if (selectedFiles.length === 0) {
      showToast(t('files.no_selection'), 'info');
      return;
    }

    if (multipleState) {
      onSelect?.(selectedFiles);
    } else {
      onSelect?.(selectedFiles[0]);
    }
  };

  // 新建文件夹处理
  const handleCreateFolder = async () => {
    const folderName = folderNameInputRef.current?.value;
    if (!folderName || folderName.trim() === '') {
      showToast(t('files.folder_name_required'), 'error');
      return;
    }
    // 判断当前目录是否为虚拟一级目录
    const virtualFolders = ["/" + S3_FOLDER, "/" + S3_CACHE_FOLDER];
    let createPath = currentPath;
    if (virtualFolders.includes(currentPath)) {
      createPath = currentPath;
    }
    try {
      const response = await client.files.folder.post({
        name: folderName.trim(),
        parentPath: createPath
      }, {
        headers: headersWithAuth()
      });
      if (response.error) {
        showToast(t('files.folder_create_error', { error: response.error.value }), 'error');
      } else {
        setShowNewFolderDialog(false);
        refreshFiles();
      }
    } catch (error: any) {
      showToast(t('files.folder_create_error', { error: error.message }), 'error');
    }
  };

  // 处理文件上传 - 使用新的上传工具支持视频缩略图
  const handleFileUpload = async (event: any) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files) as File[];
    setUploadingFiles(fileArray);
    setUploadingIndex(0);
    setUploadingPercent(0);
    setUploading(true);
    setUploadError(null);

    // 显示上传进度通知
    let uploadToastId: number | null = null;

    try {
      // 使用新的上传工具
      await uploadFiles(
        fileArray,
        {
          parentPath: currentPath || '/',
          generateThumbnail: true
        },
        (fileIndex, progress) => {
          setUploadingIndex(fileIndex + 1);
          const currentFile = fileArray[fileIndex];
          if (currentFile) {
            // 更新单个文件的进度通知
            uploadToastId = notification.uploadProgress(
              currentFile.name,
              progress,
              () => {
                // 取消上传逻辑（如果需要）
                console.log(t('files.upload_cancelled'));
              }
            );
          }
        },
        (overallProgress) => {
          setUploadingPercent(overallProgress);
          // 更新总体进度通知
          if (fileArray.length > 1) {
            notification.batchProgress(
              t('files.batch_upload'),
              Math.floor((overallProgress / 100) * fileArray.length),
              fileArray.length
            );
          }
        }
      );

      notification.success(t('files.upload_success'));
      refreshFiles(); // 刷新文件列表

      // 触发文件上传成功事件，通知其他组件
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('file-upload-success'));
      }
    } catch (error: any) {
      console.error('文件上传失败:', error);
      setUploadError(error.message);
      notification.error(t('files.upload_failed', { error: error.message }), {
        action: {
          label: '重试',
          onClick: () => handleFileUpload(event)
        }
      });
    }

    setUploadingPercent(100);
    setUploading(false);

    // 使用ref来跟踪定时器，确保组件卸载时能够清理
    const cleanupTimer = setTimeout(() => {
      // 检查组件是否仍然挂载（通过检查ref是否存在）
      if (uploadInputRef.current) {
        setUploadingFiles([]);
        setUploadingIndex(0);
        setUploadingPercent(0);
        setUploadError(null);
        // 清理进度通知
        if (uploadToastId) {
          notification.removeToast(uploadToastId);
        }
      }
    }, 1200);

    // 将定时器ID存储到ref中，以便在组件卸载时清理
    if (!cleanupTimersRef.current) {
      cleanupTimersRef.current = [];
    }
    cleanupTimersRef.current.push(cleanupTimer);

    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  // 删除文件处理
  const handleDeleteFile = async (file: FileItem) => {
    // 禁止删除虚拟一级目录
    const virtualFolders = ["/" + S3_FOLDER, "/" + S3_CACHE_FOLDER];
    if (virtualFolders.includes(file.path)) {
      showToast(t('delete_error', { error: t('files.delete_error') + ' (' + t('files.cannot_delete_system_dir', { defaultValue: '不能删除系统目录' }) + ')' }), 'error');
      return;
    }
    showConfirm(
      t('files.confirm_delete', { name: file.name }),
      '',
      async () => {
        try {
          const res = await fetch(`${endpoint}/files/${file.id}`, {
            method: 'DELETE',
            headers: headersWithAuth(),
          });
          const data = await res.json();
          if (res.status === 409 && data.error) {
            // 冲突，尝试获取引用详情
            const refRes = await fetch(`${endpoint}/files/${file.id}`, { headers: headersWithAuth() });
            const refData = await refRes.json();
            if (refRes.ok && refData.references && refData.references.length > 0) {
                  showConfirm(
                    t('files.delete_error', { error: data.error }) + '\n' + t('files.ref_detail') + '\n' + refData.references.map((r:any) => `${r.title || t('files.ref_no_title')}`).join('\n') + '\n' + t('files.force_delete_confirm'),
                    '',
                    async () => {
                const forceRes = await fetch(`${endpoint}/files/${file.id}`, {
                  method: 'DELETE',
                  headers: headersWithAuth(),
                });
                const forceData = await forceRes.json();
                if (!forceRes.ok || forceData.error) {
                        showToast(t('files.delete_error', { error: forceData.error || forceRes.status }), 'error');
                } else {
                  setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
                  refreshFiles();
                }
              }
                  );
            } else {
                  showToast(t('files.delete_error', { error: data.error }), 'error');
            }
          } else if (!res.ok || data.error) {
            showToast(t('files.delete_error', { error: data.error || res.status }), 'error');
          } else {
            setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
            showToast(t('files.delete_success'), 'info');
            refreshFiles();
          }
        } catch (error: any) {
          showToast(t('files.delete_failed', { error: error.message }), 'error');
        }
      }
    );
  };

  // 处理排序变化
  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  // 同步处理函数
  const handleSyncFiles = async () => {
    if (!window.confirm(t('files.sync_confirm'))) return;

    setIsSyncing(true);
    setSyncResult(null);
    setSyncDetailList([]);

    // 显示同步进度通知
    const syncToastId = notification.loading('正在同步文件...');

    try {
      const res = await fetch(`${endpoint}/files/sync`, {
        method: 'POST',
        headers: headersWithAuth(),
      });
      const data = await res.json();

      // 移除加载通知
      notification.removeToast(syncToastId);

      if (res.ok) {
        const successMessage = t('files.sync_success', { total: data.total, success: data.success, failed: data.failed });
        setSyncResult(successMessage);

        if (data.failed > 0) {
          notification.warning(successMessage, {
            action: {
              label: t('files.view_details'),
              onClick: () => setSyncDetailOpen(true)
            }
          });
        } else {
          notification.success(successMessage);
        }

        if (data.failedDetails && data.failedDetails.length > 0) {
          setSyncDetailList(data.failedDetails);
          setSyncDetailOpen(true);
        } else {
          setSyncDetailOpen(true);
        }
        refreshFiles(true); // 同步后自动刷新
      } else {
        const errorMessage = t('files.sync_failed', { error: data.error || res.status });
        setSyncResult(errorMessage);
        setSyncDetailOpen(true);
        notification.error(errorMessage);
      }
    } catch (e: any) {
      // 移除加载通知
      notification.removeToast(syncToastId);

      const errorMessage = t('files.sync_failed', { error: e.message });
      setSyncResult(errorMessage);
      setSyncDetailOpen(true);
      notification.networkError(errorMessage);
    }
    setIsSyncing(false);
  };

  // 打开引用详情弹窗
  const handleShowReferences = async (file: FileItem) => {
    setRefDialogFile(file);
    setRefDialogOpen(true);
    setRefDialogLoading(true);
    setRefDialogError(null);
    setRefDialogRefs([]);
    try {
      const res = await fetch(`${endpoint}/files/${file.id}`, { headers: headersWithAuth() });
      const data = await res.json();
      if (res.ok && data.references) {
        setRefDialogRefs(data.references);
      } else {
        setRefDialogError(data.error || t('files.ref_load_error'));
      }
    } catch (e: any) {
      setRefDialogError(e.message);
    }
    setRefDialogLoading(false);
  };

  // 新增重命名逻辑
  const handleRenameFile = (file: FileItem) => {
    setRenameTarget(file);
    setRenameValue(file.name);
    setShowRenameDialog(true);
  };

  const confirmRename = async () => {
    if (!renameTarget || !renameValue || renameValue === renameTarget.name) {
      setShowRenameDialog(false);
      return;
    }
    try {
      const res = await fetch(`${endpoint}/files/${renameTarget.id}`, {
        method: 'PATCH',
        headers: { ...headersWithAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue })
      });
      if (res.ok) {
        showToast(t('files.rename_success'), 'info');
        refreshFiles();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(t('files.rename_failed', { error: data.error || res.status }), 'error');
      }
    } catch (e: any) {
      showToast(t('files.rename_failed', { error: e.message }), 'error');
    }
    setShowRenameDialog(false);
    setRenameTarget(null);
    setRenameValue('');
  };

  // 1. 单文件下载
  const handleDownloadFile = async (file: FileItem) => {
    if (file.isFolder) {
      showToast(t('files.download_folder_not_supported', { defaultValue: '暂不支持直接下载整个文件夹' }), 'info');
      return;
    }
    try {
      const url = file.url || '';
      const response = await fetch(url, { headers: headersWithAuth() });
      if (!response.ok) throw new Error(t('files.download_failed', { error: response.statusText }));
      const blob = await response.blob();
      saveAs(blob, file.name);
    } catch (e: any) {
      showToast(t('files.download_failed', { error: e.message }), 'error');
    }
  };

  // 2. 批量下载
  const handleBatchDownload = async () => {
    if (selectedFiles.length === 0) return;
    const zip = new JSZip();
    let count = 0;
    for (const file of selectedFiles) {
      if (file.isFolder) continue; // 文件夹暂不支持
      try {
        const url = file.url || '';
        const response = await fetch(url, { headers: headersWithAuth() });
        if (!response.ok) continue;
        const blob = await response.blob();
        zip.file(file.name, blob);
        count++;
      } catch {}
    }
    if (count === 0) {
      showToast(t('files.download_failed', { error: t('files.no_selection') }), 'error');
      return;
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `files_${Date.now()}.zip`);
  };

  // 3. 批量删除
  const handleBatchDelete = async () => {
    if (selectedFiles.length === 0) return;
    showConfirm(
      t('files.confirm_delete', { name: t('files.selected', { count: selectedFiles.length }) }),
      '',
      async () => {
        try {
          const ids = selectedFiles.map(f => f.id);
          const res = await fetch(`${endpoint}/files/batch`, {
            method: 'DELETE',
            headers: { ...headersWithAuth(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            showToast(t('files.delete_failed', { error: data.error || res.status }), 'error');
            return;
          }
          let msg = '';
          if (data.deleted > 0) msg += t('files.delete_success_batch', { count: data.deleted });
          if (data.skipped > 0) msg += (msg ? '，' : '') + t('files.delete_skipped_batch', { count: data.skipped });
          if (data.errors && data.errors.length > 0) msg += (msg ? '，' : '') + t('files.delete_failed_batch', { count: data.errors.length });
          if (!msg) msg = t('files.delete_none');
          showToast(msg, data.deleted > 0 ? 'info' : 'error');
          setSelectedFiles([]);
          refreshFiles(); // 批量删除后自动刷新
        } catch (error: any) {
          showToast(t('files.delete_failed', { error: error.message }), 'error');
        }
      }
    );
  };

  // 4. 批量移动/移动文件夹
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetPath, setMoveTargetPath] = useState<string>('');
  const [moving, setMoving] = useState(false);

  const handleBatchMove = () => {
    setShowMoveDialog(true);
  };
  const confirmBatchMove = async () => {
    if (!moveTargetPath || moveTargetPath.trim() === '') {
      showToast(t('files.move_target_required', { defaultValue: '目标目录不能为空' }), 'error');
      return;
    }
    setMoving(true);
    let hasError = false;
    for (const file of selectedFiles) {
      if (file.parentPath === moveTargetPath) continue;
      try {
        const res = await fetch(`${endpoint}/files/${file.id}`, {
        method: 'PATCH',
        headers: { ...headersWithAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          parentPath: moveTargetPath
        })
      });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(t('files.move_failed', { error: data.error || res.status }), 'error');
          hasError = true;
        }
      } catch (e: any) {
        showToast(t('files.move_failed', { error: e.message }), 'error');
        hasError = true;
      }
    }
    setMoving(false);
    setShowMoveDialog(false);
    setSelectedFiles([]);

    // 清除源路径和目标路径的缓存
    clearFilesCaches(currentPath); // 清除源路径缓存
    clearFilesCaches(moveTargetPath); // 清除目标路径缓存
    refreshFiles();

    if (!hasError) {
      showToast(t('files.move_success', { defaultValue: '移动成功' }), 'success');
    }
  };

  // 移除重复的useModalBodyLock调用，统一在后面处理

  // 拖拽上传事件处理 - 优化拖拽体验
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOver = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    // 设置拖拽效果
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setDragActive(false);
      }
      return newCounter;
    });
  };

  const handleDrop = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragCounter(0);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // 复用上传逻辑
    const fakeEvent = { target: { files } } as any;
    await handleFileUpload(fakeEvent);
  };

  // 新增：R2容量状态
  const [r2Usage, setR2Usage] = useState<number | null>(null);
  useEffect(() => {
    // 仅管理员请求
    if (!isAdmin) return;
    fetch(`${endpoint}/files/stat`, {
      headers: headersWithAuth(),
    })
      .then(res => res.json())
      .then((data: any) => {
        if (data && data.r2 && typeof data.r2.used === 'number') setR2Usage(data.r2.used);
      });
  }, [isAdmin]);

  // 弹窗键盘事件和body锁定 - 统一管理所有弹窗状态
  const hasAnyModalOpen = showNewFolderDialog || !!errorMessage || refDialogOpen || showMoveDialog || showRenameDialog || syncDetailOpen;

  useModalKeyboard(showNewFolderDialog, () => setShowNewFolderDialog(false));
  useModalKeyboard(!!errorMessage, closeErrorDialog);
  useModalKeyboard(refDialogOpen, () => setRefDialogOpen(false));
  useModalKeyboard(showMoveDialog, () => setShowMoveDialog(false));
  useModalKeyboard(showRenameDialog, () => setShowRenameDialog(false));
  useModalKeyboard(syncDetailOpen, () => setSyncDetailOpen(false));

  useModalBodyLock(hasAnyModalOpen);

  // 骨架屏组件
  const FileSkeleton = () => (
    <div className="p-1 sm:p-2 md:p-4">
      <div className="grid gap-1.5 sm:gap-2 lg:gap-3 auto-rows-fr grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: itemsPerPage }, (_, i) => (
          <div
            key={i}
            className="flex flex-row p-1.5 sm:p-2 md:p-3 rounded-lg sm:rounded-xl border border-gray-300 dark:border-gray-600 animate-pulse"
          >
            {/* 左侧图标骨架 */}
            <div className="flex-shrink-0 mr-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>

            {/* 右侧信息骨架 */}
            <div className="flex-1 flex flex-col justify-between min-h-0 min-w-0">
              <div className="flex-1 min-h-0 min-w-0">
                {/* 文件名骨架 */}
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1"></div>
                {/* 文件信息骨架 */}
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-1"></div>
              </div>
              {/* 操作按钮骨架 */}
              <div className="flex gap-1 mt-1">
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 渲染网格视图 - 现代化卡片设计
  const renderGridView = () => {
    // 文件夹优先，文件后面
    const folders = files.filter(file => file.isFolder);
    const normalFiles = files.filter(file => !file.isFolder);
    const displayFiles = [...folders, ...normalFiles];

    return (
      <div className="p-1 sm:p-2 md:p-4">
        {/* 极致紧凑网格布局 - 移动端单列，桌面端多列 */}
        <div className="grid gap-1.5 sm:gap-2 lg:gap-3 auto-rows-fr grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {displayFiles.map(file => (
            <div
              key={file.id}
              className={`
                group relative flex flex-row
                p-1.5 sm:p-2 md:p-3 rounded-lg sm:rounded-xl
                border transition-all duration-300 cursor-pointer
                hover:shadow-md hover:scale-[1.005]
                ${selectedFiles.some(f => f.id === file.id)
                  ? 'border-theme ring-2 ring-theme/20 bg-theme/5'
                  : 'border-gray-300 dark:border-gray-600 hover:border-theme/70'
                }
              `}
              onClick={() => handleFileClick(file)}
            >
              {/* 引用计数器 - 右上角显示 */}
              {!file.isFolder && (
                <div className="absolute top-1 right-1 z-10">
                  <div
                    className={`
                      flex items-center justify-center w-4 h-4 rounded-full text-xs font-medium
                      transition-all duration-200
                      ${file.referencesCount > 0
                        ? 'bg-blue-500 text-white cursor-pointer hover:bg-blue-600'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                      }
                    `}
                    title={file.referencesCount > 0 ? t('files.references') : t('files.ref_none')}
                    onClick={file.referencesCount > 0 ? (e: React.MouseEvent) => { e.stopPropagation(); handleShowReferences(file); } : undefined}
                  >
                    {file.referencesCount || 0}
                  </div>
                </div>
              )}

              {/* 左侧：文件图标/缩略图区域 */}
              <div className="flex-shrink-0 mr-3">
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 relative flex items-center justify-center rounded-lg overflow-hidden"
                  onClick={isPreviewable(file) ? (e: React.MouseEvent) => { e.stopPropagation(); handlePreviewClick(file); } : undefined}
                  style={{ cursor: isPreviewable(file) ? 'pointer' : 'default' }}
                >
                  {file.thumbnailHash && !file.isFolder && file.thumbUrl ? (
                    <img
                      src={file.thumbUrl}
                      alt={file.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover rounded-lg shadow-sm border border-gray-200/50 dark:border-gray-700/50 bg-white dark:bg-gray-900 transition-all duration-200 group-hover:shadow-md"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.opacity = '1';
                      }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = 'none';
                      }}
                      style={{ opacity: 0 }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileTypeSvgIcon type={file.mimeType || file.name} className="w-full h-full" />
                    </div>
                  )}

                  {/* 预览指示器 */}
                  {isPreviewable(file) && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 rounded-lg flex items-center justify-center">
                      <i className="ri-eye-line text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm"></i>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：文件信息和操作区域 */}
              <div className="flex-1 flex flex-col justify-between min-h-0 min-w-0 overflow-hidden">
                {/* 文件信息区域 */}
                <div className="flex-1 min-h-0 min-w-0">
                  {/* 文件名 - 紧凑显示 */}
                  <h3
                    className="text-sm font-medium text-gray-900 dark:text-white leading-tight line-clamp-1 mb-1 overflow-hidden text-ellipsis"
                    title={file.name}
                  >
                    {file.name && !/^[a-f0-9]{32,}$/.test(file.name)
                      ? file.name
                      : (/^[a-f0-9]{32,}$/.test(file.name) ? (file.name + '（' + t('files.no_original_name', { defaultValue: '无原始名' }) + '）') : file.name)}
                  </h3>

                  {/* 文件元信息 - 水平排列 */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{file.isFolder ? t('files.folder', { defaultValue: '文件夹' }) : formatFileSize(file.size)}</span>
                    {file.modifiedAt && (
                      <>
                        <span>•</span>
                        <span>{new Date(file.modifiedAt * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 紧凑操作按钮区域 - 集成到信息区域底部 */}
                <div className="flex justify-start gap-1 mt-1">
                  {/* 下载按钮 */}
                  {!file.isFolder && (
                    <button
                      className="p-1 rounded text-green-600 hover:text-green-700 hover:bg-transparent hover:opacity-80 transition-all duration-200"
                      title={t('files.download')}
                      onClick={(e: React.MouseEvent) => {e.stopPropagation(); handleDownloadFile(file);}}
                    >
                      <i className="ri-download-2-line text-xs"></i>
                    </button>
                  )}

                  {/* 移动按钮 */}
                  <button
                    className="p-1 rounded text-purple-600 hover:text-purple-700 hover:bg-transparent hover:opacity-80 transition-all duration-200"
                    title={t('files.move')}
                    onClick={(e: React.MouseEvent) => {e.stopPropagation(); setSelectedFiles([file]); setShowMoveDialog(true);}}
                  >
                    <i className="ri-folder-transfer-line text-xs"></i>
                  </button>

                  {/* 重命名按钮 */}
                  <button
                    className="p-1 rounded text-blue-600 hover:text-blue-700 hover:bg-transparent hover:opacity-80 transition-all duration-200"
                    title={t('edit')}
                    onClick={(e: React.MouseEvent) => {e.stopPropagation(); handleRenameFile(file);}}
                  >
                    <i className="ri-edit-2-line text-xs"></i>
                  </button>

                  {/* 删除按钮 */}
                  <button
                    className="p-1 rounded text-red-600 hover:text-red-700 hover:bg-transparent hover:opacity-80 transition-all duration-200"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteFile(file); }}
                    title={t('files.delete')}
                  >
                    <i className="ri-delete-bin-line text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 空状态 */}
          {displayFiles.length === 0 && !isLoading && (
            <div className="col-span-full flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <i className="ri-inbox-line text-2xl text-gray-400"></i>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t('files.empty')}</p>
            </div>
          )}
        </div>
      </div>
    );

  };
  
  // 渲染列表视图
  const renderListView = () => {
    // 文件夹优先，文件后面
    const folders = files.filter(file => file.isFolder);
    const normalFiles = files.filter(file => !file.isFolder);
    const displayFiles = [...folders, ...normalFiles];
    // 直接渲染后端分页数据，无需slice
    return (
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="border-b border-gray-300 dark:border-gray-600">
            <tr>
              {showSelector && multipleState && (
                <th scope="col" className="px-4 py-3 w-10"></th>
              )}
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('name')}
              >
                <div className="flex items-center">
                  {t('files.columns.name')}
                  {sortBy === 'name' && (
                    <i className={`ri-${sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}-s-line ml-1`}></i>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('size')}
              >
                <div className="flex items-center">
                  {t('files.columns.size')}
                  {sortBy === 'size' && (
                    <i className={`ri-${sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}-s-line ml-1`}></i>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('date')}
              >
                <div className="flex items-center">
                  {t('files.columns.date')}
                  {sortBy === 'date' && (
                    <i className={`ri-${sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}-s-line ml-1`}></i>
                  )}
                </div>
              </th>
              <th scope="col" className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 dark:divide-gray-600">
            {displayFiles.map(file => (
              <tr 
                key={file.id}
                className={`${selectedFiles.some(f => f.id === file.id) ? 'bg-pink-50 dark:bg-pink-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} cursor-pointer transition-colors`}
                onClick={() => handleFileClick(file)}
              >
                {showSelector && multipleState && (
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedFiles.some(f => f.id === file.id)}
                      onChange={e => {
                        e.stopPropagation();
                        // 只切换选中状态，不触发行点击
                        setSelectedFiles(prev => {
                          const exists = prev.some(f => f.id === file.id);
                          return exists 
                            ? prev.filter(f => f.id !== file.id)
                            : [...prev, file];
                        });
                      }}
                      className="rounded border-gray-300 text-theme focus:ring-theme cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-4 py-3 flex items-center"
                  onClick={isPreviewable(file) ? (e) => { e.stopPropagation(); handlePreviewClick(file); } : undefined}
                  style={{ cursor: isPreviewable(file) ? 'pointer' : 'default' }}
                >
                  <FileTypeSvgIcon type={file.mimeType || file.name} className="w-6 h-6 mr-2" />
                  <span className="truncate">
                    {file.name && !/^[a-f0-9]{32,}$/.test(file.name)
                      ? file.name
                      : (/^[a-f0-9]{32,}$/.test(file.name) ? (file.name + '（' + t('files.no_original_name', { defaultValue: '无原始名' }) + '）') : file.name)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {file.isFolder ? '-' : formatFileSize(file.size)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(file.modifiedAt * 1000).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-right flex gap-1 items-center">
                  {/* 下载按钮 */}
                  {!file.isFolder && (
                    <button 
                      className="text-green-500 hover:text-green-700 p-1"
                      title={t('download')}
                      onClick={e => {e.stopPropagation(); handleDownloadFile(file);}}
                    >
                      <i className="ri-download-2-line"></i>
                    </button>
                  )}
                  {/* 移动按钮 */}
                  <button
                    className="text-purple-500 hover:text-purple-700 p-1"
                    title={t('files.move')}
                    onClick={e => {e.stopPropagation(); setSelectedFiles([file]); setShowMoveDialog(true);}}
                  >
                    <i className="ri-folder-transfer-line"></i>
                  </button>
                  {/* 引用按钮优化：仅被引用的文件显示蓝色按钮，未被引用的显示灰色提示 */}
                  {!file.isFolder && (
                    <span
                      className={`text-xs mr-2 rounded px-2 py-0.5 flex items-center gap-1
                        ${file.referencesCount > 0
                          ? 'text-blue-500 bg-gray-100 dark:bg-gray-800'
                          : 'text-gray-400 bg-gray-100 dark:bg-gray-800'}`}
                      title={file.referencesCount > 0 ? t('files.references') : t('files.ref_none')}
                      style={{ minWidth: 24, justifyContent: 'center', cursor: file.referencesCount > 0 ? 'pointer' : 'default' }}
                      onClick={file.referencesCount > 0 ? (e) => { e.stopPropagation(); handleShowReferences(file); } : undefined}
                    >
                      <i className={file.referencesCount > 0 ? 'ri-link' : 'ri-link-unlink'} />
                      {file.referencesCount > 0 && file.referencesCount}
                    </span>
                  )}
                  <button 
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                    title={t('files.delete')}
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                  {/* 预览按钮 */}
                  {isPreviewable(file) && (
                    <button
                      className="text-pink-500 hover:text-pink-700 p-1"
                      title={t('files.preview', { defaultValue: '预览' })}
                      onClick={e => {e.stopPropagation(); handlePreviewClick(file);}}
                    >
                      <i className="ri-eye-line"></i>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {displayFiles.length === 0 && !isLoading && (
              <tr>
                <td colSpan={showSelector && multipleState ? 5 : 4} className="py-8 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <i className="ri-inbox-line text-4xl text-gray-400"></i>
                    <p className="mt-2 text-gray-500">{t('files.empty')}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // 渲染面包屑 - 移动端优化
  const renderBreadcrumbs = () => {
    return (
      <div className="flex items-center w-full text-sm sm:text-base mb-0 min-h-[44px] sm:min-h-[40px] overflow-x-auto">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center flex-shrink-0">
            {index > 0 && <i className="ri-arrow-right-s-line mx-1 sm:mx-1 text-gray-400 text-sm sm:text-base"></i>}
            <button
              onClick={() => {
                setCurrentPath(crumb.path);
                setCurrentPage(1);
                setSelectedFiles([]);
              }}
              className={`h-10 px-3 rounded transition-all duration-200 whitespace-nowrap ${
                index === breadcrumbs.length - 1
                  ? 'font-medium text-theme bg-theme/10'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50'
              } text-sm flex items-center`}
              style={{ minWidth: 44 }}
            >
              {index === 0 ? <i className="ri-home-line mr-1 text-base"></i> : null}
              <span className="truncate max-w-[120px] sm:max-w-none">{crumb.name}</span>
            </button>
          </div>
        ))}
      </div>
    );
  };

  // 移除重复的modal-open类管理，由useModalBodyLock统一处理
  // useEffect(() => {
  //   const hasModal = showNewFolderDialog || errorMessage || refDialogOpen || showMoveDialog;
  //   if (hasModal) {
  //     document.body.classList.add('modal-open');
  //     window.dispatchEvent(new Event('modal-toggle'));
  //   } else {
  //     document.body.classList.remove('modal-open');
  //     window.dispatchEvent(new Event('modal-toggle'));
  //   }
  //   return () => {
  //     document.body.classList.remove('modal-open');
  //     window.dispatchEvent(new Event('modal-toggle'));
  //   };
  // }, [showNewFolderDialog, errorMessage, refDialogOpen, showMoveDialog]);

  // 移除file-upload-success事件监听器，因为FileManager组件自己处理文件上传后的缓存更新
  // 其他组件（如writing.tsx）的文件上传会触发此事件，但FileManager不需要监听自己的上传事件

  return (
    <UnifiedContainer
      heightType="responsive"
      layoutType="with-footer"
      className={
        `file-manager-container transition-all duration-300 w-full` +
        (dragActive ? " ring-4 ring-pink-400/60 ring-inset" : "")
      }
      enableScroll={false}
      disablePadding={true}
      footer={
        // 极简分页区域 - 最小高度，完全透明
        totalItems > itemsPerPage ? (
          <div className="flex justify-center py-1 px-2">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalItems / itemsPerPage)}
              onPageChange={page => {
                setIsPageChanging(true);
                setCurrentPage(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // 页面切换动画延迟，使用ref跟踪定时器
                const pageChangeTimer = setTimeout(() => {
                  // 检查组件是否仍然挂载
                  if (uploadInputRef.current) {
                    setIsPageChanging(false);
                  }
                }, 300);
                // 将定时器添加到清理列表
                cleanupTimersRef.current.push(pageChangeTimer);
              }}
              className="items-center"
            />
          </div>
        ) : null
      }
    >
      <div
        className="h-full flex flex-col"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ transition: 'box-shadow 0.2s, border-color 0.2s' }}
      >
      {/* 上传进度条 */}
      {uploading && (
        <div className="fixed top-0 left-0 w-full z-[12001] flex flex-col items-center pointer-events-none select-none">
          {/* 渐变主题色进度条 */}
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full shadow-md overflow-hidden mt-2 mx-auto max-w-2xl">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-pink-400 via-pink-500 to-pink-600 transition-all duration-500 shadow-lg"
              style={{ width: `${uploadingPercent}%` }}
            ></div>
          </div>
          {/* 卡片式进度信息 */}
          <div className="mt-3 px-4 py-2 rounded-xl shadow-lg border border-pink-200 dark:border-pink-700 bg-white/90 dark:bg-gray-900/90 flex flex-row items-center gap-2 text-xs text-gray-700 dark:text-gray-100 font-medium animate-fadeIn" style={{minWidth:220, maxWidth:360}}>
            <i className="ri-upload-cloud-2-line text-pink-500 text-base mr-1"></i>
            <span className="text-pink-500 font-semibold">{t('files.upload', { defaultValue: '上传' })}</span>
            {uploadingFiles.length > 1 && (
              <span className="ml-1 text-gray-400">{uploadingIndex}/{uploadingFiles.length}</span>
            )}
            {uploadingFiles[uploadingIndex - 1]?.name && (
              <span className="truncate max-w-[120px] ml-2 text-gray-600 dark:text-gray-200">{uploadingFiles[uploadingIndex - 1].name}</span>
            )}
            <span className="ml-2 text-pink-500 font-bold">{uploadingPercent}%</span>
            {uploadError && <span className="ml-2 text-red-400">{t('files.upload_failed', { error: uploadError })}</span>}
          </div>
        </div>
      )}
      {/* 简化拖拽上传覆盖层 - 减少层级嵌套 */}
      {dragActive && (
        <div className="absolute inset-0 z-[12000] pointer-events-none select-none bg-theme/10 backdrop-blur-sm rounded-lg animate-in fade-in duration-300">
          {/* 拖拽指示区域 - 简化设计 */}
          <div className="absolute inset-4 border-2 border-dashed border-theme/60 rounded-2xl flex items-center justify-center">
            <div className="text-center space-y-4">
              {/* 上传图标 */}
              <div className="w-16 h-16 mx-auto rounded-full bg-theme/20 flex items-center justify-center animate-bounce">
                <i className="ri-upload-cloud-2-line text-3xl text-theme"></i>
              </div>

              {/* 提示文字 */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-theme">
                  {t('files.drag_to_upload', { defaultValue: '松开上传文件' })}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs mx-auto">
                  支持多文件同时上传，自动生成缩略图
                </p>
              </div>

              {/* 装饰性元素 */}
              <div className="flex justify-center space-x-2">
                <div className="w-2 h-2 bg-theme/60 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-theme/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-theme/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 简化工具栏 - 完全透明融合背景，移动端紧凑 */}
      <div className="border-b border-gray-200/60 dark:border-gray-700/60 px-2 py-1.5 sm:px-3 sm:py-2">
        {/* 移动端面包屑 - 紧凑间距 */}
        <div className="block sm:hidden mb-1.5">
          {renderBreadcrumbs()}
        </div>

        {/* 主工具栏 - 灵活响应式布局 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 桌面端面包屑 */}
          <div className="hidden sm:block flex-shrink-0">
            {renderBreadcrumbs()}
          </div>

          {/* 搜索框 - 响应式宽度 */}
          <div className="relative flex-1 min-w-[120px] sm:min-w-[200px] max-w-[180px] sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className={`transition-all duration-200 ${
                search !== debouncedSearch
                  ? 'ri-loader-4-line animate-spin text-theme'
                  : 'ri-search-line text-gray-400 dark:text-gray-500'
              }`}></i>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder={t('files.search_placeholder')}
              className={`
                block w-full pl-10 pr-10 py-2.5
                border border-gray-300 dark:border-gray-600
                rounded-lg bg-transparent
                text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400
                focus:ring-2 focus:ring-theme/20 focus:border-theme
                transition-all duration-200
                text-sm
              `}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="清除搜索"
              >
                <i className="ri-close-line"></i>
              </button>
            )}
          </div>

          {/* 控制按钮组 - 自然排列 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 每页数量选择器 - 按钮样式 */}
            <div className="relative">
              <select
                value={itemsPerPage}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={`
                  h-10 px-3 border border-gray-300 dark:border-gray-600
                  rounded-lg bg-transparent
                  text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-theme/20 focus:border-theme
                  transition-all duration-200 text-sm
                  min-w-[80px] text-center appearance-none cursor-pointer
                `}
                title={t('files.page_size') || '每页数量'}
              >
                {[10, 15, 20, 30].map(opt => (
                  <option key={opt} value={opt} className="bg-white dark:bg-gray-800">{opt}/页</option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-sm"></i>
            </div>

            {/* 视图切换按钮组 - 统一样式 */}
            <div className={`
              flex rounded-lg border border-gray-300 dark:border-gray-600
              overflow-hidden
              transition-all duration-200
            `}>
              <button
                onClick={() => setViewMode('grid')}
                className={`
                  w-10 h-10 transition-all duration-200 flex items-center justify-center
                  ${viewMode === 'grid'
                    ? 'bg-theme text-white'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                  }
                `}
                title={t('files.grid_view')}
              >
                <i className="ri-grid-line text-lg"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`
                  w-10 h-10 transition-all duration-200 flex items-center justify-center
                  ${viewMode === 'list'
                    ? 'bg-theme text-white'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                  }
                `}
                title={t('files.list_view')}
              >
                <i className="ri-list-check text-lg"></i>
              </button>
            </div>
          </div>

          {/* 操作按钮 - 统一尺寸 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <IconButton
              icon={`ri-checkbox-${multipleState ? 'multiple' : 'blank'}-line`}
              onClick={() => setMultiple(m => !m)}
              title={multipleState ? t('files.single_select') : t('files.multi_select')}
              variant="secondary"
              size="medium"
            />
            <IconButton
              icon="ri-folder-add-line"
              onClick={() => setShowNewFolderDialog(true)}
              title={t('files.new_folder')}
              variant="secondary"
              size="medium"
            />
            <div className="relative">
              <IconButton
                icon="ri-upload-2-line"
                onClick={() => uploadInputRef.current?.click()}
                title={t('files.upload')}
                variant="secondary"
                size="medium"
                disabled={isUploading}
              />
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept={allowedTypes ? allowedTypes.map(type => type + '/*').join(',') : undefined}
              />
            </div>
            <IconButton
              icon="ri-refresh-line"
              onClick={async () => {
                showConfirm(
                  t('files.r2sync_confirm') || '确定要全量同步R2存储桶所有文件到数据库吗？',
                  '',
                  async () => {
                    setIsSyncing(true);
                    setSyncResult(null);
                    setSyncDetailList([]);
                    try {
                      const res = await fetch(`${endpoint}/files/r2sync`, {
                        method: 'POST',
                        headers: headersWithAuth(),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setSyncResult(t('files.r2sync_success', { total: data.total, inserted: data.inserted, skipped: data.skipped, failed: data.failed }));
                        if (data.failedList && data.failedList.length > 0) {
                          setSyncDetailList(data.failedList);
                          setSyncDetailOpen(true);
                        } else {
                          setSyncDetailOpen(true);
                        }
                        refreshFiles(true);
                      } else {
                        setSyncResult(t('files.r2sync_failed', { error: data.error || res.status }));
                        setSyncDetailOpen(true);
                      }
                    } catch (e: any) {
                      setSyncResult(t('files.r2sync_failed', { error: e.message }));
                      setSyncDetailOpen(true);
                    }
                    setIsSyncing(false);
                  }
                );
              }}
              title={t('files.r2sync')}
              variant="secondary"
              size="medium"
              disabled={isSyncing}
            />
          </div>
        </div>
      </div>

        {/* 文件列表主体 - 使用统一容器高度 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            viewMode === 'grid' ? (
              <FileSkeleton />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loading size="large" />
              </div>
            )
          ) : (
            <div className={`transition-opacity duration-300 ${isPageChanging ? 'opacity-50' : 'opacity-100'}`}>
              {viewMode === 'grid' ? renderGridView() : renderListView()}
            </div>
          )}
        </div>
      
      {/* 优化批量操作栏 - 移动端友好布局，完全透明融合背景 */}
      {showSelector && multipleState && selectedFiles.length > 0 && (
        <div>
          {/* 移动端：紧凑图标布局 - 一行显示 */}
          <div className="block sm:hidden px-2 py-2">
            {/* 操作按钮组 - 水平一行图标布局 */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleBatchDownload}
                className="flex items-center justify-center w-8 h-8 border border-gray-300 dark:border-gray-600 text-green-700 dark:text-green-400 rounded-md transition-all hover:border-green-400 dark:hover:border-green-500 hover:text-green-800 dark:hover:text-green-300"
                title={t('files.download')}
              >
                <i className="ri-download-2-line text-sm"></i>
              </button>

              <button
                onClick={handleBatchMove}
                className="flex items-center justify-center w-8 h-8 border border-gray-300 dark:border-gray-600 text-purple-700 dark:text-purple-400 rounded-md transition-all hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-800 dark:hover:text-purple-300"
                title={t('files.move')}
              >
                <i className="ri-folder-transfer-line text-sm"></i>
              </button>

              <button
                onClick={handleBatchDelete}
                className="flex items-center justify-center w-8 h-8 border border-gray-300 dark:border-gray-600 text-red-700 dark:text-red-400 rounded-md transition-all hover:border-red-400 dark:hover:border-red-500 hover:text-red-800 dark:hover:text-red-300"
                title={t('files.delete')}
              >
                <i className="ri-delete-bin-line text-sm"></i>
              </button>

              {showSelector && (
                <button
                  onClick={handleConfirmSelection}
                  className="flex items-center justify-center w-8 h-8 border border-gray-300 dark:border-gray-600 text-theme rounded-md transition-all hover:border-theme hover:text-theme font-medium"
                  title={t('files.confirm_selection')}
                >
                  <i className="ri-check-line text-sm"></i>
                </button>
              )}
            </div>
          </div>

          {/* 桌面端：水平布局 - 紧凑化 */}
          <div className="hidden sm:flex items-center justify-center gap-3 px-3 py-2">
            {/* 选择计数 - 图标化显示 */}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
              <i className="ri-checkbox-multiple-line text-theme"></i>
              <span>{selectedFiles.length}</span>
            </div>

            {/* 分隔线 */}
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>

            {/* 操作按钮组 - 水平排列，毛玻璃效果 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchDownload}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 text-green-700 dark:text-green-400 rounded-md transition-all hover:border-green-400 dark:hover:border-green-500 hover:text-green-800 dark:hover:text-green-300"
                title={t('files.download')}
              >
                <i className="ri-download-2-line mr-1"></i>
                {t('files.download')}
              </button>

              <button
                onClick={handleBatchMove}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 text-purple-700 dark:text-purple-400 rounded-md transition-all hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-800 dark:hover:text-purple-300"
                title={t('files.move')}
              >
                <i className="ri-folder-transfer-line mr-1"></i>
                {t('files.move')}
              </button>

              <button
                onClick={handleBatchDelete}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 text-red-700 dark:text-red-400 rounded-md transition-all hover:border-red-400 dark:hover:border-red-500 hover:text-red-800 dark:hover:text-red-300"
                title={t('files.delete')}
              >
                <i className="ri-delete-bin-line mr-1"></i>
                {t('files.delete')}
              </button>

              {showSelector && (
                <button
                  onClick={handleConfirmSelection}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 text-theme rounded-md transition-all hover:border-theme hover:text-theme font-medium"
                  title={t('files.confirm_selection')}
                >
                  <i className="ri-check-line mr-1"></i>
                  {t('confirm')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 新建文件夹对话框 */}
      {showNewFolderDialog && (
        <Modal
          isOpen={showNewFolderDialog}
          onRequestClose={() => setShowNewFolderDialog(false)}
          style={macOSModalStyles}
          ariaHideApp={false}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">{t('files.create_folder', { defaultValue: '新建文件夹' })}</h3>
            <input
              ref={folderNameInputRef}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent mb-4"
              placeholder={t('files.folder_name')}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button onClick={() => setShowNewFolderDialog(false)} title={t('cancel')} secondary />
              <Button onClick={handleCreateFolder} title={typeof t('create_action.title') === 'string' ? t('create_action.title') : '创建'} />
            </div>
          </div>
        </Modal>
      )}
      
      {/* 错误信息对话框 */}
      {errorMessage && (
        <Modal
          isOpen={!!errorMessage}
          onRequestClose={closeErrorDialog}
          style={macOSModalStyles}
          ariaHideApp={false}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium text-red-600 mb-4">{t('alert')}</h3>
            <p className="mb-6">{t('files.load_error', { error: errorMessage })}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => refreshFiles(true)} title={t('reload')} />
              <Button onClick={closeErrorDialog} title={t('close')} secondary />
              <Button onClick={() => { closeErrorDialog(); window.location.href = '/'; }} title={t('index.back')} secondary />
            </div>
          </div>
        </Modal>
      )}

      {/* 引用详情弹窗 */}
      {refDialogOpen && (
        <Modal
          isOpen={refDialogOpen}
          onRequestClose={() => setRefDialogOpen(false)}
          style={macOSModalStyles}
          ariaHideApp={false}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">{t('files.ref_detail')}</h3>
            {refDialogLoading ? (
              <div className="text-center text-gray-500">{t('loading')}</div>
            ) : refDialogError ? (
              <div className="text-red-500">{refDialogError}</div>
            ) : refDialogRefs.length === 0 ? (
              <div className="text-gray-500">{t('files.ref_none')}</div>
            ) : (
              <ul className="space-y-2">
                {refDialogRefs.map(ref => (
                  <li key={ref.id}>
                    <a href={`/feed/${ref.id}`} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                      {ref.title || t('files.ref_no_title')}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-6">
              <Button onClick={() => setRefDialogOpen(false)} title={t('close')} />
            </div>
          </div>
        </Modal>
      )}

      {/* 移动弹窗 */}
      {showMoveDialog && (
        <Modal
          isOpen={showMoveDialog}
          onRequestClose={() => setShowMoveDialog(false)}
          style={macOSModalStyles}
          ariaHideApp={false}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">{t('files.move_to')}</h3>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent mb-4"
              placeholder={t('files.target_folder')}
              value={moveTargetPath}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMoveTargetPath(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button onClick={() => setShowMoveDialog(false)} title={t('cancel')} secondary />
              <Button onClick={confirmBatchMove} title={moving ? t('files.moving') : t('files.move')} />
            </div>
          </div>
        </Modal>
      )}

      {/* 重命名弹窗 */}
      {showRenameDialog && (
        <Modal
          isOpen={showRenameDialog}
          onRequestClose={() => setShowRenameDialog(false)}
          style={macOSModalStyles}
          ariaHideApp={false}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">{t('files.rename_prompt') || '请输入新文件名'}</h3>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent mb-4"
              value={renameValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button onClick={() => setShowRenameDialog(false)} title={t('cancel')} secondary />
              <Button onClick={confirmRename} title={t('confirm')} />
            </div>
          </div>
        </Modal>
      )}

      {/* R2同步结果弹窗 */}
      {syncDetailOpen && (
        <Modal
          isOpen={syncDetailOpen}
          onRequestClose={() => setSyncDetailOpen(false)}
          style={macOSModalStyles}
          ariaHideApp={false}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">{t('files.r2sync_result', { defaultValue: 'R2同步结果' })}</h3>
            <div className="mb-4 text-gray-700 dark:text-gray-200 whitespace-pre-line break-all">
              {syncResult}
            </div>
            {syncDetailList && syncDetailList.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded p-2 text-xs text-gray-600 dark:text-gray-300">
                <ul className="list-disc pl-5">
                  {syncDetailList.map((item, idx) => (
                    <li key={idx}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button onClick={() => setSyncDetailOpen(false)} title={t('close')} />
            </div>
          </div>
        </Modal>
      )}

      {/* 图片预览弹窗 */}
      {previewOpen && createPortal(
        <FilePreview files={previewableFiles} current={previewIndex} onClose={() => setPreviewOpen(false)} />,
        document.body
      )}
      </div>
    </UnifiedContainer>
  );
}