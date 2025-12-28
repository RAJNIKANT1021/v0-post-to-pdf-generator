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

  // Try meta tags first (Open Graph)
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content")
    if (content) {
      images.push({ url: content, alt: "Instagram post image" })
    }
  })

  // Try img tags
  $("img").each((_, el) => {
    const src = $(el).attr("src")
    const alt = $(el).attr("alt")
    if (src && src.includes("cdninstagram")) {
      images.push({ url: src, alt: alt || "Instagram image" })
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

  // Try to get author
  const ogSiteName = $('meta[property="og:site_name"]').attr("content")
  const twitterCreator = $('meta[name="twitter:creator"]').attr("content")
  const author = twitterCreator || ogSiteName

  if (author) {
    metadata.author = author.replace("@", "")
  }

  // Try to get caption/description
  const ogDescription = $('meta[property="og:description"]').attr("content")
  const metaDescription = $('meta[name="description"]').attr("content")
  const caption = ogDescription || metaDescription

  if (caption) {
    metadata.caption = caption.substring(0, 300) // Limit length
  }

  // Try to get timestamp
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

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 })
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract images based on platform
    let images: ExtractedImage[] = []

    if (platform === "Instagram") {
      images = extractInstagramImages($)
    } else if (platform === "Twitter/X") {
      images = extractTwitterImages($)
    } else {
      images = extractGenericImages($)
    }

    // Remove duplicates
    images = images.filter((img, index, self) => index === self.findIndex((t) => t.url === img.url))

    // Limit to reasonable number
    images = images.slice(0, 20)

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No images found in the post. The URL might not be accessible or supported." },
        { status: 404 },
      )
    }

    // Extract metadata
    const metadata = extractMetadata($, url, platform)

    const result: ExtractionResult = {
      images,
      metadata,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Extraction error:", error)
    return NextResponse.json(
      { error: "Failed to extract images. Please check the URL and try again." },
      { status: 500 },
    )
  }
}
