// app.js - 主应用逻辑
import { supabase, currentUser, checkUser, signIn, signUp, signOut, syncCountdowns as syncToCloud, fetchCountdowns as fetchFromCloud } from './supabase.js';

// 全局变量
let countdowns = [];
let currentCountdownId = null;
let isLocalOnly = false; // 是否仅使用本地存储

// 初始化应用
async function initApp() {
    // 检查用户登录状态
    try {
        const user = await checkUser();
        if (user) {
            // 已登录，直接从云端获取数据
            showListPage();
            await loadCountdownsFromCloud();
            updateUserInfo(user);
        } else {
            // 未登录，显示登录页面
            document.getElementById('authPage').classList.remove('hidden');
        }
    } catch (error) {
        console.error('初始化失败:', error);
        loadCountdownsFromLocalStorage(); // 失败时从本地加载
        showListPage();
    }

    // 事件绑定 - 登录页面
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('signupBtn').addEventListener('click', handleSignup);
    document.getElementById('skipAuthBtn').addEventListener('click', handleSkipAuth);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // 事件绑定 - 列表页面
    document.getElementById('appTitle').addEventListener('click', showBackupModal);
    document.getElementById('createBtn').addEventListener('click', showCreatePage);
    
    // 事件绑定 - 创建页面
    document.getElementById('backToListBtn').addEventListener('click', showListPage);
    document.getElementById('saveBtn').addEventListener('click', saveCountdown);
    document.getElementById('dateDisplay').addEventListener('click', openDatePicker);
    
    // 事件绑定 - 详情页面
    document.getElementById('backFromDetailBtn').addEventListener('click', showListPage);
    document.getElementById('deleteBtn').addEventListener('click', deleteCountdown);
    
    // 事件绑定 - 日期选择器
    document.getElementById('closeDatePickerBtn').addEventListener('click', closeDatePicker);
    document.getElementById('cancelDateBtn').addEventListener('click', closeDatePicker);
    document.getElementById('confirmDateBtn').addEventListener('click', confirmDateSelection);
    
    // 事件绑定 - 备份弹窗
    document.getElementById('closeBackupModalBtn').addEventListener('click', hideBackupModal);
    document.getElementById('backupBtn').addEventListener('click', backupData);
    document.getElementById('restoreBtn').addEventListener('click', restoreData);
    document.getElementById('fileInput').addEventListener('change', handleFileRestore);
    
    // 事件绑定 - 用户菜单
    document.getElementById('closeUserModalBtn').addEventListener('click', hideUserModal);
    
    // 初始化日期选择器
    initDatePicker();
}

// 处理现有数据，确保使用正确的字段名
function normalizeCountdowns(coundownsData) {
    return coundownsData.map(countdown => {
        // 如果有createdAt但没有created_at，添加created_at
        if (countdown.createdAt && !countdown.created_at) {
            countdown.created_at = countdown.createdAt;
        }
        // 如果两个都没有，添加created_at
        if (!countdown.createdAt && !countdown.created_at) {
            countdown.created_at = new Date().toISOString();
        }
        return countdown;
    });
}

// 认证相关函数
async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showToast('请输入邮箱和密码');
        return;
    }
    
    try {
        showToast('登录中...');
        const { user } = await signIn(email, password);
        showToast('登录成功！');
        updateUserInfo(user);
        
        // 登录成功后加载云端数据
        showListPage();
        await loadCountdownsFromCloud();
    } catch (error) {
        console.error('登录失败:', error);
        showToast('登录失败: ' + (error.message || '请检查账号和密码'));
    }
}

async function handleSignup() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showToast('请输入邮箱和密码');
        return;
    }
    
    if (password.length < 6) {
        showToast('密码长度至少6位');
        return;
    }
    
    try {
        showToast('注册中...');
        await signUp(email, password);
        showToast('注册成功！请检查邮箱完成验证');
    } catch (error) {
        console.error('注册失败:', error);
        showToast('注册失败: ' + (error.message || '请稍后重试'));
    }
}

function handleSkipAuth() {
    isLocalOnly = true;
    loadCountdownsFromLocalStorage();
    showListPage();
    showToast('已跳过登录，使用本地存储');
}

async function handleLogout() {
    try {
        await signOut();
        showToast('已退出登录');
        
        // 清空状态并返回登录页面
        currentCountdownId = null;
        countdowns = [];
        document.getElementById('listPage').classList.add('hidden');
        document.getElementById('createPage').classList.add('hidden');
        document.getElementById('detailPage').classList.add('hidden');
        document.getElementById('authPage').classList.remove('hidden');
        
        // 隐藏用户菜单
        hideUserModal();
    } catch (error) {
        console.error('退出失败:', error);
        showToast('退出失败，请重试');
    }
}

