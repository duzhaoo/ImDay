// supabase.js - Supabase客户端配置

// 导入Supabase客户端
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase项目URL和公共匿名密钥（这些值需要替换为你的实际项目信息）
const SUPABASE_URL = 'https://sdmiqzxuaegxoosucbtj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbWlxenh1YWVneG9vc3VjYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NTcyNzksImV4cCI6MjA2NzUzMzI3OX0.0m3DdXmbsjWrIGLyvBi9pDs4WHKoNbjgB6vzXH_zazM'

// 创建Supabase客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 用户状态
export let currentUser = null

// 检查当前用户登录状态
export async function checkUser() {
    const { data } = await supabase.auth.getSession()
    currentUser = data?.session?.user || null
    return currentUser
}

// 使用邮箱和密码注册
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })
    
    if (error) throw error
    return data
}

// 使用邮箱和密码登录
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    
    if (error) throw error
    currentUser = data.user
    return data
}

// 退出登录
export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    currentUser = null
}

// 同步倒数日到云端
export async function syncCountdowns(countdowns) {
    if (!currentUser) return { error: '用户未登录' }
    
    try {
        // 先删除用户所有现有记录
        await supabase
            .from('countdowns')
            .delete()
            .eq('user_id', currentUser.id)
        
        // 批量插入新记录
        if (countdowns.length > 0) {
            // 确保所有记录使用正确的列名
            const coundownsWithUserId = countdowns.map(countdown => {
                // 创建新对象，确保使用正确的列名
                return {
                    id: countdown.id,
                    title: countdown.title, 
                    date: countdown.date,
                    created_at: countdown.created_at || countdown.createdAt || new Date().toISOString(),
                    user_id: currentUser.id
                }
            })
            
            const { error } = await supabase
                .from('countdowns')
                .insert(coundownsWithUserId)
                
            if (error) throw error
        }
        
        return { success: true }
    } catch (error) {
        console.error('同步失败:', error)
        return { error: error.message }
    }
}

// 从云端获取倒数日
export async function fetchCountdowns() {
    if (!currentUser) return { data: [], error: '用户未登录' }
    
    try {
        const { data, error } = await supabase
            .from('countdowns')
            .select('*')
            .eq('user_id', currentUser.id)
            
        if (error) throw error
        return { data }
    } catch (error) {
        console.error('获取数据失败:', error)
        return { data: [], error: error.message }
    }
} 