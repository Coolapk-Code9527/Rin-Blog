import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { client, endpoint } from '../../main';
import { headersWithAuth } from '../../utils/auth';
import { formatFileSize, getFileTypeIcon } from './utils';
import ReactLoading from "react-loading";
import { ShowAlertType } from '../../hooks/useAlert';

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

// 文件管理器组件
export function FileManager({
  onSelect,
  multiple = false,
  allowedTypes,
  showSelector = true
}: {
  onSelect?: (files: FileItem | FileItem[]) => void;
  multiple?: boolean;
  allowedTypes?: string[];
  showSelector?: boolean;
}) {
  const { t } = useTranslation();
  
  // 创建自己的简易alert函数作为替代
  const showAlert: ShowAlertType = (msg, onConfirm) => {
    alert(msg);
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
  const [itemsPerPage] = useState<number>(20);
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

  // 加载文件列表
  const loadFiles = async (reload = false) => {
    try {
      // 如果有之前的请求，取消它
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // 创建新的AbortController
      abortControllerRef.current = new AbortController();
      
      if (reload) {
        setFiles([]);
      }
      setIsLoading(true);
      setErrorMessage(null);

      // 构建查询参数
      const params = new URLSearchParams();
      params.append('path', currentPath);
      if (search) params.append('search', search);
      params.append('sort', sortBy);
      params.append('order', sortOrder);
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));

      // 获取授权头
      const authHeaders = headersWithAuth();

      // 发起请求并添加授权头和signal
      const response = await fetch(`${endpoint}/files?${params.toString()}`, {
        headers: authHeaders,
        signal: abortControllerRef.current.signal
      });
      
      // 检查响应状态码
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
          alert(t('login.required'));
          window.location.href = '/login';
          return;
        }
        throw new Error(errorText);
      }

      const data = await response.json();
      setFiles(data.files || []);
      setTotalItems(data.total || 0);
      setIsLoading(false);
    } catch (error: any) {
      // 检查是否是AbortError，如果是则忽略
      if (error.name === 'AbortError') {
        // 这是正常的取消请求，不是错误，不需要处理
        return;
      }
      
      console.error('文件加载错误:', error);
      setIsLoading(false);
      // 确保错误信息是字符串
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
      showAlert(t('files.no_selection'));
      return;
    }

    if (multiple) {
      onSelect?.(selectedFiles);
    } else {
      onSelect?.(selectedFiles[0]);
    }
  };

  // 创建文件夹处理
  const handleCreateFolder = async () => {
    const folderName = folderNameInputRef.current?.value;
    
    if (!folderName || folderName.trim() === '') {
      showAlert(t('files.folder_name_required'));
      return;
    }

    try {
      const response = await client.files.folder.post({
        name: folderName.trim(),
        parentPath: currentPath
      }, {
        headers: headersWithAuth()
      });

      if (response.error) {
        showAlert(t('files.folder_create_error', { error: response.error.value }));
      } else {
        setShowNewFolderDialog(false);
        loadFiles();
      }
    } catch (error: any) {
      showAlert(t('files.folder_create_error', { error: error.message }));
    }
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(prevProgress => Math.round((i / files.length) * 100));

      try {
        const response = await client.files.index.post({
          file,
          name: file.name,
          parentPath: currentPath
        }, {
          headers: headersWithAuth()
        });

        if (response.error) {
          showAlert(t('upload.failed', { error: response.error.value }));
        }
      } catch (error: any) {
        showAlert(t('upload.failed', { error: error.message }));
      }
    }

    // 完成上传
    setIsUploading(false);
    setUploadProgress(100);
    
    // 重置文件输入
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
    
    // 重新加载文件列表
    loadFiles();
  };

  // 删除文件处理
  const handleDeleteFile = async (file: FileItem) => {
    if (!confirm(t('files.confirm_delete', { name: file.name }))) {
      return;
    }

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
          if (window.confirm(t('files.delete_error', { error: data.error }) + '\n' + t('files.ref_detail') + '\n' + refData.references.map((r:any) => `${r.title || t('files.ref_no_title')}`).join('\n') + '\n' + t('files.force_delete_confirm'))) {
            // 用户确认强制删除，再次发起删除
            const forceRes = await fetch(`${endpoint}/files/${file.id}`, {
              method: 'DELETE',
              headers: headersWithAuth(),
            });
            const forceData = await forceRes.json();
            if (!forceRes.ok || forceData.error) {
              showAlert(t('files.delete_error', { error: forceData.error || forceRes.status }));
            } else {
              setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
              loadFiles();
            }
          }
        } else {
          showAlert(t('files.delete_error', { error: data.error }));
        }
      } else if (!res.ok || data.error) {
        showAlert(t('files.delete_error', { error: data.error || res.status }));
      } else {
        setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
        loadFiles();
      }
    } catch (error: any) {
      showAlert(t('files.delete_error', { error: error.message }));
    }
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
        }
        loadFiles(true);
      } else {
        setSyncResult(t('files.sync_failed', { error: data.error || res.status }));
      }
    } catch (e: any) {
      setSyncResult(t('files.sync_failed', { error: e.message }));
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

  // 渲染网格视图
  const renderGridView = () => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
        {files.map(file => (
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
            <p className="mt-2 text-sm truncate w-full text-center">{file.name}</p>
            
            {/* 文件大小 */}
            <p className="text-xs text-gray-500 mt-1">
              {file.isFolder ? '' : formatFileSize(file.size)}
            </p>
            
            {/* 引用计数按钮 */}
            {!file.isFolder && (
              <button
                className="absolute bottom-1 right-1 text-xs text-blue-500 hover:underline bg-white/80 dark:bg-gray-900/80 rounded px-2 py-0.5"
                onClick={e => { e.stopPropagation(); handleShowReferences(file); }}
                title={t('files.references')}
              >
                {file.references ? file.references.length : '-'} {t('files.ref_count')}
              </button>
            )}
            
            {/* 删除按钮 */}
            <button 
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-1"
              onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
              title={t('delete')}
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        ))}
        
        {files.length === 0 && !isLoading && (
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
              <th scope="col" className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {files.map(file => (
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
                      onChange={(e) => {
                        e.stopPropagation();
                        handleFileClick(file);
                      }}
                      className="rounded border-gray-300 text-theme focus:ring-theme"
                    />
                  </td>
                )}
                <td className="px-4 py-3 flex items-center">
                  <i className={`ri-${file.isFolder ? 'folder-fill text-yellow-500' : getFileTypeIcon(file.mimeType)} mr-2 text-xl`}></i>
                  <span className="truncate">{file.name}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {file.isFolder ? '-' : formatFileSize(file.size)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(file.modifiedAt * 1000).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <button 
                    className="text-blue-500 hover:underline text-xs mr-2"
                    onClick={e => { e.stopPropagation(); handleShowReferences(file); }}
                    title={t('files.references')}
                  >
                    {file.references ? file.references.length : '-'} {t('files.ref_count')}
                  </button>
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
            {files.length === 0 && !isLoading && (
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
      <div className="flex flex-wrap items-center text-sm mb-4">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center">
            {index > 0 && <i className="ri-arrow-right-s-line mx-1 text-gray-400"></i>}
            <button
              onClick={() => {
                setCurrentPath(crumb.path);
                setCurrentPage(1);
                setSelectedFiles([]);
              }}
              className={`px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                index === breadcrumbs.length - 1 ? 'font-medium text-theme' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {index === 0 ? <i className="ri-home-line mr-1"></i> : null}
              {crumb.name}
            </button>
          </div>
        ))}
      </div>
    );
  };

  // 渲染分页
  const renderPagination = () => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return totalPages > 1 ? (
      <div className="flex items-center justify-center mt-4 space-x-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
        >
          <i className="ri-arrow-left-s-line"></i>
        </button>
        
        <span className="text-sm">
          {currentPage} / {totalPages}
        </span>
        
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
        >
          <i className="ri-arrow-right-s-line"></i>
        </button>
      </div>
    ) : null;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 w-full">
      {/* 工具栏 */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex flex-col space-y-4">
        {/* 面包屑导航 */}
        {renderBreadcrumbs()}
        
        {/* 搜索和操作按钮 */}
        <div className="flex flex-wrap gap-2 justify-between">
          <div className="flex flex-1 max-w-md">
            <div className="relative w-full">
              <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('files.search_placeholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex space-x-2">
            {/* 视图切换按钮 */}
            <div className="flex rounded-md border border-gray-300 dark:border-gray-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                title={t('files.grid_view')}
              >
                <i className="ri-grid-line"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                title={t('files.list_view')}
              >
                <i className="ri-list-check"></i>
              </button>
            </div>

            {/* 新建文件夹按钮 */}
            <button
              onClick={() => setShowNewFolderDialog(true)}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={t('files.new_folder')}
            >
              <i className="ri-folder-add-line"></i>
            </button>

            {/* 上传文件按钮 */}
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={t('files.upload')}
              disabled={isUploading}
            >
              {isUploading ? <Loading type="spin" height={16} width={16} /> : <i className="ri-upload-2-line"></i>}
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept={allowedTypes ? allowedTypes.map(type => type + '/*').join(',') : undefined}
              />
            </button>

            {/* 数据同步按钮 */}
            <Button onClick={handleSyncFiles} title={isSyncing ? t('files.syncing') : t('files.sync')} secondary={true} />
            {/* 合并同步结果与失败详情弹窗 */}
            {(syncResult || syncDetailOpen) && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full shadow-2xl">
                  <h3 className={`text-lg font-medium mb-4 ${syncDetailList.length > 0 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>{syncDetailList.length > 0 ? t('files.sync_failed') : t('files.sync_result')}</h3>
                  <div className="mb-4 text-sm whitespace-pre-wrap break-all">{syncResult}</div>
                  {syncDetailList.length > 0 && (
                    <div className="max-h-80 overflow-y-auto text-xs mb-4">
                      {syncDetailList.map((d, i) => (
                        <details key={i} className="mb-2">
                          <summary className="cursor-pointer text-theme">文章ID: {d.feedId} UID: {d.uid}</summary>
                          <div className="mt-1 whitespace-pre-wrap break-all">
                            <b>内容片段:</b> {d.contentSnippet}
                            <br /><b>错误:</b> {d.error}
                            {d.stack && <><br /><b>堆栈:</b> {d.stack}</>}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end mt-6 gap-2">
                    <button onClick={() => {
                      const text = syncDetailList.length > 0
                        ? syncDetailList.map(d => `文章ID:${d.feedId} UID:${d.uid}\n内容:${d.contentSnippet}\n错误:${d.error}\n${d.stack ? '堆栈:' + d.stack : ''}`).join('\n---\n')
                        : syncResult;
                      navigator.clipboard.writeText(text as string);
                    }} className="px-4 py-2 bg-theme text-white rounded-md">{t('copy')}</button>
                    <button onClick={() => { setSyncResult(null); setSyncDetailOpen(false); }} className="px-4 py-2 bg-gray-500 text-white rounded-md">{t('close')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 上传进度条 */}
        {isUploading && (
          <div className="w-full mt-2">
            <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-theme rounded-full transition-all duration-300 ease-in-out" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 文件列表主体 */}
      <div className="min-h-[300px]">
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
      
      {/* 分页 */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        {renderPagination()}
      </div>
      
      {/* 选择操作栏 - 多选模式 */}
      {showSelector && multiple && selectedFiles.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="text-sm">
            {t('files.selected', { count: selectedFiles.length })}
          </div>
          <Button onClick={handleConfirmSelection} title={t('files.confirm_selection')} />
        </div>
      )}
      
      {/* 新建文件夹对话框 */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-medium mb-4">{t('files.create_folder')}</h3>
            <input
              ref={folderNameInputRef}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-theme focus:border-transparent mb-4"
              placeholder={t('files.folder_name')}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNewFolderDialog(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {t('cancel')}
              </button>
              <Button onClick={handleCreateFolder} title={t('create')} />
            </div>
          </div>
        </div>
      )}
      
      {/* 错误信息对话框 */}
      {errorMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-medium text-red-600 mb-4">{t('alert')}</h3>
            <p className="mb-6">{t('files.load_error', { error: errorMessage })}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => loadFiles(true)}
                className="px-4 py-2 bg-theme hover:bg-theme-hover text-white rounded-md transition-colors"
              >
                {t('reload')}
              </button>
              <button
                onClick={closeErrorDialog}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
              >
                {t('close')}
              </button>
              <button
                onClick={() => {
                  closeErrorDialog();
                  window.location.href = '/'; // 添加返回主页选项
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                {t('index.back')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 引用详情弹窗 */}
      {refDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
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
                    <span className="ml-2 text-xs text-gray-400">[{ref.type}]</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-6">
              <button onClick={() => setRefDialogOpen(false)} className="px-4 py-2 bg-theme text-white rounded-md">{t('close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 