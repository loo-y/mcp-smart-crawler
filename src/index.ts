import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { parseArgs, downloadFile, extractXhsUrl } from './helper.js'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process';
import { chromium, Browser, Page, Response as PlaywrightResponse } from 'playwright';
import { Writable } from 'stream'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures the required Playwright browser (Chromium) is installed.
 * Uses execSync to run the command and pipes stdio to show progress/output.
 */
function ensureBrowserInstalled(): void {
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

// 1. Ensure the browser dependency is met *before* running the main logic
ensureBrowserInstalled();

// Create server instance
const server = new McpServer({
    name: 'mcp-smart-crawler',
    version: '1.0.0',
    capabilities: {
        resources: {},
        tools: {},
    },
})

// 解析命令行参数
const args = process.argv.slice(2) // 跳过 node 和脚本路径
let saveFolder = './downloads' // 默认路径
// 使用 __dirname 获取当前文件所在目录
const currentFileDirectory = __dirname;

const parsedArgs = parseArgs(args)
if (parsedArgs['download-folder']) {
    saveFolder = parsedArgs['download-folder']
    console.error(`Save folder set to: ${saveFolder}`)
} else {
    console.error('No --download-folder specified, using default:', saveFolder)
}

saveFolder = path.join(currentFileDirectory, saveFolder)
// 确保保存目录存在
if (!fs.existsSync(saveFolder)) {
    fs.mkdirSync(saveFolder, { recursive: true })
}

const absolutePath = path.resolve(saveFolder)
console.error(`Created download folder: ${absolutePath}`)

const XhsPostSchema = z.object({
    success: z.boolean(),
    url: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    images: z.array(z.string()).optional(),
    downloadedVideoPaths: z.array(z.string()).optional(), // Paths to downloaded files
    error: z.string().optional(),
    debugInfo: z.object({ // Add debug info
        videoSourcesFound: z.array(z.string()).optional(),
        interceptedVideoRequests: z.array(z.string()).optional(),
    }).optional(),
});
// Define the type for the return value based on the schema
type XhsPostData = z.infer<typeof XhsPostSchema>;

server.tool(
    'get-xhs-post',
    'Get post content, images, and download videos from Xiaohongshu (Xiaohongshu/小红书) using page.route.',
    {
        shareLinkText: z.string().describe('The share link text copied from Xiaohongshu (小红书) app or web'),
    },
    async ({ shareLinkText }) => {
        const downloadDir = saveFolder; // Use the directory specified in command line args
        console.error(`[get-xhs-post] Received share link text: "${shareLinkText}"`);
        console.error(`[get-xhs-post] Download directory: "${downloadDir}"`);
        // 1. Ensure download directory exists
        try {
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }
        } catch (err: any) {
            return {
                content: [{
                    type: 'text',
                    // Error creating directory
                    text: `Error creating download directory`
                }]
            }
        }
        // 2. Extract URL
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = shareLinkText.match(urlRegex);
        if (!urls || urls.length === 0) {
            return {
                content: [{
                    type: 'text',
                    // No URL found in the input
                    text: 'No URL found in the input'
                }]
            }
        }
        const postUrl = extractXhsUrl(shareLinkText) || urls[0];
        let browser: Browser | null = null;
        const downloadedVideoPaths: string[] = [];
        const interceptedVideoRequests: string[] = []; // For debugging routed URLs
        const videoSourcesFound: string[] = []; // For debugging <video> src attributes
        try {
            // 3. Launch Playwright
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 800 },
                locale: 'zh-CN',
            });
            const page = await context.newPage();
            // **** SETUP page.route INTERCEPTION ****
            // Define a pattern to match your video URLs. Be specific if possible.
            // Example: Match URLs ending in .mp4 from the specific XHS CDN host
            const videoUrlPattern = /https:\/\/sns-bak-v\d+\.xhscdn\.com\/.*\.mp4/;
            // Or a more general pattern (might intercept too much, filter inside handler)
            // const videoUrlPattern = /.*\.mp4/;
            console.error(`[get-xhs-post] Setting up route intercept for pattern: ${videoUrlPattern}`);
            await page.route(videoUrlPattern, async (route, request) => {
                const reqUrl = request.url();
                console.error(`[route handler] Intercepted request: ${reqUrl}`);
                interceptedVideoRequests.push(reqUrl); // Log the URL we are handling
                try {
                    // 1. Fetch the original response *through the route*
                    // This allows Playwright to capture the response body more reliably
                    console.error(`[route handler] Fetching original response for: ${reqUrl}`);
                    const response = await route.fetch(); // Use route.fetch() not context.request.fetch()
                    console.error(`[route handler] Original response status: ${response.status()} for ${reqUrl}`);
                    // Check if response is OK and likely video content before processing
                    const contentType = response.headers()['content-type']?.toLowerCase();
                    if (response.ok() && contentType?.startsWith('video/')) {
                        // 2. Get the response body buffer
                        console.error(`[route handler] Getting response buffer for: ${reqUrl}`);
                        const bodyBuffer = await response.body(); // Try getting buffer from the fetched response
                        console.error(`[route handler] Got buffer (size: ${bodyBuffer.length} bytes) for: ${reqUrl}`);
                        if (bodyBuffer.length > 0) {
                            // 3. Save the buffer to file
                            const video_pathname = path.basename(new URL(reqUrl).pathname)
                            // if (video_pathname.endsWith('.mp4')) {
                            const filename =  video_pathname.endsWith('.mp4') ? video_pathname : `${video_pathname}_${Date.now()}.mp4`; // Basic filename
                            const filePath = path.join(downloadDir, filename);
                            console.error(`[route handler] Saving video to: ${filePath}`);
                            fs.writeFileSync(filePath, bodyBuffer); // Consider async or streams for large files
                            downloadedVideoPaths.push(filePath);
                            console.error(`[route handler] Successfully saved: ${filePath}`);
                        } else {
                             console.warn(`[route handler] Response body buffer is empty for: ${reqUrl}`);
                        }
                    } else {
                        console.error(`[route handler] Skipping body processing for ${reqUrl} (Status: ${response.status()}, Content-Type: ${contentType})`);
                    }
                    // 4. CRITICAL: Fulfill the route with the original response
                    // This sends the data back to the browser page so the video player works
                    console.error(`[route handler] Fulfilling route for: ${reqUrl}`);
                    await route.fulfill({ response }); // Pass the APIResponse object back
                } catch (error: any) {
                    console.error(`[route handler] Error processing route for ${reqUrl}: ${error.message}`, error.stack);
                    // Abort the route on error to avoid hanging the page request indefinitely
                    // Alternatively, you could try fulfilling with an error status if appropriate
                    await route.abort();
                }
            });
            // **** END page.route SETUP ****
            // Remove the page.on('response') handler for video saving as it's now handled by page.route
            // page.on('response', ...) // REMOVE or keep only for logging non-video responses
            // 4. Navigate
            console.error(`[get-xhs-post] Navigating to ${postUrl}...`);
            await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 90000 }); // networkidle might be okay now, or 'load'
            console.error(`[get-xhs-post] Navigation complete. Current URL: ${page.url()}`);
            // 5. Wait a bit more if needed, although route should capture requests during load
            // await page.waitForTimeout(5000); // Maybe less critical now
            // --- Extract metadata (Title, Description, Images) ---
             const noteContainerSelector = '#noteContainer'; // *** REPLACE ***
             const titleSelector = '.note-title'; // *** REPLACE ***
             const descSelector = '.note-content, .desc'; // *** REPLACE ***
             const imageSelector = '.swiper-slide img.content-image'; // *** REPLACE ***
             // ... (metadata extraction logic remains the same)
             let title = '';
             let description = '';
             const images: string[] = [];
              try {
                  await page.waitForSelector(noteContainerSelector, { timeout: 5000 }).catch(() => console.warn('Note container not found'));
                  title = await page.locator(titleSelector).first().textContent({ timeout: 3000 }) ?? '';
                  description = await page.locator(descSelector).first().innerText({ timeout: 3000 }) ?? '';
                  const imageElements = await page.locator(imageSelector).all();
                  for (const img of imageElements) {
                      let src = await img.getAttribute('src') || await img.getAttribute('data-src');
                      if (src && src.startsWith('http')) images.push(src);
                  }
                  // Get video element sources for debugging
                  const videoElements = await page.locator('video').all();
                  for(const videoEl of videoElements) {
                       const src = await videoEl.getAttribute('src');
                       if (src) videoSourcesFound.push(src);
                  }
             } catch (metaError: any) {
                  console.warn(`[get-xhs-post] Error extracting metadata: ${metaError.message}`);
             }
            // --- Construct result ---
            // The downloadedVideoPaths array is populated by the route handler now
            console.error(`[get-xhs-post] Finalizing result. Videos downloaded: ${downloadedVideoPaths.length}`);
            const result: XhsPostData = {
                success: true,
                url: page.url(),
                title: title.trim(),
                description: description.trim(),
                images: images,
                downloadedVideoPaths: downloadedVideoPaths,
                debugInfo: {
                    videoSourcesFound: videoSourcesFound,
                    interceptedVideoRequests: interceptedVideoRequests,
                }
            };
            if (videoSourcesFound.some(src => src?.includes('.mp4')) && downloadedVideoPaths.length === 0) {
                 console.warn("[get-xhs-post] MP4 source detected in <video> tag, but no MP4 file was downloaded via routing. Check route pattern and network logs.");
                 // Consider adding a note to the error or result indicating potential download failure
            }
            XhsPostSchema.parse(result);
            // Cleanup
            if (browser) {
                console.error('[get-xhs-post] Closing browser.');
                await browser.close();
            }
            return {
                content: [{
                    type: 'text',
                    // Success message
                    text: `Success! here is the detail result:\n\n${JSON.stringify(result, null, 2)}`
                }]
            }
        } catch (error: any) {
            console.error(`[get-xhs-post] General error during scraping: ${error.message}`, error.stack);
            // Cleanup
            if (browser) {
                console.error('[get-xhs-post] Closing browser.');
                await browser.close();
            }
            return {
                content: [{
                    type: 'text',
                    // Error message
                    text: `Error: ${error.message}`
                }]
            }
        } 
    }
);

async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('MCP Server running on stdio')
}

main().catch(error => {
    console.error('Fatal error in main():', error)
    process.exit(1)
})
