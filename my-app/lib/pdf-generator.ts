import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

export interface PDFGenerationOptions {
  images: Array<{ url: string; alt?: string }>
  metadata: {
    platform: string
    author?: string
    caption?: string
    timestamp?: string
    url: string
  }
}

export async function generatePDF(options: PDFGenerationOptions): Promise<Uint8Array> {
  const { images, metadata } = options

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()

  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Page settings
  const pageWidth = 595 // A4 width in points
  const pageHeight = 842 // A4 height in points
  const margin = 50
  const headerHeight = 60
  const footerHeight = 40
  const contentWidth = pageWidth - 2 * margin
  const contentHeight = pageHeight - 2 * margin - headerHeight - footerHeight

  // Download and embed images
  for (let i = 0; i < images.length; i++) {
    const image = images[i]

    try {
      // Fetch image data
      const imageResponse = await fetch(image.url)
      if (!imageResponse.ok) {
        console.log(`[v0] Failed to fetch image ${i + 1}: ${imageResponse.statusText}`)
        continue
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const imageBytes = new Uint8Array(imageBuffer)

      // Try to embed as JPEG or PNG
      let embeddedImage
      try {
        if (image.url.toLowerCase().includes(".png") || image.url.toLowerCase().includes("format=png")) {
          embeddedImage = await pdfDoc.embedPng(imageBytes)
        } else {
          embeddedImage = await pdfDoc.embedJpg(imageBytes)
        }
      } catch (embedError) {
        // Try the other format if first attempt fails
        try {
          if (image.url.toLowerCase().includes(".png")) {
            embeddedImage = await pdfDoc.embedJpg(imageBytes)
          } else {
            embeddedImage = await pdfDoc.embedPng(imageBytes)
          }
        } catch (secondError) {
          console.log(`[v0] Failed to embed image ${i + 1}`)
          continue
        }
      }

      // Create a new page for this image
      const page = pdfDoc.addPage([pageWidth, pageHeight])

      // Draw header
      page.drawRectangle({
        x: 0,
        y: pageHeight - headerHeight,
        width: pageWidth,
        height: headerHeight,
        color: rgb(0.11, 0.13, 0.18),
      })

      page.drawText(`${metadata.platform} Post`, {
        x: margin,
        y: pageHeight - headerHeight + 30,
        size: 14,
        font: boldFont,
        color: rgb(1, 1, 1),
      })

      if (metadata.author) {
        page.drawText(`by @${metadata.author}`, {
          x: margin,
          y: pageHeight - headerHeight + 12,
          size: 10,
          font: font,
          color: rgb(0.8, 0.8, 0.8),
        })
      }

      // Calculate image dimensions to fit content area
      const imgWidth = embeddedImage.width
      const imgHeight = embeddedImage.height
      const imgAspect = imgWidth / imgHeight

      let drawWidth = contentWidth
      let drawHeight = drawWidth / imgAspect

      if (drawHeight > contentHeight) {
        drawHeight = contentHeight
        drawWidth = drawHeight * imgAspect
      }

      const x = margin + (contentWidth - drawWidth) / 2
      const y = margin + footerHeight + (contentHeight - drawHeight) / 2

      // Draw image
      page.drawImage(embeddedImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      })

      // Draw footer
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: footerHeight,
        color: rgb(0.11, 0.13, 0.18),
      })

      page.drawText(`Image ${i + 1} of ${images.length}`, {
        x: margin,
        y: footerHeight - 20,
        size: 9,
        font: font,
        color: rgb(0.8, 0.8, 0.8),
      })

      page.drawText(new Date().toLocaleDateString(), {
        x: pageWidth - margin - 80,
        y: footerHeight - 20,
        size: 9,
        font: font,
        color: rgb(0.8, 0.8, 0.8),
      })
    } catch (error) {
      console.log(`[v0] Error processing image ${i + 1}:`, error)
      continue
    }
  }

  // If we have a caption, add a cover page
  if (metadata.caption && metadata.caption.length > 0) {
    const coverPage = pdfDoc.insertPage(0, [pageWidth, pageHeight])

    coverPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(0.11, 0.13, 0.18),
    })

    coverPage.drawText("Post to PDF", {
      x: margin,
      y: pageHeight - 100,
      size: 24,
      font: boldFont,
      color: rgb(1, 1, 1),
    })

    coverPage.drawText(`${metadata.platform} Post`, {
      x: margin,
      y: pageHeight - 140,
      size: 16,
      font: font,
      color: rgb(0.6, 0.73, 0.82),
    })

    if (metadata.author) {
      coverPage.drawText(`@${metadata.author}`, {
        x: margin,
        y: pageHeight - 180,
        size: 14,
        font: font,
        color: rgb(0.9, 0.9, 0.9),
      })
    }

    // Wrap caption text
    const captionLines = wrapText(metadata.caption, contentWidth - 40, 12, font)
    let captionY = pageHeight - 240

    for (const line of captionLines.slice(0, 10)) {
      coverPage.drawText(line, {
        x: margin,
        y: captionY,
        size: 12,
        font: font,
        color: rgb(0.85, 0.85, 0.85),
      })
      captionY -= 20
    }

    coverPage.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: margin,
      y: 60,
      size: 10,
      font: font,
      color: rgb(0.6, 0.6, 0.6),
    })
  }

  // Save the PDF
  return await pdfDoc.save()
}

function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const textWidth = font.widthOfTextAtSize(testLine, fontSize)

    if (textWidth > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}