// 更新用户信息显示
function updateUserInfo(user) {
    if (!user) return;
    
    const userEmail = document.getElementById('userEmail');
    userEmail.textContent = user.email || '未知用户';
}

// 用户菜单相关
function showUserModal() {
    document.getElementById('userModal').style.display = 'block';
}

function hideUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

// 数据同步函数
async function syncWithCloud() {
    if (isLocalOnly) {
        showToast('您处于离线模式，请登录后同步');
        return;
    }
    
    if (!currentUser) {
        showToast('请先登录');
        return;
    }
    
    try {
        // 同步到云端
        showToast('正在同步...');
        const { error } = await syncToCloud(countdowns);
        if (error) throw new Error(error);
        
        showToast('同步成功！');
        return true;
    } catch (error) {
        console.error('同步失败:', error);
        showToast('同步失败: ' + error.message);
        return false;
    }
}

// 从云端加载数据
async function loadCountdownsFromCloud() {
    try {
        const { data, error } = await fetchFromCloud();
        
        if (error) throw new Error(error);
        
        if (data && Array.isArray(data) && data.length > 0) {
            // 确保云端数据使用正确的字段名
            countdowns = normalizeCountdowns(data);
            saveCountdownsToLocalStorage(); // 同时保存到本地
            renderCountdowns();
            showToast('云端数据加载成功');
        } else {
            // 云端没有数据，尝试从本地加载
            loadCountdownsFromLocalStorage();
        }
    } catch (error) {
        console.error('加载云端数据失败:', error);
        showToast('加载失败，使用本地数据');
        loadCountdownsFromLocalStorage();
    }
}

// 从本地存储加载数据
function loadCountdownsFromLocalStorage() {
    let localData = JSON.parse(localStorage.getItem('countdowns')) || [];
    // 确保本地数据使用正确的字段名
    countdowns = normalizeCountdowns(localData);
    renderCountdowns();
}

// 保存数据到本地存储
function saveCountdownsToLocalStorage() {
    localStorage.setItem('countdowns', JSON.stringify(countdowns));
}

// 页面导航函数
function showListPage() {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('listPage').classList.remove('hidden');
    document.getElementById('createPage').classList.add('hidden');
    document.getElementById('detailPage').classList.add('hidden');
    renderCountdowns();
}

function showCreatePage() {
    document.getElementById('listPage').classList.add('hidden');
    document.getElementById('createPage').classList.remove('hidden');
    document.getElementById('detailPage').classList.add('hidden');
    
    // 清空表单
    document.getElementById('title').value = '';
    
    // 重置自定义日期选择器为今天
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    // 更新隐藏的日期字段
    const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    document.getElementById('date').value = formattedDate;
    
    // 更新显示的日期文本
    const selectedDateElement = document.getElementById('selectedDate');
    selectedDateElement.textContent = `${year}年${month}月${day}日`;
    selectedDateElement.classList.remove('placeholder');
    
    // 更新全局变量
    selectedYear = year;
    selectedMonth = month;
    selectedDay = day;
}

function showDetailPage(id) {
    currentCountdownId = id;
    const countdown = countdowns.find(c => c.id === id);
    if (!countdown) return;
    
    document.getElementById('listPage').classList.add('hidden');
    document.getElementById('createPage').classList.add('hidden');
    document.getElementById('detailPage').classList.remove('hidden');
    
    // 更新详情页内容
    document.getElementById('detailMainTitle').textContent = countdown.title;
    const days = calculateDays(countdown.date);
    document.getElementById('detailDays').textContent = Math.abs(days);
    document.getElementById('detailLabel').textContent = getDaysText(days);
    document.getElementById('detailDate').textContent = formatDate(countdown.date);
    
    // 设置详情页统一样式
    const detailContent = document.querySelector('.detail-content');
    const detailDays = document.getElementById('detailDays');
    const detailLabel = document.getElementById('detailLabel');
    
    // 移除所有状态类，使用统一的橙红渐变样式
    detailContent.classList.remove('past', 'today', 'future-far', 'future-near', 'future-soon');
    
    // 确保天数文字始终为白色
    detailDays.style.color = 'white';
    detailLabel.style.color = 'white';
}

// 保存倒数日
function saveCountdown() {
    const title = document.getElementById('title').value.trim();
    const date = document.getElementById('date').value;
    
    if (!title || !date) {
        alert('请填写完整信息');
        return;
    }

    const countdown = {
        id: Date.now(),
        title,
        date,
        created_at: new Date().toISOString()
    };

    countdowns.push(countdown);
    saveCountdownsToLocalStorage();
    
    // 如果已登录，同时同步到云端
    if (currentUser && !isLocalOnly) {
        syncWithCloud().catch(error => {
            console.error('自动同步失败:', error);
        });
    }
    
    showListPage();
    showToast('倒数日添加成功！');
}

