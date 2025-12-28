"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  FileDown,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Sparkles,
  X,
  RefreshCw,
  Lock,
  Trash2,
} from "lucide-react"
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
  { name: "Instagram", icon: "📸", pattern: /instagram\.com/ },
  { name: "Twitter/X", icon: "𝕏", pattern: /twitter\.com|x\.com/ },
  { name: "Facebook", icon: "f", pattern: /facebook\.com|fb\.com/ },
  { name: "LinkedIn", icon: "in", pattern: /linkedin\.com/ },
  { name: "TikTok", icon: "♪", pattern: /tiktok\.com/ },
]

const ERROR_MESSAGES: Record<string, { title: string; description: string; icon: string }> = {
  PRIVATE_POST: {
    title: "Post is Private",
    description: "This post is not publicly available. Make sure the account/post is public.",
    icon: "🔒",
  },
  DELETED_POST: {
    title: "Post Not Found",
    description: "This post may have been deleted or the link is broken.",
    icon: "🗑️",
  },
  NO_IMAGES: {
    title: "No Images Found",
    description: "This post doesn't contain any images. Only posts with images can be converted.",
    icon: "🖼️",
  },
  UNSUPPORTED_PLATFORM: {
    title: "Unsupported Platform",
    description: "Please use a post URL from Instagram, Twitter/X, Facebook, LinkedIn, or TikTok.",
    icon: "❌",
  },
  RATE_LIMITED: {
    title: "Please Wait",
    description: "Too many requests. Wait a moment and try again.",
    icon: "⏱️",
  },
}

