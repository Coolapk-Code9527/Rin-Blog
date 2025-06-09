import React from 'react';

interface FileTypeSvgIconProps {
  type: string;
  className?: string;
}

// 扩展名到类型key映射
const extToType: Record<string, string> = {
  // 文档类
  pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', csv: 'csv', tsv: 'excel', ppt: 'ppt', pptx: 'ppt', rtf: 'rtf',
  md: 'md', markdown: 'md', txt: 'text', log: 'config', ini: 'config', conf: 'config', bak: 'config',
  // 图片
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image', webp: 'image', svg: 'svg', tiff: 'tiff', tif: 'tiff', heic: 'heic', heif: 'heic',
  // 设计
  psd: 'psd', psb: 'psd', ai: 'ai', indd: 'indd', xd: 'xd', sketch: 'sketch', fig: 'figma',
  // 音视频
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'media', aac: 'media', m4a: 'media', mp4: 'video', avi: 'video', mov: 'media', flv: 'media', m4v: 'media', wmv: 'video', webm: 'video', mkv: 'video',
  // 代码
  js: 'js', jsx: 'js', ts: 'ts', tsx: 'ts', py: 'py', java: 'java', go: 'go', cpp: 'cpp', cxx: 'cpp', cc: 'cpp', cs: 'csharp', sh: 'sh', bash: 'sh', bat: 'sh', cmd: 'sh', vue: 'vue', svelte: 'svelte', php: 'php', rb: 'ruby', pl: 'perl', swift: 'swift', kt: 'kotlin', kts: 'kotlin', dart: 'dart', rs: 'rust', scala: 'scala', lua: 'lua', asp: 'webscript', jsp: 'webscript',
  // 数据
  json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml', db: 'db', sqlite: 'db',
  // 安装包/镜像
  apk: 'apk', ipa: 'ipa', exe: 'exe', dll: 'exe', iso: 'iso', dmg: 'iso', torrent: 'torrent',
  // 压缩包
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
};

// MIME到类型key映射（部分常见）
const mimeToType: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'application/rtf': 'rtf',
  'text/markdown': 'md',
  'text/plain': 'text',
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/bmp': 'image', 'image/webp': 'image', 'image/svg+xml': 'svg', 'image/tiff': 'tiff', 'image/heic': 'heic',
  'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio', 'audio/flac': 'media', 'audio/aac': 'media', 'audio/mp4': 'media',
  'video/mp4': 'video', 'video/x-msvideo': 'video', 'video/x-flv': 'media', 'video/x-m4v': 'media', 'video/webm': 'video', 'video/x-matroska': 'video',
  'application/json': 'json', 'application/xml': 'xml', 'text/xml': 'xml', 'application/x-yaml': 'yaml', 'text/yaml': 'yaml', 'application/x-toml': 'toml',
  'application/zip': 'archive', 'application/x-rar-compressed': 'archive', 'application/x-7z-compressed': 'archive', 'application/x-tar': 'archive', 'application/gzip': 'archive',
};