// 删除倒数日
function deleteCountdown() {
    if (!currentCountdownId) return;
    
    const countdown = countdowns.find(c => c.id === currentCountdownId);
    if (!countdown) return;
    
    if (confirm(`确定要删除"${countdown.title}"吗？\n\n删除后无法恢复！`)) {
        // 从数组中移除
        countdowns = countdowns.filter(c => c.id !== currentCountdownId);
        
        // 保存到本地存储
        saveCountdownsToLocalStorage();
        
        // 如果已登录，同时同步到云端
        if (currentUser && !isLocalOnly) {
            syncWithCloud().catch(error => {
                console.error('自动同步失败:', error);
            });
        }
        
        // 显示成功提示
        showToast('倒数日删除成功！');
        
        // 返回列表页面
        showListPage();
        
        // 清空当前ID
        currentCountdownId = null;
    }
}

// 工具函数
function calculateDays(targetDate) {
    const today = new Date();
    const target = new Date(targetDate);
    
    // 设置时间为当天的开始
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getDaysText(days) {
    if (days > 0) {
        return '还有';
    } else if (days === 0) {
        return '今天';
    } else {
        return '已过去';
    }
}

function getCardClass(days) {
    if (days > 30) {
        return 'blue';
    } else if (days > 7) {
        return 'orange';
    } else {
        return 'gray';
    }
}

function getSubtitle(countdown) {
    const date = new Date(countdown.date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 渲染倒数日列表
function renderCountdowns() {
    const container = document.getElementById('countdowns');
    
    if (countdowns.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>还没有倒数日</h3>
                <p>点击右上角的 + 号<br>创建你的第一个倒数日</p>
            </div>
        `;
        return;
    }

    // 按日期排序，最近的日期在前
    const sortedCountdowns = [...countdowns].sort((a, b) => {
        const daysA = calculateDays(a.date);
        const daysB = calculateDays(b.date);
        
        // 未来的日期优先，然后按天数升序
        if (daysA >= 0 && daysB >= 0) {
            return daysA - daysB;
        } else if (daysA >= 0) {
            return -1;
        } else if (daysB >= 0) {
            return 1;
        } else {
            return daysB - daysA; // 过去的日期按天数降序
        }
    });

    container.innerHTML = sortedCountdowns.map(countdown => {
        const days = calculateDays(countdown.date);
        const cardClass = getCardClass(days);
        const subtitle = getSubtitle(countdown);
        
        return `
            <div class="countdown-card ${cardClass}" data-id="${countdown.id}">
                <div class="countdown-info">
                    <div class="countdown-title">${countdown.title}</div>
                    <div class="countdown-subtitle">${subtitle}</div>
                </div>
                <div class="countdown-days-container">
                    <div class="countdown-days">${Math.abs(days)}</div>
                    <div class="countdown-label">天</div>
                </div>
            </div>
        `;
    }).join('');
    
    // 添加事件监听器
    const cards = container.querySelectorAll('.countdown-card');
    cards.forEach(card => {
        const id = parseInt(card.dataset.id);
        card.addEventListener('click', () => showDetailPage(id));
    });
}

// 显示提示消息
function showToast(message) {
    // 创建简单的提示
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 1000;
        animation: fadeInOut 2s ease-in-out;
    `;
    toast.textContent = message;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            20%, 80% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        document.body.removeChild(toast);
        document.head.removeChild(style);
    }, 2000);
}

// 备份恢复功能
function showBackupModal() {
    document.getElementById('backupModal').style.display = 'block';
}

function hideBackupModal() {
    document.getElementById('backupModal').style.display = 'none';
}

// 备份数据
function backupData() {
    try {
        const data = {
            countdowns: countdowns,
            exportTime: new Date().toISOString(),
            version: '1.0',
            isCloud: !isLocalOnly && currentUser !== null
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `倒数日备份_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('数据备份成功！');
        hideBackupModal();
    } catch (error) {
        console.error('备份失败:', error);
        showToast('备份失败，请重试');
    }
}

// 恢复数据
function restoreData() {
    document.getElementById('fileInput').click();
}

// 处理文件恢复
function handleFileRestore() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        showToast('请选择JSON格式的备份文件');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // 验证数据格式
            if (!data.countdowns || !Array.isArray(data.countdowns)) {
                throw new Error('无效的备份文件格式');
            }
            
            // 确认恢复
            if (confirm(`确定要恢复数据吗？\n\n备份时间: ${data.exportTime ? new Date(data.exportTime).toLocaleString('zh-CN') : '未知'}\n倒数日数量: ${data.countdowns.length}\n\n当前数据将被覆盖！`)) {
                countdowns = data.countdowns;
                saveCountdownsToLocalStorage();
                
                // 如果已登录，尝试同步到云端
                if (currentUser && !isLocalOnly) {
                    syncWithCloud().catch(error => {
                        console.error('恢复后同步失败:', error);
                    });
                }
                
                renderCountdowns();
                showToast('数据恢复成功！');
                hideBackupModal();
            }
        } catch (error) {
            console.error('恢复失败:', error);
            showToast('文件格式错误，恢复失败');
        }
    };
    
    reader.readAsText(file);
    // 清空文件输入，允许重复选择同一文件
    fileInput.value = '';
}

// 点击弹框外部关闭
window.onclick = function(event) {
    const backupModal = document.getElementById('backupModal');
    const userModal = document.getElementById('userModal');
    
    if (event.target === backupModal) {
        hideBackupModal();
    }
    
    if (event.target === userModal) {
        hideUserModal();
    }
}

// 自定义日期选择器相关函数
let selectedYear, selectedMonth, selectedDay;

function initDatePicker() {
    const currentDate = new Date();
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const daySelect = document.getElementById('daySelect');
    
    // 初始化年份选择器（从1990年到未来50年）
    const currentYear = currentDate.getFullYear();
    for (let year = 1990; year <= currentYear + 50; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year + '年';
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
    
    // 初始化月份选择器
    for (let month = 1; month <= 12; month++) {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month + '月';
        if (month === currentDate.getMonth() + 1) option.selected = true;
        monthSelect.appendChild(option);
    }
    
    // 初始化日期选择器
    updateDayOptions();
    
    // 监听年份和月份变化，更新日期选项
    yearSelect.addEventListener('change', updateDayOptions);
    monthSelect.addEventListener('change', updateDayOptions);
    
    // 设置默认选中今天
    selectedYear = currentYear;
    selectedMonth = currentDate.getMonth() + 1;
    selectedDay = currentDate.getDate();
    daySelect.value = selectedDay;
    
    // 初始化隐藏的日期字段和显示文本
    const formattedDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
    document.getElementById('date').value = formattedDate;
    
    const selectedDateElement = document.getElementById('selectedDate');
    selectedDateElement.textContent = `${selectedYear}年${selectedMonth}月${selectedDay}日`;
    selectedDateElement.classList.remove('placeholder');
}

function updateDayOptions() {
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const daySelect = document.getElementById('daySelect');
    
    const year = parseInt(yearSelect.value);
    const month = parseInt(monthSelect.value);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // 清空现有选项
    daySelect.innerHTML = '';
    
    // 添加新的日期选项
    for (let day = 1; day <= daysInMonth; day++) {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day + '日';
        daySelect.appendChild(option);
    }
    
    // 如果之前选中的日期在新月份中存在，保持选中
    if (selectedDay && selectedDay <= daysInMonth) {
        daySelect.value = selectedDay;
    } else {
        daySelect.value = 1;
    }
}

function openDatePicker() {
    const modal = document.getElementById('datePickerModal');
    const hiddenInput = document.getElementById('date');
    
    // 如果隐藏输入框有值，使用该值初始化选择器
    if (hiddenInput.value) {
        const date = new Date(hiddenInput.value);
        selectedYear = date.getFullYear();
        selectedMonth = date.getMonth() + 1;
        selectedDay = date.getDate();
        
        document.getElementById('yearSelect').value = selectedYear;
        document.getElementById('monthSelect').value = selectedMonth;
        updateDayOptions();
        document.getElementById('daySelect').value = selectedDay;
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeDatePicker() {
    const modal = document.getElementById('datePickerModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function confirmDateSelection() {
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const daySelect = document.getElementById('daySelect');
    
    selectedYear = parseInt(yearSelect.value);
    selectedMonth = parseInt(monthSelect.value);
    selectedDay = parseInt(daySelect.value);
    
    // 格式化日期为 YYYY-MM-DD
    const formattedDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
    
    // 更新隐藏的日期输入框
    document.getElementById('date').value = formattedDate;
    
    // 更新显示的日期
    const selectedDateElement = document.getElementById('selectedDate');
    selectedDateElement.textContent = `${selectedYear}年${selectedMonth}月${selectedDay}日`;
    selectedDateElement.classList.remove('placeholder');
    
    closeDatePicker();
}

// 导出部分函数到全局作用域，用于HTML调用
window.showListPage = showListPage;
window.showCreatePage = showCreatePage;
window.showDetailPage = showDetailPage;
window.saveCountdown = saveCountdown;
window.deleteCountdown = deleteCountdown;
window.showBackupModal = showBackupModal;
window.hideBackupModal = hideBackupModal;
window.backupData = backupData;
window.restoreData = restoreData;
window.handleFileRestore = handleFileRestore;
window.openDatePicker = openDatePicker;
window.closeDatePicker = closeDatePicker;
window.confirmDateSelection = confirmDateSelection;
window.syncWithCloud = syncWithCloud;
window.hideUserModal = hideUserModal;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);