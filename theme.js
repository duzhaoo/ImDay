// theme.js - 主题管理模块
// 支持三种主题: light, dark, system (跟随系统)

const THEME_STORAGE_KEY = 'imday-theme';
const THEME_ATTR = 'data-theme';

// 获取所有可用的主题
export function getThemes() {
    return ['light', 'dark', 'system'];
}

// 获取保存的主题偏好
export function getSavedTheme() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
}

// 保存主题偏好
export function saveTheme(theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// 获取系统偏好主题
export function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

// 根据当前设置解析实际应用的主题
export function resolveTheme(themePreference) {
    if (themePreference === 'system') {
        return getSystemTheme();
    }
    return themePreference;
}

// 应用主题到DOM
export function applyTheme(themePreference) {
    const resolved = resolveTheme(themePreference);
    document.documentElement.setAttribute(THEME_ATTR, resolved);
    
    // 更新meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.content = resolved === 'dark' ? '#1a1a2e' : '#FFFFFF';
    }
    
    return resolved;
}

// 设置主题（保存偏好并应用）
export function setTheme(themePreference) {
    saveTheme(themePreference);
    return applyTheme(themePreference);
}

// 获取当前有效主题（light或dark）
export function getEffectiveTheme() {
    const saved = getSavedTheme();
    return resolveTheme(saved);
}

// 切换主题: light -> dark -> system -> light
export function cycleTheme() {
    const current = getSavedTheme();
    const order = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(current);
    const nextIndex = (currentIndex + 1) % order.length;
    const nextTheme = order[nextIndex];
    setTheme(nextTheme);
    return nextTheme;
}

// 生成主题图标的SVG（用于主题切换按钮）
export function getThemeIcon(currentTheme) {
    const effective = resolveTheme(currentTheme);
    if (effective === 'dark') {
        // 月亮图标
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
    // 太阳图标
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
}

// 更新主题切换按钮的图标和aria-label
export function updateThemeButton(button) {
    if (!button) return;
    const saved = getSavedTheme();
    button.innerHTML = getThemeIcon(saved);
    const labelMap = { light: '切换至深色模式', dark: '切换至跟随系统', system: '切换至浅色模式' };
    button.setAttribute('aria-label', labelMap[saved] || '切换主题');
    button.setAttribute('title', labelMap[saved] || '切换主题');
}

// 初始化主题
export function initTheme() {
    const saved = getSavedTheme();
    applyTheme(saved);
    
    // 监听系统主题变化
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (getSavedTheme() === 'system') {
                applyTheme('system');
            }
        };
        mq.addEventListener('change', handler);
    }
    
    return saved;
}
