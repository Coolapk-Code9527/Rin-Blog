import { ConfigWrapper } from '../state/config';

// 侧边栏配置接口
export interface SidebarConfig {
  enabled: boolean;
  components: {
    profile: boolean;
    music: boolean;
    announcements: boolean;
    tagCloud: boolean;
  };
  order: string[];
}

// 个人资料配置接口
export interface AuthorConfig {
  name: string;
  bio: string;
  avatar?: string;
  social?: {
    github?: string;
    email?: string;
    wechat?: string;
    twitter?: string;
    telegram?: string;
    qq?: string;
  };
}

// 音乐播放器配置接口
export interface MusicConfig {
  enabled: boolean;
  autoplay: boolean;
  url?: string;
  title?: string;
  artist?: string;
  volume: number;
}

// 公告配置接口
export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important';
  createdAt: string;
  expiresAt?: string;
}

export interface AnnouncementConfig {
  enabled: boolean;
  announcements: Announcement[];
}

// 从配置包装器中获取侧边栏配置
export function getSidebarConfig(config: ConfigWrapper): SidebarConfig {
  const orderString = config?.get<string>('sidebar.order') || 'profile,announcements,tagCloud,music';

  return {
    enabled: config?.get<boolean>('sidebar.enabled') ?? true,
    components: {
      profile: config?.get<boolean>('sidebar.components.profile') ?? true,
      music: config?.get<boolean>('sidebar.components.music') ?? false,
      announcements: config?.get<boolean>('sidebar.components.announcements') ?? true,
      tagCloud: config?.get<boolean>('sidebar.components.tagCloud') ?? true,
    },
    order: orderString.split(',').map(s => s.trim()).filter(Boolean)
  };
}

// 从配置包装器中获取作者配置
export function getAuthorConfig(config: ConfigWrapper): AuthorConfig {
  return {
    name: config?.get<string>('author.name') || '博主',
    bio: config?.get<string>('author.bio') || '热爱分享技术与生活的博主。',
    avatar: config?.get<string>('author.avatar') || undefined,
    social: {
      github: config?.get<string>('author.social.github') || undefined,
      email: config?.get<string>('author.social.email') || undefined,
      wechat: config?.get<string>('author.social.wechat') || undefined,
      twitter: config?.get<string>('author.social.twitter') || undefined,
      telegram: config?.get<string>('author.social.telegram') || undefined,
      qq: config?.get<string>('author.social.qq') || undefined,
    }
  };
}

// 从配置包装器中获取音乐配置
export function getMusicConfig(config: ConfigWrapper): MusicConfig {
  const url = config?.get<string>('music.url') || undefined;
  return {
    enabled: !!url, // 有音乐URL就启用播放器
    autoplay: config?.get<boolean>('music.autoplay') ?? false,
    url: url,
    title: config?.get<string>('music.title') || undefined,
    artist: config?.get<string>('music.artist') || undefined,
    volume: config?.get<number>('music.volume') ?? 0.7,
  };
}

// 从配置包装器中获取公告配置
export function getAnnouncementConfig(config: ConfigWrapper): AnnouncementConfig {
  const announcementsData = config?.get<string>('announcements.data') || '[]';

  let announcements: Announcement[] = [];
  try {
    announcements = JSON.parse(announcementsData);
  } catch (error) {
    console.warn('Failed to parse announcements data:', error);
    announcements = [];
  }

  return {
    enabled: config?.get<boolean>('announcements.enabled') ?? true,
    announcements
  };
}

// 保存公告配置到配置系统
export function saveAnnouncementConfig(announcements: Announcement[]): string {
  return JSON.stringify(announcements);
}

// 创建新公告的辅助函数
export function createAnnouncement(
  title: string,
  content: string,
  priority: 'normal' | 'important' = 'normal',
  expiresAt?: string
): Announcement {
  return {
    id: `announcement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    content,
    priority,
    createdAt: new Date().toISOString(),
    expiresAt
  };
}

// 验证配置数据的辅助函数
export function validateSidebarConfig(config: Partial<SidebarConfig>): boolean {
  if (typeof config.enabled !== 'undefined' && typeof config.enabled !== 'boolean') {
    return false;
  }
  
  if (config.components) {
    const validKeys = ['profile', 'music', 'announcements', 'tagCloud'];
    for (const key of Object.keys(config.components)) {
      if (!validKeys.includes(key)) {
        return false;
      }
      if (typeof config.components[key as keyof typeof config.components] !== 'boolean') {
        return false;
      }
    }
  }
  
  if (config.order && !Array.isArray(config.order)) {
    return false;
  }
  
  return true;
}

export function validateMusicConfig(config: Partial<MusicConfig>): boolean {
  if (typeof config.enabled !== 'undefined' && typeof config.enabled !== 'boolean') {
    return false;
  }
  
  if (typeof config.autoplay !== 'undefined' && typeof config.autoplay !== 'boolean') {
    return false;
  }
  
  if (typeof config.volume !== 'undefined') {
    if (typeof config.volume !== 'number' || config.volume < 0 || config.volume > 1) {
      return false;
    }
  }
  
  return true;
}

export function validateAnnouncementConfig(config: Partial<AnnouncementConfig>): boolean {
  if (typeof config.enabled !== 'undefined' && typeof config.enabled !== 'boolean') {
    return false;
  }
  
  if (config.announcements && !Array.isArray(config.announcements)) {
    return false;
  }
  
  return true;
}
