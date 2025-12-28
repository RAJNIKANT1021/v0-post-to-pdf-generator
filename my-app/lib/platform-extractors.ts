export interface ExtractedImage {
  url: string
  alt?: string
}

export interface PostMetadata {
  platform: string
  author?: string
  caption?: string
  timestamp?: string
  url: string
}

export interface ExtractionResult {
  images: ExtractedImage[]
  metadata: PostMetadata
}

// Detect platform from URL
export function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase()

  if (urlLower.includes("instagram.com")) return "Instagram"
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) return "Twitter/X"
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.com")) return "Facebook"
  if (urlLower.includes("linkedin.com")) return "LinkedIn"
  if (urlLower.includes("tiktok.com")) return "TikTok"
  if (urlLower.includes("threads.net")) return "Threads"

  return "Unknown"
}

// Extract post data from HTML
export async function extractPostData(url: string, html: string): Promise<ExtractionResult> {
  const platform = detectPlatform(url)

  // Parse HTML to extract images and metadata
  const images: ExtractedImage[] = []
  const metadata: PostMetadata = {
    platform,
    url,
  }

  // Extract Open Graph images
  const ogImageRegex = /<meta\s+property="og:image"\s+content="([^"]+)"/gi
  let match
  while ((match = ogImageRegex.exec(html)) !== null) {
    images.push({ url: match[1] })
  }

  // Extract Twitter images
  const twitterImageRegex = /<meta\s+name="twitter:image"\s+content="([^"]+)"/gi
  while ((match = twitterImageRegex.exec(html)) !== null) {
    if (!images.some((img) => img.url === match![1])) {
      images.push({ url: match[1] })
    }
  }

  // Extract metadata
  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)
  if (ogTitleMatch) {
    metadata.caption = ogTitleMatch[1]
  }

  const ogDescriptionMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/)
  if (ogDescriptionMatch && !metadata.caption) {
    metadata.caption = ogDescriptionMatch[1]
  }

  // Platform-specific extraction
  if (platform === "Instagram") {
    metadata.author = extractInstagramAuthor(html)
    const instagramImages = extractInstagramImages(html)
    images.push(...instagramImages)
  } else if (platform === "Twitter/X") {
    metadata.author = extractTwitterAuthor(html)
    const twitterImages = extractTwitterImages(html)
    images.push(...twitterImages)
  }

  // Remove duplicates
  const uniqueImages = Array.from(new Map(images.map((img) => [img.url, img])).values())

  return {
    images: uniqueImages,
    metadata,
  }
}

function extractInstagramAuthor(html: string): string | undefined {
  const match = html.match(/"username":"([^"]+)"/)
  return match?.[1]
}

function extractInstagramImages(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = []

  // Look for display_url in Instagram's JSON data
  const displayUrlRegex = /"display_url":"([^"]+)"/g
  let match
  while ((match = displayUrlRegex.exec(html)) !== null) {
    const url = match[1].replace(/\\u0026/g, "&")
    images.push({ url })
  }

  return images
}

function extractTwitterAuthor(html: string): string | undefined {
  const match = html.match(/<meta\s+name="twitter:creator"\s+content="@?([^"]+)"/)
  return match?.[1]
}

function extractTwitterImages(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = []

  // Extract from Twitter media
  const mediaRegex = /"media_url_https":"([^"]+)"/g
  let match
  while ((match = mediaRegex.exec(html)) !== null) {
    images.push({ url: match[1] })
  }

  return images
}

// Fetch HTML from URL with proper headers
export async function fetchPostHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch post: ${response.statusText}`)
  }

  return response.text()
}
