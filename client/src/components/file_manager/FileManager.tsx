import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { client, endpoint } from '../../main';
import { headersWithAuth } from '../../utils/auth';
import { formatFileSize, getFileTypeIcon } from './utils';
import ReactLoading from "react-loading";
import { ShowAlertType } from '../../hooks/useAlert';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Pagination } from '../pagination';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../dialog';

// 导入FileItem类型
import type { FileItem } from '../../types/api';

// 使用ReactLoading作为Loading组件
const Loading = ({ type, height, width, color = "#FC466B" }: { type: any, height: number, width: number, color?: string }) => (
  <ReactLoading type={type} height={height} width={height} color={color} />
);

// Button组件
const Button = ({ onClick, title, secondary = false }: { onClick: () => void, title: string, secondary?: boolean }) => (
  <button 
    onClick={onClick} 
    className={`${secondary ? "bg-secondary t-primary bg-button" : "bg-theme text-white active:bg-theme-active hover:bg-theme-hover"} text-nowrap rounded-full px-4 py-2 h-min space-x-2 flex flex-row items-center`}
  >
    <span>{title}</span>
  </button>
);

// 获取S3访问域名（优先window全局变量，其次后端接口/配置）
let S3_ACCESS_HOST = '';
if (typeof window !== 'undefined' && (window as any).S3_ACCESS_HOST) {
  S3_ACCESS_HOST = (window as any).S3_ACCESS_HOST;
} else if (typeof S3_ACCESS_HOST !== 'undefined' && S3_ACCESS_HOST) {
  // 构建时注入的全局变量
  S3_ACCESS_HOST = S3_ACCESS_HOST;
} else {
  // 可选：后端接口动态获取，或兜底为空
  S3_ACCESS_HOST = '';
}

