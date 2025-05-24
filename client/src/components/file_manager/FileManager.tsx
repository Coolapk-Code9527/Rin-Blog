import { client, endpoint } from '../../main';
import { headersWithAuth } from '../../utils/auth';
import { formatFileSize, getFileTypeIcon, syncFiles, importFromRemoteArticles } from './utils';
import ReactLoading from "react-loading";
import { ShowAlertType } from '../../hooks/useAlert';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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
  
  // 同步状态
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [includeExternal, setIncludeExternal] = useState<boolean>(true);
  const [showSyncOptions, setShowSyncOptions] = useState<boolean>(false);
  const [forceRescan, setForceRescan] = useState<boolean>(false);
  
  // 引用
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderNameInputRef = useRef<HTMLInputElement>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // 添加错误状态，用于显示错误信息和控制关闭功能
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 添加请求取消处理
  const abortControllerRef = useRef<AbortController | null>(null);

  // 添加远程导入状态
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [remoteDomain, setRemoteDomain] = useState('');

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
      // 使用fetch直接调用API代替客户端API
      const response = await fetch(`${endpoint}/files/${file.id}`, {
        method: 'DELETE',
        headers: headersWithAuth()
      });

      if (!response.ok) {
        // 尝试解析错误信息
        let errorMsg = 'Error deleting file';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        showAlert(t('files.delete_error', { error: errorMsg }));
        return;
      }

      // 删除成功
        setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
        loadFiles();
    } catch (error: any) {
      console.error('删除文件失败:', error);
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

  // 处理同步
  const handleSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const result = await syncFiles(undefined, includeExternal, forceRescan);
      
      if (result.success) {
        setSuccessMessage(result.message);
        await loadFiles(true); // 刷新文件列表
      } else {
        setErrorMessage(result.message || t('files.sync_error'));
      }
    } catch (error) {
      console.error('同步错误:', error);
      setErrorMessage(t('files.sync_error'));
    } finally {
      setIsSyncing(false);
      setShowSyncOptions(false); // 关闭选项面板
    }
  };

  // 处理远程导入
  const handleImport = async () => {
    if (isImporting || !remoteDomain) return;
    
    setIsImporting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    
    try {
      const result = await importFromRemoteArticles(remoteDomain);
      if (result.success) {
        setSuccessMessage(result.message);
        // 导入成功后重新加载文件列表
        await loadFiles(true);
      } else {
        setErrorMessage(result.message);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '远程导入失败');
    } finally {
      setIsImporting(false);
      setShowImportModal(false);
    }
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

  // 渲染操作工具栏
  const renderOperations = () => {
    return (
      <div className="flex flex-wrap justify-between items-center gap-2 p-2 bg-card rounded-md mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <input 
              type="text" 
              placeholder={t('files.search')} 
              className="border rounded-full px-3 py-1 mr-2 bg-input t-primary placeholder:text-muted" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button 
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="bg-button rounded-full p-2 hover:bg-button-hover"
              title={viewMode === 'list' ? t('files.grid_view') : t('files.list_view')}
            >
              <span>{viewMode === 'list' ? '⊞' : '≡'}</span>
            </button>
          </div>
          
          <div className="relative inline-block">
            <Button onClick={() => setShowSyncOptions(!showSyncOptions)} title={t('files.sync')} />
            
            {showSyncOptions && (
              <div className="absolute z-10 mt-1 bg-card rounded-md shadow-lg p-3 t-primary">
                <div className="flex flex-col gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeExternal}
                      onChange={() => setIncludeExternal(!includeExternal)}
                      className="mr-2"
                    />
                    {t('files.include_external')}
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceRescan}
                      onChange={() => setForceRescan(!forceRescan)}
                      className="mr-2"
                    />
                    {t('files.force_rescan')}
                  </label>
                  <div className="flex justify-end mt-2">
                    <Button onClick={handleSync} title={t('files.start_sync')} />
                  </div>
                  {isSyncing && (
                    <div className="flex justify-center mt-2">
                      <Loading type="spin" height={20} width={20} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button 
            onClick={() => setShowImportModal(true)} 
            title={t('files.import_remote')} 
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => setShowNewFolderDialog(true)} 
            title={t('files.new_folder')} 
          />
          <Button 
            onClick={() => uploadInputRef.current?.click()} 
            title={t('files.upload')} 
          />
          
          {showSelector && selectedFiles.length > 0 && (
            <Button 
              onClick={handleConfirmSelection} 
              title={multiple ? `${t('files.select')} (${selectedFiles.length})` : t('files.select')}
            />
          )}
        </div>
      </div>
    );
  };
  
  // 添加消息提示组件
  const renderMessages = () => {
    return (
      <>
        {errorMessage && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 relative">
            <button 
              onClick={() => setErrorMessage(null)}
              className="absolute top-1 right-1 text-red-500 hover:text-red-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <p>{errorMessage}</p>
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 relative">
            <button 
              onClick={() => setSuccessMessage(null)}
              className="absolute top-1 right-1 text-green-500 hover:text-green-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <p>{successMessage}</p>
          </div>
        )}
      </>
    );
  };

  // 渲染导入模态框
  const renderImportModal = () => {
    if (!showImportModal) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-card rounded-md p-4 w-96 max-w-full">
          <h3 className="text-lg font-bold mb-4 t-primary">{t('files.import_remote')}</h3>
          <div className="mb-4">
            <label className="block t-primary mb-2">{t('files.remote_domain')}</label>
            <input 
              type="text" 
              value={remoteDomain}
              onChange={(e) => setRemoteDomain(e.target.value)}
              placeholder="example.com"
              className="w-full p-2 border rounded-md bg-input t-primary placeholder:text-muted"
            />
            <p className="text-sm mt-1 t-hint">{t('files.remote_domain_hint')}</p>
          </div>
          
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setShowImportModal(false)}
              className="px-4 py-2 border rounded-md hover:bg-button-hover"
            >
              {t('cancel')}
            </button>
            <button 
              onClick={handleImport}
              disabled={isImporting || !remoteDomain}
              className={`px-4 py-2 rounded-md text-white ${isImporting || !remoteDomain ? 'bg-theme-disabled' : 'bg-theme hover:bg-theme-hover'}`}
            >
              {isImporting ? (
                <div className="flex items-center">
                  <Loading type="spin" height={16} width={16} /> 
                  <span className="ml-2">{t('importing')}</span>
                </div>
              ) : t('import')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 修改主体渲染，添加消息组件
  return (
    <div className="w-full">
      {/* 标题和操作区域 */}
      <div className="flex justify-between items-center mb-4">
        <div>
          {/* 面包屑导航 */}
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            {renderBreadcrumbs()}
          </div>
        </div>
        <div className="flex space-x-2">
          {/* 添加导入按钮 */}
          <button
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setShowImportModal(true)}
            title={t('files.import')}
          >
            <i className="ri-cloud-download-line mr-1"></i>
            {t('files.import')}
          </button>
          
          {/* 同步按钮及下拉菜单 */}
          <div className="relative">
            <button
              className={`px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 ${
                isSyncing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => setShowSyncOptions(!showSyncOptions)}
              disabled={isSyncing}
              title={t('files.sync')}
            >
              <i className={`ri-refresh-line mr-1 ${isSyncing ? 'animate-spin' : ''}`}></i>
              {t('files.sync')}
              <i className="ri-arrow-down-s-line ml-1"></i>
            </button>
            
            {/* 同步选项下拉菜单 */}
            {showSyncOptions && (
              <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10 w-56">
                <div className="p-3">
                  <label className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      checked={includeExternal}
                      onChange={(e) => setIncludeExternal(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('files.sync_include_external')}</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {t('files.sync_include_external_desc')}
                  </p>
                  <div className="flex justify-end">
                    <button
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <i className="ri-loader-line animate-spin mr-1"></i>
                          {t('files.syncing')}
                        </>
                      ) : (
                        t('files.sync_start')
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {renderOperations()}
      {renderMessages()}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loading type="spin" height={50} width={50} />
        </div>
      ) : (
        <>
          {files.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <p className="text-lg font-medium">{t('files.empty')}</p>
              <p>{t('files.empty_desc')}</p>
            </div>
          ) : viewMode === 'grid' ? renderGridView() : renderListView()}
          
          {renderPagination()}
          
          {showSelector && selectedFiles.length > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white rounded-lg px-4 py-2 shadow-lg">
              <div className="flex items-center gap-4">
                <span>{t('files.selected', { count: selectedFiles.length })}</span>
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-gray-300 hover:text-white"
                >
                  {t('files.clear')}
                </button>
                <button
                  onClick={handleConfirmSelection}
                  className="bg-theme px-3 py-1 rounded hover:bg-theme-hover"
                >
                  {t('files.confirm')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* 新建文件夹对话框 */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 relative">
            <button
              onClick={() => setShowNewFolderDialog(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-medium mb-4">{t('files.create_folder')}</h3>
            <input
              ref={folderNameInputRef}
              type="text"
              className="w-full border rounded-lg p-2 mb-4"
              placeholder={t('files.folder_name')}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewFolderDialog(false)}
                className="px-4 py-2 rounded-lg border"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 rounded-lg bg-theme text-white"
              >
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {renderImportModal()}
    </div>
  );
} 