function getTypeKey(type: string) {
  const t = type.toLowerCase();
  // 1. 先查MIME
  if (mimeToType[t]) return mimeToType[t];
  // 2. 再查扩展名
  const extMatch = t.match(/\.([a-z0-9]+)$/);
  if (extMatch && extToType[extMatch[1]]) return extToType[extMatch[1]];
  // 3. 兜底：文件名中带.的后缀
  const nameMatch = t.split('.');
  if (nameMatch.length > 1) {
    const ext = nameMatch.pop()!;
    if (extToType[ext]) return extToType[ext];
  }
  // 4. 关键字模糊
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('image')) return 'image';
  if (t.includes('audio')) return 'audio';
  if (t.includes('video')) return 'video';
  if (t.includes('zip') || t.includes('rar') || t.includes('7z')) return 'archive';
  if (t.includes('excel')) return 'excel';
  if (t.includes('word')) return 'word';
  if (t.includes('ppt')) return 'ppt';
  if (t.includes('psd')) return 'psd';
  if (t.includes('ai')) return 'ai';
  if (t.includes('indd')) return 'indd';
  if (t.includes('xd')) return 'xd';
  if (t.includes('sketch')) return 'sketch';
  if (t.includes('figma')) return 'figma';
  if (t.includes('svg')) return 'svg';
  if (t.includes('tiff')) return 'tiff';
  if (t.includes('heic')) return 'heic';
  if (t.includes('mov') || t.includes('flv') || t.includes('m4v')) return 'media';
  if (t.includes('m4a') || t.includes('aac') || t.includes('flac')) return 'media';
  if (t.includes('rtf')) return 'rtf';
  if (t.includes('bat') || t.includes('cmd') || t.includes('sh') || t.includes('bash')) return 'sh';
  if (t.includes('exe') || t.includes('dll')) return 'exe';
  if (t.includes('db') || t.includes('sqlite') || t.includes('bak')) return 'db';
  if (t.includes('iso') || t.includes('dmg')) return 'iso';
  if (t.includes('torrent')) return 'torrent';
  if (t.includes('apk')) return 'apk';
  if (t.includes('ipa')) return 'ipa';
  if (t.includes('vue')) return 'vue';
  if (t.includes('svelte')) return 'svelte';
  if (t.includes('php')) return 'php';
  if (t.includes('rb')) return 'ruby';
  if (t.includes('pl')) return 'perl';
  if (t.includes('swift')) return 'swift';
  if (t.includes('kt') || t.includes('kts')) return 'kotlin';
  if (t.includes('dart')) return 'dart';
  if (t.includes('rs')) return 'rust';
  if (t.includes('scala')) return 'scala';
  if (t.includes('lua')) return 'lua';
  if (t.includes('asp') || t.includes('jsp')) return 'webscript';
  if (t.includes('ini') || t.includes('conf') || t.includes('log')) return 'config';
  if (t.includes('json')) return 'json';
  if (t.includes('xml')) return 'xml';
  if (t.includes('html')) return 'html';
  if (t.includes('css')) return 'css';
  if (t.includes('js')) return 'js';
  if (t.includes('ts')) return 'ts';
  if (t.includes('py')) return 'py';
  if (t.includes('java')) return 'java';
  if (t.includes('go')) return 'go';
  if (t.includes('cpp') || t.includes('c++')) return 'cpp';
  if (t.includes('c#') || t.includes('cs')) return 'csharp';
  if (t.includes('md')) return 'md';
  if (t.includes('yaml') || t.includes('yml')) return 'yaml';
  if (t.includes('toml')) return 'toml';
  if (t.includes('text') || t.includes('txt')) return 'text';
  if (t.includes('folder')) return 'folder';
  return 'file';
}

