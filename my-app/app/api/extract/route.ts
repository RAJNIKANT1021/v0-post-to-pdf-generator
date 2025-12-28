import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

interface ExtractedImage {
  url: string
  alt?: string
}

interface PostMetadata {
  platform: string
  author?: string
  caption?: string
  timestamp?: string
  url: string
}

interface ExtractionResult {
  images: ExtractedImage[]
  metadata: PostMetadata
}

// Platform detection
function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase()
  if (urlLower.includes("instagram.com")) return "Instagram"
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) return "Twitter/X"
  if (urlLower.includes("facebook.com")) return "Facebook"
  if (urlLower.includes("linkedin.com")) return "LinkedIn"
  if (urlLower.includes("tiktok.com")) return "TikTok"
  if (urlLower.includes("pinterest.com")) return "Pinterest"
  return "Unknown Platform"
}

// Extract images from Instagram
function extractInstagramImages($: cheerio.CheerioAPI): ExtractedImage[] {
  const images: ExtractedImage[] = []

  // Method 1: Extract from og:image meta tag (primary method)
  const ogImage = $('meta[property="og:image"]').attr("content")
  if (ogImage) {
    images.push({ url: ogImage, alt: "Instagram post image" })
  }

  // Method 2: Look for JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonData = JSON.parse($(el).text())
      if (jsonData.image) {
        const imageUrls = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image]
        imageUrls.forEach((img: string | { url: string }) => {
          const imgUrl = typeof img === "string" ? img : img.url
          if (imgUrl && !images.some((existing) => existing.url === imgUrl)) {
            images.push({ url: imgUrl, alt: "Instagram image" })
          }
        })
      }
    } catch {
      // Ignore JSON parse errors
    }
  })

  // Method 3: Extract from img tags in the page
  $("img[src*='cdninstagram']").each((_, el) => {
    const src = $(el).attr("src")
    if (src && !images.some((img) => img.url === src)) {
      images.push({ url: src, alt: "Instagram image" })
    }
  })

  return images
}

// Extract images from Twitter/X
function extractTwitterImages($: cheerio.CheerioAPI): ExtractedImage[] {
  const images: ExtractedImage[] = []

  // Twitter meta tags
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content")
    if (content) {
      images.push({ url: content, alt: "Twitter post image" })
    }
  })

  $('meta[name="twitter:image"]').each((_, el) => {
    const content = $(el).attr("content")
    if (content && !images.some((img) => img.url === content)) {
      images.push({ url: content, alt: "Twitter image" })
    }
  })

  return images
}

// Extract images from generic platforms
function extractGenericImages($: cheerio.CheerioAPI): ExtractedImage[] {
  const images: ExtractedImage[] = []

  // Open Graph images
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content")
    if (content) {
      images.push({ url: content, alt: "Social media post image" })
    }
  })

  // Twitter card images
  $('meta[name="twitter:image"]').each((_, el) => {
    const content = $(el).attr("content")
    if (content && !images.some((img) => img.url === content)) {
      images.push({ url: content, alt: "Post image" })
    }
  })

  // High-quality img tags
  $("img").each((_, el) => {
    const src = $(el).attr("src")
    const alt = $(el).attr("alt")
    if (src && (src.startsWith("http") || src.startsWith("//"))) {
      const fullUrl = src.startsWith("//") ? `https:${src}` : src
      if (!images.some((img) => img.url === fullUrl)) {
        images.push({ url: fullUrl, alt: alt || "Image" })
      }
    }
  })

  return images
}

// Extract metadata
function extractMetadata($: cheerio.CheerioAPI, url: string, platform: string): PostMetadata {
  const metadata: PostMetadata = {
    platform,
    url,
  }

  // Extract author based on platform
  if (platform === "Instagram") {
    // Try JSON-LD for author name
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).text())
        if (jsonData.author?.name) {
          metadata.author = jsonData.author.name
        }
      } catch {
        // Ignore
      }
    })

    // Fallback: Try to extract from URL
    if (!metadata.author) {
      // Instagram URLs are like /p/DSz5HSOj-oT/ but don't have username in path
      // Try og:article_author or fall back to site name
      const ogArticleAuthor = $('meta[property="og:article:author"]').attr("content")
      if (ogArticleAuthor) {
        metadata.author = ogArticleAuthor
      }
    }
  } else {
    // For other platforms, use standard meta tags
    const ogSiteName = $('meta[property="og:site_name"]').attr("content")
    const twitterCreator = $('meta[name="twitter:creator"]').attr("content")
    metadata.author = twitterCreator || ogSiteName
  }

  // Extract caption/description
  const ogDescription = $('meta[property="og:description"]').attr("content")
  const metaDescription = $('meta[name="description"]').attr("content")
  const caption = ogDescription || metaDescription

  if (caption) {
    metadata.caption = caption.substring(0, 300) // Limit length
  }

  // Extract timestamp
  const publishedTime = $('meta[property="article:published_time"]').attr("content")
  if (publishedTime) {
    metadata.timestamp = new Date(publishedTime).toLocaleString()
  }

  return metadata
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Valid URL is required" }, { status: 400 })
    }

    // Detect platform
    const platform = detectPlatform(url)

    console.log(`[Extract] Processing ${platform} URL: ${url}`)

    // Fetch the page with proper headers
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    })

    if (!response.ok) {
      console.error(`[Extract] Failed to fetch URL: ${response.status} ${response.statusText}`)
      return NextResponse.json({ error: `Failed to fetch URL (${response.status})` }, { status: 400 })
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    console.log(`[Extract] HTML loaded, size: ${html.length} bytes`)

    // Extract images based on platform
    let images: ExtractedImage[] = []

    if (platform === "Instagram") {
      images = extractInstagramImages($)
    } else if (platform === "Twitter/X") {
      images = extractTwitterImages($)
    } else {
      images = extractGenericImages($)
    }

    console.log(`[Extract] Found ${images.length} images after platform-specific extraction`)

    // Remove duplicates
    images = images.filter((img, index, self) => index === self.findIndex((t) => t.url === img.url))

    // Limit to reasonable number
    images = images.slice(0, 20)

    console.log(`[Extract] After dedup and limit: ${images.length} images`)

    if (images.length === 0) {
      console.warn(`[Extract] No images found for URL: ${url}`)
      return NextResponse.json(
        { error: "No images found in the post. The URL might not be accessible or supported." },
        { status: 404 },
      )
    }

    // Extract metadata
    const metadata = extractMetadata($, url, platform)

    console.log(`[Extract] Metadata extracted: ${metadata.author || "unknown"} on ${metadata.platform}`)

    const result: ExtractionResult = {
      images,
      metadata,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Extract] Error:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: "Failed to extract images. Please check the URL and try again." },
      { status: 500 },
    )
  }
}
