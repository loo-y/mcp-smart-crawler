[中文](#mcp-smart-crawler-chinese)

# MCP Smart Crawler
MCP Smart Crawler is a Model Context Protocol (MCP) server uses Playwright to crawl web content, extract metadata, and download resources such as videos and images. 

## Key Features
*   Extract metadata (title, description, images) from Xiaohongshu (小红书) posts.
*   Download videos and images from Xiaohongshu share links.
*   Uses Playwright for browser automation.

## How to Use (MCP Client Configuration)

To use this server with your MCP client, add the following configuration to your client's MCP server settings. You will need to adjust the `command` and `args` based on how you run the server script.

**Example Configuration:**
```json
{
  "mcpServers": {
    "mcp-smart-crawler": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-smart-crawler",
        "--download-folder", // optional
        "c:\\downloads" // optional
      ],
    }
  }
}
```

**Example chat:**
```text
帮我查看这条小红书的内容和图片，并告诉我图片里面是什么
59 XXX发布了一篇小红书笔记，快来看吧！ 😆 OfTOBst2PsxctaX 😆 http://xhslink.com/a/xxaabbcczz，复制本条信息，打开【小红书】App查看精彩内容！
```
<br />
<hr />
<br />

<span id="mcp-smart-crawler-chinese"></span>
# MCP Smart Crawler
MCP Smart Crawler 是一个模型上下文协议（MCP）服务器，使用 Playwright 来爬取网页内容，提取元数据，并下载资源如视频和图片。

## 主要功能
*   从小红书（Xiaohongshu）帖子中提取元数据（标题、描述、图片）。
*   从小红书分享链接中下载视频和图片。
*   使用Playwright进行浏览器自动化。

## 使用方法（MCP客户端配置）

要在您的MCP客户端中使用此服务器，请将以下配置添加到客户端的MCP服务器设置中。您需要根据服务器脚本的运行方式调整 `command`和 `args`。

**示例配置:**
```json
{
  "mcpServers": {
    "mcp-smart-crawler": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-smart-crawler",
        "--download-folder", // optional
        "c:\\downloads" // optional
      ],
    }
  }
}
```

**示例对话:**
```text
帮我查看这条小红书的内容和图片，并告诉我图片里面是什么
59 XXX发布了一篇小红书笔记，快来看吧！ 😆 OfTOBst2PsxctaX 😆 http://xhslink.com/a/xxaabbcczz，复制本条信息，打开【小红书】App查看精彩内容！
```