export function FileTypeSvgIcon({ type, className = '' }: FileTypeSvgIconProps) {
  const key = getTypeKey(type);
  switch (key) {
    case 'pdf':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#F44336"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">PDF</text></svg>
      );
    case 'image':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#90CAF9"/><circle cx="16" cy="18" r="5" fill="#fff"/><rect x="10" y="28" width="28" height="10" rx="2" fill="#fff"/><rect x="24" y="24" width="14" height="14" rx="2" fill="#64B5F6"/></svg>
      );
    case 'audio':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#BA68C8"/><rect x="14" y="18" width="8" height="16" rx="2" fill="#fff"/><rect x="26" y="12" width="8" height="22" rx="2" fill="#fff"/></svg>
      );
    case 'video':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#4FC3F7"/><polygon points="18,14 36,24 18,34" fill="#fff"/></svg>
      );
    case 'archive':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FFD54F"/><rect x="12" y="20" width="24" height="16" rx="2" fill="#fff"/><rect x="12" y="12" width="24" height="8" rx="2" fill="#FFA000"/></svg>
      );
    case 'excel':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#81C784"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">XLS</text></svg>
      );
    case 'word':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#64B5F6"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">DOC</text></svg>
      );
    case 'ppt':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FFB74D"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">PPT</text></svg>
      );
    case 'psd':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#1E3A5C"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">PSD</text></svg>
      );
    case 'ai':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FF6F00"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">AI</text></svg>
      );
    case 'indd':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#C51162"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">ID</text></svg>
      );
    case 'xd':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FF2BC2"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">XD</text></svg>
      );
    case 'sketch':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FFD600"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">SK</text></svg>
      );
    case 'figma':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#0ACF83"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">FG</text></svg>
      );
    case 'apk':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#43A047"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">APK</text></svg>
      );
    case 'ipa':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#007AFF"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">IPA</text></svg>
      );
    case 'csv':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#388E3C"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">CSV</text></svg>
      );
    case 'json':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FFA000"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">JSON</text></svg>
      );
    case 'xml':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#8E24AA"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">XML</text></svg>
      );
    case 'html':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#E65100"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">HTML</text></svg>
      );
    case 'css':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#0277BD"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">CSS</text></svg>
      );
    case 'js':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FFEB3B"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#333" fontWeight="bold">JS</text></svg>
      );
    case 'ts':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#1976D2"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">TS</text></svg>
      );
    case 'py':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FFD43B"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#306998" fontWeight="bold">PY</text></svg>
      );
    case 'java':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#F44336"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">JAVA</text></svg>
      );
    case 'go':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#00ADD8"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">GO</text></svg>
      );
    case 'cpp':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#1976D2"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">C++</text></svg>
      );
    case 'csharp':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#512DA8"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">C#</text></svg>
      );
    case 'sh':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#263238"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">SH</text></svg>
      );
    case 'md':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#546E7A"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">MD</text></svg>
      );
    case 'yaml':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FBC02D"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#333" fontWeight="bold">YML</text></svg>
      );
    case 'toml':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#8D6E63"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">TOML</text></svg>
      );
    case 'text':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#B0BEC5"/><rect x="12" y="16" width="24" height="4" rx="2" fill="#fff"/><rect x="12" y="24" width="24" height="4" rx="2" fill="#fff"/><rect x="12" y="32" width="16" height="4" rx="2" fill="#fff"/></svg>
      );
    case 'folder':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FFD54F"/><rect x="8" y="20" width="32" height="16" rx="2" fill="#fff"/><rect x="8" y="12" width="16" height="8" rx="2" fill="#FFA000"/></svg>
      );
    case 'svg':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FF9800"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">SVG</text></svg>
      );
    case 'tiff':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#8D6E63"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">TIFF</text></svg>
      );
    case 'heic':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#607D8B"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">HEIC</text></svg>
      );
    case 'media':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#00BCD4"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">MEDIA</text></svg>
      );
    case 'rtf':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#607D8B"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">RTF</text></svg>
      );
    case 'exe':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#263238"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">EXE</text></svg>
      );
    case 'db':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="24" rx="20" ry="16" fill="#90A4AE"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">DB</text></svg>
      );
    case 'iso':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" fill="#BDBDBD"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">ISO</text></svg>
      );
    case 'torrent':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#7E57C2"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">TOR</text></svg>
      );
    case 'vue':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#42B883"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">VUE</text></svg>
      );
    case 'svelte':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FF3E00"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">SVT</text></svg>
      );
    case 'php':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#8892BF"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">PHP</text></svg>
      );
    case 'ruby':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#E0115F"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">RB</text></svg>
      );
    case 'perl':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#8E44AD"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">PL</text></svg>
      );
    case 'swift':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#FF6F00"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">SWF</text></svg>
      );
    case 'kotlin':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#7F52FF"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">KT</text></svg>
      );
    case 'dart':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#0175C2"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">DART</text></svg>
      );
    case 'rust':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#DEA584"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">RS</text></svg>
      );
    case 'scala':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#DC322F"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">SCALA</text></svg>
      );
    case 'lua':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#000080"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">LUA</text></svg>
      );
    case 'webscript':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#009688"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">WEB</text></svg>
      );
    case 'config':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#607D8B"/><text x="24" y="32" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="bold">CFG</text></svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#E0E0E0"/><rect x="14" y="14" width="20" height="20" rx="4" fill="#fff"/></svg>
      );
  }
} 