import { type NextRequest, NextResponse } from "next/server"
import { generatePDF } from "@/lib/pdf-generator"

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

interface PDFRequest {
  images: ExtractedImage[]
  metadata: PostMetadata
}

export async function POST(req: NextRequest) {
  try {
    const data: PDFRequest = await req.json()

    if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 })
    }

    if (!data.metadata) {
      return NextResponse.json({ error: "Metadata is required" }, { status: 400 })
    }

    console.log("[v0] Generating PDF for", data.images.length, "images from", data.metadata.platform)

    // Generate PDF
    const pdfBytes = await generatePDF({
      images: data.images,
      metadata: data.metadata,
    })

    console.log("[v0] PDF generated successfully, size:", pdfBytes.length, "bytes")

    // Return PDF as blob (ensure BodyInit-compatible type)
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="post-${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[v0] PDF generation error:", error)
    return NextResponse.json({ error: "Failed to generate PDF. Please try again." }, { status: 500 })
  }
}