export default function Home() {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<ProcessingStatus>("idle")
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [progress, setProgress] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const validateUrl = (urlString: string): { valid: boolean; platform?: string } => {
    try {
      new URL(urlString)
    } catch {
      return { valid: false }
    }

    const supported = SUPPORTED_PLATFORMS.find((p) => p.pattern.test(urlString.toLowerCase()))
    return { valid: !!supported, platform: supported?.name }
  }

  const getErrorInfo = (message: string, statusCode?: number) => {
    if (message.includes("private")) {
      return { code: "PRIVATE_POST", message: ERROR_MESSAGES.PRIVATE_POST.description }
    }
    if (message.includes("deleted") || message.includes("not found")) {
      return { code: "DELETED_POST", message: ERROR_MESSAGES.DELETED_POST.description }
    }
    if (message.includes("No images")) {
      return { code: "NO_IMAGES", message: ERROR_MESSAGES.NO_IMAGES.description }
    }
    if (statusCode === 429 || message.includes("Too many")) {
      return { code: "RATE_LIMITED", message: ERROR_MESSAGES.RATE_LIMITED.description }
    }
    if (message.includes("Unsupported")) {
      return { code: "UNSUPPORTED_PLATFORM", message: ERROR_MESSAGES.UNSUPPORTED_PLATFORM.description }
    }
    return { code: "UNKNOWN", message }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    const validation = validateUrl(url)
    if (!validation.valid) {
      setError(getErrorInfo("Unsupported platform"))
      setStatus("error")
      return
    }

    setStatus("extracting")
    setError(null)
    setResult(null)
    setProgress(0)
    setRetryCount(0)

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

      const extractData = await extractResponse.json()

      if (!extractResponse.ok) {
        const errorInfo = getErrorInfo(extractData.error, extractResponse.status)
        throw new Error(JSON.stringify(errorInfo))
      }

      if (!extractData.images || extractData.images.length === 0) {
        throw new Error(JSON.stringify(getErrorInfo("No images found")))
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
        throw new Error(JSON.stringify({ code: "PDF_ERROR", message: "Failed to generate PDF" }))
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
        setError({ code: "STOPPED", message: "Download cancelled" })
      } else {
        try {
          const errorInfo = JSON.parse(err instanceof Error ? err.message : "{}")
          setError(errorInfo)
        } catch {
          setError({ code: "UNKNOWN", message: err instanceof Error ? err.message : "Something went wrong" })
        }
        setStatus("error")
      }
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleRetry = () => {
    setRetryCount(retryCount + 1)
    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  const handleReset = () => {
    setUrl("")
    setStatus("idle")
    setResult(null)
    setError(null)
    setProgress(0)
    setRetryCount(0)
  }

  const errorInfo = error ? ERROR_MESSAGES[error.code] || null : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
              <FileDown className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
                Post to PDF
              </h1>
              <p className="text-xs text-muted-foreground">Extract & Download Social Media Posts</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
            <Sparkles className="h-4 w-4 text-accent animate-pulse" />
            <span className="text-sm font-medium text-accent">Fast • Free • No Signup</span>
          </div>

          <div>
            <h2 className="text-5xl font-bold mb-3 text-balance">
              Convert Your Posts to
              <br />
              <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
                Professional PDFs
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Paste a social media post link. We extract images and create a beautiful PDF in seconds.
            </p>
          </div>
        </div>

        {/* Main Input Card */}
        <Card className="p-8 mb-8 relative overflow-hidden shadow-xl border-accent/20">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />

          <form onSubmit={handleSubmit} className="space-y-6 relative">
            <div className="space-y-3">
              <label htmlFor="url" className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4 text-accent" />
                Paste Your Post Link
              </label>
              <div className="relative">
                <Input
                  id="url"
                  type="url"
                  placeholder="https://instagram.com/p/... or https://twitter.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={status === "extracting" || status === "generating"}
                  className="h-12 text-base pl-4 pr-10 border-2 border-border/50 focus:border-accent transition-colors"
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => setUrl("")}
                    className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {SUPPORTED_PLATFORMS.map((p) => (
                  <span key={p.name} className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                    {p.icon} {p.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {status === "idle" || status === "error" || status === "stopped" ? (
              <div className="flex gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1 h-12 text-base bg-gradient-to-r from-accent to-primary hover:shadow-lg hover:shadow-accent/20 transition-all"
                  disabled={!url.trim()}
                >
                  <FileDown className="mr-2 h-5 w-5" />
                  {status === "idle" ? "Generate PDF" : "Try Again"}
                </Button>
                {(status === "error" || status === "stopped") && (
                  <Button type="button" onClick={handleReset} variant="outline" size="lg" className="h-12">
                    <RefreshCw className="mr-2 h-5 w-5" />
                    New
                  </Button>
                )}
              </div>
            ) : status === "complete" ? (
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 h-12 text-base bg-gradient-to-r from-accent to-primary"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Convert Another
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button type="button" size="lg" className="flex-1 h-12 text-base" disabled>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {status === "extracting" ? "Extracting Images..." : "Generating PDF..."}
                </Button>
                <Button
                  type="button"
                  onClick={handleStop}
                  variant="destructive"
                  size="lg"
                  className="h-12 px-6"
                  title="Cancel this conversion"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Progress Bar */}
            {(status === "extracting" || status === "generating") && (
              <div className="space-y-2">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{progress === 20 ? "Accessing post..." : progress === 60 ? "Creating PDF..." : "Finalizing..."}
                  </span>
                  <span className="font-semibold text-accent">{progress}%</span>
                </div>
              </div>
            )}
          </form>
        </Card>

        {/* Success Alert */}
        {status === "complete" && result && (
          <Alert className="mb-8 border-2 border-accent/50 bg-gradient-to-r from-accent/10 to-primary/10 shadow-lg">
            <CheckCircle2 className="h-5 w-5 text-accent" />
            <AlertDescription className="text-base">
              <span className="font-bold text-accent">✓ Success!</span> Downloaded PDF with{" "}
              <span className="font-semibold">{result.images.length}</span> image
              {result.images.length !== 1 ? "s" : ""} from{" "}
              <span className="font-bold text-accent">{result.metadata.platform}</span>.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert - Enhanced */}
        {(status === "error" || status === "stopped") && error && errorInfo && (
          <Alert className="mb-8 border-2 border-destructive/50 bg-gradient-to-r from-destructive/10 to-red-900/5 shadow-lg">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <AlertDescription className="text-sm space-y-1">
                <div className="font-bold text-destructive">{errorInfo.title}</div>
                <div className="text-foreground">{error.message || errorInfo.description}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {error.code === "PRIVATE_POST" && "💡 Tip: Make sure the post/account is public"}
                  {error.code === "DELETED_POST" && "💡 Tip: Check if the URL is correct"}
                  {error.code === "NO_IMAGES" && "💡 Tip: Posts without images cannot be converted"}
                  {error.code === "RATE_LIMITED" && "💡 Tip: Wait a few moments before trying again"}
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Results Preview */}
        {result && result.images.length > 0 && (
          <Card className="p-8 mb-8 shadow-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-accent" />
              Extracted Images ({result.images.length})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {result.images.slice(0, 8).map((img, idx) => (
                <div
                  key={idx}
                  className="aspect-square bg-secondary rounded-lg overflow-hidden border-2 border-border hover:border-accent transition-all hover:shadow-lg group"
                >
                  <img
                    src={img.url || "/placeholder.svg"}
                    alt={img.alt || `Image ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              ))}
            </div>

            {/* Metadata */}
            {result.metadata && (
              <div className="border-t border-border pt-6 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground font-medium">Platform</p>
                    <p className="text-accent font-bold text-base">{result.metadata.platform}</p>
                  </div>
                  {result.metadata.author && (
                    <div>
                      <p className="text-muted-foreground font-medium">Author</p>
                      <p className="font-semibold truncate">@{result.metadata.author}</p>
                    </div>
                  )}
                </div>
                {result.metadata.caption && (
                  <div>
                    <p className="text-muted-foreground font-medium mb-2">Caption</p>
                    <p className="text-foreground line-clamp-2">{result.metadata.caption}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Features */}
        <div className="grid sm:grid-cols-3 gap-6 mt-16">
          {[
            { icon: "⚡", title: "Lightning Fast", desc: "Get your PDF in seconds" },
            { icon: "🔒", title: "Secure", desc: "Your data is never stored" },
            { icon: "🎯", title: "Simple", desc: "One link, one click, done" },
          ].map((f, i) => (
            <Card key={i} className="p-6 text-center hover:border-accent/50 transition-colors group">
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{f.icon}</div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}
