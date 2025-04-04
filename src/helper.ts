import * as fs from 'fs'
import { execSync } from 'child_process';

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

/**
 * Ensures the required Playwright browser (Chromium) is installed.
 * Uses execSync to run the command and pipes stdio to show progress/output.
 */
 export function ensureBrowserInstalled(): void {
    try {
        console.log('Checking and ensuring Playwright Chromium browser is installed...');
        // We use 'npx playwright install ...' to ensure it finds the playwright CLI
        // even in the temporary npx environment.
        // 'stdio: inherit' shows the download progress directly to the user.
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        console.log('Chromium installation check complete.');
    } catch (error) {
        console.error('---------------------------------------------------------');
        console.error('Failed to install Playwright Chromium browser.');
        console.error('Please try installing it manually by running:');
        console.error('  npx playwright install chromium');
        console.error('Or ensure you have network connectivity.');
        console.error('---------------------------------------------------------');
        // Re-throw the error or exit, as the tool cannot proceed
        console.error('Original Error:', error);
        process.exit(1); // Exit the process if browser setup fails
    }
}
