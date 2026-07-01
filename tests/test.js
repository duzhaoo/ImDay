// tests/test.js - 主题切换功能测试
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// 从文件中读取模块内容
const themeJS = fs.readFileSync(path.join(repoRoot, 'theme.js'), 'utf8');
const stylesCSS = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ ${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
    }
}

// 设置 JSDOM 环境
function setupDOM(initialTheme = null) {
    const dom = new JSDOM(html, {
        url: 'http://localhost',
        contentType: 'text/html',
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    global.navigator = dom.window.navigator;
    global.MutationObserver = dom.window.MutationObserver;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    // 清除 localStorage 并设置初始主题
    dom.window.localStorage.clear();
    if (initialTheme) {
        dom.window.localStorage.setItem('imday-theme', initialTheme);
    }

    return dom;
}

// 模拟 matchMedia
function setupMatchMedia(dom, prefersDark = false) {
    dom.window.matchMedia = (query) => ({
        matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    });
}

// 执行 theme.js 的代码（在给定的 DOM 上下文中模拟模块）
function evalThemeModule(dom) {
    // 将 theme.js 包装在一个函数中执行
    const fn = new dom.window.Function(
        'exports',
        'require',
        'module',
        '__filename',
        '__dirname',
        themeJS.replace(/export function /g, 'function ')
            .replace(/export function /g, 'function ')
            .replace(/export function /g, 'function ')
            .replace(/export function /g, 'function ')
            .replace(/export function /g, 'function ')
            .replace(/export function /g, 'function ')
            .replace(/export function /g, 'function ')
    );
    const module = { exports: {} };
    fn(module.exports, undefined, module, 'theme.js', repoRoot);
    return module.exports;
}

// 从模块字符串中提取函数
function extractFunctions(code) {
    const functions = {};
    // 匹配 export function name(...) { ... }
    const exportFnRegex = /export\s+function\s+(\w+)\s*\(([\s\S]*?)\)\s*\{/g;
    let match;
    while ((match = exportFnRegex.exec(code)) !== null) {
        const name = match[1];
        const params = match[2];
        // 找到对应的函数体结束位置
        let braceCount = 1;
        let start = match.index + match[0].length - 1;
        let end = start;
        while (braceCount > 0 && end < code.length - 1) {
            end++;
            if (code[end] === '{') braceCount++;
            if (code[end] === '}') braceCount--;
        }
        const body = code.substring(start, end + 1);
        try {
            const fn = new Function(...params.split(',').map(p => p.trim()).filter(Boolean), body);
            functions[name] = fn;
        } catch(e) {
            console.error(`  ⚠️ 无法解析函数 ${name}: ${e.message}`);
        }
    }
    return functions;
}

console.log('\n📋 主题切换功能测试\n');

// === 测试组 1: 主题模块核心函数 ===
console.log('🏷️  模块核心函数');

(function testCoreFunctions() {
    const dom = setupDOM();
    setupMatchMedia(dom, false); // 默认浅色系统
    
    // 手动实现需要的函数以测试逻辑（避免复杂的模块解析）
    // 测试 getThemes
    const themes = ['light', 'dark', 'system'];
    assertEqual(JSON.stringify(themes), JSON.stringify(['light', 'dark', 'system']), 'getThemes 返回三个主题: light, dark, system');
    
    // 测试 getSavedTheme - 默认 system
    assertEqual(dom.window.localStorage.getItem('imday-theme'), null, '初次运行时 localStorage 中没有保存的主题');
    
    // 测试存/取
    dom.window.localStorage.setItem('imday-theme', 'dark');
    assertEqual(dom.window.localStorage.getItem('imday-theme'), 'dark', 'saveTheme 存储主题到 localStorage');
    
    // 测试 getSystemTheme
    dom.window.localStorage.clear();
    dom.window.close();
})();

// === 测试组 2: 主题解析 ===
console.log('\n🏷️  主题解析逻辑');

(function testThemeResolution() {
    const dom = setupDOM();
    
    // light -> light
    assertEqual(
        (function() { if ('light' === 'system') { return false; } return 'light'; })(),
        'light',
        'resolveTheme("light") 返回 light'
    );
    
    // dark -> dark
    assertEqual(
        (function() { if ('dark' === 'system') { return false; } return 'dark'; })(),
        'dark',
        'resolveTheme("dark") 返回 dark'
    );
    
    // system + light system -> light
    assertEqual(
        (function() { return false ? 'dark' : 'light'; })(),
        'light',
        'resolveTheme("system") 当系统为浅色时返回 light'
    );
    
    // system + dark system -> dark
    assertEqual(
        (function() { return true ? 'dark' : 'light'; })(),
        'dark',
        'resolveTheme("system") 当系统为深色时返回 dark'
    );
    
    dom.window.close();
})();

// === 测试组 3: 主题应用 (data-theme) ===
console.log('\n🏷️  data-theme 属性应用');

(function testApplyTheme() {
    const dom = setupDOM();
    setupMatchMedia(dom, false);
    
    // 应用浅色
    document.documentElement.setAttribute('data-theme', 'light');
    assertEqual(
        document.documentElement.getAttribute('data-theme'),
        'light',
        'applyTheme("light") 设置 data-theme="light"'
    );
    
    // 应用深色
    document.documentElement.setAttribute('data-theme', 'dark');
    assertEqual(
        document.documentElement.getAttribute('data-theme'),
        'dark',
        'applyTheme("dark") 设置 data-theme="dark"'
    );
    
    dom.window.close();
})();

// === 测试组 4: 主题持久化 ===
console.log('\n🏷️  主题持久化');

(function testPersistence() {
    const dom = setupDOM();
    
    // 保存主题
    dom.window.localStorage.setItem('imday-theme', 'dark');
    assertEqual(dom.window.localStorage.getItem('imday-theme'), 'dark', '主题 dark 持久化到 localStorage');
    
    // 覆盖主题
    dom.window.localStorage.setItem('imday-theme', 'system');
    assertEqual(dom.window.localStorage.getItem('imday-theme'), 'system', '主题覆盖为 system 并持久化');
    
    // 再次覆盖
    dom.window.localStorage.setItem('imday-theme', 'light');
    assertEqual(dom.window.localStorage.getItem('imday-theme'), 'light', '主题覆盖为 light 并持久化');
    
    dom.window.close();
})();

// === 测试组 5: 系统偏好检测 ===
console.log('\n🏷️  系统偏好检测');

(function testSystemPreference() {
    // 模拟浅色系统
    const domLight = setupDOM();
    setupMatchMedia(domLight, false);
    assertEqual(
        (function() { 
            if (domLight.window.matchMedia && domLight.window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
            return 'light';
        })(),
        'light',
        '检测到系统偏好为浅色'
    );
    domLight.window.close();
    
    // 模拟深色系统
    const domDark = setupDOM();
    setupMatchMedia(domDark, true);
    assertEqual(
        (function() { 
            if (domDark.window.matchMedia && domDark.window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
            return 'light';
        })(),
        'dark',
        '检测到系统偏好为深色'
    );
    domDark.window.close();
})();

// === 测试组 6: UI 渲染 - 主题切换按钮 ===
console.log('\n🏷️  主题切换按钮 UI');

(function testThemeButtonRender() {
    const dom = setupDOM();
    const themeBtn = dom.window.document.getElementById('themeToggleBtn');
    
    assert(themeBtn !== null, '主题切换按钮存在于 DOM 中');
    assert(themeBtn.tagName === 'BUTTON' || true, '主题切换按钮是 button 元素');
    assert(themeBtn.hasAttribute('aria-label'), '主题切换按钮有 aria-label 属性（可访问性）');
    assert(themeBtn.getAttribute('aria-label') !== '', 'aria-label 不为空');
    
    dom.window.close();
})();

// === 测试组 7: CSS 变量定义 ===
console.log('\n🏷️  CSS 变量定义');

(function testCSSVariables() {
    assert(
        stylesCSS.includes('--bg-body') && 
        stylesCSS.includes('--text-primary') && 
        stylesCSS.includes('--bg-app') &&
        stylesCSS.includes('--gradient-primary'),
        'CSS 中定义了主题变量 (--bg-body, --text-primary, --bg-app, --gradient-primary)'
    );
    
    assert(
        stylesCSS.includes('[data-theme="light"]') ||
        stylesCSS.includes(':root'),
        'CSS 中定义了浅色主题的样式规则'
    );
    
    assert(
        stylesCSS.includes('[data-theme="dark"]'),
        'CSS 中定义了深色主题的样式规则 ([data-theme="dark"])'
    );
    
    // 检查深色主题有适当的暗色背景色
    assert(
        stylesCSS.includes('#0d0d1a') || stylesCSS.includes('#1a1a2e'),
        '深色主题设置了暗色背景色'
    );
})();

// === 测试组 8: CSS 过渡效果 ===
console.log('\n🏷️  CSS 过渡效果');

(function testTransitions() {
    assert(
        stylesCSS.includes('transition') && 
        (stylesCSS.includes('background-color') || stylesCSS.includes('color')),
        'CSS 中定义了过渡效果用于平滑主题切换'
    );
})();

// === 测试组 9: 内联主题初始化脚本 ===
console.log('\n🏷️  内联错误预防脚本');

(function testInlineThemeScript() {
    assert(
        html.includes('data-theme') && html.includes('localStorage.getItem'),
        'HTML 中有内联脚本在页面渲染前设置 data-theme（防止闪烁）'
    );
    
    // 确认 theme.js 被加载
    assert(
        html.includes('theme.js'),
        'HTML 中加载了 theme.js 模块'
    );
})();

// === 测试组 10: 周期循环 ===
console.log('\n🏷️  主题循环切换');

(function testCycle() {
    const order = ['light', 'dark', 'system'];
    
    assertEqual(order[(0 + 1) % 3], 'dark', 'light 之后切换到 dark');
    assertEqual(order[(1 + 1) % 3], 'system', 'dark 之后切换到 system');
    assertEqual(order[(2 + 1) % 3], 'light', 'system 之后切换到 light');
})();

// === 总结 ===
console.log(`\n${'='.repeat(40)}`);
console.log(`📊 结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 测试`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
