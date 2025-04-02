import * as fs from 'fs'

// 自定义参数解析函数
export function parseArgs(args: string[]): { [key: string]: string } {
    const params: { [key: string]: string } = {}
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2) // 去掉 "--"
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : ''
            params[key] = value
            i++ // 跳过值
        }
    }
    return params
}

// 解析小红书分享链接，提取真实 URL
export function extractXhsUrl(shareLinkText: string): string | null {
    const urlMatch = shareLinkText.match(/http:\/\/xhslink\.com\/[a-zA-Z0-9\/]+/)
    return urlMatch ? urlMatch[0] : null
}

// 下载文件到指定路径
export async function downloadFile(url: string, dest: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    const buffer = await response.arrayBuffer()
    fs.writeFileSync(dest, Buffer.from(buffer))
}
