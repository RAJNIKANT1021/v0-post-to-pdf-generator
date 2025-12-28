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

  // Method 1: Extract from og:image meta tag (primary method for shared links)
  const ogImage = $('meta[property="og:image"]').attr("content")
  if (ogImage) {
    images.push({ url: ogImage, alt: "Instagram post image" })
  }

  // Method 2: Extract scontent URLs from the raw HTML
  // Get the raw HTML string and search for scontent URLs
  let html = ""
  try {
    $("*").each((_, el) => {
      const elem = el as any
      if (elem.children) {
        elem.children.forEach((child: any) => {
          if (child.type === "text") {
            html += child.data
          }
        })
      }
    })
  } catch {
    // Fallback to $.html()
    try {
      html = $.html() || ""
    } catch {
      html = ""
    }
  }

  if (html && html.length > 0) {
    // Find all scontent URL patterns - they are embedded in the HTML
    // Looking for: https://scontent...followed by various characters until a quote or tag
    let match
    const urlPattern = /https:\/\/scontent-[a-z0-9.-]+\.cdninstagram\.com\/v\/[^"<>]*(?=["\s<])/g

    while ((match = urlPattern.exec(html)) !== null) {
      const url = match[0]
      // Decode HTML entities
      const decodedUrl = url
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()

      if (decodedUrl && !images.some((img) => img.url === decodedUrl)) {
        images.push({ url: decodedUrl, alt: "Instagram post image" })
      }
    }
  }

  // Method 3: Look for JSON-LD structured data
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

  // Method 4: Extract from img tags in the page
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

  // Twitter/X card images
  $('meta[name="twitter:image:src"]').each((_, el) => {
    const content = $(el).attr("content")
    if (content && !images.some((img) => img.url === content)) {
      images.push({ url: content, alt: "Twitter image" })
    }
  })

  return images
}

// Extract images from LinkedIn
function extractLinkedInImages($: cheerio.CheerioAPI): ExtractedImage[] {
  const images: ExtractedImage[] = []

  // LinkedIn og:image
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content")
    if (content && content.includes("linkedin")) {
      images.push({ url: content, alt: "LinkedIn post image" })
    }
  })

  // LinkedIn img tags with specific patterns
  $("img[src*='licdn']").each((_, el) => {
    const src = $(el).attr("src")
    if (src && !images.some((img) => img.url === src)) {
      images.push({ url: src, alt: "LinkedIn image" })
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
      return NextResponse.json({ error: "Please provide a valid post URL" }, { status: 400 })
    }

    // Clean up the URL (remove query parameters if not needed)
    let cleanUrl = url.trim()

    // Detect platform
    const platform = detectPlatform(cleanUrl)
    if (platform === "Unknown") {
      return NextResponse.json(
        { error: "Unsupported platform. Try Instagram, Twitter/X, Facebook, or LinkedIn posts." },
        { status: 400 },
      )
    }

    console.log(`[Extract] Processing ${platform} URL: ${cleanUrl}`)

    // Fetch the page with proper headers
    let response: Response
    try {
      response = await fetch(cleanUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          Referer: platform === "Instagram" ? "https://www.instagram.com/" : "https://www.google.com/",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })
    } catch (fetchError) {
      console.error(`[Extract] Fetch timeout or error: ${fetchError}`)
      return NextResponse.json(
        { error: "Could not reach the post. Please check the URL and try again." },
        { status: 400 },
      )
    }

    // Handle specific HTTP status codes
    if (response.status === 404) {
      console.warn(`[Extract] Post not found: ${cleanUrl}`)
      return NextResponse.json(
        { error: "Post not found. The URL may be broken or the post might have been deleted." },
        { status: 404 },
      )
    }

    if (response.status === 403) {
      console.warn(`[Extract] Access forbidden (likely private): ${cleanUrl}`)
      return NextResponse.json(
        {
          error: "This post is private or you don't have permission to access it. Please check if the post is public.",
        },
        { status: 403 },
      )
    }

    if (response.status === 429) {
      console.warn(`[Extract] Rate limited: ${cleanUrl}`)
      return NextResponse.json(
        {
          error: "Too many requests. Please wait a moment and try again.",
        },
        { status: 429 },
      )
    }

    if (!response.ok) {
      console.error(`[Extract] Failed to fetch URL: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: `Failed to access post (Error: ${response.status})` },
        { status: 400 },
      )
    }

    const html = await response.text()

    // Check if content indicates a private/deleted post
    if (platform === "Instagram") {
      if (html.includes('"private":true') || html.includes("This account is private")) {
        console.warn(`[Extract] Instagram post is private`)
        return NextResponse.json(
          {
            error: "This Instagram post is private. Make sure the account is public and try again.",
          },
          { status: 403 },
        )
      }
      if (html.includes("Sorry, this page isn't available") || html.includes("Oops, something went wrong")) {
        console.warn(`[Extract] Instagram post not found or deleted`)
        return NextResponse.json(
          { error: "This Instagram post might be deleted or no longer available." },
          { status: 404 },
        )
      }
    }

    if (platform === "Twitter/X") {
      if (html.includes("This post is from a private account") || html.includes("You're not able to see this")) {
        console.warn(`[Extract] Twitter post is private`)
        return NextResponse.json(
          { error: "This post is from a private account or has been deleted." },
          { status: 403 },
        )
      }
    }

    if (platform === "LinkedIn") {
      if (html.includes("You don't have permission") || html.includes("This post isn't available")) {
        console.warn(`[Extract] LinkedIn post not accessible`)
        return NextResponse.json(
          { error: "This LinkedIn post isn't publicly available or has been deleted." },
          { status: 403 },
        )
      }
    }

    const $ = cheerio.load(html)

    console.log(`[Extract] HTML loaded, size: ${html.length} bytes`)

    // Extract images based on platform
    let images: ExtractedImage[] = []

    if (platform === "Instagram") {
      images = extractInstagramImages($)
    } else if (platform === "Twitter/X") {
      images = extractTwitterImages($)
    } else if (platform === "LinkedIn") {
      images = extractLinkedInImages($)
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
      console.warn(`[Extract] No images found for URL: ${cleanUrl}`)
      return NextResponse.json(
        {
          error: `No images found in this ${platform} post. Posts without images or videos cannot be converted.`,
        },
        { status: 400 },
      )
    }

    // Extract metadata
    const metadata = extractMetadata($, cleanUrl, platform)

    console.log(`[Extract] Successfully extracted ${images.length} images from ${platform}`)

    const result: ExtractionResult = {
      images,
      metadata,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Extract] Unexpected error:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again or try a different post." },
      { status: 500 },
    )
  }
}
