import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { client, endpoint } from '../../main';
import { headersWithAuth } from '../../utils/auth';
import { MacOSSpinner } from "../loading";
import { ShowAlertType } from '../dialog';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Pagination } from '../pagination';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../dialog';
import { useNotification } from '../../hooks/useNotification';
import { ClientConfigContext } from '../../state/config';
import { FilePreview } from './FilePreview';
import { FileTypeSvgIcon } from './FileTypeSvgIcon';
import {
  MODAL_Z_INDEX,
  MODAL_CONTAINER_CLASSES,
  useModalKeyboard,
  useModalBodyLock
} from '../../utils/modal-config';

// 导入FileItem类型
import type { FileItem } from '../../types/api';
import { uploadFiles } from '../../utils/fileUpload';

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
  const { showConfirm, ConfirmUI } = useConfirm();
  const notification = useNotification();
  const config = useContext(ClientConfigContext);
  const S3_FOLDER = config?.get<string>('S3_FOLDER') || 'images';
  const S3_CACHE_FOLDER = config?.get<string>('S3_CACHE_FOLDER') || 'cache';
  
  // 创建自己的简易alert函数作为替代
  const showAlert: ShowAlertType = (msg, onConfirm) => {
    showToast(msg, 'info');
    if (onConfirm) onConfirm();
  };
  
  // 状态定义
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, path: string}[]>([{ name: t('files.root'), path: '/' }]);
  
  // 引用
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderNameInputRef = useRef<HTMLInputElement>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // 添加错误状态，用于显示错误信息和控制关闭功能
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // 判断是否管理员（需根据实际用户信息实现）
  const isAdmin = true; // TODO: 替换为真实权限判断

  if (!isAdmin) {
    return null;
  }

  // 新增多选/单选切换
  const [multipleState, setMultiple] = useState(multiple);
  useEffect(() => { setMultiple(multiple); }, [multiple]);

  // 新增同步菜单状态
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  // 新增：每页数量下拉选择
  const [itemsPerPage, setItemsPerPage] = useState<number>(15);
  const pageSizeOptions = [5, 10, 15, 20, 30, 50];

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

  // 加载文件列表
  const loadFiles = async (reload = false) => {
    try {
      // 检查endpoint是否有效
      if (!endpoint) {
        throw new Error('API endpoint not configured. Please check your environment variables.');
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      if (reload) {
        setFiles([]);
      }
      setIsLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams();
      params.append('path', currentPath);
      if (search) params.append('search', search);
      params.append('sort', sortBy);
      params.append('order', sortOrder);
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));
      params.append('all', '1');
      const authHeaders = headersWithAuth();

      console.log('Loading files from:', `${endpoint}/files?${params.toString()}`);

      const response = await fetch(`${endpoint}/files?${params.toString()}`, {
        headers: authHeaders,
        signal: abortControllerRef.current.signal
      });
      if (!response.ok) {
        let errorText = `HTTP error ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorText = errorData.error;
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        if (response.status === 401 || response.status === 403) {
          showToast(t('login.required'), 'error');
          window.location.href = '/login';
          return;
        }
        throw new Error(errorText);
      }
      const data = await response.json();
      // 修复：根目录下virtualFolders不参与分页，files=virtualFolders+dbItems（分页），totalItems=total-virtualFolders.length
      let filesData = data.files || [];
      let total = data.total || 0;

      // 过滤缩略图文件（不在文件管理界面显示）
      filesData = filesData.filter((f: any) => {
        // 过滤以 thumb_ 开头的文件
        if (!f.isFolder && f.name && f.name.startsWith('thumb_')) {
          return false;
        }
        // 过滤视频缩略图文件（以 _thumbnail 结尾的文件）
        if (!f.isFolder && f.name && f.name.includes('_thumbnail.')) {
          return false;
        }
        return true;
      });

      if (currentPath === '/' && filesData.length > 0) {
        // virtualFolders: id为负数的文件夹
        const virtualFolders = filesData.filter((f:any) => f.isFolder && f.id < 0);
        const dbItems = filesData.filter((f:any) => !(f.isFolder && f.id < 0));
        // 只对dbItems分页，virtualFolders始终显示在第一页
        if (currentPage === 1) {
          filesData = [...virtualFolders, ...dbItems];
        } else {
          filesData = dbItems;
        }
        total = total - virtualFolders.length;
      }
      setFiles(filesData);
      setTotalItems(total);
      setIsLoading(false);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('文件加载错误:', error);
      setIsLoading(false);
      let errorMessage = '';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = String(error);
      }
      setErrorMessage(errorMessage || t('files.load_error', { error: 'Unknown error' }));
    }
  };

  // 关闭错误消息对话框
  const closeErrorDialog = () => {
    setErrorMessage(null);
  };

  // 初始加载和依赖变更时重新加载
  useEffect(() => {
    // 进入界面自动同步R2
    const syncR2 = async () => {
      try {
        await fetch(`${endpoint}/files/r2sync`, {
          method: 'POST',
          headers: headersWithAuth(),
        });
      } catch (e) {}
    };
    syncR2();
    const fetchData = async () => {
      await loadFiles();
    };
    fetchData();
    // 在组件卸载时取消未完成的请求
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // 明确列出依赖项
  }, [currentPath, search, sortBy, sortOrder, currentPage, itemsPerPage]);

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
        loadFiles();
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
                console.log('用户取消上传');
              }
            );
          }
        },
        (overallProgress) => {
          setUploadingPercent(overallProgress);
          // 更新总体进度通知
          if (fileArray.length > 1) {
            notification.batchProgress(
              '文件上传',
              Math.floor((overallProgress / 100) * fileArray.length),
              fileArray.length
            );
          }
        }
      );

      notification.success(t('files.upload_success'));
      loadFiles(); // 刷新文件列表
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
    setTimeout(() => {
      setUploadingFiles([]);
      setUploadingIndex(0);
      setUploadingPercent(0);
      setUploadError(null);
      // 清理进度通知
      if (uploadToastId) {
        notification.removeToast(uploadToastId);
      }
    }, 1200);

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
                  loadFiles(true);
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
            loadFiles(true);
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
              label: '查看详情',
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
        loadFiles(true); // 同步后自动刷新
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
        loadFiles();
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
          loadFiles(true); // 批量删除后自动刷新
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
    loadFiles();
    if (!hasError) {
      showToast(t('files.move_success', { defaultValue: '移动成功' }), 'success');
    }
  };

  // 使用统一的键盘事件处理和body锁定 - 移动弹窗
  useModalKeyboard(showMoveDialog, () => setShowMoveDialog(false), confirmBatchMove, moving);
  useModalBodyLock(showMoveDialog);

  // 使用统一的键盘事件处理和body锁定 - 重命名弹窗
  useModalKeyboard(showRenameDialog, () => setShowRenameDialog(false), confirmRename);
  useModalBodyLock(showRenameDialog);

  // 使用统一的键盘事件处理和body锁定 - 其他弹窗
  useModalBodyLock(showNewFolderDialog);
  useModalBodyLock(!!errorMessage);
  useModalBodyLock(refDialogOpen);
  useModalBodyLock(syncDetailOpen);

  // 拖拽上传事件处理
  const handleDragEnter = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDragOver = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDragLeave = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const handleDrop = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
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

  // 渲染网格视图
  const renderGridView = () => {
    // 文件夹优先，文件后面
    const folders = files.filter(file => file.isFolder);
    const normalFiles = files.filter(file => !file.isFolder);
    const displayFiles = [...folders, ...normalFiles];
    // 优化卡片布局和交互
    return (
      <div className="grid gap-x-6 gap-y-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 p-4">
        {displayFiles.map(file => (
          <div
            key={file.id}
            className={`group relative flex flex-col items-center p-4 rounded-xl border bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-enhanced hover:shadow-enhanced-lg hover:-translate-y-1 transition-all duration-300 ${selectedFiles.some(f => f.id === file.id) ? 'border-theme ring-2 ring-theme/30 bg-pink-50/80 dark:bg-pink-900/20' : 'border-neutral-200/60 dark:border-neutral-700/60'}`}
            style={{ minWidth: 0 }}
            onClick={() => handleFileClick(file)}
          >
            {/* 文件图标/缩略图，大小统一 */}
            <div className="w-24 h-24 relative flex items-center justify-center mb-2"
              onClick={isPreviewable(file) ? (e) => { e.stopPropagation(); handlePreviewClick(file); } : undefined}
              style={{ cursor: isPreviewable(file) ? 'pointer' : 'default' }}
            >
              {file.thumbnailHash && !file.isFolder && file.thumbUrl ? (
                <img
                  src={file.thumbUrl}
                  alt={file.name}
                  loading="lazy"
                  className="w-24 h-24 object-cover rounded shadow border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <FileTypeSvgIcon type={file.mimeType || file.name} className="w-24 h-24" />
              )}
            </div>
            {/* 文件名，省略并加tooltip */}
            <p className="mt-2 text-sm truncate w-full text-center" title={file.name}>
              <span className="truncate">
                {file.name && !/^[a-f0-9]{32,}$/.test(file.name)
                  ? file.name
                  : (/^[a-f0-9]{32,}$/.test(file.name) ? (file.name + '（' + t('files.no_original_name', { defaultValue: '无原始名' }) + '）') : file.name)}
              </span>
            </p>
            {/* 文件大小/类型 */}
            <p className="text-xs text-gray-500 mt-1 mb-2">
              {file.isFolder ? t('files.folder', { defaultValue: '文件夹' }) : formatFileSize(file.size)}
            </p>
            {/* 新增：文件日期显示 */}
            <p className="text-xs text-gray-400 mb-2">
              {file.modifiedAt ? new Date(file.modifiedAt * 1000).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''}
            </p>
            {/* 操作按钮区，悬浮显示，半透明背景 */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-1 shadow-enhanced z-10">
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
              {/* 重命名按钮 */}
              <button 
                className="text-blue-500 hover:text-blue-700 p-1"
                title={t('edit')}
                onClick={e => {e.stopPropagation(); handleRenameFile(file);}}
              >
                <i className="ri-edit-2-line"></i>
              </button>
              {/* 删除按钮 */}
              <button 
                className="text-red-500 hover:text-red-700 p-1"
                onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                title={t('delete')}
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
            </div>
            {/* 引用计数按钮，固定右下角绝对定位，不占主内容空间 */}
            {!file.isFolder && (
              <span
                className={`text-xs rounded px-2 py-0.5 flex items-center gap-1
                  ${file.referencesCount > 0
                    ? 'text-blue-500 bg-gray-100 dark:bg-gray-800'
                    : 'text-gray-400 bg-gray-100 dark:bg-gray-800'}`}
                title={file.referencesCount > 0 ? t('files.references') : t('files.ref_none')}
                style={{ minWidth: 24, justifyContent: 'center', cursor: file.referencesCount > 0 ? 'pointer' : 'default', position: 'absolute', right: 12, bottom: 12, zIndex: 20 }}
                onClick={file.referencesCount > 0 ? (e) => { e.stopPropagation(); handleShowReferences(file); } : undefined}
              >
                <i className={file.referencesCount > 0 ? 'ri-link' : 'ri-link-unlink'} />
                {file.referencesCount > 0 && file.referencesCount}
              </span>
            )}
          </div>
        ))}
        {displayFiles.length === 0 && !isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center py-10">
            <i className="ri-inbox-line text-4xl text-gray-400"></i>
            <p className="mt-2 text-gray-500">{t('files.empty')}</p>
          </div>
        )}
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
          <thead className="bg-gray-50 dark:bg-gray-800">
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
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
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
                  {file.thumbnailHash && !file.isFolder && file.thumbUrl ? (
                    <img
                      src={file.thumbUrl}
                      alt={file.name}
                      loading="lazy"
                      className="w-8 h-8 object-cover rounded shadow border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mr-2"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <FileTypeSvgIcon type={file.mimeType || file.name} className="w-24 h-24" />
                  )}
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
                    title={t('delete')}
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

  // 渲染面包屑
  const renderBreadcrumbs = () => {
    return (
      <div className="flex items-center w-full text-base mb-0 min-h-[40px]">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center">
            {index > 0 && <i className="ri-arrow-right-s-line mx-1 text-gray-400 text-base"></i>}
            <button
              onClick={() => {
                setCurrentPath(crumb.path);
                setCurrentPage(1);
                setSelectedFiles([]);
              }}
              className={`px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                index === breadcrumbs.length - 1 ? 'font-medium text-theme' : 'text-gray-600 dark:text-gray-300'
              } text-base`}
              style={{ minWidth: 40 }}
            >
              {index === 0 ? <i className="ri-home-line mr-1"></i> : null}
              {crumb.name}
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

  useEffect(() => {
    const handler = () => loadFiles(true);
    window.addEventListener('file-upload-success', handler);
    return () => window.removeEventListener('file-upload-success', handler);
  }, [currentPath, search, sortBy, sortOrder, itemsPerPage]);

  return (
    <div
      className={
        "relative bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60 w-full" +
        (dragActive ? " ring-4 ring-pink-400/60 ring-inset" : "")
      }
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
      {dragActive && (
        <div className="absolute inset-0 z-[12000] bg-black/30 flex items-center justify-center pointer-events-none select-none rounded-lg">
          <div className="text-2xl text-white font-bold drop-shadow-lg animate-pulse">
            {t('files.drag_to_upload', { defaultValue: '松开上传文件' })}
          </div>
        </div>
      )}
      {/* 工具栏 */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-2 flex flex-col sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0 space-y-2">
        {/* 左侧：面包屑+搜索框 */}
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <div className="flex-shrink-0 min-w-0">{renderBreadcrumbs()}</div>
          <div className="relative w-full min-w-[120px] max-w-xs flex-shrink flex-grow">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('files.search_placeholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent text-sm transition-all min-w-[120px] max-w-full sm:max-w-xs"
              style={{ minWidth: 0 }}
            />
          </div>
        </div>
        {/* 右侧：每页数量+按钮组，整体右对齐 */}
        <div className="flex flex-row flex-wrap items-center gap-2 justify-end min-w-0">
          <div className="flex items-center h-10 gap-2">
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="h-10 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[70px] align-middle"
              style={{ minWidth: 70, maxWidth: 100 }}
              title={t('files.page_size') || '每页数量'}
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt + t('files.per_page', { defaultValue: '/页' })}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-row flex-wrap gap-2 min-w-0">
            {/* 视图切换按钮 */}
            <div className="flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-enhanced transition-all duration-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 h-10 transition-all duration-200 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                title={t('files.grid_view')}
              >
                <i className="ri-grid-line"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 h-10 transition-all duration-200 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                title={t('files.list_view')}
              >
                <i className="ri-list-check"></i>
              </button>
            </div>
            {/* 单/多选模式切换按钮（仅icon） */}
            <IconButton
              icon={`ri-checkbox-${multipleState ? 'multiple' : 'blank'}-line`}
              onClick={() => setMultiple(m => !m)}
              title={multipleState ? t('files.single_select') : t('files.multi_select')}
              variant="secondary"
            />
            {/* 新建文件夹按钮 */}
            <IconButton
              icon="ri-folder-add-line"
              onClick={() => setShowNewFolderDialog(true)}
              title={t('files.new_folder')}
              variant="secondary"
            />
            {/* 上传文件按钮 */}
            <div className="relative">
              <IconButton
                icon="ri-upload-2-line"
                onClick={() => uploadInputRef.current?.click()}
                title={t('files.upload')}
                variant="secondary"
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
            {/* 全量同步R2按钮（仅icon） */}
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
                        loadFiles(true);
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
              disabled={isSyncing}
            />
          </div>
        </div>
      </div>

      {/* 文件列表主体 */}
      <div className="min-h-[60vh]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loading size="large" />
          </div>
        ) : (
          <div>
            {viewMode === 'grid' ? renderGridView() : renderListView()}
          </div>
        )}
      </div>
      {/* 分页：仅当总数大于每页数量时显示，统一用Pagination组件 */}
      {totalItems > itemsPerPage && (
        <div className="border-t border-gray-200 dark:border-gray-700 py-2 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / itemsPerPage)}
            onPageChange={page => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="items-center"
          />
        </div>
      )}
      
      {/* 选择操作栏 - 多选模式 */}
      {showSelector && multipleState && selectedFiles.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between gap-2">
          <div className="text-sm">
            {selectedFiles.length > 0 ? t('files.selected', { count: selectedFiles.length }) : ''}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleBatchDownload} title={t('files.download') + (selectedFiles.length > 1 ? t('files.batch') : '')} />
            <Button onClick={handleBatchDelete} title={t('files.delete') + (selectedFiles.length > 1 ? t('files.batch') : '')} />
            <Button onClick={handleBatchMove} title={t('files.move') + (selectedFiles.length > 1 ? t('files.batch') : '')} />
          <Button onClick={handleConfirmSelection} title={t('files.confirm_selection')} />
          </div>
        </div>
      )}
      
      {/* 新建文件夹对话框 */}
      {showNewFolderDialog && createPortal(
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ zIndex: MODAL_Z_INDEX.NESTED_DIALOG }}
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
        </div>,
        document.body
      )}
      
      {/* 错误信息对话框 */}
      {errorMessage && createPortal(
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ zIndex: MODAL_Z_INDEX.CRITICAL }}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium text-red-600 mb-4">{t('alert')}</h3>
            <p className="mb-6">{t('files.load_error', { error: errorMessage })}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => loadFiles(true)} title={t('reload')} />
              <Button onClick={closeErrorDialog} title={t('close')} secondary />
              <Button onClick={() => { closeErrorDialog(); window.location.href = '/'; }} title={t('index.back')} secondary />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 引用详情弹窗 */}
      {refDialogOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ zIndex: MODAL_Z_INDEX.NESTED_DIALOG }}
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
        </div>,
        document.body
      )}

      {/* 移动弹窗 */}
      {showMoveDialog && createPortal(
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ zIndex: MODAL_Z_INDEX.NESTED_DIALOG }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMoveDialog(false);
            }
          }}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">{t('files.move_to')}</h3>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent mb-4"
              placeholder={t('files.target_folder')}
              value={moveTargetPath}
              onChange={e => setMoveTargetPath(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button onClick={() => setShowMoveDialog(false)} title={t('cancel')} secondary />
              <Button onClick={confirmBatchMove} title={moving ? t('files.moving') : t('files.move')} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 重命名弹窗 */}
      {showRenameDialog && createPortal(
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ zIndex: MODAL_Z_INDEX.NESTED_DIALOG }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRenameDialog(false);
            }
          }}
        >
          <div className={`${MODAL_CONTAINER_CLASSES.standard} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">{t('files.rename_prompt') || '请输入新文件名'}</h3>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent mb-4"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button onClick={() => setShowRenameDialog(false)} title={t('cancel')} secondary />
              <Button onClick={confirmRename} title={t('confirm')} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* R2同步结果弹窗 */}
      {syncDetailOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          style={{ zIndex: MODAL_Z_INDEX.NESTED_DIALOG }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSyncDetailOpen(false);
            }
          }}
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
        </div>,
        document.body
      )}

      {/* 图片预览弹窗 */}
      {previewOpen && createPortal(
        <FilePreview files={previewableFiles} current={previewIndex} onClose={() => setPreviewOpen(false)} />,
        document.body
      )}

      <ConfirmUI />
    </div>
  );
} 