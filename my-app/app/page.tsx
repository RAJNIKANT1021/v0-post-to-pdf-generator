"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileDown, Link2, Loader2, CheckCircle2, AlertCircle, ImageIcon, Sparkles, X } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

type ProcessingStatus = "idle" | "extracting" | "generating" | "complete" | "error" | "stopped"

interface ExtractedImage {
  url: string
  alt?: string
}

interface ProcessingResult {
  images: ExtractedImage[]
  metadata: {
    platform: string
    author?: string
    caption?: string
    timestamp?: string
    url: string
  }
}

const SUPPORTED_PLATFORMS = [
  { name: "Instagram", pattern: /instagram\.com/ },
  { name: "Twitter/X", pattern: /twitter\.com|x\.com/ },
  { name: "Facebook", pattern: /facebook\.com|fb\.com/ },
  { name: "LinkedIn", pattern: /linkedin\.com/ },
  { name: "TikTok", pattern: /tiktok\.com/ },
]

export default function Home() {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<ProcessingStatus>("idle")
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const validateUrl = (urlString: string): { valid: boolean; platform?: string; error?: string } => {
    try {
      new URL(urlString)
    } catch {
      return { valid: false, error: "Please enter a valid URL" }
    }

    const supported = SUPPORTED_PLATFORMS.find((p) => p.pattern.test(urlString.toLowerCase()))
    if (!supported) {
      return {
        valid: false,
        error: `Unsupported platform. Try: ${SUPPORTED_PLATFORMS.map((p) => p.name).join(", ")}`,
      }
    }

    return { valid: true, platform: supported.name }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    const validation = validateUrl(url)
    if (!validation.valid) {
      setError(validation.error || "Invalid URL")
      setStatus("error")
      return
    }

    setStatus("extracting")
    setError(null)
    setResult(null)
    setProgress(0)

    abortControllerRef.current = new AbortController()

    try {
      // Extract images
      setProgress(20)
      const extractResponse = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: abortControllerRef.current.signal,
      })

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json()
        throw new Error(errorData.error || "Failed to extract images from this post")
      }

      const extractData = await extractResponse.json()

      if (!extractData.images || extractData.images.length === 0) {
        throw new Error("No images found in this post. Try a post with images.")
      }

      setResult(extractData)
      setProgress(60)

      // Generate PDF
      setStatus("generating")
      setProgress(70)

      const pdfResponse = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extractData),
        signal: abortControllerRef.current.signal,
      })

      if (!pdfResponse.ok) {
        throw new Error("Failed to generate PDF. Please try again.")
      }

      const blob = await pdfResponse.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `post-${extractData.metadata.platform}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      setProgress(100)
      setStatus("complete")
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("stopped")
        setError("Download cancelled")
      } else {
        setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.")
        setStatus("error")
      }
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setStatus("stopped")
      setError("Process stopped by user")
      setProgress(0)
    }
  }

  const handleRetry = () => {
    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  const handleReset = () => {
    setUrl("")
    setStatus("idle")
    setResult(null)
    setError(null)
    setProgress(0)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <FileDown className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
              Post to PDF
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs sm:text-sm text-muted-foreground hidden lg:block">
              Convert social media posts to professional PDFs
            </p>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 sm:py-12 max-w-5xl">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Free & Fast PDF Generation</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 text-balance">
            <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
              Convert Posts to PDF
            </span>
            <br />
            <span className="text-foreground">in Seconds</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground text-balance max-w-2xl mx-auto px-4">
            Extract images and metadata from Instagram, Twitter/X, Facebook, LinkedIn, and TikTok posts. Generate professional PDFs instantly.
          </p>
        </div>

        {/* Input Form */}
        <Card className="p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 relative">
            <div className="space-y-2">
              <label htmlFor="url" className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4 text-accent" />
                Post URL
              </label>
              <Input
                id="url"
                type="url"
                placeholder="https://instagram.com/p/... or https://twitter.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={status === "extracting" || status === "generating"}
                className="h-11 sm:h-12 text-sm sm:text-base"
                required
              />
              <p className="text-xs text-muted-foreground">
                Supports: Instagram • Twitter/X • Facebook • LinkedIn • TikTok
              </p>
            </div>

            {status === "idle" ? (
              <Button
                type="submit"
                size="lg"
                className="w-full h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-accent to-primary hover:opacity-90 transition-opacity"
              >
                <FileDown className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Generate PDF
              </Button>
            ) : status === "complete" ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleReset}
                  size="lg"
                  className="flex-1 h-11 sm:h-12 text-sm sm:text-base"
                  variant="secondary"
                >
                  Convert Another
                </Button>
              </div>
            ) : status === "extracting" || status === "generating" ? (
              <div className="flex gap-2">
                <Button type="button" size="lg" className="flex-1 h-11 sm:h-12 text-sm sm:text-base" disabled>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  {status === "extracting" ? "Extracting Images..." : "Generating PDF..."}
                </Button>
                <Button
                  type="button"
                  onClick={handleStop}
                  size="lg"
                  variant="destructive"
                  className="h-11 sm:h-12 px-3 sm:px-4"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline ml-2">Stop</span>
                </Button>
              </div>
            ) : status === "error" || status === "stopped" ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleRetry}
                  size="lg"
                  className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-accent to-primary"
                >
                  Try Again
                </Button>
                <Button
                  type="button"
                  onClick={handleReset}
                  size="lg"
                  variant="secondary"
                  className="h-11 sm:h-12"
                >
                  Reset
                </Button>
              </div>
            ) : null}
          </form>

          {/* Progress Bar */}
          {(status === "extracting" || status === "generating") && (
            <div className="mt-4 sm:mt-6 relative">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">{progress}% complete</p>
            </div>
          )}
        </Card>

        {/* Success Alert */}
        {status === "complete" && result && (
          <Alert className="mb-6 sm:mb-8 border-accent/50 bg-gradient-to-r from-accent/10 to-primary/10">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <AlertDescription className="text-sm sm:text-base">
              ✓ PDF generated successfully! Downloaded with {result.images.length} image{result.images.length !== 1 ? "s" : ""} from{" "}
              <span className="font-semibold text-accent">{result.metadata.platform}</span>.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {(status === "error" || status === "stopped") && error && (
          <Alert className="mb-6 sm:mb-8 border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-sm sm:text-base">
              <span className="font-semibold">Error:</span> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Preview */}
        {result && result.images.length > 0 && (
          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
              Extracted Images ({result.images.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {result.images.slice(0, 8).map((img, idx) => (
                <div
                  key={idx}
                  className="aspect-square bg-secondary rounded-lg overflow-hidden border-2 border-border hover:border-accent transition-colors"
                >
                  <img
                    src={img.url || "/placeholder.svg"}
                    alt={img.alt || `Image ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            {result.metadata && (
              <div className="border-t border-border pt-4 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Platform:</span>
                  <span className="font-medium text-accent">{result.metadata.platform}</span>
                </div>
                {result.metadata.author && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Author:</span>
                    <span className="font-medium truncate">@{result.metadata.author}</span>
                  </div>
                )}
                {result.metadata.caption && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Caption:</span>
                    <span className="font-medium text-right line-clamp-2">{result.metadata.caption}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Features Section */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16">
          <Card className="p-5 sm:p-6 relative overflow-hidden group hover:border-accent/50 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-3 sm:mb-4 relative">
              <Link2 className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
            </div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Multi-Platform Support</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Instagram, Twitter/X, Facebook, LinkedIn, TikTok, and more
            </p>
          </Card>

          <Card className="p-5 sm:p-6 relative overflow-hidden group hover:border-primary/50 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 sm:mb-4 relative">
              <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base">High Quality Images</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Original resolution images with metadata preservation
            </p>
          </Card>

          <Card className="p-5 sm:p-6 relative overflow-hidden group hover:border-accent/50 transition-colors sm:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-3 sm:mb-4 relative">
              <FileDown className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
            </div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Instant PDF Generation</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Professional PDFs with headers, footers, and metadata
            </p>
          </Card>
        </div>
      </main>
    </div>
  )
}