// 文件展示时拼接完整URL
function getFileUrl(path: string) {
  if (!path) return '';
  if (!S3_ACCESS_HOST) return path; // 若未配置则返回原始路径
  return S3_ACCESS_HOST.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

// 文件管理器组件
export function FileManager({
  onSelect,
  allowedTypes,
  showSelector = true
}: {
  onSelect?: (files: FileItem | FileItem[]) => void;
  allowedTypes?: string[];
  showSelector?: boolean;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { showConfirm, ConfirmUI } = useConfirm();
  
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
  const [multiple, setMultiple] = useState(true);

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

  // 加载文件列表
  const loadFiles = async (reload = false) => {
    try {
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

  // 处理文件选择
  const handleFileClick = (file: FileItem) => {
    if (isLoading) return; // 如果正在加载，忽略点击事件

    if (file.isFolder) {
      // 导航到文件夹
      setCurrentPath(file.path);
      setCurrentPage(1);
      setSelectedFiles([]);
    } else if (showSelector) {
      if (multiple) {
        // 在多选模式下切换选择状态
        setSelectedFiles(prev => {
          const exists = prev.some(f => f.id === file.id);
          return exists 
            ? prev.filter(f => f.id !== file.id)
            : [...prev, file];
        });
      } else {
        // 单选模式直接选择文件
        setSelectedFiles([file]);
        onSelect?.(file);
      }
    }
  };

  // 处理确认选择
  const handleConfirmSelection = () => {
    if (selectedFiles.length === 0) {
      showToast(t('files.no_selection'), 'info');
      return;
    }

    if (multiple) {
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
    const virtualFolders = ["/images", "/cache"];
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

  // 处理文件上传
  const handleFileUpload = async (event: any) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploadingFiles(Array.from(files));
    setUploadingIndex(0);
    setUploadingPercent(0);
    setUploading(true);
    setUploadError(null);
    for (let i = 0; i < files.length; i++) {
      setUploadingIndex(i + 1);
      setUploadingPercent(Math.round(((i) / files.length) * 100));
      const file = files[i];
      try {
        const response = await client.files.index.post({
          file,
          name: file.name,
          parentPath: currentPath || '/'
        }, {
          headers: headersWithAuth()
        });
        if (response.error) {
          let msg = '';
          if (typeof response.error === 'object') {
            if ('message' in response.error && typeof (response.error as any).message === 'string') {
              msg = (response.error as any).message;
            } else if ('value' in response.error) {
              if (typeof (response.error as any).value === 'string') {
                msg = (response.error as any).value;
              } else if (typeof (response.error as any).value === 'object' && (response.error as any).value !== null) {
                const val = (response.error as any).value;
                msg = typeof val.message === 'string' ? val.message : JSON.stringify(val);
              } else {
                msg = JSON.stringify((response.error as any).value);
              }
            } else {
              msg = JSON.stringify(response.error);
            }
          } else {
            msg = response.error;
          }
          setUploadError(msg);
          showToast(msg, 'error');
          continue;
        } else if ((response as any).reusedMsg) {
          showToast((response as any).reusedMsg, 'info');
        } else {
          showToast(t('files.upload_success'), 'info');
        }
        loadFiles();
      } catch (error: any) {
        setUploadError(error.message);
        showToast(t('files.upload_failed', { error: error.message }), 'error');
      }
    }
    setUploadingPercent(100);
    setUploading(false);
    setTimeout(() => {
      setUploadingFiles([]);
      setUploadingIndex(0);
      setUploadingPercent(0);
      setUploadError(null);
    }, 1200);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  // 删除文件处理
  const handleDeleteFile = async (file: FileItem) => {
    // 禁止删除虚拟一级目录
    const virtualFolders = ["/images", "/cache"];
    if (virtualFolders.includes(file.path)) {
      showToast(t('delete_error', { error: t('files.delete_error') + ' (不能删除系统目录)' }), 'error');
      return;
    }
    showConfirm(
      t('files.confirm_delete', { name: file.name }),
      '',
      async () => {
    try {
      // 直接用fetch发送DELETE请求，确保header带上
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
              loadFiles();
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
        loadFiles();
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
    try {
      const res = await fetch(`${endpoint}/files/sync`, {
        method: 'POST',
        headers: headersWithAuth(),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(t('files.sync_success', { total: data.total, success: data.success, failed: data.failed }));
        if (data.failedDetails && data.failedDetails.length > 0) {
          setSyncDetailList(data.failedDetails);
          setSyncDetailOpen(true);
        } else {
          setSyncDetailOpen(true);
        }
        loadFiles(true); // 同步后自动刷新
      } else {
        setSyncResult(t('files.sync_failed', { error: data.error || res.status }));
        setSyncDetailOpen(true);
      }
    } catch (e: any) {
      setSyncResult(t('files.sync_failed', { error: e.message }));
      setSyncDetailOpen(true);
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
      showToast(t('files.download_folder_not_supported') || '暂不支持直接下载整个文件夹', 'info');
      return;
    }
    try {
      const url = file.url || getFileUrl(file.path);
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
        const url = file.url || getFileUrl(file.path);
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
    loadFiles();
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

  // 渲染网格视图
  const renderGridView = () => {
    // 文件夹优先，文件后面
    const folders = files.filter(file => file.isFolder);
    const normalFiles = files.filter(file => !file.isFolder);
    const displayFiles = [...folders, ...normalFiles];
    // 分页：只显示当前页的数据
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pagedFiles = displayFiles.slice(startIdx, endIdx);
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
        {pagedFiles.map(file => (
          <div 
            key={file.id}
            className={`p-3 rounded-lg border ${selectedFiles.some(f => f.id === file.id) ? 'border-theme bg-pink-50 dark:bg-pink-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'} 
            cursor-pointer transition-colors flex flex-col items-center relative group`}
            onClick={() => handleFileClick(file)}
          >
            {/* 文件图标 */}
            <div className="w-16 h-16 flex items-center justify-center">
              <i className={`ri-${file.isFolder ? 'folder-fill text-yellow-500' : getFileTypeIcon(file.mimeType)} text-4xl`}></i>
            </div>
            {/* 文件名 */}
            <p className={`mt-2 text-sm truncate w-full text-center ${/^[a-f0-9]{16,}$/.test(file.name) ? 'text-gray-400 italic' : ''}`}>
              {/^[a-f0-9]{32,}$/.test(file.name)
                ? `${file.name}（无原始名）`
                : file.name}
            </p>
            {/* 操作按钮区 */}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            </div>
            {/* 文件大小 */}
            <p className="text-xs text-gray-500 mt-1">
              {file.isFolder ? '' : formatFileSize(file.size)}
            </p>
            {/* 引用计数按钮 */}
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
          </div>
        ))}
        {pagedFiles.length === 0 && !isLoading && (
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
    // 分页：只显示当前页的数据
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pagedFiles = displayFiles.slice(startIdx, endIdx);
    return (
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {showSelector && multiple && (
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
            {pagedFiles.map(file => (
              <tr 
                key={file.id}
                className={`${selectedFiles.some(f => f.id === file.id) ? 'bg-pink-50 dark:bg-pink-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} cursor-pointer transition-colors`}
                onClick={() => handleFileClick(file)}
              >
                {showSelector && multiple && (
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
                <td className="px-4 py-3 flex items-center">
                  <i className={`ri-${file.isFolder ? 'folder-fill text-yellow-500' : getFileTypeIcon(file.mimeType)} mr-2 text-xl`}></i>
                  <span className="truncate">
                    {/^[a-f0-9]{32,}$/.test(file.name)
                      ? `${file.name}（无原始名）`
                      : file.name}
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
                </td>
              </tr>
            ))}
            {pagedFiles.length === 0 && !isLoading && (
              <tr>
                <td colSpan={showSelector && multiple ? 5 : 4} className="py-8 text-center">
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

  useEffect(() => {
    const hasModal = showNewFolderDialog || errorMessage || refDialogOpen || showMoveDialog;
    if (hasModal) {
      document.body.classList.add('modal-open');
      window.dispatchEvent(new Event('modal-toggle'));
    } else {
      document.body.classList.remove('modal-open');
      window.dispatchEvent(new Event('modal-toggle'));
    }
    return () => {
      document.body.classList.remove('modal-open');
      window.dispatchEvent(new Event('modal-toggle'));
    };
  }, [showNewFolderDialog, errorMessage, refDialogOpen, showMoveDialog]);

  return (
    <div
      className={
        "relative bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 w-full" +
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
          <div className="flex items-center h-10">
          <select
            value={itemsPerPage}
            onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="h-10 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[70px] flex items-center"
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
            <div className="flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 h-10 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                title={t('files.grid_view')}
              >
                <i className="ri-grid-line"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 h-10 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                title={t('files.list_view')}
              >
                <i className="ri-list-check"></i>
              </button>
            </div>
            {/* 单/多选模式切换按钮（仅icon） */}
            <button
              onClick={() => setMultiple(m => !m)}
              className="px-3 py-2 h-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={multiple ? t('files.single_select') : t('files.multi_select')}
            >
              <i className={`ri-checkbox-${multiple ? 'multiple' : 'blank'}-line`}></i>
            </button>
            {/* 新建文件夹按钮 */}
            <button
              onClick={() => setShowNewFolderDialog(true)}
              className="px-3 py-2 h-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={t('files.new_folder')}
            >
              <i className="ri-folder-add-line"></i>
            </button>
            {/* 上传文件按钮 */}
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="px-3 py-2 h-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={t('files.upload')}
              disabled={isUploading}
            >
              <i className="ri-upload-2-line"></i>
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept={allowedTypes ? allowedTypes.map(type => type + '/*').join(',') : undefined}
              />
            </button>
            {/* 全量同步R2按钮（仅icon） */}
            <button
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
              className="px-3 py-2 h-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              disabled={isSyncing}
              title={t('files.r2sync')}
            >
              <i className="ri-refresh-line"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 文件列表主体 */}
      <div className="min-h-[60vh]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loading type="spin" height={32} width={32} />
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
      {showSelector && multiple && selectedFiles.length > 0 && (
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
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[11000]">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
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
        </div>
      )}
      
      {/* 错误信息对话框 */}
      {errorMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[11000]">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-medium text-red-600 mb-4">{t('alert')}</h3>
            <p className="mb-6">{t('files.load_error', { error: errorMessage })}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => loadFiles(true)} title={t('reload')} />
              <Button onClick={closeErrorDialog} title={t('close')} secondary />
              <Button onClick={() => { closeErrorDialog(); window.location.href = '/'; }} title={t('index.back')} secondary />
            </div>
          </div>
        </div>
      )}

      {/* 引用详情弹窗 */}
      {refDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[11000]">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
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
        </div>
      )}

      {/* 移动弹窗 */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[11000]">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
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
        </div>
      )}

      {/* 重命名弹窗 */}
      {showRenameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[11000]">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
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
        </div>
      )}

      {/* R2同步结果弹窗 */}
      {syncDetailOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[11000]">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
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
        </div>
      )}
      <ConfirmUI />
    </div>
  );
} 