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
export async function downloadFile(url: string, dest: string): Promise<{contentType?: string, dataUri?: string, error?: string}> {
    let contentType, dataUri, errorInfo;
    try{
        const response = await fetch(url)
        if (!response.ok){
            // throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
            console.error(`Failed to fetch ${url}: ${response.statusText}`)
            return {
                error: `Failed to fetch ${url}: ${response.statusText}`
            }
        }
        const contentType = response.headers.get('content-type') || undefined;
        const buffer = await response.arrayBuffer()
        const nodeBuffer = Buffer.from(buffer)
        fs.writeFileSync(dest, nodeBuffer)
        // 将 Buffer 转换为 Base64 字符串
        const base64String = nodeBuffer.toString('base64');
        console.log(`Converted to Base64 string (length: ${base64String.length})`);
        const dataUri = `data:${contentType};base64,${base64String}`;
        return {contentType, dataUri: base64String};
    }catch (error) {
        console.error(`Error downloading file: ${error}`)
        errorInfo = `Error downloading file: ${error}`
    }
    return {
        contentType,
        dataUri,
        error: errorInfo
    }
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
